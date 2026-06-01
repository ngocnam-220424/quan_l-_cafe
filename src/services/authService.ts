import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { auth } from '../firebase';

const googleProvider = new GoogleAuthProvider();

/**
 * Đăng nhập bằng Google
 */
export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Lỗi đăng nhập Google:', error);
    throw error;
  }
};

/**
 * Đăng xuất
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    throw error;
  }
};

/**
 * Theo dõi trạng thái xác thực
 */
export const listenAuth = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

/**
 * Lấy user hiện tại
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
