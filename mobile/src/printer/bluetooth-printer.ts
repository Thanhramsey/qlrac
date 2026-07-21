import { PermissionsAndroid, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import {
  clearPrinterConnection,
  loadPrinterConnection,
  savePrinterConnection,
  type StoredPrinterConnection,
} from '@/printer/printer-storage';

interface RawPrinterDevice {
  name?: string;
  deviceName?: string;
  address?: string;
  macAddress?: string;
  bonded?: boolean;
}

interface PrinterNativeModule {
  BluetoothManager: {
    enableBluetooth: () => Promise<unknown>;
    scanDevices: () => Promise<unknown>;
    connect: (address: string) => Promise<unknown>;
    disconnect?: (address: string) => Promise<unknown>;
  };
  BluetoothEscposPrinter: {
    printerInit?: () => Promise<unknown>;
    printText: (content: string, options?: Record<string, unknown>) => Promise<unknown>;
    printPic?: (base64Data: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
}

export interface PrinterDevice {
  name: string;
  address: string;
  bonded: boolean;
}

export interface ThermalReceiptPayload {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerAddress: string;
  billingPeriod: string;
  serviceName: string;
  totalAmount: number;
  cashierName: string;
  unitName: string;
  unitAddress: string;
  unitPhone: string;
  unitBankAccount: string;
  qrPaymentImageUrl?: string;
}

function parseJsonString<T>(value: unknown): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractDevices(input: unknown): RawPrinterDevice[] {
  if (!input) {
    return [];
  }

  if (typeof input === 'string') {
    const parsed = parseJsonString<unknown>(input);
    return extractDevices(parsed);
  }

  if (Array.isArray(input)) {
    return input.filter((item): item is RawPrinterDevice => typeof item === 'object' && item !== null);
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    return [
      ...extractDevices(record.paired),
      ...extractDevices(record.unpaired),
      ...extractDevices(record.devices),
      ...extractDevices(record.found),
    ];
  }

  return [];
}

function normalizeDevice(raw: RawPrinterDevice): PrinterDevice | null {
  const address = (raw.address ?? raw.macAddress ?? '').trim();
  if (!address) {
    return null;
  }

  const name = (raw.name ?? raw.deviceName ?? 'May in nhiet').trim() || 'May in nhiet';
  return {
    name,
    address,
    bonded: Boolean(raw.bonded),
  };
}

async function getPrinterModule(): Promise<PrinterNativeModule | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    const module = require('react-native-bluetooth-escpos-printer') as PrinterNativeModule;
    if (!module?.BluetoothManager || !module?.BluetoothEscposPrinter) {
      return null;
    }

    return module;
  } catch {
    return null;
  }
}

async function ensureBluetoothPermissions() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const androidVersion = Number(Platform.Version);
  const permissions =
    androidVersion >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

function formatAmount(value: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)}d`;
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function buildReceiptHeadContent(payload: ThermalReceiptPayload, includeQrPlaceholder: boolean) {
  const lines = [
    '========================',
    payload.unitName,
    `dia chi: ${payload.unitAddress}`,
    `dien thoai: ${payload.unitPhone}`,
    `STK: ${payload.unitBankAccount}`,
    '========================',
    'PHIEU THU',
    `So phieu: ${payload.receiptNumber}`,
    '',
    `Ngay ${formatDateOnly(payload.date)}`,
    '------------------------------',
    '',
    `KH: ${payload.customerName}`,
    `Dia chi: ${payload.customerAddress}`,
    `Ky: ${payload.billingPeriod}`,
    `Dich vu: ${payload.serviceName}`,
    '------------------------------',
    'THANH TIEN',
    formatAmount(payload.totalAmount),
    '------------------------------',
    'QR ngan hang',
  ];

  if (includeQrPlaceholder) {
    lines.push('██████████████');
    lines.push('████ QR ████');
    lines.push('██████████████');
  }

  return `${lines.join('\r\n')}\r\n`;
}

function buildReceiptFooterContent(payload: ThermalReceiptPayload) {
  const lines = [
    '------------------------------',
    `Thu ngan: ${payload.cashierName}`,
    '========================',
    '',
  ];

  return lines.join('\r\n');
}

function buildPrinterErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function loadImageAsBase64(imageUrl: string) {
  const normalized = imageUrl.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('data:image')) {
    const base64Part = normalized.split(',')[1] ?? '';
    return base64Part || null;
  }

  const fileName = `qr-payment-${Date.now()}.img`;
  const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheDir) {
    return null;
  }

  const targetUri = `${cacheDir}${fileName}`;
  const downloaded = await FileSystem.downloadAsync(normalized, targetUri);

  try {
    const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } finally {
    await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
  }
}

export async function listPrinterDevices() {
  const module = await getPrinterModule();
  if (!module) {
    throw new Error('Chuc nang may in Bluetooth chi ho tro tren Android dev build.');
  }

  const granted = await ensureBluetoothPermissions();
  if (!granted) {
    throw new Error('Can cap quyen Bluetooth de quet va ket noi may in.');
  }

  const { BluetoothManager } = module;
  const enabledResult = await BluetoothManager.enableBluetooth();
  const scanResult = await BluetoothManager.scanDevices();

  const rawDevices = [...extractDevices(enabledResult), ...extractDevices(scanResult)];
  const byAddress = new Map<string, PrinterDevice>();

  for (const raw of rawDevices) {
    const normalized = normalizeDevice(raw);
    if (!normalized) {
      continue;
    }

    if (!byAddress.has(normalized.address)) {
      byAddress.set(normalized.address, normalized);
    }
  }

  return Array.from(byAddress.values());
}

export async function connectPrinter(device: PrinterDevice) {
  const module = await getPrinterModule();
  if (!module) {
    throw new Error('Khong the tai module may in Bluetooth.');
  }

  const granted = await ensureBluetoothPermissions();
  if (!granted) {
    throw new Error('Can cap quyen Bluetooth truoc khi ket noi may in.');
  }

  await module.BluetoothManager.enableBluetooth();
  await module.BluetoothManager.connect(device.address);

  const connection: StoredPrinterConnection = {
    name: device.name,
    address: device.address,
    connectedAt: new Date().toISOString(),
  };

  await savePrinterConnection(connection);
  return connection;
}

export async function disconnectPrinter() {
  const module = await getPrinterModule();
  const saved = await loadPrinterConnection();

  if (module?.BluetoothManager.disconnect && saved?.address) {
    try {
      await module.BluetoothManager.disconnect(saved.address);
    } catch {
      // ignore disconnect failures, local state still needs reset
    }
  }

  await clearPrinterConnection();
}

export async function getSavedPrinterConnection() {
  return await loadPrinterConnection();
}

export async function hasSavedPrinterConnection() {
  const saved = await loadPrinterConnection();
  return Boolean(saved?.address);
}

async function ensureConnectedPrinter() {
  const module = await getPrinterModule();
  if (!module) {
    throw new Error('Chuc nang in Bluetooth chi ho tro tren Android dev build.');
  }

  const granted = await ensureBluetoothPermissions();
  if (!granted) {
    throw new Error('Can cap quyen Bluetooth truoc khi in phieu.');
  }

  const saved = await loadPrinterConnection();
  if (!saved?.address) {
    throw new Error('Chua ket noi may in Bluetooth.');
  }

  await module.BluetoothManager.enableBluetooth();
  try {
    await module.BluetoothManager.connect(saved.address);
  } catch {
    await clearPrinterConnection();
    throw new Error('Khong the ket noi lai voi may in da luu. Vui long ket noi lai.');
  }

  return module;
}

export async function printThermalReceipt(payload: ThermalReceiptPayload) {
  const module = await ensureConnectedPrinter();
  const hasQrImage = Boolean(payload.qrPaymentImageUrl?.trim());
  const headContent = buildReceiptHeadContent(payload, !hasQrImage);
  const footerContent = buildReceiptFooterContent(payload);

  try {
    await module.BluetoothEscposPrinter.printerInit?.();
    await module.BluetoothEscposPrinter.printText(headContent, {
      encoding: 'GBK',
      codepage: 0,
    });

    if (hasQrImage && module.BluetoothEscposPrinter.printPic) {
      try {
        const base64Image = await loadImageAsBase64(payload.qrPaymentImageUrl ?? '');
        if (base64Image) {
          await module.BluetoothEscposPrinter.printPic(base64Image, {
            width: 280,
            left: 40,
          });
          await module.BluetoothEscposPrinter.printText('\r\n', { encoding: 'GBK', codepage: 0 });
        } else {
          await module.BluetoothEscposPrinter.printText('██████████████\r\n████ QR ████\r\n██████████████\r\n', {
            encoding: 'GBK',
            codepage: 0,
          });
        }
      } catch {
        await module.BluetoothEscposPrinter.printText('██████████████\r\n████ QR ████\r\n██████████████\r\n', {
          encoding: 'GBK',
          codepage: 0,
        });
      }
    }

    await module.BluetoothEscposPrinter.printText(footerContent, {
      encoding: 'GBK',
      codepage: 0,
    });

    await module.BluetoothEscposPrinter.printText('\r\n\r\n', {});
  } catch (error) {
    throw new Error(buildPrinterErrorMessage(error, 'Gui lenh in that bai.'));
  }
}
