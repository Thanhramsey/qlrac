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

import { httpClient, setAccessToken } from '@/api/http-client';
import { clearAuthSession, loadAuthSession } from '@/auth/auth-storage';
import type { LoginResponse } from '@/types/auth';

type PaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'PUBLISHED';

interface HouseholdHistoryInvoice {
  id: number;
  kyHoaDon: string;
  trangThaiThanhToan: PaymentStatus;
  tongTien: number;
  thue: number;
  paymentDate: string | null;
  paymentNote: string | null;
  invoicePublishStatus: string | null;
  mergedPeriodCodes: string | null;
  publishedByName: string | null;
  collectedByName: string | null;
}

interface HouseholdHistoryResponse {
  household: {
    id: number;
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
  };
  summary: {
    total: number;
    paid: number;
    unpaid: number;
  };
  invoices: HouseholdHistoryInvoice[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusLabel(status: PaymentStatus) {
  if (status === 'PUBLISHED') {
    return 'Đã xuất HĐ';
  }

  if (status === 'PAID') {
    return 'Đã thu';
  }

  if (status === 'OVERDUE') {
    return 'Quá hạn';
  }

  return 'Chưa thu';
}

function getPublishStatusLabel(status: string | null) {
  return status === 'SUCCESS' ? 'Đã phát hành' : 'Chưa phát hành';
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function isInvoicePublishable(invoice: HouseholdHistoryInvoice) {
  return invoice.invoicePublishStatus !== 'SUCCESS';
}

export default function HouseholdHistoryRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ householdId?: string }>();
  const householdId = Number(params.householdId);

  const [session, setSession] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [data, setData] = useState<HouseholdHistoryResponse | null>(null);

  const loadHistory = useCallback(async () => {
    if (!Number.isInteger(householdId) || householdId <= 0) {
      Alert.alert('Lỗi', 'Hộ dân không hợp lệ');
      router.back();
      return;
    }

    setLoading(true);
    try {
      const storedSession = await loadAuthSession();
      if (!storedSession?.accessToken) {
        setAccessToken(null);
        router.replace('/login');
        return;
      }

      setAccessToken(storedSession.accessToken);
      setSession(storedSession);

      const response = await httpClient.get<HouseholdHistoryResponse>(`/invoices/household/${householdId}/history`);
      setData(response.data);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) {
        Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
        setAccessToken(null);
        await clearAuthSession();
        setSession(null);
        router.replace('/login');
        return;
      }

      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Không tải được lịch sử hộ dân'
          : 'Không tải được lịch sử hộ dân';
      Alert.alert('Lỗi', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [householdId, router]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectedCount = selectedInvoiceIds.length;

  const toggleSelected = (invoiceId: number) => {
    const invoice = data?.invoices.find((item) => item.id === invoiceId);
    if (invoice && !isInvoicePublishable(invoice)) {
      return;
    }

    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((item) => item !== invoiceId) : [...current, invoiceId],
    );
  };

  const submitCollect = () => {
    if (selectedCount === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một kỳ để thu tiền');
      return;
    }

    Alert.alert('Xác nhận thu tiền', `Bạn có đồng ý thu ${selectedCount} kỳ đã chọn không?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        onPress: () => {
          void collectSelected();
        },
      },
    ]);
  };

  const submitPublish = () => {
    if (selectedCount === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một kỳ để xuất bù');
      return;
    }

    Alert.alert('Xác nhận xuất hóa đơn bù', `Bạn có đồng ý xuất hóa đơn bù cho ${selectedCount} kỳ đã chọn không?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        onPress: () => {
          void publishSelected();
        },
      },
    ]);
  };

  const collectSelected = async () => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('invoiceIds', JSON.stringify(selectedInvoiceIds));
      const response = await httpClient.post('/invoices/collect', formData, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Thông báo', response.data?.message ?? 'Thu tiền thành công');
      setSelectedInvoiceIds([]);
      await loadHistory();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.code === 'ECONNABORTED'
          ? 'Thu tiền đang xử lý lâu hơn dự kiến. Vui lòng thử lại sau 1-2 phút.'
          : error.code === 'ERR_CANCELED'
            ? 'Yêu cầu thu tiền đã bị hủy. Vui lòng thử lại.'
            : error.response?.data?.message ?? 'Thu tiền thất bại'
        : 'Thu tiền thất bại';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoading(false);
    }
  };

  const publishSelected = async () => {
    const publishableIds = (data?.invoices ?? [])
      .filter((item) => selectedInvoiceIds.includes(item.id) && isInvoicePublishable(item))
      .map((item) => item.id);

    if (publishableIds.length === 0) {
      Alert.alert('Thông báo', 'Không có kỳ hợp lệ để xuất bù');
      return;
    }

    setActionLoading(true);
    try {
      const response = await httpClient.post(
        '/invoices/publish',
        { invoiceIds: publishableIds },
        { timeout: 120000 },
      );
      Alert.alert('Thông báo', response.data?.message ?? 'Xuất hóa đơn bù thành công');
      setSelectedInvoiceIds([]);
      await loadHistory();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.code === 'ECONNABORTED'
          ? 'Xuất hóa đơn bù đang xử lý lâu hơn dự kiến. Vui lòng thử lại sau 1-2 phút.'
          : error.code === 'ERR_CANCELED'
            ? 'Yêu cầu xuất hóa đơn bù đã bị hủy. Vui lòng thử lại.'
            : error.response?.data?.message ?? 'Xuất hóa đơn bù thất bại'
        : 'Xuất hóa đơn bù thất bại';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoading(false);
    }
  };

  const summaryTiles = useMemo(
    () => [
      { label: 'Tổng kỳ', value: data?.summary.total ?? 0 },
      { label: 'Đã thu', value: data?.summary.paid ?? 0 },
      { label: 'Chưa thu', value: data?.summary.unpaid ?? 0 },
    ],
    [data],
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#0d8a6a" />
      </View>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Lịch sử hộ dân</Text>
        <Text style={styles.title}>{data.household.tenChuHo}</Text>
        <Text style={styles.code}>{data.household.maHoDan}</Text>
        <Text style={styles.address}>{data.household.diaChi}</Text>

        <View style={styles.summaryRow}>
          {summaryTiles.map((item) => (
            <View key={item.label} style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>← Quay lại</Text>
          </Pressable>
          <Pressable
            onPress={submitCollect}
            disabled={actionLoading}
            style={({ pressed }) => [styles.primaryButton, styles.collectButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>◉ Thu tiền đã chọn</Text>
          </Pressable>
          <Pressable
            onPress={submitPublish}
            disabled={actionLoading}
            style={({ pressed }) => [styles.primaryButton, styles.publishButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>◈ Xuất hóa đơn bù</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          Chọn các kỳ cần xử lý {selectedCount > 0 ? `(${selectedCount})` : ''}
        </Text>
        <View style={styles.invoiceList}>
          {data.invoices.map((invoice) => {
            const total = toNumber(invoice.tongTien) + toNumber(invoice.thue);
            const selected = selectedInvoiceIds.includes(invoice.id);
            const publishable = isInvoicePublishable(invoice);

            return (
              <Pressable
                key={invoice.id}
                onPress={() => toggleSelected(invoice.id)}
                style={({ pressed }) => [
                  styles.invoiceCard,
                  !publishable && styles.invoiceCardDisabled,
                  selected && styles.invoiceCardSelected,
                  pressed && styles.pressedCard,
                ]}>
                <View style={styles.invoiceTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoicePeriod}>Kỳ {invoice.kyHoaDon}</Text>
                    <Text style={styles.invoiceMoney}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={styles.selectionBadge}>
                    <Text style={styles.selectionBadgeText}>
                      {!publishable ? 'Đã phát hành' : selected ? 'Đã chọn' : 'Chạm để chọn'}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceRow}>
                  <View
                    style={[
                      styles.statusChip,
                      invoice.trangThaiThanhToan === 'PAID'
                        ? styles.statusChipPaid
                        : invoice.trangThaiThanhToan === 'PUBLISHED'
                          ? styles.statusChipPublished
                          : invoice.trangThaiThanhToan === 'OVERDUE'
                            ? styles.statusChipOverdue
                            : styles.statusChipUnpaid,
                    ]}>
                    <Text style={styles.statusChipText}>Trạng thái: {getStatusLabel(invoice.trangThaiThanhToan)}</Text>
                  </View>
                  <Text style={styles.invoiceMeta}>Phát hành: {getPublishStatusLabel(invoice.invoicePublishStatus)}</Text>
                </View>
                <Text style={styles.invoiceMeta}>
                  Ngày thu: {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleString('vi-VN') : '---'}
                </Text>
                <Text style={styles.invoiceMeta}>Kỳ trên hóa đơn: {invoice.mergedPeriodCodes ?? invoice.kyHoaDon}</Text>
                <Text style={styles.invoiceMeta}>Người xuất: {invoice.publishedByName ?? '---'}</Text>
                <Text style={styles.invoiceMeta}>Người thu: {invoice.collectedByName ?? '---'}</Text>
                {invoice.paymentNote ? <Text style={styles.invoiceNote}>Ghi chú: {invoice.paymentNote}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    gap: 8,
  },
  kicker: {
    color: '#0d8a6a',
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f2d25',
  },
  code: {
    color: '#4c776b',
    fontWeight: '700',
  },
  address: {
    color: '#35574d',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#f3faf7',
    borderWidth: 1,
    borderColor: '#d7e9e2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2d25',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#4c776b',
    marginTop: 2,
    fontWeight: '700',
  },
  headerActions: {
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  collectButton: {
    backgroundColor: '#1f9e63',
  },
  publishButton: {
    backgroundColor: '#2f6ea8',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#e8f3ef',
    borderWidth: 1,
    borderColor: '#cfe1db',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#173a30',
  },
  invoiceList: {
    gap: 10,
  },
  invoiceCard: {
    borderRadius: 14,
    backgroundColor: '#f9fcfb',
    borderWidth: 1,
    borderColor: '#dceae5',
    padding: 12,
    gap: 6,
  },
  invoiceCardSelected: {
    borderColor: '#0d8a6a',
    backgroundColor: '#eaf8f3',
  },
  invoiceCardDisabled: {
    opacity: 0.6,
  },
  pressedCard: {
    opacity: 0.86,
  },
  invoiceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoicePeriod: {
    fontSize: 14,
    fontWeight: '800',
    color: '#173a30',
  },
  invoiceMoney: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  selectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ebf7f2',
  },
  selectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b4f3f',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipPaid: {
    backgroundColor: '#e5f7eb',
  },
  statusChipPublished: {
    backgroundColor: '#e1f5fe',
  },
  statusChipUnpaid: {
    backgroundColor: '#fff6d8',
  },
  statusChipOverdue: {
    backgroundColor: '#ffe7d7',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f473d',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  invoiceMeta: {
    fontSize: 12,
    color: '#4b7167',
  },
  invoiceNote: {
    fontSize: 12,
    color: '#36584d',
    fontStyle: 'italic',
  },
});
