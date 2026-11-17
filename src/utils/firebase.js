// Firebase 앱, 익명 인증 및 Firestore Enterprise(bombom-db) 지연 초기화 모듈

import { getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const FIREBASE_CONFIG = {
  projectId: 'bombom-arcade-woosai',
  appId: '1:875943731928:web:e6c85c27ffb63b7dff6dad',
  storageBucket: 'bombom-arcade-woosai.firebasestorage.app',
  apiKey: 'AIzaSyD1bCNPaBt05jkyx7pnfNmwa5_QkehRJk4',
  authDomain: 'bombom-arcade-woosai.firebaseapp.com',
  messagingSenderId: '875943731928'
};

const FIRESTORE_DATABASE_ID = 'bombom-db';

let authInitPromise = null;

// Firebase App 싱글톤 반환 목적
export function getFirebaseApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  return initializeApp(FIREBASE_CONFIG);
}

// Enterprise 에디션 데이터베이스 인스턴스 반환 목적
export function getBomBomFirestore() {
  return getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);
}

// 오프라인·네트워크 장애 시 호출부 중단 없이 익명 UID 확보 목적
export function ensureAnonymousUser() {
  if (authInitPromise) {
    return authInitPromise;
  }

  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  authInitPromise = new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (existingUser) => {
      unsubscribe();
      if (existingUser) {
        resolve(existingUser);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        resolve(credential.user);
      } catch (authError) {
        authInitPromise = null;
        reject(authError);
      }
    });
  });

  return authInitPromise;
}
