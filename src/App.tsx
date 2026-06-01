/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo } from 'react';
import { 
  Coffee, 
  Users, 
  CheckCircle2, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  Receipt, 
  History as HistoryIcon, 
  LayoutGrid,
  ChevronRight,
  ShoppingCart,
  Settings,
  PlusCircle,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  ArrowLeft,
  Send,
  StickyNote,
  AlertCircle,
  QrCode,
  Download,
  LogOut,
  Search,
  ImagePlus,
  Pencil,
  Save,
  Package,
  BarChart3,
  Printer,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';
import { QRCodeSVG } from 'qrcode.react';
import { Routes, Route, useParams, useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  collection, 
  getDocs, 
  writeBatch,
  getDocFromServer,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Table, TableStatus, MenuItem, OrderItem, PaymentRecord } from './types';
import { menuData } from './data/menuData';
import { LazyImage } from './components/LazyImage';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { logout } from './services/authService';

const INITIAL_TABLES: Table[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  status: 'Empty',
  currentOrder: [],
  totalItems: 0,
  totalPrice: 0
}));


const MENU_CATEGORIES = [
  'All',
  'Coffee',
  'Trà',
  'Sữa chua',
  'Trà sữa',
  'Soda',
  'Nước ép',
  'Kem – chè',
  'Hạt'
];

const MENU_STORAGE_KEY = 'qcafe-menu-items';
const MENU_COLLECTION = 'menuItems';
const INVENTORY_STORAGE_KEY = 'qcafe-inventory-items';
const INVENTORY_COLLECTION = 'inventoryItems';

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  updatedAt?: number;
};

const normalizeInventoryItem = (item: Partial<InventoryItem>, fallbackId?: string): InventoryItem => ({
  id: String(item.id || fallbackId || `inv-${Date.now()}`),
  name: String(item.name || '').trim(),
  unit: String(item.unit || 'ly').trim(),
  stock: Number(item.stock || 0),
  minStock: Number(item.minStock || 0),
  updatedAt: Number(item.updatedAt || Date.now())
});

const getStoredInventory = () => {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item, index) => normalizeInventoryItem(item, `local-inv-${index}`)).filter(item => item.name);
  } catch (err) {
    console.error('Error loading inventory from localStorage:', err);
    return null;
  }
};

const storeInventoryLocally = (items: InventoryItem[]) => {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
};

const normalizeMenuItem = (item: Partial<MenuItem>, fallbackId?: string): MenuItem => ({
  id: String(item.id || fallbackId || `menu-${Date.now()}`),
  name: String(item.name || '').trim(),
  price: Number(item.price || 0),
  category: String(item.category || 'Coffee').trim(),
  image: String(item.image || '/images/placeholder.png').trim() || '/images/placeholder.png'
});

const getStoredMenu = () => {
  try {
    const savedMenu = localStorage.getItem(MENU_STORAGE_KEY) || localStorage.getItem('menu');
    if (!savedMenu) return null;
    const parsedMenu = JSON.parse(savedMenu);
    if (!Array.isArray(parsedMenu)) return null;
    return parsedMenu
      .map((item, index) => normalizeMenuItem(item, `local-${index}`))
      .filter(item => item.name && item.price > 0);
  } catch (err) {
    console.error('Error loading menu from localStorage:', err);
    return null;
  }
};

const storeMenuLocally = (items: MenuItem[]) => {
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem('menu', JSON.stringify(items));
};

const resizeImageToDataUrl = (file: File, maxSize = 900, quality = 0.78): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn file ảnh hợp lệ.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không xử lý được ảnh này.'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};

const MenuForm: React.FC<{
  item: MenuItem | null;
  onSave: (item: Omit<MenuItem, 'id'>) => void | Promise<void>;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
  const [name, setName] = useState(item?.name || '');
  const [price, setPrice] = useState(item?.price ? String(item.price) : '');
  const [category, setCategory] = useState(item?.category || 'Coffee');
  const [image, setImage] = useState(item?.image || '');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingImage, setIsReadingImage] = useState(false);

  useEffect(() => {
    setName(item?.name || '');
    setPrice(item?.price ? String(item.price) : '');
    setCategory(item?.category || 'Coffee');
    setImage(item?.image || '');
    setFormError('');
  }, [item]);

  const handleImageFile = async (file?: File) => {
    if (!file) return;
    try {
      setIsReadingImage(true);
      setFormError('');
      const dataUrl = await resizeImageToDataUrl(file);
      setImage(dataUrl);
    } catch (err: any) {
      setFormError(err?.message || 'Không thể tải ảnh.');
    } finally {
      setIsReadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = name.trim();
    const normalizedPrice = Number(price);
    const normalizedCategory = category.trim();

    if (!normalizedName) {
      setFormError('Vui lòng nhập tên món.');
      return;
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setFormError('Giá món phải lớn hơn 0.');
      return;
    }
    if (!normalizedCategory) {
      setFormError('Vui lòng chọn danh mục.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError('');
      await onSave({
        name: normalizedName,
        price: Math.round(normalizedPrice),
        category: normalizedCategory,
        image: image.trim() || '/images/placeholder.png'
      });
    } catch (err: any) {
      setFormError(err?.message || 'Không lưu được món. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-5 items-start">
        <div>
          <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shadow-inner">
            <LazyImage src={image || '/images/placeholder.png'} alt={name || 'Ảnh món'} className="w-full h-full object-cover" />
          </div>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 transition-all">
            {isReadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            Chọn ảnh
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">Tên món</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bạc xỉu đá"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">Giá bán</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="1000"
                step="1000"
                placeholder="18000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">Danh mục</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              >
                {MENU_CATEGORIES.filter(cat => cat !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">Ảnh URL hoặc ảnh đã chọn</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="/images/example.jpg hoặc dán link ảnh"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            <p className="mt-2 text-xs font-semibold text-slate-400">Có thể dán link ảnh hoặc bấm “Chọn ảnh” để lấy ảnh từ máy.</p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm font-bold text-rose-600">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          {formError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="sm:flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSaving || isReadingImage}
          className="sm:flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-xl shadow-emerald-100"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {item ? 'Lưu thay đổi' : 'Thêm món'}
        </button>
      </div>
    </form>
  );
};

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Check if current route is customer route (QR ordering)
  const isCustomerRoute = location.pathname.match(/^\/order\/\d+/) || location.pathname.match(/^\/qr\/\d+/);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-emerald-600 animate-spin" />
          <p className="font-bold text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Customer route: không cần login
  if (isCustomerRoute) {
    return (
      <Routes>
        <Route path="/order/:tableId" element={<CustomerOrderPage />} />
        <Route path="/qr/:tableId" element={<CustomerOrderPage />} />
      </Routes>
    );
  }

  // Admin route: cần login
  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/dashboard" element={<AppContent />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const TableCard: React.FC<{ 
  table: Table, 
  onSelect: (id: number) => void,
  getStatusColor: (status: TableStatus) => string,
  getStatusText: (status: TableStatus) => string
}> = ({ table, onSelect, getStatusColor, getStatusText }) => {
  return (
    <button
      onClick={() => onSelect(table.id)}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col items-center gap-4 transition-all hover:shadow-md relative overflow-hidden group"
    >
      <div className={`absolute top-0 left-0 w-full h-1.5 ${getStatusColor(table.status)}`} />
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${getStatusColor(table.status)} shadow-lg`}>
        <Users size={24} />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-lg text-slate-800">Bàn {table.id}</h3>
        <p className={`text-xs font-semibold uppercase tracking-wider mt-1 ${
          table.status === 'Empty' ? 'text-emerald-600' : 
          table.status === 'Occupied' || table.status === 'Serving' || table.status === 'Unpaid' ? 'text-rose-600' : 'text-slate-500'
        }`}>
          {getStatusText(table.status)}
        </p>
      </div>
      <div className="mt-2 w-full pt-3 border-t border-slate-50 flex justify-center items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {table.totalItems || 0} món đã chọn
        </span>
      </div>
    </button>
  );
}

const AppUserSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setIsLogoutLoading(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      setIsLogoutLoading(false);
    }
  };

  return (
    <div className="mt-auto border-t border-white/10 px-3 py-4 text-white/90 lg:px-4 lg:py-5">
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="h-11 w-11 rounded-full border-2 border-white/20 object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white">
            {(user?.displayName || 'U').slice(0, 1)}
          </div>
        )}
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-sm font-black text-white">
            {user?.displayName || 'Người dùng'}
          </p>
          <p className="truncate text-xs text-emerald-50/70">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        disabled={isLogoutLoading}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <LogOut size={20} />
        <span className="hidden text-sm font-black lg:block">Đăng xuất</span>
      </button>
    </div>
  );
};

function AppContent() {
  const [tables, setTables] = useState<Table[]>([]);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>(menuData);
  const [inventory, setInventory] = useState<InventoryItem[]>(getStoredInventory() || []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'tables' | 'history' | 'menu' | 'payment' | 'inventory' | 'stats' | 'qr'>('tables');
  const [menuActiveCategory, setMenuActiveCategory] = useState<string>('All');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedPaymentTableId, setSelectedPaymentTableId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableAreaFilter, setTableAreaFilter] = useState<'all' | 'Khu A' | 'Khu B'>('all');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'empty' | 'serving' | 'unpaid'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showOrderMobile, setShowOrderMobile] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const tablesRef = useRef<Table[]>([]);

  // States for menu CRUD
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // States for inventory CRUD
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryForm, setInventoryForm] = useState({ id: '', name: '', unit: 'ly', stock: '', minStock: '' });

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // Realtime menu: Firestore is the source of truth, localStorage is a safe fallback.
  useEffect(() => {
    const localMenu = getStoredMenu();
    if (localMenu?.length) {
      setMenu(localMenu);
    }

    const menuRef = collection(db, MENU_COLLECTION);
    const unsubscribe = onSnapshot(menuRef, async (snapshot) => {
      if (snapshot.empty) {
        const seedMenu = localMenu?.length ? localMenu : menuData;
        setMenu(seedMenu);
        storeMenuLocally(seedMenu);

        // Seed default menu once, so admin and QR customer pages share the same data.
        try {
          const batch = writeBatch(db);
          seedMenu.forEach(item => {
            batch.set(doc(db, MENU_COLLECTION, item.id), normalizeMenuItem(item));
          });
          await batch.commit();
        } catch (err) {
          console.warn('Không thể khởi tạo menu lên Firestore, dùng dữ liệu cục bộ:', err);
        }
        return;
      }

      const firestoreMenu = snapshot.docs
        .map(menuDoc => normalizeMenuItem({ id: menuDoc.id, ...menuDoc.data() }))
        .filter(item => item.name && item.price > 0)
        .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'vi') || a.name.localeCompare(b.name, 'vi'));

      setMenu(firestoreMenu);
      storeMenuLocally(firestoreMenu);
    }, (err) => {
      console.error('Lỗi đồng bộ menu:', err);
      const fallbackMenu = getStoredMenu();
      if (fallbackMenu?.length) {
        setMenu(fallbackMenu);
        showToast('Đang dùng menu cục bộ vì chưa kết nối được Firebase', 'warning');
      }
    });

    return () => unsubscribe();
  }, []);

  // Realtime inventory: every menu item can have a matching stock row.
  useEffect(() => {
    const localInventory = getStoredInventory();
    if (localInventory?.length) {
      setInventory(localInventory);
    }

    const unsubscribe = onSnapshot(collection(db, INVENTORY_COLLECTION), async (snapshot) => {
      if (snapshot.empty) {
        const seedInventory = (localInventory?.length ? localInventory : menuData.map(item => ({
          id: item.id,
          name: item.name,
          unit: 'ly',
          stock: 100,
          minStock: 10,
          updatedAt: Date.now()
        }))).map(item => normalizeInventoryItem(item));

        setInventory(seedInventory);
        storeInventoryLocally(seedInventory);

        try {
          const batch = writeBatch(db);
          seedInventory.forEach(item => batch.set(doc(db, INVENTORY_COLLECTION, item.id), item));
          await batch.commit();
        } catch (err) {
          console.warn('Không thể khởi tạo kho lên Firestore, dùng dữ liệu cục bộ:', err);
        }
        return;
      }

      const firestoreInventory = snapshot.docs
        .map(inventoryDoc => normalizeInventoryItem({ id: inventoryDoc.id, ...inventoryDoc.data() }))
        .filter(item => item.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

      setInventory(firestoreInventory);
      storeInventoryLocally(firestoreInventory);
    }, (err) => {
      console.error('Lỗi đồng bộ kho:', err);
      const fallbackInventory = getStoredInventory();
      if (fallbackInventory?.length) {
        setInventory(fallbackInventory);
        showToast('Đang dùng dữ liệu kho cục bộ vì chưa kết nối được Firebase', 'warning');
      }
    });

    return () => unsubscribe();
  }, []);

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        console.log("Testing Firestore connection...");
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful!");
      } catch (error) {
        console.error("Firestore connection test failed:", error);
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Không thể kết nối với Firebase. Vui lòng kiểm tra cấu hình.");
        } else {
          // Even if it's not "offline", we might want to know
          setError(`Lỗi kết nối Firebase: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    testConnection();
  }, []);

  // Initialize tables in Firestore if they don't exist
  useEffect(() => {
    const initTables = async () => {
      try {
        const tablesSnap = await getDocs(collection(db, 'tables'));
        if (tablesSnap.empty) {
          const batch = writeBatch(db);
          INITIAL_TABLES.forEach(table => {
            const tableRef = doc(db, 'tables', table.id.toString());
            batch.set(tableRef, table);
          });
          await batch.commit();
        }
      } catch (err) {
        console.error("Error initializing tables:", err);
      }
    };
    initTables();
  }, []);

  // Real-time listener for tables
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const updatedTables = snapshot.docs.map(doc => doc.data() as Table);
      setTables(updatedTables.sort((a, b) => a.id - b.id));
      setIsLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Lỗi đồng bộ dữ liệu: " + err.message);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for orders of the selected table (or payment table)
  useEffect(() => {
    const tableId = selectedTableId || selectedPaymentTableId;
    if (!tableId) {
      setActiveOrders([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, `tables/${tableId}/orders`), orderBy('createdAt', 'asc')),
      (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setActiveOrders(orders);
      },
      (err) => {
        console.error("Error listening to orders:", err);
      }
    );

    return () => unsubscribe();
  }, [selectedTableId, selectedPaymentTableId]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Real-time listener for ALL tables' orders to update status, totalItems, and totalPrice
  useEffect(() => {
    if (tables.length === 0) return;

    const unsubscribes = tables.map(table => {
      const tableRef = doc(db, 'tables', table.id.toString());
      return onSnapshot(
        collection(db, `tables/${table.id}/orders`),
        (snapshot) => {
          const currentTable = tablesRef.current.find(t => t.id === table.id);
          if (!currentTable) return;

          let total = 0;
          let totalPrice = 0;
          
          snapshot.docs.forEach(doc => {
            const orderData = doc.data();
            if (orderData.items) {
              orderData.items.forEach((item: any) => {
                total += item.quantity || 0;
                totalPrice += (item.price * item.quantity) || 0;
              });
            }
          });
          
          currentTable.currentOrder.forEach(item => {
            total += item.quantity || 0;
            totalPrice += (item.price * item.quantity) || 0;
          });

          const hasOrders = total > 0;
          const newStatus: TableStatus = hasOrders ? 'Occupied' : 'Empty';

          if (currentTable.status !== newStatus || currentTable.totalItems !== total || currentTable.totalPrice !== totalPrice) {
            updateDoc(tableRef, { 
              status: newStatus,
              totalItems: total,
              totalPrice: totalPrice
            });
          }
        }
      );
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [tables.length]);

  const updateTableInFirestore = async (tableId: number, updates: Partial<Table>) => {
    try {
      const tableRef = doc(db, 'tables', tableId.toString());
      await updateDoc(tableRef, updates);
    } catch (err) {
      console.error("Error updating table:", err);
      showToast("Lỗi cập nhật bàn", "error");
    }
  };

  const saveHistory = (newHistory: PaymentRecord[]) => {
    setHistory(newHistory);
    localStorage.setItem('history', JSON.stringify(newHistory));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    const itemId = editingItem?.id || `menu-${Date.now()}`;
    const nextItem = normalizeMenuItem({ ...item, id: itemId });

    if (!nextItem.name || nextItem.price <= 0) {
      throw new Error('Thông tin món chưa hợp lệ.');
    }

    const nextMenu = editingItem
      ? menu.map(menuItem => menuItem.id === itemId ? nextItem : menuItem)
      : [...menu, nextItem];

    setMenu(nextMenu);
    storeMenuLocally(nextMenu);

    try {
      await setDoc(doc(db, MENU_COLLECTION, itemId), nextItem);
      showToast(editingItem ? 'Đã cập nhật món thành công' : 'Đã thêm món thành công', 'success');
    } catch (err) {
      console.error('Lỗi lưu món lên Firestore:', err);
      showToast('Đã lưu tạm trên máy này, Firebase chưa đồng bộ được', 'warning');
    }

    setIsMenuModalOpen(false);
    setEditingItem(null);
  };

  const deleteMenuItem = async (item: MenuItem) => {
    const shouldDelete = window.confirm(`Xóa món "${item.name}"? Thao tác này sẽ xóa khỏi menu khách QR và admin.`);
    if (!shouldDelete) return;

    const nextMenu = menu.filter(menuItem => menuItem.id !== item.id);
    setMenu(nextMenu);
    storeMenuLocally(nextMenu);

    try {
      await deleteDoc(doc(db, MENU_COLLECTION, item.id));
      showToast('Đã xóa món thành công', 'success');
    } catch (err) {
      console.error('Lỗi xóa món trên Firestore:', err);
      showToast('Đã xóa tạm trên máy này, Firebase chưa đồng bộ được', 'warning');
    }
  };

  const resetInventoryForm = () => {
    setInventoryForm({ id: '', name: '', unit: 'ly', stock: '', minStock: '' });
  };

  const saveInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const stock = Number(inventoryForm.stock);
    const minStock = Number(inventoryForm.minStock);
    const name = inventoryForm.name.trim();
    const unit = inventoryForm.unit.trim() || 'ly';

    if (!name) {
      showToast('Vui lòng nhập tên hàng trong kho', 'error');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0) {
      showToast('Số lượng tồn và tồn tối thiểu phải hợp lệ', 'error');
      return;
    }

    const itemId = inventoryForm.id || `inv-${Date.now()}`;
    const nextItem = normalizeInventoryItem({ id: itemId, name, unit, stock, minStock, updatedAt: Date.now() });
    const nextInventory = inventory.some(item => item.id === itemId)
      ? inventory.map(item => item.id === itemId ? nextItem : item)
      : [...inventory, nextItem];

    setInventory(nextInventory);
    storeInventoryLocally(nextInventory);

    try {
      await setDoc(doc(db, INVENTORY_COLLECTION, itemId), nextItem);
      showToast(inventoryForm.id ? 'Đã cập nhật hàng trong kho' : 'Đã thêm hàng vào kho', 'success');
    } catch (err) {
      console.error('Lỗi lưu kho:', err);
      showToast('Đã lưu kho tạm trên máy này, Firebase chưa đồng bộ được', 'warning');
    }
    resetInventoryForm();
  };

  const editInventoryItem = (item: InventoryItem) => {
    setInventoryForm({
      id: item.id,
      name: item.name,
      unit: item.unit,
      stock: String(item.stock),
      minStock: String(item.minStock)
    });
  };

  const deleteInventoryItem = async (item: InventoryItem) => {
    if (!window.confirm(`Xóa hàng kho "${item.name}"?`)) return;
    const nextInventory = inventory.filter(inventoryItem => inventoryItem.id !== item.id);
    setInventory(nextInventory);
    storeInventoryLocally(nextInventory);
    try {
      await deleteDoc(doc(db, INVENTORY_COLLECTION, item.id));
      showToast('Đã xóa hàng khỏi kho', 'success');
    } catch (err) {
      console.error('Lỗi xóa kho:', err);
      showToast('Đã xóa tạm trên máy này, Firebase chưa đồng bộ được', 'warning');
    }
  };

  const adjustInventory = async (item: InventoryItem, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const nextStock = Math.max(0, item.stock + delta);
    const nextItem = { ...item, stock: nextStock, updatedAt: Date.now() };
    const nextInventory = inventory.map(inventoryItem => inventoryItem.id === item.id ? nextItem : inventoryItem);
    setInventory(nextInventory);
    storeInventoryLocally(nextInventory);
    try {
      await setDoc(doc(db, INVENTORY_COLLECTION, item.id), nextItem);
      showToast(delta > 0 ? 'Đã nhập kho' : 'Đã xuất kho', 'success');
    } catch (err) {
      console.error('Lỗi cập nhật tồn kho:', err);
      showToast('Đã cập nhật tạm trên máy này, Firebase chưa đồng bộ được', 'warning');
    }
  };

  const deductInventoryAfterCheckout = async (items: OrderItem[]) => {
    if (items.length === 0) return;
    const soldByItemId = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.itemId] = (acc[item.itemId] || 0) + item.quantity;
      return acc;
    }, {});

    const nextInventory = inventory.map(stockItem => {
      const soldQty = soldByItemId[stockItem.id] || 0;
      if (soldQty <= 0) return stockItem;
      return {
        ...stockItem,
        stock: Math.max(0, stockItem.stock - soldQty),
        updatedAt: Date.now()
      };
    });

    setInventory(nextInventory);
    storeInventoryLocally(nextInventory);

    try {
      const batch = writeBatch(db);
      nextInventory.forEach(stockItem => {
        if ((soldByItemId[stockItem.id] || 0) > 0) {
          batch.set(doc(db, INVENTORY_COLLECTION, stockItem.id), stockItem);
        }
      });
      await batch.commit();
    } catch (err) {
      console.error('Lỗi trừ kho sau thanh toán:', err);
      showToast('Đã thanh toán, nhưng kho chỉ cập nhật tạm trên máy này', 'warning');
    }
  };

  const printInvoice = (record?: PaymentRecord) => {
    const tableId = record?.tableId || selectedPaymentTableId;
    const items = record?.items || mergedBillItems;
    const total = record?.total ?? calculateTotal();
    if (!tableId || items.length === 0) {
      showToast('Không có hóa đơn để in', 'error');
      return;
    }

    const rows = items.map(item => `
      <tr>
        <td>${item.name}${item.note ? `<br/><small>${item.note}</small>` : ''}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.price)}</td>
        <td style="text-align:right">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn bàn ${tableId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1, h2, p { margin: 0; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px dashed #cbd5e1; padding: 10px 4px; font-size: 13px; vertical-align: top; }
            th { text-align: left; color: #64748b; text-transform: uppercase; font-size: 11px; }
            .total { display: flex; justify-content: space-between; margin-top: 18px; font-size: 20px; font-weight: 800; }
            .muted { color: #64748b; font-size: 12px; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="center">
            <h1>Coffee King’s</h1>
            <p class="muted">Hóa đơn thanh toán</p>
            <h2>Bàn ${tableId}</h2>
            <p class="muted">${new Date(record?.timestamp || Date.now()).toLocaleString('vi-VN')}</p>
          </div>
          <table>
            <thead><tr><th>Món</th><th>SL</th><th>Giá</th><th>Tiền</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total"><span>Tổng cộng</span><span>${formatCurrency(total)}</span></div>
          <p class="center muted" style="margin-top:24px">Cảm ơn quý khách!</p>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stats = useMemo(() => {
    const today = new Date();
    const isSameDay = (time: number) => {
      const d = new Date(time);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };
    const todayRecords = history.filter(record => isSameDay(record.timestamp));
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    history.forEach(record => {
      record.items.forEach(item => {
        if (!itemMap[item.itemId]) itemMap[item.itemId] = { name: item.name, quantity: 0, revenue: 0 };
        itemMap[item.itemId].quantity += item.quantity;
        itemMap[item.itemId].revenue += item.quantity * item.price;
      });
    });
    return {
      totalRevenue: history.reduce((sum, record) => sum + record.total, 0),
      todayRevenue: todayRecords.reduce((sum, record) => sum + record.total, 0),
      totalOrders: history.length,
      todayOrders: todayRecords.length,
      topItems: Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      lowStock: inventory.filter(item => item.stock <= item.minStock)
    };
  }, [history, inventory]);

  const downloadQRCode = (tableId: number) => {
    const svgElement = document.getElementById(`qr-code-${tableId}`);
    if (!svgElement) {
      showToast('Không tìm thấy mã QR', 'error');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    // Set higher resolution for better quality
    const scale = 5;
    const size = 200 * scale;
    
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QR_Ban_${tableId}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        showToast('Đã tải mã QR!', 'success');
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'Empty': return 'bg-emerald-500';
      case 'Serving': return 'bg-amber-500';
      case 'Occupied': return 'bg-amber-500';
      case 'Unpaid': return 'bg-rose-500';
      case 'Paid': return 'bg-slate-400';
      default: return 'bg-slate-200';
    }
  };

  const getStatusText = (status: TableStatus) => {
    switch (status) {
      case 'Empty': return 'Trống';
      case 'Serving': return 'Phục vụ';
      case 'Occupied': return 'Có khách';
      case 'Unpaid': return 'Chờ thanh toán';
      case 'Paid': return 'Đã thanh toán';
    }
  };

  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menu, searchQuery, selectedCategory]);

  const getTableAreaLabel = (tableId: number) => (tableId <= Math.ceil(INITIAL_TABLES.length / 2) ? 'Khu A' : 'Khu B');

  const getDashboardStatus = (table: Table): 'empty' | 'serving' | 'unpaid' => {
    if (table.status === 'Empty' || ((table.totalItems || 0) === 0 && table.currentOrder.length === 0)) return 'empty';
    if (table.status === 'Unpaid') return 'unpaid';
    return 'serving';
  };

  const getDashboardStatusText = (status: 'empty' | 'serving' | 'unpaid') => {
    switch (status) {
      case 'empty':
        return 'Trống';
      case 'serving':
        return 'Đang phục vụ';
      case 'unpaid':
        return 'Chờ thanh toán';
    }
  };

  const getDashboardStatusBadgeClasses = (status: 'empty' | 'serving' | 'unpaid') => {
    switch (status) {
      case 'empty':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'serving':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'unpaid':
        return 'bg-rose-50 text-rose-600 border border-rose-100';
    }
  };

  const tableDashboardStats = useMemo(() => {
    const total = tables.length;
    const empty = tables.filter(table => getDashboardStatus(table) === 'empty').length;
    const unpaid = tables.filter(table => getDashboardStatus(table) === 'unpaid').length;
    const serving = total - empty - unpaid;
    return { total, empty, unpaid, serving };
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      const matchesSearch = !tableSearchQuery.trim() || `bàn ${table.id}`.toLowerCase().includes(tableSearchQuery.trim().toLowerCase());
      const matchesArea = tableAreaFilter === 'all' || getTableAreaLabel(table.id) === tableAreaFilter;
      const matchesStatus = tableStatusFilter === 'all' || getDashboardStatus(table) === tableStatusFilter;
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [tables, tableSearchQuery, tableAreaFilter, tableStatusFilter]);

  const addToOrder = (tableId: number, item: MenuItem) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const existing = table.currentOrder.find(oi => oi.itemId === item.id && !oi.note);
    let newOrder;
    if (existing) {
      newOrder = table.currentOrder.map(oi => 
        (oi.itemId === item.id && !oi.note) ? { ...oi, quantity: oi.quantity + 1 } : oi
      );
    } else {
      newOrder = [...table.currentOrder, { itemId: item.id, name: item.name, quantity: 1, price: item.price, note: '' }];
    }

    // Calculate new totals immediately for UI feedback
    const newTotalItems = (table.totalItems || 0) + 1;
    const newTotalPrice = (table.totalPrice || 0) + item.price;

    updateTableInFirestore(tableId, { 
      currentOrder: newOrder, 
      status: 'Occupied',
      totalItems: newTotalItems,
      totalPrice: newTotalPrice
    });
  };

  const updateQuantity = (tableId: number, itemId: string, delta: number, note?: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const itemToUpdate = table.currentOrder.find(oi => oi.itemId === itemId && oi.note === note);
    if (!itemToUpdate) return;

    const actualDelta = Math.max(-itemToUpdate.quantity, delta);
    if (actualDelta === 0 && delta !== 0) return;

    const newOrder = table.currentOrder.map(oi => 
      (oi.itemId === itemId && oi.note === note) ? { ...oi, quantity: oi.quantity + actualDelta } : oi
    ).filter(oi => oi.quantity > 0);

    // Calculate new totals immediately for UI feedback
    const newTotalItems = Math.max(0, (table.totalItems || 0) + actualDelta);
    const newTotalPrice = Math.max(0, (table.totalPrice || 0) + (itemToUpdate.price * actualDelta));

    updateTableInFirestore(tableId, { 
      currentOrder: newOrder, 
      status: newTotalItems === 0 ? 'Empty' : table.status,
      totalItems: newTotalItems,
      totalPrice: newTotalPrice
    });
  };

  const combinedOrders = useMemo(() => {
    const tableId = selectedTableId || selectedPaymentTableId;
    const table = tables.find(t => t.id === tableId);
    if (!table) return [];
    
    const staffOrder = table.currentOrder.length > 0 ? [{
      id: 'staff',
      items: table.currentOrder,
      source: 'POS Staff'
    }] : [];
    
    const customerOrders = activeOrders.map((order, idx) => ({
      ...order,
      source: `Khách gọi #${idx + 1}`
    }));
    
    return [...staffOrder, ...customerOrders];
  }, [tables, selectedTableId, selectedPaymentTableId, activeOrders]);

  const mergedBillItems = useMemo(() => {
    const allItems = combinedOrders.flatMap(o => o.items || []);
    const merged: { [key: string]: any } = {};
    
    allItems.forEach(item => {
      const key = item.itemId;
      if (merged[key]) {
        merged[key].quantity += item.quantity;
        if (item.note && merged[key].note !== item.note) {
          merged[key].note = merged[key].note ? `${merged[key].note}; ${item.note}` : item.note;
        }
      } else {
        merged[key] = { ...item };
      }
    });
    
    return Object.values(merged);
  }, [combinedOrders]);

  const calculateTotal = () => {
    return mergedBillItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const handleCheckout = async (tableId: number) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (mergedBillItems.length === 0) return;

    const total = calculateTotal();
    const record: PaymentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      tableId,
      items: mergedBillItems,
      total,
      timestamp: Date.now()
    };

    await deductInventoryAfterCheckout(mergedBillItems);
    saveHistory([record, ...history]);
    
    // Clear both sources
    try {
      const tableRef = doc(db, 'tables', tableId.toString());
      await updateDoc(tableRef, { 
        currentOrder: [], 
        status: 'Empty',
        totalItems: 0,
        totalPrice: 0
      });

      const ordersSnap = await getDocs(collection(db, `tables/${tableId}/orders`));
      const batch = writeBatch(db);
      ordersSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Update local state immediately
      setTables(prev => prev.map(t => 
        t.id === tableId 
          ? { ...t, status: 'Empty', currentOrder: [], totalItems: 0, totalPrice: 0 }
          : t
      ));
    } catch (err) {
      console.error("Error clearing orders after checkout:", err);
    }

    setSelectedPaymentTableId(null);
    showToast("Thanh toán thành công");
  };

  const clearTableOrders = async (tableId: number) => {
    try {
      const tableRef = doc(db, 'tables', tableId.toString());
      await updateDoc(tableRef, { 
        currentOrder: [], 
        status: 'Empty',
        totalItems: 0,
        totalPrice: 0
      });

      const ordersSnap = await getDocs(collection(db, `tables/${tableId}/orders`));
      const batch = writeBatch(db);
      ordersSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      showToast("Đã xóa toàn bộ đơn hàng", "warning");
    } catch (err) {
      console.error("Error clearing orders:", err);
    }
  };

  const selectedTable = selectedTableId ? tables.find(t => t.id === selectedTableId) : null;
  const selectedTableTotalItems = combinedOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum: number, item: OrderItem) => itemSum + item.quantity, 0), 0);
  const selectedTableTotalLines = combinedOrders.reduce((sum, order) => sum + (order.items?.length || 0), 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="animate-spin text-emerald-600" />
            <p className="font-bold text-slate-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      <aside className="flex w-20 shrink-0 flex-col bg-gradient-to-b from-[#015c43] via-[#024737] to-[#032c2a] text-white lg:w-72">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6 lg:px-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white shadow-lg shadow-black/10 backdrop-blur-sm">
            <Coffee size={26} />
          </div>
          <h1 className="hidden text-2xl font-black tracking-tight lg:block">Coffee King’s</h1>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5 lg:px-4">
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'tables' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <LayoutGrid size={20} />
            <span className="hidden text-sm font-black lg:block">Sơ đồ bàn</span>
          </button>

          <button
            onClick={() => setActiveTab('payment')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'payment' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <Receipt size={20} />
            <span className="hidden text-sm font-black lg:block">Quản lý thanh toán</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'history' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <HistoryIcon size={20} />
            <span className="hidden text-sm font-black lg:block">Lịch sử</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'menu' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <Settings size={20} />
            <span className="hidden text-sm font-black lg:block">Quản lý menu</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'inventory' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <Package size={20} />
            <span className="hidden text-sm font-black lg:block">Quản lý kho</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'stats' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <BarChart3 size={20} />
            <span className="hidden text-sm font-black lg:block">Thống kê</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${activeTab === 'qr' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <QrCode size={20} />
            <span className="hidden text-sm font-black lg:block">Mã QR Gọi Món</span>
          </button>
        </nav>

        <AppUserSection />
      </aside>

      <main className="flex-1 overflow-hidden bg-slate-100">
        <div className="flex h-full flex-col overflow-hidden">
          {activeTab === 'tables' ? (
            <>
              <header className="shrink-0 border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur lg:px-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Quản lý bàn</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Theo dõi và quản lý trạng thái các bàn trong quán</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
                    <div className="relative min-w-[280px] xl:min-w-[320px]">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm bàn..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                      />
                    </div>
                    <select
                      value={tableAreaFilter}
                      onChange={(e) => setTableAreaFilter(e.target.value as 'all' | 'Khu A' | 'Khu B')}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                    >
                      <option value="all">Tất cả khu vực</option>
                      <option value="Khu A">Khu A</option>
                      <option value="Khu B">Khu B</option>
                    </select>
                    <select
                      value={tableStatusFilter}
                      onChange={(e) => setTableStatusFilter(e.target.value as 'all' | 'empty' | 'serving' | 'unpaid')}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="empty">Trống</option>
                      <option value="serving">Đang phục vụ</option>
                      <option value="unpaid">Chờ thanh toán</option>
                    </select>
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-emerald-600 transition hover:bg-emerald-50"
                      title="Làm mới"
                    >
                      <RefreshCw size={20} />
                    </button>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-5 lg:p-8">
                <div className="mx-auto max-w-[1480px] space-y-7">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                          <LayoutGrid size={32} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Tổng bàn</p>
                          <p className="text-4xl font-black text-slate-900">{tableDashboardStats.total}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">100% tổng số bàn</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500">
                          <Coffee size={32} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Đang phục vụ</p>
                          <p className="text-4xl font-black text-slate-900">{tableDashboardStats.serving}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{tableDashboardStats.total ? Math.round((tableDashboardStats.serving / tableDashboardStats.total) * 100) : 0}% tổng số bàn</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                          <CheckSquare size={32} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Trống</p>
                          <p className="text-4xl font-black text-slate-900">{tableDashboardStats.empty}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{tableDashboardStats.total ? Math.round((tableDashboardStats.empty / tableDashboardStats.total) * 100) : 0}% tổng số bàn</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-500">
                          <Receipt size={32} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Chờ thanh toán</p>
                          <p className="text-4xl font-black text-slate-900">{tableDashboardStats.unpaid}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{tableDashboardStats.total ? Math.round((tableDashboardStats.unpaid / tableDashboardStats.total) * 100) : 0}% tổng số bàn</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredTables.length === 0 ? (
                    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-300 bg-white text-center">
                      <Search size={44} className="mb-4 text-slate-300" />
                      <h3 className="text-xl font-black text-slate-700">Không tìm thấy bàn phù hợp</h3>
                      <p className="mt-2 text-sm text-slate-500">Hãy thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                      {filteredTables.map((table) => {
                        const dashboardStatus = getDashboardStatus(table);
                        const totalItems = table.totalItems || 0;
                        const totalPrice = table.totalPrice || 0;
                        return (
                          <button
                            key={table.id}
                            onClick={() => setSelectedTableId(table.id)}
                            className="group rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60"
                          >
                            <div className="mb-5 flex items-start justify-between gap-3">
                              <div className={`flex h-14 w-14 items-center justify-center rounded-3xl text-white shadow-lg ${getStatusColor(table.status)}`}>
                                <Users size={26} />
                              </div>
                              <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${getDashboardStatusBadgeClasses(dashboardStatus)}`}>
                                {getDashboardStatusText(dashboardStatus)}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-2xl font-black text-slate-900">Bàn {table.id}</h3>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{getTableAreaLabel(table.id)}</span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-slate-400">Nhấn để xem chi tiết và thao tác gọi món</p>
                            </div>
                            <div className="mt-5 border-t border-slate-100 pt-4">
                              <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-slate-500">
                                <div className="flex items-center gap-2">
                                  <Coffee size={16} className="text-slate-400" />
                                  <span>{totalItems} món</span>
                                </div>
                                <div className="flex items-center justify-end gap-2 text-right">
                                  <Receipt size={16} className="text-slate-400" />
                                  <span>{formatCurrency(totalPrice)}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
                <h2 className="text-xl font-bold text-slate-800">
                  {activeTab === 'payment' ? 'Quản lý thanh toán' : activeTab === 'history' ? 'Lịch sử thanh toán' : activeTab === 'menu' ? 'Quản lý menu' : activeTab === 'inventory' ? 'Quản lý kho' : activeTab === 'stats' ? 'Thống kê doanh thu' : 'Mã QR Gọi Món'}
                </h2>
              </header>

              <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'payment' ? (
                  <div className="mx-auto max-w-[1480px] space-y-7">
                    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 p-6 text-white shadow-2xl shadow-emerald-100 sm:p-8">
                      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                      <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
                      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] backdrop-blur">
                            <Receipt size={16} />
                            Thu ngân
                          </div>
                          <h3 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Quản lý thanh toán</h3>
                          <p className="mt-2 max-w-2xl text-sm font-semibold text-emerald-50/90 sm:text-base">
                            Theo dõi các bàn đang có món, kiểm tra tạm tính và mở hóa đơn để thanh toán nhanh.
                          </p>
                        </div>
                        <div className="grid min-w-0 grid-cols-2 gap-3 lg:min-w-[520px] lg:grid-cols-3">
                          <div className="rounded-3xl border border-white/10 bg-white/15 p-4 backdrop-blur">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-50/80">Bàn cần xử lý</p>
                            <p className="mt-1 text-3xl font-black">{tables.filter(t => (t.totalItems || 0) > 0).length}</p>
                          </div>
                          <div className="rounded-3xl border border-white/10 bg-white/15 p-4 backdrop-blur">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-50/80">Tổng món</p>
                            <p className="mt-1 text-3xl font-black">{tables.reduce((sum, t) => sum + (t.totalItems || 0), 0)}</p>
                          </div>
                          <div className="col-span-2 rounded-3xl border border-white/10 bg-white p-4 text-slate-900 shadow-xl lg:col-span-1">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tạm tính</p>
                            <p className="mt-1 text-2xl font-black text-emerald-600">{formatCurrency(tables.reduce((sum, t) => sum + (t.totalPrice || 0), 0))}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {tables.filter(t => (t.totalItems || 0) > 0).length === 0 ? (
                      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 text-center shadow-sm">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <Receipt size={42} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">Chưa có bàn cần thanh toán</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                          Khi khách hoặc nhân viên gọi món, bàn sẽ xuất hiện tại đây để thu ngân kiểm tra và thanh toán.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {tables.filter(t => (t.totalItems || 0) > 0).map(table => {
                          const isWaitingPayment = table.status === 'Unpaid';
                          return (
                            <button
                              key={table.id}
                              onClick={() => setSelectedPaymentTableId(table.id)}
                              className="group rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/70"
                            >
                              <div className="mb-5 flex items-start justify-between gap-3">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl text-white shadow-lg ${isWaitingPayment ? 'bg-rose-500 shadow-rose-100' : 'bg-amber-500 shadow-amber-100'}`}>
                                  <Users size={26} />
                                </div>
                                <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${isWaitingPayment ? 'border border-rose-100 bg-rose-50 text-rose-600' : 'border border-amber-100 bg-amber-50 text-amber-700'}`}>
                                  {isWaitingPayment ? 'Chờ thanh toán' : 'Có khách'}
                                </span>
                              </div>
                              <div className="flex items-end justify-between gap-4">
                                <div>
                                  <h4 className="text-2xl font-black text-slate-900">Bàn {table.id}</h4>
                                  <p className="mt-1 text-sm font-semibold text-slate-400">{table.totalItems || 0} món đã chọn</p>
                                </div>
                                <ChevronRight className="h-6 w-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600" />
                              </div>
                              <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tạm tính</span>
                                  <span className="text-2xl font-black text-slate-900">{formatCurrency(table.totalPrice || 0)}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : activeTab === 'history' ? (
                  <div className="mx-auto max-w-[1480px] space-y-7">
                    <div className="relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-8">
                      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />
                      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                            <HistoryIcon size={16} />
                            Nhật ký bán hàng
                          </div>
                          <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Lịch sử thanh toán</h3>
                          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 sm:text-base">
                            Lưu lại các hóa đơn đã thanh toán, hỗ trợ in lại hóa đơn và kiểm tra doanh thu nhanh.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:min-w-[520px] lg:grid-cols-3">
                          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Số hóa đơn</p>
                            <p className="mt-1 text-3xl font-black text-slate-900">{history.length}</p>
                          </div>
                          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng món</p>
                            <p className="mt-1 text-3xl font-black text-slate-900">{history.reduce((sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)}</p>
                          </div>
                          <div className="col-span-2 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 lg:col-span-1">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-700/70">Doanh thu</p>
                            <p className="mt-1 text-2xl font-black text-emerald-700">{formatCurrency(history.reduce((sum, record) => sum + record.total, 0))}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {history.length === 0 ? (
                      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 text-center shadow-sm">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                          <HistoryIcon size={42} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">Chưa có lịch sử thanh toán</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                          Sau khi thu ngân xác nhận thanh toán, hóa đơn sẽ được lưu tại đây để xem lại hoặc in lại.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {history.map(record => (
                          <div key={record.id} className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition-all hover:shadow-xl hover:shadow-slate-200/60">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex items-start gap-5">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-slate-100 text-2xl font-black text-slate-700">
                                  {record.tableId}
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-xl font-black text-slate-900">Bàn {record.tableId}</h3>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">Đã thanh toán</span>
                                    <span className="text-xs font-bold text-slate-400">{new Date(record.timestamp).toLocaleString('vi-VN')}</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {record.items.slice(0, 5).map((i, idx) => (
                                      <span key={idx} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-600">
                                        {i.name} x{i.quantity}
                                      </span>
                                    ))}
                                    {record.items.length > 5 && (
                                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500">+{record.items.length - 5} món</span>
                                    )}
                                  </div>
                                  <p className="mt-3 text-sm font-semibold text-slate-400">
                                    {record.items.reduce((sum, item) => sum + item.quantity, 0)} món trong hóa đơn
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-4 lg:min-w-[360px] lg:border-t-0 lg:pt-0">
                                <div className="text-left lg:text-right">
                                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tổng cộng</p>
                                  <p className="mt-1 text-2xl font-black text-emerald-600">{formatCurrency(record.total)}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => printInvoice(record)}
                                    className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 transition hover:bg-emerald-600 hover:text-white"
                                    title="In lại hóa đơn"
                                  >
                                    <Printer size={20} />
                                  </button>
                                  <button
                                    onClick={() => saveHistory(history.filter(h => h.id !== record.id))}
                                    className="rounded-2xl bg-rose-50 p-3 text-rose-500 transition hover:bg-rose-500 hover:text-white"
                                    title="Xóa lịch sử"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
          ) : activeTab === 'menu' ? (
            <div className="max-w-7xl mx-auto flex flex-col gap-5">
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 p-6 sm:p-8 text-white shadow-2xl shadow-emerald-100">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] backdrop-blur">
                      <ShoppingCart size={16} />
                      Menu realtime
                    </div>
                    <h3 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">Quản lý thực đơn</h3>
                    <p className="mt-2 max-w-2xl text-sm sm:text-base font-semibold text-emerald-50/90">
                      Thêm, sửa, xóa món tại đây. Menu được đồng bộ cho cả màn hình nhân viên và trang khách quét QR.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-0 lg:min-w-[420px]">
                    <div className="rounded-3xl bg-white/15 p-4 backdrop-blur border border-white/10">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-50/80">Tổng món</p>
                      <p className="mt-1 text-3xl font-black">{menu.length}</p>
                    </div>
                    <div className="rounded-3xl bg-white/15 p-4 backdrop-blur border border-white/10">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-50/80">Danh mục</p>
                      <p className="mt-1 text-3xl font-black">{MENU_CATEGORIES.length - 1}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setIsMenuModalOpen(true);
                      }}
                      className="col-span-2 sm:col-span-1 rounded-3xl bg-white px-5 py-4 text-emerald-700 font-black hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-xl"
                    >
                      <PlusCircle size={20} />
                      Thêm món
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[72vh]">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 lg:items-center justify-between bg-white">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên món..."
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold text-slate-700"
                    />
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
                    {MENU_CATEGORIES.map(cat => {
                      const count = cat === 'All' ? menu.length : menu.filter(m => m.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setMenuActiveCategory(cat)}
                          className={`shrink-0 px-4 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 ${
                            menuActiveCategory === cat
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white hover:border-emerald-200'
                          }`}
                        >
                          <span>{cat}</span>
                          <span className={`text-[11px] rounded-full px-2 py-0.5 ${menuActiveCategory === cat ? 'bg-white/20' : 'bg-white border border-slate-200'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 min-h-0 bg-slate-50/60">
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={
                      menu
                        .filter(m => menuActiveCategory === 'All' || m.category === menuActiveCategory)
                        .filter(m => m.name.toLowerCase().includes(menuSearchQuery.trim().toLowerCase()))
                    }
                    components={{
                      EmptyPlaceholder: () => (
                        <div className="h-full flex items-center justify-center p-10 text-center">
                          <div className="rounded-[2rem] bg-white border border-slate-100 p-8 shadow-sm max-w-sm">
                            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h4 className="text-lg font-black text-slate-700">Không tìm thấy món</h4>
                            <p className="mt-2 text-sm font-semibold text-slate-400">Thử đổi từ khóa hoặc chọn danh mục khác.</p>
                          </div>
                        </div>
                      )
                    }}
                    itemContent={(index, item) => (
                      <div className="p-3 sm:p-4">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-3 sm:p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-400">
                              {index + 1}
                            </div>
                            <div className="w-20 h-20 rounded-3xl overflow-hidden bg-slate-100 shrink-0 ring-1 ring-slate-100">
                              <LazyImage src={item.image || '/images/placeholder.png'} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-800 text-base sm:text-lg truncate">{item.name}</h4>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-100">{item.category}</span>
                                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-black rounded-full">ID: {item.id}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-4 md:w-[320px]">
                            <div className="text-left md:text-right">
                              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Giá bán</p>
                              <p className="text-xl font-black text-emerald-600">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsMenuModalOpen(true);
                                }}
                                className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                                title="Sửa món"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={() => deleteMenuItem(item)}
                                className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                                title="Xóa món"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'inventory' ? (
            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
              <form onSubmit={saveInventoryItem} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 h-fit space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">{inventoryForm.id ? 'Sửa hàng kho' : 'Thêm hàng kho'}</h3>
                    <p className="text-sm font-semibold text-slate-400">Nhập/xuất kho, cảnh báo tồn thấp</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">Tên hàng</label>
                  <input value={inventoryForm.name} onChange={e => setInventoryForm({...inventoryForm, name: e.target.value})} placeholder="Ví dụ: Bạc xỉu / Sữa đặc / Cà phê" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">Đơn vị</label>
                    <input value={inventoryForm.unit} onChange={e => setInventoryForm({...inventoryForm, unit: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">Tồn</label>
                    <input type="number" min="0" value={inventoryForm.stock} onChange={e => setInventoryForm({...inventoryForm, stock: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">Tối thiểu</label>
                    <input type="number" min="0" value={inventoryForm.minStock} onChange={e => setInventoryForm({...inventoryForm, minStock: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  {inventoryForm.id && <button type="button" onClick={resetInventoryForm} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black">Hủy</button>}
                  <button type="submit" className="flex-[2] py-3 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2"><Save size={18} /> Lưu kho</button>
                </div>
                <div className="rounded-3xl bg-amber-50 border border-amber-100 p-4 text-sm font-semibold text-amber-700">
                  Khi thanh toán, hệ thống tự trừ kho đúng theo số lượng món bán ra. Ví dụ bán 1 ly thì kho trừ 1, không bị trừ lặp.
                </div>
              </form>

              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 md:items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Danh sách tồn kho</h3>
                    <p className="text-sm font-semibold text-slate-400">{inventory.length} mặt hàng • {stats.lowStock.length} mặt hàng sắp hết</p>
                  </div>
                  <div className="relative md:w-80">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={inventorySearchQuery} onChange={e => setInventorySearchQuery(e.target.value)} placeholder="Tìm hàng kho..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold" />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {inventory
                    .filter(item => item.name.toLowerCase().includes(inventorySearchQuery.trim().toLowerCase()))
                    .map(item => (
                    <div key={item.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.stock <= item.minStock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          <Package size={22} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800">{item.name}</h4>
                          <p className="text-xs font-bold text-slate-400">Cập nhật: {new Date(item.updatedAt || Date.now()).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        <div className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-600 font-black">Tồn: {item.stock} {item.unit}</div>
                        <div className={`px-4 py-2 rounded-2xl font-black ${item.stock <= item.minStock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.stock <= item.minStock ? 'Sắp hết' : 'Ổn định'}</div>
                        <button onClick={() => adjustInventory(item, 1)} className="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 font-black flex items-center gap-1"><Plus size={16} /> Nhập 1</button>
                        <button onClick={() => adjustInventory(item, -1)} className="h-10 px-4 rounded-xl bg-amber-50 text-amber-700 font-black flex items-center gap-1"><Minus size={16} /> Xuất 1</button>
                        <button onClick={() => editInventoryItem(item)} className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><Pencil size={18} /></button>
                        <button onClick={() => deleteInventoryItem(item)} className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'stats' ? (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Doanh thu hôm nay</p><p className="mt-2 text-3xl font-black text-emerald-600">{formatCurrency(stats.todayRevenue)}</p></div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng doanh thu</p><p className="mt-2 text-3xl font-black text-slate-800">{formatCurrency(stats.totalRevenue)}</p></div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Hóa đơn hôm nay</p><p className="mt-2 text-3xl font-black text-slate-800">{stats.todayOrders}</p></div>
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-400">Sắp hết kho</p><p className="mt-2 text-3xl font-black text-rose-600">{stats.lowStock.length}</p></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5"><BarChart3 className="text-emerald-600" /><h3 className="text-xl font-black text-slate-800">Món bán chạy</h3></div>
                  {stats.topItems.length === 0 ? <p className="text-slate-400 font-semibold py-10 text-center">Chưa có dữ liệu bán hàng</p> : (
                    <div className="space-y-3">
                      {stats.topItems.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-xl bg-white text-slate-500 font-black flex items-center justify-center">{index + 1}</span><div><p className="font-black text-slate-800">{item.name}</p><p className="text-xs font-bold text-slate-400">Đã bán {item.quantity} món</p></div></div>
                          <p className="font-black text-emerald-600">{formatCurrency(item.revenue)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5"><AlertTriangle className="text-rose-500" /><h3 className="text-xl font-black text-slate-800">Cảnh báo kho</h3></div>
                  {stats.lowStock.length === 0 ? <p className="text-slate-400 font-semibold py-10 text-center">Kho đang ổn định</p> : (
                    <div className="space-y-3">
                      {stats.lowStock.map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-2xl bg-rose-50 border border-rose-100 p-4">
                          <div><p className="font-black text-rose-700">{item.name}</p><p className="text-xs font-bold text-rose-400">Tối thiểu: {item.minStock} {item.unit}</p></div>
                          <p className="font-black text-rose-700">Còn {item.stock} {item.unit}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tables.map(table => (
                <div key={table.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-6">
                  <h3 className="text-2xl font-black text-slate-800">BÀN {table.id}</h3>
                  <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-slate-50">
                    <QRCodeSVG 
                      id={`qr-code-${table.id}`}
                      value={`${window.location.origin}/order/${table.id}`}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-slate-400 text-sm font-medium text-center">Quét mã để gọi món trực tiếp tại bàn</p>
                  <div className="w-full flex flex-col gap-2">
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/order/${table.id}`;
                        navigator.clipboard.writeText(url);
                        showToast('Đã sao chép link gọi món!', 'success');
                      }}
                      className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      Sao chép liên kết
                    </button>
                    <button 
                      onClick={() => downloadQRCode(table.id)}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      Tải mã QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedTableId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              className="flex h-full w-full max-w-[1380px] flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-[92vh] md:rounded-[2.25rem]"
            >
              <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 px-5 py-5 text-white md:px-7 md:py-6">
                <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
                <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-white/15 text-white shadow-lg shadow-emerald-900/20 backdrop-blur">
                      <Users size={30} />
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur">
                          Chi tiết bàn
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                          {selectedTable ? getStatusText(selectedTable.status) : 'Đang tải'}
                        </span>
                      </div>
                      <h3 className="text-3xl font-black tracking-tight md:text-4xl">Bàn {selectedTableId}</h3>
                      <p className="mt-1 text-sm font-semibold text-emerald-50/80">Chọn món, kiểm tra đơn và xác nhận thao tác cho bàn</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 xl:min-w-[520px]">
                    <div className="rounded-3xl border border-white/10 bg-white/15 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-50/70">Số món</p>
                      <p className="mt-1 text-3xl font-black">{selectedTableTotalItems}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/15 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-50/70">Dòng món</p>
                      <p className="mt-1 text-3xl font-black">{selectedTableTotalLines}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white p-4 text-slate-900 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tạm tính</p>
                      <p className="mt-1 text-2xl font-black text-emerald-600">{formatCurrency(calculateTotal())}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => { setSelectedTableId(null); setShowOrderMobile(false); }}
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white hover:text-slate-900 xl:relative xl:right-auto xl:top-auto"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 bg-slate-100 lg:grid-cols-[42%_58%]">
                <section className={`${showOrderMobile ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-slate-200 bg-white`}>
                  <div className="border-b border-slate-100 p-4 md:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Thực đơn</h4>
                        <p className="text-sm font-semibold text-slate-400">Bấm món để thêm vào đơn của bàn</p>
                      </div>
                      <button
                        onClick={() => setShowOrderMobile(true)}
                        className="relative rounded-2xl bg-emerald-50 p-3 text-emerald-600 lg:hidden"
                      >
                        <ShoppingCart size={20} />
                        {selectedTableTotalItems > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                            {selectedTableTotalItems}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                      {MENU_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition-all ${
                            selectedCategory === cat
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                              : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar md:p-5">
                    {filteredMenu.length === 0 ? (
                      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                        <Search className="mb-4 h-12 w-12 text-slate-300" />
                        <h4 className="text-lg font-black text-slate-700">Không có món trong danh mục này</h4>
                        <p className="mt-2 text-sm font-semibold text-slate-400">Hãy chọn danh mục khác hoặc thêm món trong quản lý menu.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {filteredMenu.map(item => {
                          const selectedQty = selectedTable?.currentOrder.filter(orderItem => orderItem.itemId === item.id).reduce((sum, orderItem) => sum + orderItem.quantity, 0) || 0;
                          return (
                            <button
                              key={item.id}
                              onClick={() => addToOrder(selectedTableId, item)}
                              className="group overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70"
                            >
                              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                                <LazyImage src={item.image || '/images/placeholder.png'} alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                                {selectedQty > 0 && (
                                  <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-lg">
                                    Đã chọn {selectedQty}
                                  </span>
                                )}
                              </div>
                              <div className="p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h5 className="truncate text-base font-black text-slate-900">{item.name}</h5>
                                    <p className="mt-1 text-xs font-bold text-slate-400">{item.category || 'Món uống'}</p>
                                  </div>
                                  <p className="shrink-0 text-base font-black text-emerald-600">{formatCurrency(item.price)}</p>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Thêm vào bàn</span>
                                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100">
                                    <Plus size={18} />
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <section className={`${showOrderMobile ? 'flex absolute inset-0 z-10 lg:relative lg:inset-auto' : 'hidden lg:flex'} min-h-0 flex-col bg-slate-50`}>
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4 md:p-5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setShowOrderMobile(false)} className="rounded-2xl bg-slate-100 p-3 text-slate-500 lg:hidden">
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h4 className="text-xl font-black text-slate-900">Đơn hàng hiện tại</h4>
                        <p className="text-sm font-semibold text-slate-400">Gộp đơn nhân viên và khách gọi QR</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-100">
                      {selectedTableTotalItems} món
                    </span>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar md:p-6">
                    {combinedOrders.length === 0 ? (
                      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 text-center shadow-sm">
                        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                          <ShoppingCart size={48} />
                        </div>
                        <h4 className="text-2xl font-black text-slate-800">Chưa có món nào được chọn</h4>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Chọn món từ thực đơn bên trái hoặc chờ khách gửi đơn từ mã QR của bàn.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {combinedOrders.map((order, orderIdx) => (
                          <div key={order.id || orderIdx} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                              <div className="flex items-center gap-3">
                                <span className={`h-3 w-3 rounded-full ${order.source === 'staff' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <div>
                                  <p className="text-sm font-black uppercase tracking-widest text-slate-700">{order.source === 'staff' ? 'Nhân viên chọn món' : 'Khách gọi QR'}</p>
                                  <p className="text-xs font-semibold text-slate-400">{order.items?.length || 0} dòng món</p>
                                </div>
                              </div>
                              {order.createdAt && (
                                <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                                  {new Date(order.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>

                            <div className="divide-y divide-slate-100">
                              {order.items?.map((item: any, idx: number) => (
                                <div key={`${item.itemId}-${idx}`} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <h5 className="text-base font-black text-slate-900">{item.name}</h5>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{formatCurrency(item.price)}</span>
                                      {item.note && (
                                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold italic text-amber-700">
                                          <StickyNote size={12} />
                                          <span className="truncate">{item.note}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                                    {order.id === 'staff' ? (
                                      <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-inner">
                                        <button
                                          onClick={() => updateQuantity(selectedTableId!, item.itemId, -1, item.note)}
                                          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-rose-600"
                                        >
                                          <Minus size={16} strokeWidth={3} />
                                        </button>
                                        <span className="w-10 text-center text-base font-black text-slate-800">{item.quantity}</span>
                                        <button
                                          onClick={() => updateQuantity(selectedTableId!, item.itemId, 1, item.note)}
                                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm transition hover:scale-95"
                                        >
                                          <Plus size={16} strokeWidth={3} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="rounded-2xl bg-slate-100 px-4 py-2 text-base font-black text-slate-800">x{item.quantity}</span>
                                    )}
                                    <div className="min-w-[120px] text-right">
                                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Thành tiền</p>
                                      <p className="text-lg font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 bg-white p-4 shadow-[0_-12px_35px_rgba(15,23,42,0.06)] md:p-6">
                    <div className="mb-5 rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Tổng tiền tạm tính</p>
                          <p className="mt-1 text-sm font-bold text-slate-400">Đã bao gồm VAT (nếu có)</p>
                        </div>
                        <p className="text-4xl font-black tracking-tight text-emerald-600">{formatCurrency(calculateTotal())}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => clearTableOrders(selectedTableId!)}
                        disabled={combinedOrders.length === 0}
                        className="rounded-[1.3rem] bg-rose-50 px-4 py-4 text-sm font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
                      >
                        Xóa đơn
                      </button>
                      <button
                        onClick={() => { setSelectedTableId(null); setShowOrderMobile(false); }}
                        className="col-span-2 flex items-center justify-center gap-2 rounded-[1.3rem] bg-emerald-600 px-4 py-4 text-base font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-100 transition hover:bg-emerald-700 active:scale-95"
                      >
                        Xác nhận
                        <CheckCircle2 size={20} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPaymentTableId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center border-b border-slate-50">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Receipt size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800">THANH TOÁN BÀN {selectedPaymentTableId}</h3>
                <p className="text-slate-400 text-sm font-medium mt-1">Vui lòng kiểm tra lại đơn hàng trước khi thanh toán</p>
              </div>
              <div className="p-8 space-y-4 max-h-[40vh] overflow-y-auto">
                {mergedBillItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center text-xs font-bold text-slate-500 mt-0.5">{item.quantity}</span>
                      <div>
                        <span className="font-bold text-slate-700">{item.name}</span>
                        {item.note && (
                          <p className="text-[10px] text-amber-600 font-medium italic">Note: {item.note}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-slate-800">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-slate-50 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Tổng tiền cần thu</span>
                  <span className="text-3xl font-black text-emerald-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setSelectedPaymentTableId(null)} className="flex-1 py-4 bg-white text-slate-500 rounded-2xl font-bold border border-slate-200">Hủy</button>
                  <button onClick={() => printInvoice()} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2"><Printer size={18} /> In</button>
                  <button onClick={() => handleCheckout(selectedPaymentTableId!)} className="flex-2 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100">XÁC NHẬN THANH TOÁN</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-[100] flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 
              toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="font-bold text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu CRUD Modal */}
      <AnimatePresence>
        {isMenuModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingItem ? 'Sửa món' : 'Thêm món mới'}
                </h3>
                <button
                  onClick={() => setIsMenuModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <MenuForm
                item={editingItem}
                onSave={saveMenuItem}
                onCancel={() => {
                  setIsMenuModalOpen(false);
                  setEditingItem(null);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerOrderPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(getStoredMenu() || menuData);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isOrderSent, setIsOrderSent] = useState(false);
  const [menuActiveCategory, setMenuActiveCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const categoryMeta: Record<string, { label: string; emoji: string }> = {
    All: { label: 'Tất cả', emoji: '◫' },
    Coffee: { label: 'Cà phê', emoji: '☕' },
    'Trà': { label: 'Trà', emoji: '🍵' },
    'Sữa chua': { label: 'Sữa chua', emoji: '🥛' },
    'Trà sữa': { label: 'Trà sữa', emoji: '🧋' },
    'Soda': { label: 'Soda', emoji: '🥤' },
    'Nước ép': { label: 'Nước ép', emoji: '🍹' },
    'Kem – chè': { label: 'Kem – chè', emoji: '🍨' },
    'Hạt': { label: 'Hạt', emoji: '🌰' }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, MENU_COLLECTION), (snapshot) => {
      if (snapshot.empty) {
        const fallbackMenu = getStoredMenu() || menuData;
        setMenuItems(fallbackMenu);
        return;
      }

      const nextMenu = snapshot.docs
        .map(menuDoc => normalizeMenuItem({ id: menuDoc.id, ...menuDoc.data() }))
        .filter(item => item.name && item.price > 0)
        .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'vi') || a.name.localeCompare(b.name, 'vi'));

      setMenuItems(nextMenu);
      storeMenuLocally(nextMenu);
    }, (err) => {
      console.error('Lỗi tải menu khách:', err);
      setMenuItems(getStoredMenu() || menuData);
    });

    return () => unsubscribe();
  }, []);

  const addToOrder = (item: MenuItem) => {
    const existingIndex = cart.findIndex(oi => oi.itemId === item.id && !oi.note);
    if (existingIndex !== -1) {
      const newOrder = [...cart];
      newOrder[existingIndex].quantity += 1;
      setCart(newOrder);
    } else {
      setCart([...cart, { itemId: item.id, name: item.name, quantity: 1, price: item.price, note: '' }]);
    }
  };

  const removeOneFromOrder = (itemId: string) => {
    const targetIndex = cart.findIndex(item => item.itemId === itemId && !item.note);
    const fallbackIndex = targetIndex !== -1 ? targetIndex : cart.findIndex(item => item.itemId === itemId);
    if (fallbackIndex === -1) return;

    const newOrder = [...cart];
    newOrder[fallbackIndex].quantity -= 1;
    setCart(newOrder.filter(item => item.quantity > 0));
  };

  const updateQuantity = (index: number, delta: number) => {
    const newOrder = [...cart];
    newOrder[index].quantity = Math.max(0, newOrder[index].quantity + delta);
    setCart(newOrder.filter(oi => oi.quantity > 0));
  };

  const clearCart = () => setCart([]);

  const handleOpenNote = (index: number) => {
    setEditingNoteIndex(index);
    setTempNote(cart[index].note || '');
  };

  const handleSaveNote = () => {
    if (editingNoteIndex !== null) {
      const newOrder = [...cart];
      newOrder[editingNoteIndex].note = tempNote;
      setCart(newOrder);
      setEditingNoteIndex(null);
    }
  };

  const totalCartItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const menuById = useMemo(() => Object.fromEntries(menuItems.map(item => [item.id, item])), [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = menuActiveCategory === 'All' || item.category === menuActiveCategory;
      const keyword = searchKeyword.trim().toLowerCase();
      const matchesKeyword = !keyword || item.name.toLowerCase().includes(keyword) || (item.category || '').toLowerCase().includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [menuItems, menuActiveCategory, searchKeyword]);

  const getItemTotalQty = (itemId: string) => cart.filter(item => item.itemId === itemId).reduce((sum, item) => sum + item.quantity, 0);

  const handleSendOrder = async () => {
    if (!tableId || tableId.trim() === '') {
      alert('Mã bàn không hợp lệ. Vui lòng quét lại mã QR.');
      return;
    }

    if (!cart.length) {
      alert('Giỏ hàng đang trống. Vui lòng chọn món.');
      return;
    }

    try {
      await addDoc(collection(db, `tables/${tableId}/orders`), {
        items: cart,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      const tableRef = doc(db, 'tables', tableId);
      await updateDoc(tableRef, {
        status: 'Occupied'
      });

      setIsOrderSent(true);
      setCart([]);
      setIsCartOpen(false);
    } catch (error: any) {
      console.error('Firebase error:', error);
      alert(error.message);
    }
  };

  const CartContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex h-full flex-col ${mobile ? '' : 'min-h-[calc(100vh-180px)]'}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Giỏ hàng</h3>
          <p className="mt-1 text-sm text-slate-500">{totalCartItems} món đang chờ gửi đến quán</p>
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-rose-500 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Xóa tất cả
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-800">Giỏ hàng đang trống</h4>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Chọn món yêu thích ở danh sách bên trái rồi nhấn gửi để quán xác nhận nhanh nhất.</p>
          </div>
        ) : (
          cart.map((item, index) => {
            const menuItem = menuById[item.itemId];
            return (
              <div key={`${item.itemId}-${index}`} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/80">
                <div className="flex items-start gap-4">
                  <div className="h-18 w-18 overflow-hidden rounded-2xl bg-slate-100 sm:h-20 sm:w-20 shrink-0">
                    <LazyImage
                      src={menuItem?.image || '/images/placeholder.png'}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="line-clamp-2 text-base font-black text-slate-900">{item.name}</h4>
                      </div>
                      <button
                        onClick={() => updateQuantity(index, -item.quantity)}
                        className="rounded-full p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleOpenNote(index)}
                        className={`inline-flex min-w-0 max-w-[70%] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold ${item.note ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                      >
                        <StickyNote className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.note || 'Thêm ghi chú'}</span>
                      </button>

                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <button onClick={() => updateQuantity(index, -1)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-rose-500">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-black text-slate-800">{item.quantity}</span>
                        <button onClick={() => updateQuantity(index, 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm transition hover:scale-95">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 bg-white px-5 py-5">
        <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-emerald-800">Đơn gọi món của bạn</p>
              <p className="mt-1 text-xs font-medium text-emerald-700/80">Quán sẽ xác nhận và phục vụ tại bàn trong thời gian sớm nhất.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-emerald-700 shadow-sm">{totalCartItems} món</span>
          </div>
        </div>

        <button
          onClick={handleSendOrder}
          disabled={cart.length === 0}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-[24px] bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <Send className="h-5 w-5" />
          Gửi gọi món
        </button>
        <p className="mt-3 text-center text-xs font-medium text-slate-500">Đơn sẽ được quán xác nhận sớm nhất</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f1f5f9,_#ffffff_35%,_#eff6ff_100%)] text-slate-800">
      <div className="mx-auto max-w-[1800px] p-3 sm:p-4 lg:p-6">
        {isOrderSent ? (
          <div className="flex min-h-[85vh] items-center justify-center">
            <div className="w-full max-w-2xl rounded-[36px] border border-emerald-100 bg-white/95 p-8 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)] sm:p-12">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              >
                <CheckCircle2 className="h-12 w-12" />
              </motion.div>
              <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                Coffee King's • Bàn số {tableId}
              </div>
              <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">Đã gửi yêu cầu gọi món</h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
                Cảm ơn bạn đã đặt món. Quán đã nhận được yêu cầu và sẽ xác nhận trong giây lát.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => setIsOrderSent(false)}
                  className="rounded-[22px] bg-emerald-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  Tiếp tục gọi món
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-[22px] border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Làm mới trang
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-4 rounded-[36px] border border-white/70 bg-white/90 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5 lg:mb-6 lg:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                      <Coffee className="h-8 w-8" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Coffee King&apos;s</h1>
                      <p className="mt-1 text-lg font-bold text-emerald-600">Bàn số {tableId}</p>
                    </div>
                  </div>

                  <div className="hidden h-10 w-px bg-slate-200 lg:block" />

                  <div className="grid grid-cols-2 gap-3 sm:flex">
                    <div className="inline-flex items-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                      <ShoppingCart className="h-4 w-4" />
                      Giỏ hàng
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">{totalCartItems}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Đang gọi món
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center xl:min-w-[740px] xl:max-w-[740px] xl:justify-end">
                  <div className="flex flex-1 items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner shadow-slate-100">
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="Tìm món uống bạn yêu thích..."
                      className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:text-base"
                    />
                    <button className="rounded-full bg-white p-2 text-emerald-600 shadow-sm transition hover:scale-95">
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <button className="hidden rounded-[20px] border border-slate-200 bg-white p-3 text-slate-500 transition hover:bg-slate-50 sm:inline-flex">
                      <LayoutGrid className="h-5 w-5" />
                    </button>
                    <button className="hidden rounded-[20px] border border-slate-200 bg-white p-3 text-slate-500 transition hover:bg-slate-50 sm:inline-flex">
                      <Users className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="inline-flex items-center gap-2 rounded-[20px] bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 xl:hidden"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Xem giỏ hàng
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_360px] xl:gap-5">
              <aside className="xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-[34px] border border-white/70 bg-white/90 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">Danh mục</h3>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{filteredMenuItems.length} món</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    {MENU_CATEGORIES.map((cat) => {
                      const active = menuActiveCategory === cat;
                      const meta = categoryMeta[cat] || { label: cat, emoji: '•' };
                      return (
                        <button
                          key={cat}
                          onClick={() => setMenuActiveCategory(cat)}
                          className={`flex items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-emerald-100 hover:bg-emerald-50/50'}`}
                        >
                          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-lg ${active ? 'bg-white/15' : 'bg-slate-100'}`}>{meta.emoji}</span>
                          <span className="min-w-0 truncate text-sm font-bold sm:text-base">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-slate-700">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
                      <Coffee className="h-6 w-6" />
                    </div>
                    <h4 className="text-base font-black text-slate-900">Chọn món và nhấn gửi</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Giao diện mới ưu tiên dễ dùng, thao tác nhanh và chỉ hiển thị thông tin cần thiết cho khách đặt món.</p>
                  </div>
                </div>
              </aside>

              <main className="rounded-[34px] border border-white/70 bg-white/90 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{categoryMeta[menuActiveCategory]?.label || 'Tất cả món'}</h2>
                    <p className="mt-1 text-sm text-slate-500">Khám phá các món được chuẩn bị nhanh chóng và phù hợp cho bàn của bạn.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
                    <Search className="h-4 w-4" />
                    {searchKeyword ? `Kết quả cho “${searchKeyword}”` : `${filteredMenuItems.length} món sẵn sàng phục vụ`}
                  </div>
                </div>

                {filteredMenuItems.length === 0 ? (
                  <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Search className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Không tìm thấy món phù hợp</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Hãy thử từ khóa khác hoặc chọn lại danh mục để xem đầy đủ thực đơn của quán.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredMenuItems.map((item) => {
                      const qty = getItemTotalQty(item.id);
                      const categoryLabel = categoryMeta[item.category || 'All']?.label || item.category || 'Món uống';
                      return (
                        <article key={item.id} className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm shadow-slate-100 transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                            <LazyImage
                              src={item.image || '/images/placeholder.png'}
                              alt={item.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <div className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{categoryLabel}</div>
                          </div>

                          <div className="p-5">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div>
                                <h3 className="line-clamp-2 text-xl font-black text-slate-900">{item.name}</h3>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">Thức uống thơm ngon, được chuẩn bị nhanh để phục vụ ngay tại bàn của bạn.</p>
                              </div>
                            </div>

                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              Còn món
                            </div>

                            {qty > 0 ? (
                              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-emerald-100 bg-emerald-50 px-3 py-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đã chọn</p>
                                  <p className="text-2xl font-black text-emerald-700">{qty}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => removeOneFromOrder(item.id)}
                                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:text-rose-500"
                                  >
                                    <Minus className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => addToOrder(item)}
                                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 transition hover:scale-95"
                                  >
                                    <Plus className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToOrder(item)}
                                className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-emerald-600 px-4 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700"
                              >
                                <Plus className="h-5 w-5" />
                                Thêm vào giỏ
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </main>

              <aside className="hidden xl:block xl:sticky xl:top-6 xl:self-start">
                <div className="overflow-hidden rounded-[34px] border border-white/70 bg-white/95 shadow-[0_25px_80px_rgba(15,23,42,0.06)] backdrop-blur">
                  <CartContent />
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-sm xl:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[86vh] overflow-hidden rounded-t-[32px] bg-white shadow-2xl xl:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">Giỏ hàng của bạn</h3>
                    <p className="text-sm text-slate-500">Bàn số {tableId}</p>
                  </div>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CartContent mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingNoteIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl"
            >
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-900">
                <StickyNote className="h-5 w-5 text-amber-500" />
                Ghi chú cho {cart[editingNoteIndex].name}
              </h3>
              <textarea
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Ví dụ: ít đường, không đá, mang về..."
                className="h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setEditingNoteIndex(null)}
                  className="flex-1 rounded-[20px] bg-slate-100 px-4 py-3 font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveNote}
                  className="flex-1 rounded-[20px] bg-emerald-600 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                >
                  Lưu ghi chú
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isOrderSent && cart.length > 0 && !isCartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-[28px] border border-white/80 bg-white/95 p-3 shadow-[0_15px_50px_rgba(15,23,42,0.12)] backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giỏ hàng</p>
              <p className="text-xl font-black text-emerald-600">{totalCartItems} món</p>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 rounded-[22px] bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              Xem giỏ hàng
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
