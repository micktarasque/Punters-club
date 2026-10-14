export type FirebaseApp = Record<string, unknown>;
export type Auth = { currentUser: User | null };
export type Firestore = Record<string, unknown>;
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: Array<{ providerId?: string | null; email?: string | null }>;
}

export function initializeApp(_config?: unknown): FirebaseApp {
  return {};
}

export function getAuth(_app?: unknown): Auth {
  return { currentUser: null };
}

export class GoogleAuthProvider {}

export async function signInWithPopup(
  _auth?: unknown,
  _provider?: unknown
): Promise<{ user: User | null }> {
  return { user: null };
}

export async function signOut(_auth?: unknown): Promise<void> {}

export function onAuthStateChanged(
  _auth: unknown,
  callback: (user: User | null) => void,
  _errorCallback?: (err: unknown) => void
): () => void {
  try {
    callback(null);
  } catch {
    // ignore
  }
  return () => {};
}

export function getFirestore(_app?: unknown, _dbId?: unknown): Firestore {
  return {};
}

export function doc(..._args: unknown[]): Record<string, unknown> {
  return {};
}

export async function getDocFromServer(_ref?: unknown): Promise<unknown> {
  return {};
}

export async function setDoc(_ref?: unknown, _data?: unknown): Promise<void> {}

export async function deleteDoc(_ref?: unknown): Promise<void> {}

export async function getDocs(_q?: unknown): Promise<{
  empty: boolean;
  docs: Array<{ id: string; data: () => Record<string, any> }>;
}> {
  return { empty: true, docs: [] };
}

export function collection(..._args: unknown[]): Record<string, unknown> {
  return {};
}

export function query(..._args: unknown[]): Record<string, unknown> {
  return {};
}

export function where(..._args: unknown[]): Record<string, unknown> {
  return {};
}

export function onSnapshot(
  _q: unknown,
  _onNext?: (snap: { forEach: (cb: (d: any) => void) => void }) => void,
  _onError?: (err: unknown) => void
): () => void {
  return () => {};
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}
