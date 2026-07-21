declare module 'react-native-bluetooth-escpos-printer' {
  export const BluetoothManager: {
    enableBluetooth: () => Promise<unknown>;
    scanDevices: () => Promise<unknown>;
    connect: (address: string) => Promise<unknown>;
    disconnect?: (address: string) => Promise<unknown>;
  };

  export const BluetoothEscposPrinter: {
    printerInit?: () => Promise<unknown>;
    printText: (content: string, options?: Record<string, unknown>) => Promise<unknown>;
    printPic?: (base64Data: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
}
