import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ChatMessage, Pirate, WorldEvent } from '../game/types';
import { getDefaultAppearance } from '../game/worldData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory boot connection probe
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  if (user && user.emailVerified) {
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Capitán Pirata').slice(0, 60);
    try {
      const existingSnap = await getDoc(userRef);
      if (!existingSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          displayName,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }
  return user;
}

export async function signOutCaptain(): Promise<void> {
  await signOut(auth);
}

export async function savePirateToFirestore(pirate: Pirate, user: User): Promise<void> {
  if (!user.emailVerified) return;
  const path = `pirates/${pirate.id}`;
  try {
    await setDoc(doc(db, 'pirates', pirate.id), {
      id: pirate.id,
      ownerId: user.uid,
      isPublic: true,
      name: pirate.name.slice(0, 32),
      epithet: pirate.epithet.slice(0, 40),
      faction: pirate.faction || 'piratas',
      role: pirate.role,
      race: pirate.race || 'humano',
      originSea: pirate.originSea,
      dream: pirate.dream.slice(0, 120),
      physicalTraits: pirate.physicalTraits.slice(0, 2),
      mentalTraits: pirate.mentalTraits.slice(0, 2),
      bounty: Math.max(0, Math.round(pirate.bounty)),
      berries: Math.max(0, Math.round(pirate.berries)),
      wins: Math.max(0, Math.round(pirate.wins)),
      losses: Math.max(0, Math.round(pirate.losses)),
      devilFruit: pirate.devilFruit.slice(0, 40),
      crewName: pirate.crewName.slice(0, 48),
      islandId: pirate.islandId.slice(0, 64),
      flagColor: pirate.flagColor.slice(0, 16),
      flagEmblem: pirate.flagEmblem,
      hatStyle: pirate.hatStyle,
      hatColor: (pirate.hatColor || '').slice(0, 16),
      skinTone: pirate.skinTone.slice(0, 16),
      hairStyle: pirate.hairStyle,
      hairColor: pirate.hairColor.slice(0, 16),
      bodyBuild: pirate.bodyBuild,
      outfitStyle: pirate.outfitStyle,
      outfitColor: pirate.outfitColor.slice(0, 16),
      accessory: pirate.accessory,
      accessoryColor: (pirate.accessoryColor || '').slice(0, 16),
      capeStyle: pirate.capeStyle || 'none',
      capeColor: (pirate.capeColor || '').slice(0, 16),
      inventory: (pirate.inventory ?? []).slice(0, 64),
      equipped: pirate.equipped ?? {},
      directive: pirate.directive,
      status: pirate.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePirateDirectiveInFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      directive: pirate.directive,
      status: pirate.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePirateCrewInFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      crewName: pirate.crewName.slice(0, 48),
      role: pirate.role,
      flagColor: pirate.flagColor.slice(0, 16),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePirateProfileInFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      name: pirate.name.slice(0, 32),
      epithet: pirate.epithet.slice(0, 40),
      faction: pirate.faction || 'piratas',
      role: pirate.role,
      originSea: pirate.originSea,
      dream: pirate.dream.slice(0, 120),
      physicalTraits: pirate.physicalTraits.slice(0, 2),
      mentalTraits: pirate.mentalTraits.slice(0, 2),
      flagColor: pirate.flagColor.slice(0, 16),
      hatStyle: pirate.hatStyle,
      hatColor: (pirate.hatColor || '').slice(0, 16),
      outfitStyle: pirate.outfitStyle,
      outfitColor: pirate.outfitColor.slice(0, 16),
      accessory: pirate.accessory,
      accessoryColor: (pirate.accessoryColor || '').slice(0, 16),
      capeStyle: pirate.capeStyle || 'none',
      capeColor: (pirate.capeColor || '').slice(0, 16),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePirateBuildInFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      hatStyle: pirate.hatStyle,
      hatColor: (pirate.hatColor || '').slice(0, 16),
      outfitStyle: pirate.outfitStyle,
      outfitColor: pirate.outfitColor.slice(0, 16),
      accessory: pirate.accessory,
      accessoryColor: (pirate.accessoryColor || '').slice(0, 16),
      capeStyle: pirate.capeStyle || 'none',
      capeColor: (pirate.capeColor || '').slice(0, 16),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePirateInventoryInFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      inventory: (pirate.inventory ?? []).slice(0, 64),
      equipped: pirate.equipped ?? {},
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncPirateProgressToFirestore(
  pirate: Pirate,
  user: User
): Promise<void> {
  if (!user.emailVerified || pirate.ownerId !== user.uid) return;
  const path = `pirates/${pirate.id}`;
  try {
    await updateDoc(doc(db, 'pirates', pirate.id), {
      bounty: Math.max(0, Math.round(pirate.bounty)),
      berries: Math.max(0, Math.round(pirate.berries)),
      wins: Math.max(0, Math.round(pirate.wins)),
      losses: Math.max(0, Math.round(pirate.losses)),
      devilFruit: pirate.devilFruit.slice(0, 40),
      crewName: pirate.crewName.slice(0, 48),
      islandId: pirate.islandId.slice(0, 64),
      inventory: (pirate.inventory ?? []).slice(0, 64),
      equipped: pirate.equipped ?? {},
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePirateFromFirestore(
  pirateId: string,
  user: User
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `pirates/${pirateId}`;
  try {
    await deleteDoc(doc(db, 'pirates', pirateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function publishWorldEventToFirestore(
  ev: WorldEvent,
  user: User
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `worldEvents/${ev.id}`;
  try {
    const firestoreType =
      ev.type === 'boss' ? 'duel' : ev.type === 'level_up' ? 'launch' : ev.type;
    await setDoc(doc(db, 'worldEvents', ev.id), {
      id: ev.id,
      authorId: user.uid,
      isPublic: true,
      type: firestoreType,
      sea: ev.sea.slice(0, 32),
      islandId: ev.islandId.slice(0, 64),
      pirateId: ev.pirateId.slice(0, 128),
      pirateName: ev.pirateName.slice(0, 40),
      message: ev.message.slice(0, 240),
      bountyDelta: Math.max(0, Math.round(ev.bountyDelta)),
      day: Math.max(1, Math.round(ev.day)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function publishChatMessageToFirestore(
  msg: ChatMessage,
  user: User
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `chatMessages/${msg.id}`;
  try {
    await setDoc(doc(db, 'chatMessages', msg.id), {
      id: msg.id,
      authorId: user.uid,
      isPublic: true,
      senderName: msg.senderName.slice(0, 40),
      sea: msg.sea.slice(0, 32),
      text: msg.text.slice(0, 280),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserPirates(
  uid: string,
  onData: (pirates: Pirate[]) => void
): Unsubscribe {
  const path = 'pirates';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: Pirate[] = snap.docs
        .map((d) => {
          const data = d.data();
          const ownerId = String(data.ownerId || uid);
          const pirateName = String(data.name || 'Pirata');
          const flagColor = String(data.flagColor || '#dc2626');
          const fallback = getDefaultAppearance(pirateName, flagColor);
          const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
          const rawIsland = String(data.islandId || 'isla-dawn');
          return {
            id: String(data.id || d.id),
            ownerId,
            isPlayerOwned: true,
            name: pirateName,
            epithet: String(data.epithet || ''),
            faction: data.faction || 'piratas',
            role: data.role || 'Capitán',
            race: data.race || 'humano',
            originSea: data.originSea || 'Mar del Este',
            dream: String(data.dream || ''),
            physicalTraits: Array.isArray(data.physicalTraits)
              ? data.physicalTraits.map(String)
              : ['fuerte'],
            mentalTraits: Array.isArray(data.mentalTraits)
              ? data.mentalTraits.map(String)
              : ['astuto'],
            bounty: Number(data.bounty || 500000),
            berries: Number(data.berries || 0),
            wins: Number(data.wins || 0),
            losses: Number(data.losses || 0),
            level: Math.max(1, 1 + Math.floor(Number(data.wins || 0) / 2)),
            xp: 0,
            bossesDefeated: 0,
            devilFruit: String(data.devilFruit || ''),
            crewName: String(data.crewName || 'Sin tripulación'),
            islandId: rawIsland === 'laugh-tale' ? 'isla-lodestar' : rawIsland,
            islandSpot: 'taberna',
            islandActivity: '',
            manualMode: false,
            flagColor,
            flagEmblem: data.flagEmblem || 'skull',
            directive: data.directive || 'libre',
            status: data.status || 'active',
            sailingToIslandId: null,
            sailProgress: 0,
            sailSpeed: 0.018,
            cooldownSec: 8,
            hatStyle: data.hatStyle || 'straw',
            hatColor: data.hatColor ? String(data.hatColor) : undefined,
            skinTone: String(data.skinTone || fallback.skinTone),
            hairStyle: data.hairStyle || fallback.hairStyle,
            hairColor: String(data.hairColor || fallback.hairColor),
            bodyBuild: data.bodyBuild || fallback.bodyBuild,
            outfitStyle: data.outfitStyle || fallback.outfitStyle,
            outfitColor: String(data.outfitColor || fallback.outfitColor),
            accessory: data.accessory || 'none',
            accessoryColor: data.accessoryColor ? String(data.accessoryColor) : undefined,
            capeStyle: data.capeStyle || 'none',
            capeColor: data.capeColor ? String(data.capeColor) : undefined,
            inventory: Array.isArray(data.inventory) ? data.inventory.map(String) : [],
            equipped:
              data.equipped && typeof data.equipped === 'object' ? data.equipped : {},
            createdAtMs: createdMs,
          } satisfies Pirate;
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
