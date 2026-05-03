// src/auth/AuthProvider.jsx
import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const { uid, email } = firebaseUser;
        setUser({ uid, email });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signup: async (email, password) => {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        setUser({
          uid: credential.user.uid,
          email: credential.user.email,
        });
        return credential;
      },
      login: async (email, password) => {
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        setUser({
          uid: credential.user.uid,
          email: credential.user.email,
        });
        return credential;
      },
      logout: async () => {
        await signOut(auth);
        setUser(null);
      },
      resetPassword: async (email) => sendPasswordResetEmail(auth, email),
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
}
