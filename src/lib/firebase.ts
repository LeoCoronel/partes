import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';

const env = import.meta.env;
export const firebaseConfigured = Boolean(env.PUBLIC_FIREBASE_API_KEY && env.PUBLIC_FIREBASE_PROJECT_ID);
export const allowedEmail: string = (env.PUBLIC_ALLOWED_EMAIL ?? '').toLowerCase();

let _db: ReturnType<typeof getFirestore> | null = null;
const app = () => initializeApp({
  apiKey: env.PUBLIC_FIREBASE_API_KEY, authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.PUBLIC_FIREBASE_PROJECT_ID, appId: env.PUBLIC_FIREBASE_APP_ID,
});
let _app: ReturnType<typeof app> | null = null;
const getApp = () => (_app ??= app());
export const db = () => (_db ??= initializeFirestore(getApp(), { localCache: persistentLocalCache() }));
export const auth = () => getAuth(getApp());
export const login = () => signInWithPopup(auth(), new GoogleAuthProvider());
export const logout = () => signOut(auth());
export const onUser = (cb: (u: User | null) => void) => onAuthStateChanged(auth(), cb);
