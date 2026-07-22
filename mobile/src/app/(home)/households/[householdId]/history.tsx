import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { ConfirmModal, ConfirmModalType } from '@/components/ConfirmModal';
import { printerService } from '@/services/printer-service';
import { API_BASE_URL } from '@/constants/api-base-url';

type PaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'PUBLISHED';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildReceiptHtml(invoice: any, payload?: any) {
  const total = Number(invoice.tongTien) + Number(invoice.thue);
  const isInvoicePublished =
    invoice.invoicePublishStatus === 'SUCCESS' ||
    Boolean(invoice.invoiceSerial) ||
    Boolean(invoice.invoiceFkey);

  const portalUrl = payload?.portalUrl || 'http://ankhe.vnptportal.vn';
  const qrThanhToan = payload?.qrThanhToan;
  const qrImageUrl = (qrThanhToan && qrThanhToan.startsWith('http'))
    ? qrThanhToan
    : (payload?.companyAccountNumber
        ? `https://img.vietqr.io/image/VietinBank-${payload.companyAccountNumber.replace(/[^a-zA-Z0-9]/g, '')}-compact2.png?amount=${Math.round(total)}&addInfo=${encodeURIComponent(`TT TIEN RAC ${invoice.household?.maHoDan || ''}`.trim())}`
        : (qrThanhToan ? (qrThanhToan.startsWith('/') ? `${API_BASE_URL}${qrThanhToan}` : qrThanhToan) : ''));

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${isInvoicePublished ? 'Hóa đơn điện tử' : 'Phiếu thu'} ${invoice.kyHoaDon}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 12px; color: #1e2f2a; background: #ffffff; }
      .receipt { border: 1px solid #cce3de; border-radius: 12px; padding: 16px; max-width: 480px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px dashed #0d8a6a; padding-bottom: 12px; margin-bottom: 12px; }
      .company-name { font-size: 16px; font-weight: bold; color: #0d8a6a; text-transform: uppercase; }
      .company-sub { font-size: 11px; color: #557067; margin-top: 2px; }
      .title { font-size: 18px; font-weight: 800; color: #0d8a6a; text-transform: uppercase; margin: 10px 0 2px 0; }
      .title-sub { font-size: 12px; color: #475569; font-weight: 600; }
      .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
      .label { color: #557067; font-weight: 600; }
      .value { color: #1e2f2a; font-weight: 700; text-align: right; }
      .divider { border-top: 1px dashed #d0e3dd; margin: 10px 0; }
      .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; color: #0d8a6a; padding: 8px 0; border-top: 1.5px solid #0d8a6a; border-bottom: 1.5px solid #0d8a6a; margin: 10px 0; }
      .footer { text-align: center; margin-top: 12px; }
      .qr-img { width: 140px; height: 140px; border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; background: #fff; margin-top: 6px; }
      .lookup-box { margin-top: 8px; font-size: 11px; color: #334155; line-height: 1.4; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <div class="company-name">${payload?.companyName || 'CÔNG TRÌNH ĐÔ THỊ AN KHÊ'}</div>
        <div class="company-sub">${payload?.companyAddress || ''}</div>
        <div class="company-sub">ĐIỆN THOẠI: ${payload?.companyPhone || ''} • STK: ${payload?.companyAccountNumber || ''}</div>
        <div class="title">${isInvoicePublished ? 'HÓA ĐƠN ĐIỆN TỬ' : 'PHIẾU THU TIỀN RÁC'}</div>
        <div class="title-sub">Kỳ hóa đơn: ${invoice.mergedPeriodCodes ?? invoice.kyHoaDon}</div>
      </div>

      <div class="row"><span class="label">Mã hộ dân:</span><span class="value">${invoice.household?.maHoDan || ''}</span></div>
      <div class="row"><span class="label">Tên hộ dân:</span><span class="value">${invoice.household?.tenChuHo || ''}</span></div>
      <div class="row"><span class="label">Địa chỉ:</span><span class="value">${invoice.household?.diaChi || ''}</span></div>
      <div class="row"><span class="label">Số điện thoại:</span><span class="value">${invoice.household?.soDienThoai || ''}</span></div>
      <div class="row"><span class="label">Loại dịch vụ:</span><span class="value">${invoice.household?.serviceCatalog?.tenDichVu || 'Dịch vụ thu gom rác'}</span></div>

      <div class="divider"></div>

      <div class="row"><span class="label">Tiền dịch vụ:</span><span class="value">${formatCurrency(Number(invoice.tongTien))}</span></div>
      <div class="row"><span class="label">Thuế VAT:</span><span class="value">${formatCurrency(Number(invoice.thue))}</span></div>

      <div class="total-row">
        <span>TỔNG TIỀN THANH TOÁN:</span>
        <span>${formatCurrency(total)}</span>
      </div>

      <div class="row"><span class="label">Ngày thu tiền:</span><span class="value">${invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleString('vi-VN') : '---'}</span></div>
      <div class="row"><span class="label">Người thu tiền:</span><span class="value">${invoice.collectedByName || '---'}</span></div>

      <div class="footer">
        ${qrImageUrl ? `<img src="${qrImageUrl}" class="qr-img" alt="QR Code" /><div style="font-size: 11px; font-weight: bold; color: #0d8a6a; margin-top: 4px;">QR THANH TOÁN</div>` : ''}
        ${isInvoicePublished ? `
          <div class="lookup-box">
            Tra cứu hóa đơn (${invoice.invoiceSerial || '---'}) tại: <a href="${portalUrl}" target="_blank" style="color: #0d8a6a; font-weight: bold;">${portalUrl.replace(/^https?:\/\//, '')}</a> với mã FKey: <strong>${invoice.invoiceFkey || '---'}</strong>
          </div>
        ` : ''}
      </div>
    </div>
  </body>
</html>`;
}

interface HouseholdHistoryInvoice {
  id: number;
  kyHoaDon: string;
  trangThaiThanhToan: PaymentStatus;
  tongTien: number;
  thue: number;
  paymentDate: string | null;
  paymentNote: string | null;
  invoicePublishStatus: string | null;
  invoiceSerial?: string | null;
  invoiceFkey?: string | null;
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
      showAlert('Lỗi', 'Hộ dân không hợp lệ', () => router.back());
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
        showAlert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
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
      showAlert('Lỗi', message, () => router.back());
    } finally {
      setLoading(false);
    }
  }, [householdId, router]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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

  const selectedCount = selectedInvoiceIds.length;

  const toggleSelected = (invoiceId: number) => {
    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((item) => item !== invoiceId) : [...current, invoiceId],
    );
  };

  const submitCollect = () => {
    const uncollectedIds = (data?.invoices ?? [])
      .filter((item) => selectedInvoiceIds.includes(item.id) && item.trangThaiThanhToan !== 'PAID' && item.trangThaiThanhToan !== 'PUBLISHED')
      .map((item) => item.id);

    if (uncollectedIds.length === 0) {
      showAlert('Thông báo', 'Vui lòng chọn ít nhất một kỳ chưa thu để thu tiền');
      return;
    }

    showConfirm({
      title: 'Xác nhận thu tiền',
      message: `Bạn có đồng ý xác nhận thu tiền cho ${uncollectedIds.length} kỳ chưa thu đã chọn không?`,
      confirmText: 'Thu tiền',
      type: 'success',
      icon: '💰',
      onConfirm: () => {
        hideConfirm();
        void collectSelected(uncollectedIds);
      },
    });
  };

  const submitPublish = () => {
    const publishableIds = (data?.invoices ?? [])
      .filter((item) => selectedInvoiceIds.includes(item.id) && isInvoicePublishable(item))
      .map((item) => item.id);

    if (publishableIds.length === 0) {
      showAlert('Thông báo', 'Vui lòng chọn ít nhất một kỳ chưa xuất hóa đơn để xuất bù');
      return;
    }

    showConfirm({
      title: 'Xác nhận xuất hóa đơn bù',
      message: `Bạn có đồng ý xuất hóa đơn bù cho ${publishableIds.length} kỳ đã chọn không?`,
      confirmText: 'Xuất hóa đơn',
      type: 'primary',
      icon: '🧾',
      onConfirm: () => {
        hideConfirm();
        void publishSelected(publishableIds);
      },
    });
  };

  const collectSelected = async (targetIds?: number[]) => {
    const idsToCollect = targetIds ?? selectedInvoiceIds;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('invoiceIds', JSON.stringify(idsToCollect));
      const response = await httpClient.post('/invoices/collect', formData, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showAlert('Thông báo', response.data?.message ?? 'Thu tiền thành công');
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
      showAlert('Lỗi', message);
    } finally {
      setActionLoading(false);
    }
  };

  const publishSelected = async (targetIds?: number[]) => {
    const idsToPublish = targetIds ?? selectedInvoiceIds;
    setActionLoading(true);
    try {
      const response = await httpClient.post(
        '/invoices/publish',
        { invoiceIds: idsToPublish },
        { timeout: 120000 },
      );
      showAlert('Thông báo', response.data?.message ?? 'Xuất hóa đơn bù thành công');
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
      showAlert('Lỗi', message);
    } finally {
      setActionLoading(false);
    }
  };

  const printReceiptSelected = async (specificId?: number) => {
    const idsToPrint = specificId ? [specificId] : selectedInvoiceIds;
    if (idsToPrint.length === 0) {
      showAlert('Thông báo', 'Vui lòng chọn ít nhất một kỳ để in phiếu');
      return;
    }

    if (Platform.OS !== 'web') {
      const isConnected = printerService.getIsConnected();
      if (!isConnected) {
        showConfirm({
          title: 'Chưa kết nối máy in',
          message: 'Bạn có muốn kết nối với máy in nhiệt Bluetooth RI-5809DD không?',
          confirmText: 'Kết nối ngay',
          cancelText: 'Bỏ qua',
          type: 'info',
          icon: '🖨️',
          onConfirm: () => {
            hideConfirm();
            router.push('/printer-connection' as never);
          },
        });
        return;
      }
    }

    setActionLoading(true);
    try {
      const response = await httpClient.get<any>('/invoices/receipt', {
        params: { invoiceIds: idsToPrint.join(',') },
      });

      const invoice = response.data?.invoices?.[0];
      if (!invoice) {
        showAlert('Lỗi', 'Không có dữ liệu phiếu thu để in');
        return;
      }

      if (Platform.OS === 'web') {
        const popup = globalThis.open('', '_blank');
        if (!popup) {
          showAlert('Lỗi', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để in phiếu.');
          return;
        }

        popup.document.write(buildReceiptHtml(invoice, response.data));
        popup.document.close();
      } else {
        await printerService.printReceipt(response.data);
        showAlert(
          'In thành công',
          'Đã in phiếu thu thành công trên máy in nhiệt Bluetooth RI-5809DD!',
        );
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'In phiếu thu thất bại'
          : 'In phiếu thu thất bại';
      showAlert('Lỗi', message);
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
            <Text style={styles.primaryButtonText}>💰 Thu tiền đã chọn</Text>
          </Pressable>
          <Pressable
            onPress={() => void printReceiptSelected()}
            disabled={actionLoading}
            style={({ pressed }) => [styles.primaryButton, styles.printButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>🖨 In phiếu đã chọn {selectedCount > 0 ? `(${selectedCount})` : ''}</Text>
          </Pressable>
          <Pressable
            onPress={submitPublish}
            disabled={actionLoading}
            style={({ pressed }) => [styles.primaryButton, styles.publishButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>🧾 Xuất hóa đơn bù</Text>
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

            const isPublished =
              invoice.trangThaiThanhToan === 'PUBLISHED' ||
              invoice.invoicePublishStatus === 'SUCCESS' ||
              Boolean(invoice.invoiceFkey) ||
              Boolean(invoice.invoiceSerial);
            const isPaid = invoice.trangThaiThanhToan === 'PAID' && !isPublished;
            const isOverdue = invoice.trangThaiThanhToan === 'OVERDUE' && !isPublished;

            const statusLabel = isPublished
              ? 'Đã xuất HĐ'
              : isPaid
                ? 'Đã thu'
                : isOverdue
                  ? 'Quá hạn'
                  : 'Chưa thu';

            return (
              <Pressable
                key={invoice.id}
                onPress={() => toggleSelected(invoice.id)}
                style={({ pressed }) => [
                  styles.invoiceCard,
                  selected && styles.invoiceCardSelected,
                  pressed && styles.pressedCard,
                ]}>
                <View style={styles.invoiceTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoicePeriod}>Kỳ {invoice.kyHoaDon}</Text>
                    <Text style={styles.invoiceMoney}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={[styles.selectionBadge, selected && styles.selectionBadgeSelected]}>
                    <Text style={[styles.selectionBadgeText, selected && styles.selectionBadgeTextSelected]}>
                      {selected ? '✓ Đã chọn' : 'Chạm để chọn'}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceRow}>
                  <View
                    style={[
                      styles.statusChip,
                      isPublished
                        ? styles.statusChipPublished
                        : isPaid
                          ? styles.statusChipPaid
                          : isOverdue
                            ? styles.statusChipOverdue
                            : styles.statusChipUnpaid,
                    ]}>
                    <Text style={styles.statusChipText}>Trạng thái: {statusLabel}</Text>
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

                <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      void printReceiptSelected(invoice.id);
                    }}
                    style={({ pressed }) => [styles.cardPrintBtn, pressed && styles.pressed]}>
                    <Text style={styles.cardPrintBtnText}>🖨 In phiếu thu</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        type={confirmConfig.type}
        icon={confirmConfig.icon}
        onConfirm={confirmConfig.onConfirm}
        onCancel={hideConfirm}
      />
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
  printButton: {
    backgroundColor: '#6366f1',
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
  selectionBadgeSelected: {
    backgroundColor: '#0d8a6a',
  },
  selectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b4f3f',
  },
  selectionBadgeTextSelected: {
    color: '#ffffff',
  },
  cardPrintBtn: {
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardPrintBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
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
