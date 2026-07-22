import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { printerService, usePrinterStatus, BluetoothDevice } from '@/services/printer-service';
import { ConfirmModal, ConfirmModalType } from '@/components/ConfirmModal';

export default function PrinterConnectionRoute() {
  const router = useRouter();
  const { isConnected, connectedDevice, isScanning, scannedDevices } = usePrinterStatus();

  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    hideCancelButton?: boolean;
    type?: ConfirmModalType;
    icon?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    hideCancelButton?: boolean;
    type?: ConfirmModalType;
    icon?: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmConfig({
      visible: true,
      ...config,
    });
  };

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setConfirmConfig({
      visible: true,
      title,
      message,
      confirmText: 'Đóng',
      hideCancelButton: true,
      onConfirm: () => {
        hideConfirm();
        if (onConfirm) onConfirm();
      },
    });
  };

  const hideConfirm = () => {
    setConfirmConfig((prev) => ({ ...prev, visible: false }));
  };
  
  // Animation for scanning pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    let rotateLoop: Animated.CompositeAnimation | null = null;

    if (isScanning) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }

    return () => {
      pulseLoop?.stop();
      rotateLoop?.stop();
    };
  }, [isScanning, pulseAnim, rotateAnim]);

  const handleScan = async () => {
    try {
      await printerService.scanDevices();
    } catch (e: any) {
      showAlert('Lỗi', e.message || 'Không thể khởi động quét Bluetooth.');
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    try {
      const success = await printerService.connectDevice(device);
      if (success) {
        showAlert('Thành công', `Đã kết nối với máy in ${device.name}`);
      }
    } catch (e) {
      showAlert('Lỗi kết nối', `Không thể kết nối đến thiết bị ${device.name}`);
    }
  };

  const handleDisconnect = async () => {
    showConfirm({
      title: 'Xác nhận ngắt kết nối',
      message: 'Bạn có đồng ý ngắt kết nối với máy in hiện tại không?',
      confirmText: 'Ngắt kết nối',
      cancelText: 'Hủy',
      type: 'danger',
      icon: '🔌',
      onConfirm: async () => {
        hideConfirm();
        await printerService.disconnectDevice();
        showAlert('Thông báo', 'Đã ngắt kết nối máy in');
      },
    });
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      showAlert('Chưa kết nối', 'Vui lòng kết nối với máy in trước khi in thử.');
      return;
    }

    try {
      // Mock data representing a typical invoice payload
      const mockPayload = {
        companyName: 'CÔNG TRÌNH ĐÔ THỊ AN KHÊ',
        companyAddress: '123 Quang Trung, An Khê, Gia Lai',
        companyPhone: '0269.3832115',
        companyAccountNumber: '1122334455 (VietinBank)',
        portalUrl: 'http://ankhe.vnptportal.vn',
        generatedAt: new Date().toISOString(),
        invoices: [
          {
            id: 156,
            kyHoaDon: '07/2026',
            tongTien: 120000,
            thue: 0,
            paymentDate: new Date().toISOString(),
            invoiceSerial: '0000156',
            invoiceFkey: 'ANKHE202607156',
            collectedByName: 'Nguyễn Văn B',
            household: {
              maHoDan: 'HD-ANKHE-0099',
              tenChuHo: 'Nguyễn Văn A',
              diaChi: 'Tổ dân phố 2, P. An Bình, An Khê',
              soDienThoai: '0987654321',
              serviceCatalog: {
                tenDichVu: 'Thu gom rác sinh hoạt',
              },
            },
          },
        ],
      };

      await printerService.printReceipt(mockPayload);
      showAlert(
        'Đang in...',
        'Lệnh in thử đã được gửi. Kiểm tra máy in thermal RI-5809DD.',
      );
    } catch (e) {
      showAlert('Lỗi in ấn', 'In thử nghiệm thất bại.');
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>↩ Quay lại</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Cấu hình máy in</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.card, styles.statusCard, isConnected ? styles.cardConnected : styles.cardDisconnected]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, isConnected ? styles.indicatorOn : styles.indicatorOff]} />
            <Text style={styles.statusLabel}>Trạng thái kết nối</Text>
          </View>
          
          {isConnected && connectedDevice ? (
            <View style={styles.connectedDetails}>
              <Text style={styles.connectedName}>{connectedDevice.name}</Text>
              <Text style={styles.connectedAddress}>{connectedDevice.address}</Text>
              <Text style={styles.connectedTip}>Loại máy: Máy in nhiệt 58mm Bluetooth</Text>
              
              <View style={styles.buttonRow}>
                <Pressable onPress={handleTestPrint} style={styles.testButton}>
                  <Text style={styles.testButtonText}>🖨 In thử nghiệm</Text>
                </Pressable>
                <Pressable onPress={handleDisconnect} style={styles.disconnectButton}>
                  <Text style={styles.disconnectButtonText}>Ngắt kết nối</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.disconnectedDetails}>
              <Text style={styles.disconnectedText}>Chưa kết nối máy in nhiệt Bluetooth nào</Text>
              <Text style={styles.modelRecommend}>Dòng máy tương thích: RI-5809DD (Khuyên dùng)</Text>
              
              <Pressable
                onPress={handleScan}
                disabled={isScanning}
                style={[styles.scanButtonBig, isScanning && styles.buttonDisabled]}
              >
                {isScanning ? (
                  <View style={styles.scanningBtnLabel}>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.scanButtonText}>Đang quét thiết bị...</Text>
                  </View>
                ) : (
                  <Text style={styles.scanButtonText}>🔍 Quét tìm máy in</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Scan List Section */}
        <View style={styles.devicesHeader}>
          <Text style={styles.sectionTitle}>Thiết bị Bluetooth quét được</Text>
          {isScanning && (
            <Animated.Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3256/3256621.png' }}
              style={[styles.rotateIcon, { transform: [{ rotate: spin }] }]}
            />
          )}
        </View>

        {isScanning && scannedDevices.length === 0 ? (
          <View style={styles.loaderArea}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.loaderText}>Đang tìm kiếm máy in gần đây...</Text>
          </View>
        ) : scannedDevices.length > 0 ? (
          <View style={styles.deviceListWrap}>
            {scannedDevices.map((item) => {
              const isRecommended = item.name.includes('RI-5809DD') || item.name.includes('5809');
              return (
                <Pressable
                  key={item.address}
                  onPress={() => handleConnect(item)}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    isRecommended && styles.recommendedDeviceRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.deviceIconCol}>
                    <Text style={styles.deviceIcon}>🖨</Text>
                  </View>
                  <View style={styles.deviceInfoCol}>
                    <View style={styles.deviceTitleRow}>
                      <Text style={styles.deviceName}>{item.name}</Text>
                      {isRecommended && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Phù hợp nhất</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deviceAddress}>{item.address}</Text>
                  </View>
                  <View style={styles.connectActionCol}>
                    <Text style={styles.connectText}>Kết nối</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Chưa có thiết bị nào. Nhấn Quét để tìm máy in.</Text>
          </View>
        )}

        {/* Info panel */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Hướng dẫn kết nối</Text>
          <Text style={styles.infoText}>
            1. Bật nguồn máy in nhiệt RI-5809DD.{'\n'}
            2. Đảm bảo Bluetooth trên điện thoại đã được bật.{'\n'}
            3. Nhấn "Quét tìm máy in" và chọn đúng thiết bị 'RI-5809DD' để kết nối.{'\n'}
            4. Mã PIN mặc định khi kết nối thường là '0000' hoặc '1234' (nếu hệ thống yêu cầu).
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        hideCancelButton={confirmConfig.hideCancelButton}
        type={confirmConfig.type}
        icon={confirmConfig.icon}
        onConfirm={confirmConfig.onConfirm}
        onCancel={hideConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e2ece8',
    backgroundColor: '#ffffff',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f0f5f2',
  },
  backButtonText: {
    fontSize: 14,
    color: '#0b4f3f',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2d25',
  },
  placeholder: {
    width: 60,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  statusCard: {
    borderColor: '#d5e6e0',
  },
  cardConnected: {
    borderColor: '#a3e2cd',
    backgroundColor: '#f2fbf7',
  },
  cardDisconnected: {
    borderColor: '#e8ecea',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  indicatorOn: {
    backgroundColor: '#10b981',
  },
  indicatorOff: {
    backgroundColor: '#9ca3af',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4c776b',
    textTransform: 'uppercase',
  },
  connectedDetails: {
    gap: 8,
  },
  connectedName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f2d25',
  },
  connectedAddress: {
    fontSize: 13,
    color: '#4c776b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  connectedTip: {
    fontSize: 13,
    color: '#0d8a6a',
    fontWeight: '600',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  testButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#0d8a6a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  disconnectButton: {
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: '#fce7e7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f9c5c5',
  },
  disconnectButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13,
  },
  disconnectedDetails: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  disconnectedText: {
    fontSize: 15,
    color: '#4c776b',
    textAlign: 'center',
    fontWeight: '600',
  },
  modelRecommend: {
    fontSize: 12,
    color: '#1f4d40',
    backgroundColor: '#e6f3ee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scanButtonBig: {
    marginTop: 8,
    height: 42,
    backgroundColor: '#0d8a6a',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  scanningBtnLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#86cbb6',
  },
  devicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#173a30',
  },
  rotateIcon: {
    width: 20,
    height: 20,
    tintColor: '#0d8a6a',
  },
  loaderArea: {
    height: 120,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2ece8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pulseRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#0d8a6a',
  },
  loaderText: {
    fontSize: 13,
    color: '#4c776b',
  },
  deviceListWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2ece8',
    overflow: 'hidden',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#f0f5f2',
  },
  recommendedDeviceRow: {
    backgroundColor: '#f7fdfb',
  },
  deviceIconCol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f5f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceIcon: {
    fontSize: 18,
  },
  deviceInfoCol: {
    flex: 1,
    gap: 2,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f2d25',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#6c8e84',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badge: {
    backgroundColor: '#0d8a6a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  connectActionCol: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e6f3ee',
    borderRadius: 8,
  },
  connectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b4f3f',
  },
  emptyWrap: {
    height: 100,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2ece8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    color: '#6c8e84',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#eff5f2',
    borderWidth: 1,
    borderColor: '#daeae2',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0b4f3f',
  },
  infoText: {
    fontSize: 12,
    color: '#3d5c52',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
});
