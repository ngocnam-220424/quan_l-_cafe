import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Hardcoded config for testing connection issues
const firebaseConfig = {
  apiKey: "AIzaSyAu8g_0gSZsd1JtLk_ks8kv6zNp9K-7MbY",
  authDomain: "gen-lang-client-0843678618.firebaseapp.com",
  projectId: "gen-lang-client-0843678618",
  storageBucket: "gen-lang-client-0843678618.firebasestorage.app",
  messagingSenderId: "656697892015",
  appId: "1:656697892015:web:2db8de787312f47e58085a",
};

console.log('Using Hardcoded Firebase Config for Project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const databaseId = "ai-studio-d132e37a-8fb0-4ed8-ad01-3644333432a0";

console.log('Using Hardcoded Firestore Database ID:', databaseId);

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
