# Firebase Authentication Integration Guide

Hệ thống đã được tích hợp Firebase Authentication với Google Login. Đây là hướng dẫn sử dụng.

---

## 🎯 Các File Đã Tạo

### 1. `src/services/authService.ts`
Auth service với các hàm:
- `loginWithGoogle()` - Đăng nhập bằng Google
- `logout()` - Đăng xuất
- `listenAuth(callback)` - Theo dõi trạng thái đăng nhập
- `getCurrentUser()` - Lấy user hiện tại

### 2. `src/hooks/useAuth.ts`
React hook để sử dụng auth:
```tsx
const { user, loading, error } = useAuth();
```

### 3. `src/pages/LoginPage.tsx`
Trang đăng nhập với:
- Logo Coffee King's
- Nút Google Login
- Error handling
- Loading state

---

## 🔧 Cách Integrate vào App

### App.tsx (đã được sửa)

```tsx
// Import
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { logout } from './services/authService';

// Trong App component
export default function App() {
  const { user, loading } = useAuth();

  // Loading
  if (loading) {
    return <LoadingScreen />;
  }

  // Not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Authenticated
  return <Routes>...</Routes>;
}
```

### User Section (trong Sidebar)

```tsx
const AppUserSection: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="p-4 border-t border-slate-100">
      {/* User Avatar */}
      <img src={user?.photoURL} alt="User" className="w-10 h-10 rounded-full" />
      
      {/* User Name */}
      <p className="font-bold">{user?.displayName}</p>
      
      {/* Logout Button */}
      <button onClick={handleLogout}>Đăng xuất</button>
    </div>
  );
};
```

---

## 📋 Flow Hoạt Động

### 1. First Load
```
App Component Mount
  ↓
useAuth() Hook Init
  ↓
onAuthStateChanged() Listener
  ↓
Check Firebase Auth State
  ↓
User?.
  ├─ Yes → Show AppContent (POS)
  └─ No  → Show LoginPage
```

### 2. Google Login
```
User Click "Đăng nhập bằng Google"
  ↓
signInWithPopup(auth, googleProvider)
  ↓
Firebase Popup Opens
  ↓
User Authenticates
  ↓
Session Stored
  ↓
Navigate to Homepage (/)
```

### 3. Logout
```
User Click "Đăng xuất"
  ↓
await logout()
  ↓
Firebase Session Cleared
  ↓
useAuth() Detects Change
  ↓
Redirect to LoginPage
  ↓
User Needs to Login Again
```

---

## 🔐 Security Features

✅ **Session Persistence**
- Firebase maintains session across page reloads
- Token stored in browser storage
- Auto-refresh when needed

✅ **Protected Routes**
- Only authenticated users can access POS
- Automatic redirect if not logged in
- Error handling for network issues

✅ **User Data**
- User avatar displayed
- Email & name stored
- Can be extended for roles/permissions

---

## 🚀 Testing

### 1. Start Dev Server
```bash
npm run dev
```

### 2. First Load
- App auto redirects to LoginPage
- See "Đăng nhập bằng Google" button

### 3. Click Login
- Google Auth Popup appears
- Sign in with your Google account
- Redirects to POS dashboard

### 4. Logout
- Click user section at sidebar bottom
- Click "Đăng xuất" button
- Redirects back to LoginPage

### 5. Reload Page
- User session persists
- Direct access to POS (no need to login again)

---

## 📝 Firebase Configuration

File: `src/firebase.ts`

Already configured with:
- initializeApp()
- getAuth(app)
- getFirestore(app)

Environment: `firebase-applet-config.json`

---

## 🛠️ Customization

### Change Login UI
Edit: `src/pages/LoginPage.tsx`

### Change User Section
Edit: `src/App.tsx` → `AppUserSection` component

### Add User Roles
Modify: `src/services/authService.ts`
```tsx
export const getUserRole = async (userId: string) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.data()?.role;
};
```

### Extend User Profile
Modify: `useAuth` hook
```tsx
const [userProfile, setUserProfile] = useState(null);
useEffect(() => {
  if (user) {
    // Fetch additional data from Firestore
  }
}, [user]);
```

---

## ⚠️ Common Issues

### Issue: "Google OAuth Popup Blocked"
**Solution:** Check browser popup settings or use localhost

### Issue: "User Not Persisting"
**Solution:** Check Firebase Console → Authentication → Users list

### Issue: "Build Error"
**Solution:** Run `npm install` to ensure all dependencies installed

---

## 📚 API Reference

### authService.ts

```tsx
// Sign in with Google
const user = await loginWithGoogle();

// Sign out
await logout();

// Listen for auth changes
const unsubscribe = listenAuth((user) => {
  console.log(user?.uid);
});
unsubscribe(); // Stop listening

// Get current user
const currentUser = getCurrentUser();
```

### useAuth.ts

```tsx
const { user, loading, error } = useAuth();

// user: Firebase User | null
// loading: boolean
// error: string | null
```

---

## 🎨 UI Components Used

- **Lucide Icons**: LogOut, Loader2, Coffee
- **Motion.framer**: Animations
- **TailwindCSS**: Styling

---

## 📞 Support

For issues:
1. Check console logs (F12 → Console)
2. Verify Firebase config
3. Check network connectivity
4. Review Firebase Rules

---

Generated on: March 31, 2026
Coffee King's Management System
