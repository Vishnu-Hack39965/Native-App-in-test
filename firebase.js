// firebase.js — initialise Firebase for React Native (Expo)
// Install: expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
// OR use the compat SDK via: npm install firebase

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, onSnapshot, arrayUnion,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyDjn6u195jqewM53qb2xnrPruFnMOELAcc',
  authDomain:        'rakshapal-singh-library-ded2e.firebaseapp.com',
  projectId:         'rakshapal-singh-library-ded2e',
  storageBucket:     'rakshapal-singh-library-ded2e.firebasestorage.app',
  messagingSenderId: '988319651464',
  appId:             '1:988319651464:web:477fa283cddb1d1123713d',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── Shared pure helpers ──────────────────────────────────────────────────────

export const getStamp = () => new Date().toLocaleString('en-GB');
export const fmtDate  = (d) => d.toLocaleDateString('en-GB');

export const formatTime = (decimalDays) => {
  if (decimalDays == null) return '00:00:00:00';
  const sign = decimalDays < 0 ? '-' : '';
  const ts   = Math.floor(Math.abs(decimalDays) * 86400);
  return (
    sign +
    String(Math.floor(ts / 86400)).padStart(2, '0') + ':' +
    String(Math.floor((ts % 86400) / 3600)).padStart(2, '0') + ':' +
    String(Math.floor((ts % 3600) / 60)).padStart(2, '0') + ':' +
    String(ts % 60).padStart(2, '0')
  );
};

export const getRealSurvival = (u) => {
  if (!u || !u.joinDateISO) return u ? (u.totalPaidDays || 0) : 0;
  return (u.totalPaidDays || 0) - (Date.now() - new Date(u.joinDateISO).getTime()) / 86400000;
};

export const lastValidDate = (srv) => {
  if (srv <= 0) return null;
  return fmtDate(new Date(Date.now() + srv * 86400000));
};

export const parseStamp = (s) => {
  try {
    const [dp, tp] = (s || '').split(', ');
    const [dd, mm, yyyy] = dp.split('/');
    return new Date(`${yyyy}-${mm}-${dd}T${tp}`).getTime();
  } catch { return 0; }
};

export { app, auth, db, googleProvider, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot, arrayUnion };
