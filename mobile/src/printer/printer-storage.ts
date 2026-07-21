import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface StoredPrinterConnection {
  name: string;
  address: string;
  connectedAt: string;
}

const PRINTER_CONNECTION_KEY = 'bluetooth_printer_connection';

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

export async function savePrinterConnection(connection: StoredPrinterConnection) {
  await setItem(PRINTER_CONNECTION_KEY, JSON.stringify(connection));
}

export async function loadPrinterConnection() {
  const raw = await getItem(PRINTER_CONNECTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredPrinterConnection;
  } catch {
    await deleteItem(PRINTER_CONNECTION_KEY);
    return null;
  }
}

export async function clearPrinterConnection() {
  await deleteItem(PRINTER_CONNECTION_KEY);
}
