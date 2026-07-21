import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform, PermissionsAndroid } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { API_BASE_URL } from '@/constants/api-base-url';

const PRINTER_DEVICE_KEY = 'connected_printer_device';

export interface BluetoothDevice {
  name: string;
  address: string;
  isSimulated?: boolean;
  isBonded?: boolean;
}

export interface ReceiptInvoiceData {
  id: number;
  kyHoaDon: string;
  tongTien: string | number;
  thue: string | number;
  paymentDate: string | null;
  invoiceSerial?: string | null;
  invoiceFkey?: string | null;
  collectedByName?: string | null;
  household: {
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
    soDienThoai: string | null;
    serviceCatalog?: {
      tenDichVu: string;
    } | null;
  } | null;
}

export interface ReceiptDataPayload {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyAccountNumber: string;
  portalUrl: string;
  qrThanhToan?: string;
  generatedAt: string;
  invoices: ReceiptInvoiceData[];
}

// Helper to remove Vietnamese accents for clean thermal printing
function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

class PrinterService {
  private isConnected: boolean = false;
  private connectedDevice: BluetoothDevice | null = null;
  private isScanning: boolean = false;
  private scannedDevices: BluetoothDevice[] = [];
  private listeners: Set<() => void> = new Set();
  private lastPrintedText: string = '';
  private activeNativeDevice: any = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const stored = await SecureStore.getItemAsync(PRINTER_DEVICE_KEY);
      if (stored) {
        const device = JSON.parse(stored) as BluetoothDevice;
        
        // On native platforms, check if the device is actually connected/available
        if (Platform.OS !== 'web' && !device.isSimulated) {
          try {
            const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
            if (isBluetoothEnabled) {
              const isStillConnected = await RNBluetoothClassic.isDeviceConnected(device.address);
              if (isStillConnected) {
                this.activeNativeDevice = await RNBluetoothClassic.connectToDevice(device.address);
                this.isConnected = true;
                this.connectedDevice = device;
              } else {
                // Device stored but disconnected, attempt silent reconnect
                const connected = await RNBluetoothClassic.connectToDevice(device.address);
                if (connected) {
                  this.activeNativeDevice = connected;
                  this.isConnected = true;
                  this.connectedDevice = device;
                }
              }
            }
          } catch (err) {
            console.warn('Lỗi kết nối lại thiết bị thật khi khởi động:', err);
          }
        } else {
          // If simulated
          this.isConnected = true;
          this.connectedDevice = device;
        }
        this.notify();
      }
    } catch (e) {
      console.warn('Không tải được cấu hình máy in đã lưu:', e);
    }
  }

  // Subscriptions for React components
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Getters
  getIsConnected() {
    return this.isConnected;
  }

  getConnectedDevice() {
    return this.connectedDevice;
  }

  getIsScanning() {
    return this.isScanning;
  }

  getScannedDevices() {
    return this.scannedDevices;
  }

  getLastPrintedText() {
    return this.lastPrintedText;
  }

  // Check connection state
  async checkConnection(): Promise<boolean> {
    if (Platform.OS !== 'web' && this.isConnected && this.connectedDevice && !this.connectedDevice.isSimulated) {
      try {
        const isStillConnected = await RNBluetoothClassic.isDeviceConnected(this.connectedDevice.address);
        if (!isStillConnected) {
          this.isConnected = false;
          this.connectedDevice = null;
          this.activeNativeDevice = null;
          this.notify();
          return false;
        }
        return true;
      } catch (e) {
        this.isConnected = false;
        this.connectedDevice = null;
        this.activeNativeDevice = null;
        this.notify();
        return false;
      }
    }
    return this.isConnected;
  }

  private async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = parseInt(String(Platform.Version), 10);
      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('Lỗi yêu cầu quyền Bluetooth:', err);
      return false;
    }
  }

  // Scan Bluetooth devices
  async scanDevices(): Promise<BluetoothDevice[]> {
    if (this.isScanning) return this.scannedDevices;

    this.isScanning = true;
    this.scannedDevices = [];
    this.notify();

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockDevices: BluetoothDevice[] = [
            { name: 'RI-5809DD (Giả lập)', address: '86:DE:B7:44:98:C3', isSimulated: true, isBonded: false },
            { name: 'ZJiang 5809DD (Giả lập)', address: '00:11:22:33:44:55', isSimulated: true, isBonded: false },
          ];
          this.scannedDevices = mockDevices;
          this.isScanning = false;
          this.notify();
          resolve(mockDevices);
        }, 1500);
      });
    }

    try {
      const hasPermission = await this.requestBluetoothPermissions();
      if (!hasPermission) {
        throw new Error('Quyền truy cập Bluetooth bị từ chối. Vui lòng cấp quyền Bluetooth trong Cài đặt điện thoại để tìm máy in.');
      }

      const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!isBluetoothEnabled) {
        // Prompt to turn on Bluetooth on Android
        await RNBluetoothClassic.requestBluetoothEnabled();
      }

      const list: BluetoothDevice[] = [];

      // 1. Get paired (bonded) devices (quickest)
      const bonded = await RNBluetoothClassic.getBondedDevices();
      bonded.forEach((d) => {
        list.push({
          name: d.name || 'Thiết bị không tên',
          address: d.address,
          isSimulated: false,
          isBonded: true,
        });
      });

      // Update UI with paired devices first
      this.scannedDevices = [...list];
      this.notify();

      // 2. Discover other devices
      const discovered = await RNBluetoothClassic.startDiscovery();
      discovered.forEach((d) => {
        if (!list.some((existing) => existing.address === d.address)) {
          list.push({
            name: d.name || 'Thiết bị không tên',
            address: d.address,
            isSimulated: false,
            isBonded: false,
          });
        }
      });

      this.scannedDevices = list;
    } catch (e) {
      console.warn('Lỗi quét thiết bị thật:', e);
      this.scannedDevices = [];
      throw e;
    } finally {
      this.isScanning = false;
      this.notify();
    }

    return this.scannedDevices;
  }

  // Connect device
  async connectDevice(device: BluetoothDevice): Promise<boolean> {
    this.isScanning = false;
    this.isConnected = false;
    this.notify();

    if (device.isSimulated) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          this.isConnected = true;
          this.connectedDevice = device;
          try {
            await SecureStore.setItemAsync(PRINTER_DEVICE_KEY, JSON.stringify(device));
          } catch (e) {
            console.warn('Lỗi lưu cấu hình máy in:', e);
          }
          this.notify();
          resolve(true);
        }, 1000);
      });
    }

    try {
      const connected = await RNBluetoothClassic.connectToDevice(device.address);
      if (connected) {
        this.isConnected = true;
        this.connectedDevice = device;
        this.activeNativeDevice = connected;
        try {
          await SecureStore.setItemAsync(PRINTER_DEVICE_KEY, JSON.stringify(device));
        } catch (e) {
          console.warn('Lỗi lưu cấu hình máy in:', e);
        }
        this.notify();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Lỗi kết nối máy in Bluetooth:', e);
      throw e;
    }
  }

  // Disconnect
  async disconnectDevice(): Promise<void> {
    if (this.activeNativeDevice) {
      try {
        await this.activeNativeDevice.disconnect();
      } catch (e) {
        console.warn('Lỗi ngắt kết nối thiết bị Bluetooth:', e);
      }
      this.activeNativeDevice = null;
    }
    this.isConnected = false;
    this.connectedDevice = null;
    try {
      await SecureStore.deleteItemAsync(PRINTER_DEVICE_KEY);
    } catch (e) {
      console.warn('Lỗi xóa cấu hình máy in:', e);
    }
    this.notify();
  }

  // Format Receipt to text layout (58mm width, approx 32 chars per line)
  formatReceipt(
    payload: ReceiptDataPayload,
    isNative: boolean = false
  ): { topText: string; qrUrl: string; bottomText: string } | string {
    const invoice = payload.invoices[0];
    if (!invoice) return isNative ? { topText: '', qrUrl: '', bottomText: '' } : '';

    const width = 32;
    const divider = '-'.repeat(width);
    const doubleDivider = '='.repeat(width);

    // Center text helper
    const center = (text: string) => {
      const cleanText = text.trim();
      if (cleanText.length >= width) return cleanText;
      const leftPad = Math.floor((width - cleanText.length) / 2);
      return ' '.repeat(leftPad) + cleanText;
    };

    // Right-align helper
    const rightAlign = (left: string, right: string) => {
      const totalLen = left.length + right.length;
      if (totalLen >= width) return left + ' ' + right;
      return left + ' '.repeat(width - totalLen) + right;
    };

    const formatCurrency = (val: number | string) => {
      const num = Number(val);
      return new Intl.NumberFormat('vi-VN').format(num) + 'd';
    };

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return new Date().toLocaleDateString('vi-VN');
      try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } catch {
        return dateStr;
      }
    };

    const companyName = payload.companyName || 'CÔNG TRÌNH ĐÔ THỊ AN KHÊ';
    const companyAddress = payload.companyAddress || 'An Khê, Gia Lai';
    const companyPhone = payload.companyPhone || '0269.xxxxxxx';
    const companyAccount = payload.companyAccountNumber || 'Chưa cấu hình STK';
    const total = Number(invoice.tongTien) + Number(invoice.thue);
    const invoiceNo = invoice.invoiceSerial ? `PT${invoice.invoiceSerial}` : `PT${String(invoice.id).padStart(6, '0')}`;
    const dateFormatted = formatDate(invoice.paymentDate);

    const qrUrl = payload.qrThanhToan 
      ? (payload.qrThanhToan.startsWith('http') ? payload.qrThanhToan : `${API_BASE_URL}${payload.qrThanhToan}`)
      : (invoice.invoiceFkey 
          ? `${payload.portalUrl}/tim-kiem?fkey=${invoice.invoiceFkey}`
          : payload.portalUrl || 'http://ankhe.vnptportal.vn');

    if (isNative) {
      const topLines: string[] = [];
      topLines.push(doubleDivider);
      topLines.push(center(companyName.toUpperCase()));
      topLines.push(center(companyAddress));
      topLines.push(center(`DT: ${companyPhone}`));
      topLines.push(center(`STK: ${companyAccount}`));
      topLines.push(doubleDivider);
      topLines.push('');
      topLines.push(center('PHIẾU THU'));
      topLines.push('');
      topLines.push(rightAlign('So phieu:', invoiceNo));
      topLines.push(rightAlign('Ngay:', dateFormatted));
      topLines.push(divider);
      topLines.push(`KH: ${invoice.household?.tenChuHo ?? '---'}`);
      topLines.push(`Dia chi: ${invoice.household?.diaChi ?? '---'}`);
      topLines.push(`Dich vu: ${invoice.household?.serviceCatalog?.tenDichVu ?? 'Thu gom rac sinh hoat'}`);
      topLines.push(`Ky: ${invoice.kyHoaDon}`);
      topLines.push(divider);
      topLines.push(rightAlign('THANH TIEN', formatCurrency(total)));
      topLines.push(divider);
      topLines.push(center('QR THANH TOAN'));
      topLines.push(''); // Add a line break before QR

      const bottomLines: string[] = [];
      bottomLines.push(''); // Add a line break after QR
      bottomLines.push(divider);
      bottomLines.push(rightAlign('Thu ngan:', invoice.collectedByName ?? 'Nhan vien thu tien'));
      bottomLines.push(doubleDivider);
      bottomLines.push('\n\n\n'); // Feed tape

      return {
        topText: removeAccents(topLines.join('\n')),
        qrUrl,
        bottomText: removeAccents(bottomLines.join('\n')),
      };
    }

    const lines: string[] = [];
    lines.push(doubleDivider);
    lines.push(center(companyName.toUpperCase()));
    lines.push(center(companyAddress));
    lines.push(center(`DT: ${companyPhone}`));
    lines.push(center(`STK: ${companyAccount}`));
    lines.push(doubleDivider);
    lines.push('');
    lines.push(center('PHIẾU THU'));
    lines.push('');
    lines.push(rightAlign('So phieu:', invoiceNo));
    lines.push(rightAlign('Ngay:', dateFormatted));
    lines.push(divider);
    lines.push(`KH: ${invoice.household?.tenChuHo ?? '---'}`);
    lines.push(`Dia chi: ${invoice.household?.diaChi ?? '---'}`);
    lines.push(`Dich vu: ${invoice.household?.serviceCatalog?.tenDichVu ?? 'Thu gom rac sinh hoat'}`);
    lines.push(`Ky: ${invoice.kyHoaDon}`);
    lines.push(divider);
    lines.push(rightAlign('THANH TIEN', formatCurrency(total)));
    lines.push(divider);
    lines.push(center('QR THANH TOAN'));
    lines.push(center('██████████████'));
    lines.push(center('████  QR  ████'));
    lines.push(center('██████████████'));
    lines.push(center(qrUrl));
    lines.push(divider);
    lines.push(rightAlign('Thu ngan:', invoice.collectedByName ?? 'Nhan vien thu tien'));
    lines.push(doubleDivider);
    lines.push('\n\n\n'); // Feed tape

    return lines.join('\n');
  }

  // Print Receipt
  async printReceipt(payload: ReceiptDataPayload): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Chưa kết nối máy in');
    }

    const isRealDevice = !this.connectedDevice?.isSimulated;

    if (Platform.OS !== 'web' && isRealDevice && this.activeNativeDevice) {
      const receiptData = this.formatReceipt(payload, true);

      if (typeof receiptData === 'object' && receiptData !== null) {
        const { topText, qrUrl, bottomText } = receiptData;
        this.lastPrintedText = `${topText}\n[QR Code: ${qrUrl}]\n${bottomText}`;

        try {
          // 1. Send top text
          await this.activeNativeDevice.write(topText + '\n', 'utf-8');

          // 2. Build and send raw QR code command
          const qrBytes = buildEscPosQrCode(qrUrl);
          const qrBase64 = uint8ArrayToBase64(qrBytes);
          await this.activeNativeDevice.write(qrBase64, 'base64');

          // 3. Send bottom text
          await this.activeNativeDevice.write('\n' + bottomText, 'utf-8');

          return true;
        } catch (err) {
          console.error('Lỗi khi gửi dữ liệu in sang máy in thật:', err);
          throw new Error('Lỗi gửi dữ liệu in. Vui lòng thử lại.');
        }
      }
    }

    // Fallback/Simulated
    const text = this.formatReceipt(payload, false) as string;
    this.lastPrintedText = text;

    console.log('%c--- IN PHIẾU THU THÀNH CÔNG ---', 'color: #0d8a6a; font-weight: bold;');
    console.log(text);
    console.log('--------------------------------');

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 1200);
    });
  }
}

// Helpers for printing raw ESC/POS QR Code
function stringToAsciiBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function buildEscPosQrCode(content: string): Uint8Array {
  const dataBytes = stringToAsciiBytes(content);
  const dataLen = dataBytes.length;
  const pL = (dataLen + 3) & 0xff;
  const pH = ((dataLen + 3) >> 8) & 0xff;

  // ESC/POS commands to print QR code (with center alignment)
  const header = new Uint8Array([
    0x1b, 0x61, 0x01,                                     // Align Center
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // Model 2
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06,       // Size 6 (range 1-16)
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30,       // Error Correction Level L
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30            // Store data header
  ]);

  const footer = new Uint8Array([
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,       // Print the stored QR code
    0x1b, 0x61, 0x00                                      // Restore Align Left
  ]);

  const result = new Uint8Array(header.length + dataBytes.length + footer.length);
  result.set(header, 0);
  result.set(dataBytes, header.length);
  result.set(footer, header.length + dataBytes.length);

  return result;
}

function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  let i = 0;
  while (i < len) {
    const byte1 = uint8[i++];
    const byte2 = i < len ? uint8[i++] : NaN;
    const byte3 = i < len ? uint8[i++] : NaN;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    let enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    let enc4 = byte3 & 63;

    if (isNaN(byte2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(byte3)) {
      enc4 = 64;
    }

    base64 += chars.charAt(enc1) + chars.charAt(enc2) + 
              (enc3 === 64 ? '=' : chars.charAt(enc3)) + 
              (enc4 === 64 ? '=' : chars.charAt(enc4));
  }
  return base64;
}

export const printerService = new PrinterService();

export function usePrinterStatus() {
  const [status, setStatus] = useState({
    isConnected: printerService.getIsConnected(),
    connectedDevice: printerService.getConnectedDevice(),
    isScanning: printerService.getIsScanning(),
    scannedDevices: printerService.getScannedDevices(),
  });

  useEffect(() => {
    return printerService.subscribe(() => {
      setStatus({
        isConnected: printerService.getIsConnected(),
        connectedDevice: printerService.getConnectedDevice(),
        isScanning: printerService.getIsScanning(),
        scannedDevices: printerService.getScannedDevices(),
      });
    });
  }, []);

  return status;
}
