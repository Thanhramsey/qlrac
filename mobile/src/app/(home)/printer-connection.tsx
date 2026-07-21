import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  connectPrinter,
  disconnectPrinter,
  getSavedPrinterConnection,
  listPrinterDevices,
  type PrinterDevice,
} from '@/printer/bluetooth-printer';
import type { StoredPrinterConnection } from '@/printer/printer-storage';

export default function PrinterConnectionRoute() {
  const router = useRouter();

  const [loadingSaved, setLoadingSaved] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [savedConnection, setSavedConnection] = useState<StoredPrinterConnection | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);

  const loadSavedConnection = useCallback(async () => {
    const saved = await getSavedPrinterConnection();
    setSavedConnection(saved);
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        await loadSavedConnection();
      } finally {
        setLoadingSaved(false);
      }
    };

    void boot();
  }, [loadSavedConnection]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await listPrinterDevices();
      setDevices(result);
      if (result.length === 0) {
        Alert.alert('Thong bao', 'Khong tim thay may in Bluetooth gan day. Vui long bat may in RI-5809DD.');
      }
    } catch (error) {
      Alert.alert('Loi', error instanceof Error ? error.message : 'Khong the quet may in Bluetooth.');
    } finally {
      setScanning(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSavedConnection();
      await handleScan();
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = async (device: PrinterDevice) => {
    setConnectingAddress(device.address);
    try {
      const connection = await connectPrinter(device);
      setSavedConnection(connection);
      Alert.alert('Thanh cong', `Da ket noi may in ${connection.name}.`);
    } catch (error) {
      Alert.alert('Loi', error instanceof Error ? error.message : 'Ket noi may in that bai.');
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectPrinter();
      setSavedConnection(null);
      Alert.alert('Thong bao', 'Da ngat ket noi may in Bluetooth.');
    } catch (error) {
      Alert.alert('Loi', error instanceof Error ? error.message : 'Khong the ngat ket noi may in.');
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Bluetooth Printer</Text>
        <Text style={styles.title}>Ket noi may in RI-5809DD</Text>
        <Text style={styles.subtitle}>
          Trang thai ket noi duoc luu tren thiet bi. Neu mat ket noi, hay vao day ket noi lai.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Trang thai hien tai</Text>
          {loadingSaved ? (
            <ActivityIndicator color="#0d8a6a" />
          ) : savedConnection ? (
            <>
              <Text style={styles.statusConnected}>Da ket noi</Text>
              <Text style={styles.statusMeta}>May in: {savedConnection.name}</Text>
              <Text style={styles.statusMeta}>Dia chi: {savedConnection.address}</Text>
              <Text style={styles.statusMeta}>
                Thoi gian luu: {new Date(savedConnection.connectedAt).toLocaleString('vi-VN')}
              </Text>
              <Pressable onPress={handleDisconnect} style={({ pressed }) => [styles.disconnectButton, pressed && styles.pressed]}>
                <Text style={styles.disconnectButtonText}>Ngat ket noi</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.statusDisconnected}>Chua ket noi may in</Text>
          )}
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Quay lai</Text>
          </Pressable>
          <Pressable onPress={() => void handleScan()} style={({ pressed }) => [styles.primaryButton, (pressed || scanning) && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{scanning ? 'Dang quet...' : 'Quet may in'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Danh sach thiet bi Bluetooth</Text>
        {devices.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Chua co thiet bi. Bam "Quet may in" de tim RI-5809DD.</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => {
              const selected = savedConnection?.address === device.address;
              const connecting = connectingAddress === device.address;
              return (
                <View key={device.address} style={[styles.deviceCard, selected && styles.deviceCardSelected]}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceAddress}>{device.address}</Text>
                  <View style={styles.deviceFooter}>
                    <Text style={styles.deviceBadge}>{device.bonded ? 'Da pair' : 'Chua pair'}</Text>
                    <Pressable
                      onPress={() => void handleConnect(device)}
                      disabled={connecting}
                      style={({ pressed }) => [styles.connectButton, (pressed || connecting) && styles.pressed]}>
                      <Text style={styles.connectButtonText}>{connecting ? 'Dang ket noi...' : selected ? 'Ket noi lai' : 'Ket noi'}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
    backgroundColor: '#f4f8f6',
  },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    gap: 10,
  },
  kicker: {
    color: '#0d8a6a',
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f2d25',
  },
  subtitle: {
    color: '#4b7167',
    fontSize: 13,
    lineHeight: 19,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e9e2',
    backgroundColor: '#f7fbf9',
    padding: 12,
    gap: 6,
  },
  statusLabel: {
    color: '#35574d',
    fontWeight: '700',
    fontSize: 12,
  },
  statusConnected: {
    color: '#0d8a6a',
    fontWeight: '800',
    fontSize: 16,
  },
  statusDisconnected: {
    color: '#bf5f5f',
    fontWeight: '700',
    fontSize: 14,
  },
  statusMeta: {
    color: '#36584d',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#e8f3ef',
    borderWidth: 1,
    borderColor: '#cfe1db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
  },
  disconnectButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#efb2b2',
    backgroundColor: '#ffe9e9',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectButtonText: {
    color: '#8d3434',
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#173a30',
  },
  emptyWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e8e2',
    backgroundColor: '#f7fbf9',
    padding: 12,
  },
  emptyText: {
    color: '#4b7167',
    fontSize: 12,
  },
  deviceList: {
    gap: 10,
  },
  deviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dceae5',
    backgroundColor: '#f9fcfb',
    padding: 12,
    gap: 6,
  },
  deviceCardSelected: {
    borderColor: '#93d1be',
    backgroundColor: '#f0faf6',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#173a30',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#4b7167',
  },
  deviceFooter: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3f655b',
  },
  connectButton: {
    minWidth: 108,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#bfe8d2',
    backgroundColor: '#e8f8ef',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  connectButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
