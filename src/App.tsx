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
  LogOut
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

const MenuForm: React.FC<{
  item: MenuItem | null;
  onSave: (item: Omit<MenuItem, 'id'>) => void;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
  const [name, setName] = useState(item?.name || '');
  const [price, setPrice] = useState(item?.price || 0);
  const [category, setCategory] = useState(item?.category || 'Coffee');
  const [image, setImage] = useState(item?.image || '');

  useEffect(() => {
    setName(item?.name || '');
    setPrice(item?.price || 0);
    setCategory(item?.category || 'Coffee');
    setImage(item?.image || '');
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0 || !category.trim()) {
      return;
    }
    console.log("FORM:", { name, price, category, image });
    onSave({
      name: name.trim(),
      price,
      category,
      image: image.trim() || '/images/placeholder.png'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Tên món</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Giá (VND)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          min="1"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Danh mục</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {MENU_CATEGORIES.filter(cat => cat !== 'All').map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Ảnh (URL)</label>
        <input
          type="text"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="/images/example.jpg"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
        >
          {item ? 'Cập nhật' : 'Thêm món'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
        >
          Hủy
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
    <div className="p-4 border-t border-slate-100 flex flex-col gap-3">
      <div className="flex items-center gap-3 px-3 py-2">
        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-10 h-10 rounded-full"
          />
        )}
        <div className="hidden lg:block flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">
            {user?.displayName || 'Người dùng'}
          </p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        disabled={isLogoutLoading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 disabled:opacity-50"
      >
        <LogOut size={20} />
        <span className="hidden lg:block font-bold text-sm">Đăng xuất</span>
      </button>
    </div>
  );
};

function AppContent() {
  const [tables, setTables] = useState<Table[]>([]);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>(menuData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'tables' | 'history' | 'menu' | 'payment' | 'qr'>('tables');
  const [menuActiveCategory, setMenuActiveCategory] = useState<string>('All');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedPaymentTableId, setSelectedPaymentTableId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showOrderMobile, setShowOrderMobile] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const tablesRef = useRef<Table[]>([]);

  // States for menu CRUD
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // Load menu from localStorage
  useEffect(() => {
    const savedMenu = localStorage.getItem('menu');
    if (savedMenu) {
      try {
        const parsedMenu = JSON.parse(savedMenu);
        setMenu(parsedMenu);
      } catch (err) {
        console.error('Error loading menu from localStorage:', err);
      }
    }
  }, []);

  // Save menu to localStorage whenever menu changes
  useEffect(() => {
    localStorage.setItem('menu', JSON.stringify(menu));
  }, [menu]);

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
      case 'Serving': return 'bg-rose-500';
      case 'Occupied': return 'bg-rose-500';
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-emerald-600 animate-spin" />
            <p className="font-bold text-slate-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Coffee size={24} />
          </div>
          <h1 className="hidden lg:block font-bold text-xl tracking-tight text-slate-800">Coffee King’s</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('tables')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'tables' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutGrid size={20} />
            <span className="hidden lg:block">Sơ đồ bàn</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('payment')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'payment' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Receipt size={20} />
            <span className="hidden lg:block">Quản lý thanh toán</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'history' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <HistoryIcon size={20} />
            <span className="hidden lg:block">Lịch sử</span>
          </button>

          <button 
            onClick={() => setActiveTab('menu')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'menu' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings size={20} />
            <span className="hidden lg:block">Quản lý menu</span>
          </button>

          <button 
            onClick={() => setActiveTab('qr')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'qr' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <PlusCircle size={20} />
            <span className="hidden lg:block">Mã QR Gọi Món</span>
          </button>
        </nav>

        {/* User Section */}
        <AppUserSection />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'tables' ? 'Quản lý bàn' : activeTab === 'payment' ? 'Quản lý thanh toán' : activeTab === 'history' ? 'Lịch sử thanh toán' : activeTab === 'menu' ? 'Quản lý menu' : 'Mã QR Gọi Món'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'tables' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {tables.map(table => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  onSelect={setSelectedTableId}
                  getStatusColor={getStatusColor}
                  getStatusText={getStatusText}
                />
              ))}
            </div>
          ) : activeTab === 'payment' ? (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tables.filter(t => (t.totalItems || 0) > 0).length === 0 ? (
                  <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <Receipt size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">Không có bàn nào đang chờ thanh toán</p>
                  </div>
                ) : (
                  tables.filter(t => (t.totalItems || 0) > 0).map(table => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedPaymentTableId(table.id)}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4 text-left group hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${getStatusColor(table.status)} shadow-lg`}>
                            <Users size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">Bàn {table.id}</h4>
                            <p className="text-xs text-slate-400">{table.totalItems || 0} món</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          table.status === 'Serving' ? 'bg-amber-100 text-amber-600' : 
                          table.status === 'Occupied' ? 'bg-rose-100 text-rose-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {getStatusText(table.status)}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Tạm tính</div>
                        <div className="text-xl font-black text-slate-800">
                          {formatCurrency(table.totalPrice || 0)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <HistoryIcon size={40} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-500">Chưa có lịch sử thanh toán</h3>
                </div>
              ) : (
                history.map(record => (
                  <div key={record.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold text-xl">
                        {record.tableId}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800">Bàn {record.tableId}</h3>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="space-y-1">
                          {record.items.map((i, idx) => (
                            <div key={idx} className="text-sm text-slate-500">
                              <span className="font-medium text-slate-700">{i.name} x{i.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tổng cộng</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(record.total)}</p>
                      </div>
                      <button 
                        onClick={() => saveHistory(history.filter(h => h.id !== record.id))}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'menu' ? (
            <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[75vh]">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <ShoppingCart size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Quản lý Menu ({menu.length})</h3>
                </div>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setIsMenuModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg"
                >
                  <Plus size={16} />
                  Thêm món
                </button>
              </div>

              <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Tìm kiếm món..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50">
                  <div className="max-h-52 md:max-h-none md:h-full p-4 flex flex-col gap-2 overflow-y-auto">
                    {MENU_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMenuActiveCategory(cat)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
                          menuActiveCategory === cat
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                          : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                <Virtuoso
                  style={{ height: '100%' }}
                  data={
                    menu
                      .filter(m => menuActiveCategory === 'All' || m.category === menuActiveCategory)
                      .filter(m => m.name.toLowerCase().includes(menuSearchQuery.toLowerCase()))
                  }
                  itemContent={(index, item) => (
                    <div key={item.id} className="flex items-center hover:bg-slate-50/50 transition-colors group border-b border-slate-50">
                      <div className="px-6 py-4 w-12 text-center text-slate-300 font-mono text-xs">
                        {index + 1}
                      </div>
                      <div className="px-6 py-4 flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
                          <LazyImage src={item.image || '/images/placeholder.png'} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-slate-700">{item.name}</span>
                      </div>
                      <div className="px-6 py-4 w-1/4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">{item.category}</span>
                      </div>
                      <div className="px-6 py-4 w-1/4">
                        <span className="font-bold text-emerald-600">{formatCurrency(item.price)}</span>
                      </div>
                      <div className="px-6 py-4 w-32 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsMenuModalOpen(true);
                          }}
                          className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all"
                          title="Sửa"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Bạn có chắc muốn xóa món này?')) {
                              setMenu(prev => prev.filter(m => m.id !== item.id));
                              showToast('Đã xóa món thành công', 'success');
                            }
                          }}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                />
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
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedTableId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-none md:rounded-[2rem] shadow-2xl w-full md:max-w-6xl h-full md:h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">BÀN {selectedTableId}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chi tiết đơn hàng</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowOrderMobile(!showOrderMobile)} 
                    className="md:hidden p-2 bg-emerald-50 text-emerald-600 rounded-xl relative"
                  >
                    <ShoppingCart size={20} />
                    {(tables.find(t => t.id === selectedTableId)?.currentOrder.length || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {tables.find(t => t.id === selectedTableId)?.currentOrder.length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setSelectedTableId(null); setShowOrderMobile(false); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Menu Selection */}
                <div className={`w-full md:w-[40%] border-r border-slate-100 flex flex-col bg-white ${showOrderMobile ? 'hidden md:flex' : 'flex'}`}>
                  <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                    <div className="w-full lg:w-44 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                      <div className="max-h-44 lg:max-h-none lg:h-full p-4 flex flex-col gap-2 overflow-y-auto">
                        {MENU_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
                              selectedCategory === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredMenu.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToOrder(selectedTableId, item)}
                        className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all text-left"
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                          <LazyImage src={item.image || '/images/placeholder.png'} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate text-sm">{item.name}</p>
                          <p className="text-emerald-600 font-bold text-sm">{formatCurrency(item.price)}</p>
                        </div>
                      </button>
                    ))}
                    </div>
                  </div>
                </div>

                {/* Current Order */}
                <div className={`w-full md:w-[60%] flex flex-col bg-slate-50/50 border-t md:border-t-0 border-slate-100 ${showOrderMobile ? 'flex absolute inset-0 z-10 md:relative md:inset-auto' : 'hidden md:flex'}`}>
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowOrderMobile(false)} 
                        className="md:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                      >
                        <X size={20} />
                      </button>
                      <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Đơn hàng hiện tại</h4>
                    </div>
                    <span className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-full shadow-sm">
                      {tables.find(t => t.id === selectedTableId)?.currentOrder.length || 0} MÓN
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth">
                    {combinedOrders.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <ShoppingCart size={48} className="opacity-20" />
                        </div>
                        <p className="text-base font-bold text-slate-400">Chưa có món nào được chọn</p>
                        <p className="text-sm text-slate-300 mt-1">Vui lòng chọn món từ thực đơn</p>
                      </div>
                    ) : (
                      combinedOrders.map((order, orderIdx) => (
                        <div key={order.id || orderIdx} className="space-y-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${order.source === 'staff' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{order.source === 'staff' ? 'Nhân viên' : 'Khách gọi'}</p>
                            </div>
                            {order.createdAt && (
                              <p className="text-[11px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md">
                                {new Date(order.createdAt.seconds * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <div className="space-y-4">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={`${item.itemId}-${idx}`} className="flex items-start justify-between gap-4 group">
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-slate-800 text-base leading-tight mb-1">{item.name}</p>
                                  {item.note && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold italic mb-2 border border-amber-100/50">
                                      <StickyNote size={12} className="shrink-0" />
                                      <span className="truncate">{item.note}</span>
                                    </div>
                                  )}
                                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(item.price)}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center bg-slate-100 rounded-xl p-1 shadow-inner">
                                    {order.id === 'staff' ? (
                                      <>
                                        <button 
                                          onClick={() => updateQuantity(selectedTableId!, item.itemId, -1, item.note)} 
                                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all active:scale-90"
                                        >
                                          <Minus size={14} strokeWidth={3} />
                                        </button>
                                        <span className="w-10 text-center font-black text-slate-800 text-base">
                                          {item.quantity}
                                        </span>
                                        <button 
                                          onClick={() => updateQuantity(selectedTableId!, item.itemId, 1, item.note)} 
                                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-all active:scale-90"
                                        >
                                          <Plus size={14} strokeWidth={3} />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="px-4 py-1 font-black text-slate-800 text-base">
                                        x{item.quantity}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-black text-slate-800">
                                    {formatCurrency(item.price * item.quantity)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-6 md:p-8 bg-white border-t border-slate-100 space-y-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] block">Tổng tiền tạm tính</span>
                        <span className="text-sm font-bold text-slate-400 block">Đã bao gồm VAT (nếu có)</span>
                      </div>
                      <span className="text-4xl font-black text-emerald-600 tracking-tighter">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => clearTableOrders(selectedTableId!)} 
                        className="flex-1 py-4 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                      >
                        Xóa đơn
                      </button>
                      <button 
                        onClick={() => { setSelectedTableId(null); setShowOrderMobile(false); }} 
                        className="flex-[2] py-4 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        Xác nhận
                        <CheckCircle2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
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
                onSave={(item) => {
                  console.log("SAVING ITEM:", item);
                  if (editingItem) {
                    // Edit
                    setMenu(prev => {
                      const newMenu = prev.map(m => m.id === editingItem.id ? { ...item, id: editingItem.id } : m);
                      console.log("UPDATED MENU:", newMenu);
                      return newMenu;
                    });
                    showToast('Đã sửa món thành công', 'success');
                  } else {
                    // Add
                    const newItem = { ...item, id: `menu-${Date.now()}` };
                    console.log("NEW ITEM:", newItem);
                    setMenu(prev => {
                      const newMenu = [...prev, newItem];
                      console.log("ADDED MENU:", newMenu);
                      return newMenu;
                    });
                    showToast('Đã thêm món thành công', 'success');
                  }
                  setIsMenuModalOpen(false);
                  setEditingItem(null);
                }}
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
  const isCustomerView = true;
  const [menuItems] = useState<MenuItem[]>(menuData);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isOrderSent, setIsOrderSent] = useState(false);
  const [menuActiveCategory, setMenuActiveCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

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

  const updateQuantity = (index: number, delta: number) => {
    const newOrder = [...cart];
    newOrder[index].quantity = Math.max(0, newOrder[index].quantity + delta);
    setCart(newOrder.filter(oi => oi.quantity > 0));
  };

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

  const handleSendOrder = async () => {
    // 4. ENSURE TABLE ID IS VALID
    if (!tableId || tableId.trim() === "") {
      alert("Mã bàn không hợp lệ. Vui lòng quét lại mã QR.");
      return;
    }

    // 5. HANDLE EMPTY CART
    if (!cart.length) {
      alert("Giỏ hàng đang trống. Vui lòng chọn món.");
      return;
    }

    try {
      // 1. FIX FIREBASE WRITE LOGIC
      await addDoc(collection(db, `tables/${tableId}/orders`), {
        items: cart,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // 2. Update table status to Occupied
      const tableRef = doc(db, 'tables', tableId);
      await updateDoc(tableRef, {
        status: 'Occupied'
      });

      setIsOrderSent(true);
      setCart([]);
      setIsCartOpen(false);
    } catch (error: any) {
      // 2. ADD ERROR DEBUGGING
      console.error("Firebase error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Coffee className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Coffee King's</h1>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Bàn số {tableId}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-600 bg-slate-100 rounded-xl active:scale-95 transition-transform"
          >
            <ShoppingCart className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 pb-32">
        {isOrderSent ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Đã gửi yêu cầu gọi món</h2>
            <p className="text-slate-500 mb-8">Nhân viên sẽ phục vụ bạn trong giây lát. Cảm ơn quý khách!</p>
            <button 
              onClick={() => setIsOrderSent(false)}
              className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
            >
              Tiếp tục gọi món
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-full md:w-56 md:shrink-0 md:sticky md:top-[89px]">
                <div className="max-h-52 md:max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-2">
                    {MENU_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMenuActiveCategory(cat)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-bold text-left transition-all ${
                          menuActiveCategory === cat
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1 grid grid-cols-1 gap-4">
              {menuItems
                .filter(item => menuActiveCategory === 'All' || item.category === menuActiveCategory)
                .map(item => {
                  const itemsInOrder = cart.filter(oi => oi.itemId === item.id);
                  const totalQty = itemsInOrder.reduce((sum, oi) => sum + oi.quantity, 0);
                  
                  return (
                    <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                        <LazyImage 
                          src={item.image || '/images/placeholder.png'}
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h3 className="font-bold text-slate-800">{item.name}</h3>
                          {!isCustomerView && (
                            <p className="text-emerald-600 font-bold mt-1">{formatCurrency(item.price)}</p>
                          )}
                        </div>
                        <div className="flex justify-end items-center gap-3">
                          {totalQty > 0 ? (
                            <div className="flex items-center gap-4 bg-slate-100 rounded-xl px-2 py-1">
                              <span className="text-xs font-bold text-slate-500 mr-2">Đã chọn {totalQty}</span>
                              <button 
                                onClick={() => addToOrder(item)}
                                className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-sm"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => addToOrder(item)}
                              className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-100 active:scale-90 transition-transform"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] z-50 max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="text-emerald-600 w-6 h-6" />
                  <h3 className="text-xl font-black text-slate-800">Giỏ hàng</h3>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="py-20 text-center">
                    <ShoppingCart className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">Giỏ hàng đang trống</p>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800">{item.name}</h4>
                          {!isCustomerView && (
                            <p className="text-emerald-600 font-bold text-sm">{formatCurrency(item.price)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 bg-white rounded-xl p-1 border border-slate-200">
                          <button onClick={() => updateQuantity(index, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500"><Minus size={16} /></button>
                          <span className="font-bold text-slate-800 text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(index, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-500"><Plus size={16} /></button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenNote(index)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                            item.note ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-slate-500 border border-slate-200'
                          }`}
                        >
                          <StickyNote size={14} />
                          {item.note || 'Thêm ghi chú...'}
                        </button>
                        <button 
                          onClick={() => updateQuantity(index, -item.quantity)}
                          className="p-2 text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-white border-t border-slate-100 space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Tổng cộng</span>
                  {!isCustomerView && (
                    <span className="text-2xl font-black text-slate-800">
                      {formatCurrency(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                    </span>
                  )}
                </div>
                <button 
                  onClick={handleSendOrder}
                  disabled={cart.length === 0}
                  className="w-full py-4 bg-emerald-600 disabled:bg-slate-300 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                >
                  GỬI GỌI MÓN
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Note Modal */}
      <AnimatePresence>
        {editingNoteIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-sm shadow-2xl"
            >
              <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <StickyNote className="text-amber-500" />
                Ghi chú cho {cart[editingNoteIndex].name}
              </h3>
              <textarea 
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Ví dụ: Ít đường, không đá, mang về..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-700"
              />
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setEditingNoteIndex(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSaveNote}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100"
                >
                  Lưu ghi chú
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isOrderSent && cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng cộng ({cart.reduce((sum, item) => sum + item.quantity, 0)} món)</span>
              {!isCustomerView && (
                <span className="text-xl font-black text-slate-800">
                  {formatCurrency(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                </span>
              )}
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
            >
              XEM GIỎ HÀNG
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
