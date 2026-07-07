import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { LoginResponse } from '@/types/auth';

const AUTH_SESSION_KEY = 'auth_session';

function getWebStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(key) ?? null;
  }

  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveAuthSession(session: LoginResponse) {
  await setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function loadAuthSession() {
  const raw = await getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LoginResponse;
  } catch {
    await deleteItem(AUTH_SESSION_KEY);
    return null;
  }
}

export async function clearAuthSession() {
  await deleteItem(AUTH_SESSION_KEY);
}
