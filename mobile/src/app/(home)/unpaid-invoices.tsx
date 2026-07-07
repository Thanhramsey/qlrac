import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';

import { httpClient } from '@/api/http-client';

type PaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

interface HouseholdInvoiceItem {
  id: number;
  householdId: number;
  kyHoaDon: string;
  trangThaiThanhToan: PaymentStatus;
  tongTien: number;
  thue: number;
  tongCong: number;
  invoicePublishStatus: string | null;
  household: {
    id: number;
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
    tuyenThuRac: {
      id: number;
      maTuyen: string;
      tenTuyen: string;
    } | null;
    serviceCatalog: {
      id: number;
      maDichVu: string;
      tenDichVu: string;
    } | null;
  } | null;
}

interface MobileHouseholdsResponse {
  data: HouseholdInvoiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function parseCsvNumberList(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseCsvStringList(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusLabel(status: PaymentStatus) {
  if (status === 'OVERDUE') {
    return 'Quá hạn';
  }

  return 'Chưa thu';
}

export default function UnpaidInvoicesRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kyHoaDons?: string;
    tuyenThuRacIds?: string;
    serviceCatalogIds?: string;
    keyword?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<HouseholdInvoiceItem[]>([]);

  const selectedKyHoaDons = useMemo(() => parseCsvStringList(params.kyHoaDons), [params.kyHoaDons]);
  const selectedRouteIds = useMemo(() => parseCsvNumberList(params.tuyenThuRacIds), [params.tuyenThuRacIds]);
  const selectedServiceIds = useMemo(
    () => parseCsvNumberList(params.serviceCatalogIds),
    [params.serviceCatalogIds],
  );
  const keyword = (params.keyword ?? '').trim();

  const loadUnpaidInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await httpClient.get<MobileHouseholdsResponse>('/invoices/mobile/households', {
        params: {
          page: 1,
          limit: 200,
          kyHoaDons: selectedKyHoaDons.length > 0 ? selectedKyHoaDons.join(',') : undefined,
          tuyenThuRacIds: selectedRouteIds.length > 0 ? selectedRouteIds.join(',') : undefined,
          serviceCatalogIds: selectedServiceIds.length > 0 ? selectedServiceIds.join(',') : undefined,
          keyword: keyword || undefined,
        },
      });

      const unpaidRows = (response.data.data ?? []).filter((item) => item.trangThaiThanhToan !== 'PAID');
      setInvoices(unpaidRows);
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Không tải được danh sách hóa đơn chưa thu'
          : 'Không tải được danh sách hóa đơn chưa thu';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedKyHoaDons, selectedRouteIds, selectedServiceIds]);

  useEffect(() => {
    void loadUnpaidInvoices();
  }, [loadUnpaidInvoices]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Hóa đơn chưa thu</Text>
        <Text style={styles.subtitle}>Danh sách theo bộ lọc hiện tại từ màn hình chính</Text>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>← Quay lại</Text>
          </Pressable>
          <Pressable onPress={() => void loadUnpaidInvoices()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Làm mới</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#0d8a6a" />
          <Text style={styles.loadingText}>Đang tải danh sách...</Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>Tổng hóa đơn chưa thu: {invoices.length}</Text>
      </View>

      <View style={styles.listWrap}>
        {invoices.map((invoice) => (
          <Pressable
            key={invoice.id}
            onPress={() => router.push(`/households/${invoice.householdId}?kyHoaDon=${encodeURIComponent(invoice.kyHoaDon)}` as never)}
            style={({ pressed }) => [styles.invoiceCard, pressed && styles.pressed]}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.code}>{invoice.household?.maHoDan ?? '---'}</Text>
                <Text style={styles.name}>{invoice.household?.tenChuHo ?? '---'}</Text>
              </View>
              <View style={styles.statusChip}>
                <Text style={styles.statusText}>{getStatusLabel(invoice.trangThaiThanhToan)}</Text>
              </View>
            </View>

            <Text style={styles.address}>{invoice.household?.diaChi ?? '---'}</Text>

            <View style={styles.rowInfo}>
              <Text style={styles.meta}>Kỳ: {invoice.kyHoaDon}</Text>
              <Text style={styles.meta}>Tổng: {formatCurrency(Number(invoice.tongCong ?? Number(invoice.tongTien) + Number(invoice.thue)))}</Text>
            </View>

            <View style={styles.rowInfo}>
              <Text style={styles.meta}>Tuyến: {invoice.household?.tuyenThuRac?.tenTuyen ?? '---'}</Text>
              <Text style={styles.meta}>Dịch vụ: {invoice.household?.serviceCatalog?.tenDichVu ?? '---'}</Text>
            </View>
          </Pressable>
        ))}

        {!loading && invoices.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Không còn hóa đơn chưa thu</Text>
            <Text style={styles.emptyText}>Bạn có thể đổi bộ lọc ở màn hình chính rồi vào lại.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
    backgroundColor: '#f4f8f6',
  },
  headerCard: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 20,
    color: '#0f2d25',
    fontWeight: '800',
  },
  subtitle: {
    color: '#4c776b',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfe1db',
    backgroundColor: '#e8f3ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  loadingText: {
    color: '#4b7268',
    fontSize: 13,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  summaryText: {
    color: '#173a30',
    fontWeight: '700',
  },
  listWrap: {
    gap: 8,
  },
  invoiceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 7,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    color: '#4d766a',
    fontWeight: '700',
    fontSize: 12,
  },
  name: {
    color: '#173a30',
    fontWeight: '700',
    fontSize: 15,
    marginTop: 2,
  },
  statusChip: {
    borderRadius: 999,
    backgroundColor: '#fff6d8',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    color: '#1f473d',
    fontWeight: '700',
    fontSize: 11,
  },
  address: {
    color: '#41675c',
    fontSize: 13,
  },
  rowInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    flexShrink: 1,
    color: '#315b50',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e8e2',
    backgroundColor: '#f7fbf9',
    padding: 12,
    gap: 4,
  },
  emptyTitle: {
    color: '#1d3d33',
    fontWeight: '700',
  },
  emptyText: {
    color: '#4b7167',
    fontSize: 12,
  },
});
