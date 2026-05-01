// src/business/BusinessProfileProvider.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase";
import { BusinessProfileContext } from "./BusinessProfileContext";

function isCompleteProfile(profile) {
  return Boolean(
    profile &&
      profile.businessType &&
      Array.isArray(profile.roles) &&
      profile.roles.length > 0 &&
      profile.hours
  );
}

function requireSignedInUser(user) {
  if (!user?.uid) {
    throw new Error("You must be logged in to save business data.");
  }
}

export function BusinessProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadingProfile(true);
      setProfileError("");

      if (!user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      try {
        const ref = doc(db, "businessProfiles", user.uid);
        const snap = await getDoc(ref);

        if (!active) return;

        if (!snap.exists()) {
          setProfile(null);
          return;
        }

        const data = snap.data();
        if (data.ownerUid && data.ownerUid !== user.uid) {
          throw new Error("Business profile ownership check failed.");
        }

        setProfile({ ...data, ownerUid: user.uid });
      } catch (err) {
        console.error("Failed to load business profile", err);
        if (active) {
          setProfile(null);
          setProfileError(
            "We could not load your business profile. Please try again."
          );
        }
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [user]);

  const saveProfile = useCallback(
    async (config) => {
      requireSignedInUser(user);

      const statePayload = {
        ...(profile || {}),
        ...config,
        ownerUid: user.uid,
      };

      const firestorePayload = {
        ...config,
        ownerUid: user.uid,
        updatedAt: serverTimestamp(),
      };

      try {
        const ref = doc(db, "businessProfiles", user.uid);
        await setDoc(ref, firestorePayload, { merge: true });
        setProfile(statePayload);
        setProfileError("");
        return statePayload;
      } catch (err) {
        console.error("Failed to save business profile to Firestore", err);
        throw err;
      }
    },
    [profile, user]
  );

  const saveCsvDemand = useCallback(
    async (csvDemand) => saveProfile({ csvDemand }),
    [saveProfile]
  );

  const value = useMemo(
    () => ({
      profile,
      hasProfile: isCompleteProfile(profile),
      loadingProfile,
      profileError,
      saveProfile,
      saveCsvDemand,
    }),
    [profile, loadingProfile, profileError, saveProfile, saveCsvDemand]
  );

  return (
    <BusinessProfileContext.Provider value={value}>
      {children}
    </BusinessProfileContext.Provider>
  );
}
