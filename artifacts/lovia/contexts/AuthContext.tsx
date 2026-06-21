import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, db, storage } from "@/firebase/config";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface UserProfile {
  uid: string;
  email: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  partnerId: string | null;
  partnerLocked: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  resendVerification: () => Promise<void>;
  setUsername: (username: string, displayName: string, avatarUri?: string) => Promise<void>;
  searchByUsername: (username: string) => Promise<UserProfile | null>;
  linkPartner: (partnerUid: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Bloque RootGuard pendant la récupération du profil
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (snap.exists()) {
        setProfile({ uid: firebaseUser.uid, ...snap.data() } as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ uid: user.uid, ...snap.data() } as UserProfile);
      }
    });
    return unsub;
  }, [user?.uid]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      username: null,
      displayName: email.split("@")[0],
      avatarUrl: null,
      partnerId: null,
      partnerLocked: false,
      createdAt: serverTimestamp(),
    });
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resendVerification = useCallback(async () => {
    if (user) await sendEmailVerification(user);
  }, [user]);

  const setUsername = useCallback(
    async (username: string, displayName: string, avatarUri?: string) => {
      if (!user) throw new Error("Not logged in");

      const lower = username.toLowerCase();
      const q = query(collection(db, "users"), where("username", "==", lower));
      const { getDocs } = await import("firebase/firestore");
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error("Ce @username est déjà pris.");

      let avatarUrl: string | null = null;

      if (avatarUri) {
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        const avatarRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(avatarRef, blob, { contentType: "image/jpeg" });
        avatarUrl = await getDownloadURL(avatarRef);
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: lower,
        displayName: displayName.trim(),
        ...(avatarUrl !== null ? { avatarUrl } : {}),
      });
    },
    [user]
  );

  const searchByUsername = useCallback(
    async (username: string): Promise<UserProfile | null> => {
      const lower = username.toLowerCase();
      const q = query(collection(db, "users"), where("username", "==", lower));
      const { getDocs } = await import("firebase/firestore");
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { uid: d.id, ...d.data() } as UserProfile;
    },
    []
  );

  const linkPartner = useCallback(
    async (partnerUid: string) => {
      if (!user) throw new Error("Not logged in");
      // Écrire son propre doc en premier (toujours autorisé par les règles de sécurité)
      await updateDoc(doc(db, "users", user.uid), {
        partnerId: partnerUid,
        partnerLocked: true,
      });
      // Tenter d'écrire le doc du partenaire (peut échouer selon les règles Firestore)
      try {
        await updateDoc(doc(db, "users", partnerUid), {
          partnerId: user.uid,
          partnerLocked: true,
        });
      } catch {
        // Écriture du partenaire bloquée par les règles — l'utilisateur sera invité à confirmer de son côté
      }
    },
    [user]
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!user) throw new Error("Not logged in");
      await updateDoc(doc(db, "users", user.uid), { displayName: name });
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        logOut,
        resendVerification,
        setUsername,
        searchByUsername,
        linkPartner,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
