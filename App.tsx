/**
 * App.tsx — Root file
 * Only responsible for initializing Navigation + SafeAreaProvider
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/index'; // 👈 All navigation logic is here
import {
  initNotifications,
  showLocalImmediateNotification,
} from './utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  React.useEffect(() => {
    initNotifications();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timer: any;

    const API_BASE = 'https://backend-careflow.vercel.app';
    const POLL_MS = 15000;

    const state: {
      userId?: string;
      initialized?: boolean;
      seen?: Set<string>;
    } = {};

    const getSession = async () => {
      try {
        const raw = await AsyncStorage.getItem('session');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const getAuthHeaders = async () => {
      try {
        const sess = await getSession();
        const base = { 'Content-Type': 'application/json' } as Record<
          string,
          string
        >;
        if (!sess) return base;
        const token = sess?.token || sess?.user?.token || sess?.accessToken;
        const userId = sess?.user?.id || sess?.id;
        const withAuth = token
          ? { ...base, Authorization: `Bearer ${token}` }
          : base;
        return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
      } catch {
        return { 'Content-Type': 'application/json' } as Record<string, string>;
      }
    };

    const getUserKey = (userId: string) => {
      const id = String(userId || '').trim();
      return {
        init: `notifs_seen_init:${id}`,
        seen: `notifs_seen_ids:${id}`,
      };
    };

    const ensureUserState = async (userId: string) => {
      if (state.userId === String(userId) && state.seen && state.initialized)
        return;
      const k = getUserKey(userId);
      state.userId = String(userId);
      try {
        const initRaw = await AsyncStorage.getItem(k.init);
        state.initialized = initRaw === '1';
      } catch {
        state.initialized = false;
      }
      try {
        const raw = await AsyncStorage.getItem(k.seen);
        const arr = Array.isArray(raw ? JSON.parse(raw) : [])
          ? JSON.parse(raw as string)
          : [];
        state.seen = new Set(arr.map((x: any) => String(x)));
      } catch {
        state.seen = new Set();
      }
    };

    const persistSeen = async () => {
      try {
        if (!state.userId || !state.seen) return;
        const k = getUserKey(state.userId);
        const arr = Array.from(state.seen.values()).slice(-500);
        await AsyncStorage.setItem(k.seen, JSON.stringify(arr));
        await AsyncStorage.setItem(k.init, '1');
        state.initialized = true;
      } catch {}
    };

    const tick = async () => {
      try {
        const sess = await getSession();
        const userId = sess?.user?.id || sess?.id;
        if (!userId) return;

        await ensureUserState(String(userId));

        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications?limit=50`, {
          headers,
        });
        if (!res.ok) return;
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : [];
        const mapped = list
          .map((n: any) => ({
            id: String(n?.id ?? ''),
            title: String(n?.title || 'Notification'),
            message: String(n?.message || ''),
            read: Boolean(n?.read) === true,
            timestamp: n?.created_at
              ? new Date(n.created_at).getTime()
              : Date.now(),
          }))
          .filter((x: any) => String(x.id || '').trim().length > 0);

        if (!state.seen) state.seen = new Set();

        if (!state.initialized) {
          for (const it of mapped) {
            state.seen.add(String(it.id));
          }
          await persistSeen();
          return;
        }

        const fresh = mapped.filter(it => !state.seen!.has(String(it.id)));
        if (fresh.length === 0) return;

        fresh
          .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-3)
          .forEach(it => {
            const title = String(it.title || 'Notification').trim();
            const body = String(it.message || '').trim();
            if (!body) return;
            try {
              showLocalImmediateNotification(title, body);
            } catch {}
          });

        for (const it of fresh) {
          state.seen.add(String(it.id));
        }
        await persistSeen();
      } catch {}
    };

    const loop = async () => {
      if (!mounted) return;
      await tick();
      if (!mounted) return;
      timer = setTimeout(loop, POLL_MS);
    };

    loop();

    return () => {
      mounted = false;
      try {
        if (timer) clearTimeout(timer);
      } catch {}
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
