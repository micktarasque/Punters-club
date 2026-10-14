import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  Auth,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { PunterProfile, RaceSelectionTrio } from "./types/racing";
import { safeFetchJson } from "./utils/safeFetchJson";

const isFileProtocol =
  typeof window !== "undefined" && window.location.protocol === "file:";

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (!isFileProtocol) {
  try {
    appInstance = initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn("Firebase initialization skipped:", err);
  }
}

export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = authInstance?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot when running on http/https
async function testConnection() {
  if (!dbInstance || isFileProtocol) return;
  try {
    await getDocFromServer(doc(dbInstance, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

/**
 * Deterministically merges two PunterProfile arrays by comparing per-race `updatedAt`
 * and per-meeting `jokerUpdatedAtByMeeting` timestamps so selections made on different
 * devices at different times never overwrite newer picks.
 */
export function mergePunterProfiles(
  baseList: PunterProfile[],
  incomingList: PunterProfile[],
  deletedIds: string[] = []
): PunterProfile[] {
  const deletedSet = new Set(deletedIds.filter(Boolean));
  const byId = new Map<string, PunterProfile>();

  for (const p of baseList) {
    if (!p || !p.id || deletedSet.has(p.id)) continue;
    byId.set(p.id, {
      ...p,
      selectionsByMeeting: { ...(p.selectionsByMeeting || {}) },
      jokerRaceByMeeting: { ...(p.jokerRaceByMeeting || {}) },
      jokerUpdatedAtByMeeting: { ...(p.jokerUpdatedAtByMeeting || {}) },
    });
  }

  for (const inc of incomingList) {
    if (!inc || !inc.id || deletedSet.has(inc.id)) continue;
    const existing = byId.get(inc.id);
    if (!existing) {
      byId.set(inc.id, {
        ...inc,
        selectionsByMeeting: { ...(inc.selectionsByMeeting || {}) },
        jokerRaceByMeeting: { ...(inc.jokerRaceByMeeting || {}) },
        jokerUpdatedAtByMeeting: { ...(inc.jokerUpdatedAtByMeeting || {}) },
      });
      continue;
    }

    const mergedSelections: Record<string, Record<number, RaceSelectionTrio>> = {
      ...existing.selectionsByMeeting,
    };

    for (const [mtgId, incRaceMap] of Object.entries(
      inc.selectionsByMeeting || {}
    )) {
      const baseRaceMap = { ...(mergedSelections[mtgId] || {}) };
      for (const [raceKey, incTrio] of Object.entries(incRaceMap || {})) {
        const rNum = Number(raceKey);
        if (!rNum || !incTrio) continue;
        const baseTrio = baseRaceMap[rNum];
        if (!baseTrio) {
          baseRaceMap[rNum] = { ...incTrio };
        } else {
          const baseTime = baseTrio.updatedAt || "";
          const incTime = incTrio.updatedAt || "";
          if (incTime >= baseTime) {
            baseRaceMap[rNum] = { ...incTrio };
          }
        }
      }
      mergedSelections[mtgId] = baseRaceMap;
    }

    const mergedJokers: Record<string, number | null> = {
      ...(existing.jokerRaceByMeeting || {}),
    };
    const mergedJokerTimes: Record<string, string> = {
      ...(existing.jokerUpdatedAtByMeeting || {}),
    };

    for (const [mtgId, incJokerVal] of Object.entries(
      inc.jokerRaceByMeeting || {}
    )) {
      const baseJTime = mergedJokerTimes[mtgId] || "";
      const incJTime = inc.jokerUpdatedAtByMeeting?.[mtgId] || inc.updatedAt || "";
      if (
        !(mtgId in mergedJokers) ||
        incJTime >= baseJTime
      ) {
        mergedJokers[mtgId] = incJokerVal ?? null;
        if (incJTime) mergedJokerTimes[mtgId] = incJTime;
      }
    }

    const latestUpdatedAt =
      (inc.updatedAt || "") >= (existing.updatedAt || "")
        ? inc.updatedAt || existing.updatedAt
        : existing.updatedAt;

    byId.set(inc.id, {
      ...existing,
      name: inc.name || existing.name,
      role: inc.role || existing.role,
      selectionsByMeeting: mergedSelections,
      jokerRaceByMeeting: mergedJokers,
      jokerUpdatedAtByMeeting: mergedJokerTimes,
      updatedAt: latestUpdatedAt,
    });
  }

  return Array.from(byId.values());
}

/**
 * Sanitizes a punterId to match the blueprint pattern `^[a-zA-Z0-9_\-]+$` (max 64 chars)
 */
function sanitizeBlueprintId(raw: string): string {
  const cleaned = String(raw || "punter")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
  return cleaned || "punter-default";
}

/**
 * Saves punter sheets to Firebase Cloud Firestore when a verified Google user is signed in.
 */
export async function savePuntersToFirestore(
  punters: PunterProfile[]
): Promise<boolean> {
  if (!authInstance || !dbInstance) return false;
  const user = authInstance.currentUser;
  if (!user || !user.emailVerified) return false;

  const ownerUid = sanitizeBlueprintId(user.uid);

  for (const p of punters) {
    const safePunterId = sanitizeBlueprintId(p.id);
    const sheetId = sanitizeBlueprintId(`${ownerUid}_${safePunterId}`).slice(0, 120);
    const docPath = `punterSheets/${sheetId}`;
    const docRef = doc(dbInstance, "punterSheets", sheetId);

    const safeName = String(p.name || "Punter").trim().slice(0, 60) || "Punter";
    const safeRole = String(p.role || "Member").trim().slice(0, 80) || "Member";

    // Limit map keys to 100 per blueprint constraint
    const selectionsEntries = Object.entries(p.selectionsByMeeting || {}).slice(0, 100);
    const selectionsMap: Record<string, any> = {};
    for (const [k, v] of selectionsEntries) {
      selectionsMap[k] = v || {};
    }

    const jokerEntries = Object.entries(p.jokerRaceByMeeting || {}).slice(0, 100);
    const jokerMap: Record<string, any> = {};
    for (const [k, v] of jokerEntries) {
      jokerMap[k] = v ?? null;
    }

    try {
      const existingSnap = await getDocs(
        query(
          collection(dbInstance, "punterSheets"),
          where("ownerId", "==", ownerUid),
          where("punterId", "==", safePunterId)
        )
      );

      if (existingSnap.empty) {
        await setDoc(docRef, {
          punterId: safePunterId,
          name: safeName,
          role: safeRole,
          ownerId: ownerUid,
          selectionsMap,
          jokerMap,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        await setDoc(doc(dbInstance, "punterSheets", existingDoc.id), {
          punterId: existingData.punterId || safePunterId,
          name: safeName,
          role: safeRole,
          ownerId: existingData.ownerId || ownerUid,
          selectionsMap,
          jokerMap,
          createdAt: existingData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }
  return true;
}

/**
 * Deletes a removed punter sheet from Firebase Cloud Firestore when a verified user is signed in.
 */
export async function deletePunterFromFirestore(
  punterId: string
): Promise<boolean> {
  if (!authInstance || !dbInstance) return false;
  const user = authInstance.currentUser;
  if (!user || !user.emailVerified) return false;

  const ownerUid = sanitizeBlueprintId(user.uid);
  const safePunterId = sanitizeBlueprintId(punterId);
  const sheetId = sanitizeBlueprintId(`${ownerUid}_${safePunterId}`).slice(
    0,
    120
  );
  const docPath = `punterSheets/${sheetId}`;

  try {
    const existingSnap = await getDocs(
      query(
        collection(dbInstance, "punterSheets"),
        where("ownerId", "==", ownerUid),
        where("punterId", "==", safePunterId)
      )
    );
    for (const d of existingSnap.docs) {
      await deleteDoc(doc(dbInstance, "punterSheets", d.id));
    }
    await deleteDoc(doc(dbInstance, "punterSheets", sheetId));
    return true;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    } catch {
      // Ignore if doc did not exist
    }
    return false;
  }
}

/**
 * Subscribes to real-time Firestore punterSheets updates for the signed-in user.
 */
export function subscribeToFirestorePunters(
  user: User,
  onReceive: (profiles: PunterProfile[]) => void
): () => void {
  if (!dbInstance) return () => {};
  const ownerUid = sanitizeBlueprintId(user.uid);
  const q = query(
    collection(dbInstance, "punterSheets"),
    where("ownerId", "==", ownerUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const loaded: PunterProfile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.punterId) {
          loaded.push({
            id: String(d.punterId),
            name: String(d.name || "Punter"),
            role: String(d.role || "Member"),
            selectionsByMeeting: d.selectionsMap || {},
            jokerRaceByMeeting: d.jokerMap || {},
            updatedAt:
              d.updatedAt?.toDate?.()?.toISOString?.() ||
              new Date().toISOString(),
          });
        }
      });
      if (loaded.length > 0) {
        onReceive(loaded);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, "punterSheets");
      } catch {
        // Log structured error without crashing UI
      }
    }
  );
}

/**
 * Universal Cross-Device Cloud API Sync (works with zero login on both AI Studio
 * Node server `/api/punters` AND InfinityFree PHP hosting `./api/punters.php`).
 */
export async function fetchSharedCloudPunters(): Promise<{
  ok: boolean;
  punters?: PunterProfile[];
  deletedPunterIds?: string[];
  updatedAt?: string;
}> {
  if (isFileProtocol) return { ok: false };
  const endpoints = ["./api/punters.php", "/api/punters"];
  for (const url of endpoints) {
    const { ok, data } = await safeFetchJson<{
      ok?: boolean;
      punters?: PunterProfile[];
      deletedPunterIds?: string[];
      updatedAt?: string;
    }>(`${url}?t=${Date.now()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (ok && data && data.ok && Array.isArray(data.punters)) {
      return {
        ok: true,
        punters: data.punters,
        deletedPunterIds: Array.isArray(data.deletedPunterIds)
          ? data.deletedPunterIds
          : [],
        updatedAt: data.updatedAt,
      };
    }
  }
  return { ok: false };
}

export async function saveSharedCloudPunters(
  punters: PunterProfile[],
  deletedPunterIds: string[] = []
): Promise<{
  ok: boolean;
  punters?: PunterProfile[];
  deletedPunterIds?: string[];
  updatedAt?: string;
}> {
  if (isFileProtocol) return { ok: false };
  const endpoints = ["./api/punters.php", "/api/punters"];
  let result: {
    ok: boolean;
    punters?: PunterProfile[];
    deletedPunterIds?: string[];
    updatedAt?: string;
  } = {
    ok: false,
  };

  const bodyJson = JSON.stringify({
    punters,
    deletedPunterIds,
    updatedAt: new Date().toISOString(),
  });

  for (const url of endpoints) {
    const { ok, data } = await safeFetchJson<{
      ok?: boolean;
      punters?: PunterProfile[];
      deletedPunterIds?: string[];
      updatedAt?: string;
    }>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: bodyJson,
    });
    if (ok && data && data.ok && Array.isArray(data.punters)) {
      result = {
        ok: true,
        punters: data.punters,
        deletedPunterIds: Array.isArray(data.deletedPunterIds)
          ? data.deletedPunterIds
          : deletedPunterIds,
        updatedAt: data.updatedAt,
      };
      break;
    }
  }

  // Also sync to Firebase Firestore if the user is authenticated
  if (authInstance?.currentUser?.emailVerified) {
    try {
      await savePuntersToFirestore(result.punters || punters);
    } catch {
      // ignore if firestore write fails
    }
  }

  return result;
}

export async function signInWithGooglePopup(): Promise<User | null> {
  if (!authInstance) return null;
  try {
    const cred = await signInWithPopup(authInstance, googleProvider);
    return cred.user;
  } catch {
    return null;
  }
}

export async function signOutFirebaseUser(): Promise<void> {
  if (!authInstance) return;
  await signOut(authInstance);
}

export function safeOnAuthStateChanged(
  _auth: unknown,
  callback: (user: User | null) => void
): () => void {
  if (!authInstance) {
    try {
      callback(null);
    } catch {
      // ignore
    }
    return () => {};
  }
  try {
    return firebaseOnAuthStateChanged(authInstance, callback, () => {
      try {
        callback(null);
      } catch {
        // ignore
      }
    });
  } catch {
    try {
      callback(null);
    } catch {
      // ignore
    }
    return () => {};
  }
}

export { safeOnAuthStateChanged as onAuthStateChanged };
export type { User };
