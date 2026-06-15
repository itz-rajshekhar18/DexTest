import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAQEsadMgSJhKh5W9J3OSiHZh7EREgx6XE",
  authDomain: "dextest-b6346.firebaseapp.com",
  projectId: "dextest-b6346",
  storageBucket: "dextest-b6346.firebasestorage.app",
  messagingSenderId: "1024553292489",
  appId: "1:1024553292489:web:a21e280df239df1d45f318",
  measurementId: "G-XEK5KHYK1G"
};

// Initialize Firebase (SSR Safe)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
