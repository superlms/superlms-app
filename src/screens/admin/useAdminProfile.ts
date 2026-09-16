import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminUser, getStoredUser } from '../../api/authApi';
import { getAdminProfile } from '../../api/adminApi';

let inFlight: Promise<AdminUser | null> | null = null;

// The admin's school and permissions from the server, saved over what the
// phone holds — an account opened from the switcher is saved without them.
const refreshAdminProfile = (): Promise<AdminUser | null> => {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const fresh = await getAdminProfile();
        const saved = (await getStoredUser()) as AdminUser | null;
        // Only while that account is still the one signed in.
        if (!fresh?.id || (saved && String(saved.id) !== String(fresh.id))) {
          return null;
        }
        const merged = {
          ...(saved ?? fresh),
          organization: fresh.organization ?? null,
          permissions: fresh.permissions,
        } as AdminUser;
        await AsyncStorage.setItem('user_data', JSON.stringify(merged));
        return merged;
      } catch {
        return null;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
};

/**
 * The signed-in school admin — their school's name and logo, and the screens
 * they may use: at once from the phone, then fresh from the server.
 */
export const useAdminProfile = (): AdminUser | null => {
  const [profile, setProfile] = useState<AdminUser | null>(null);

  useEffect(() => {
    let alive = true;
    getStoredUser()
      .then(u => {
        if (alive) setProfile(prev => prev ?? (u as AdminUser | null));
      })
      .catch(() => {});
    refreshAdminProfile().then(u => {
      if (alive && u) setProfile(u);
    });
    return () => {
      alive = false;
    };
  }, []);

  return profile;
};
