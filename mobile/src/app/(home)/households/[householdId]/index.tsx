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
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { httpClient, setAccessToken } from '@/api/http-client';
import { clearAuthSession, loadAuthSession } from '@/auth/auth-storage';
import type { LoginResponse } from '@/types/auth';
import { printerService } from '@/services/printer-service';
import { API_BASE_URL } from '@/constants/api-base-url';
import { ConfirmModal, ConfirmModalType } from '@/components/ConfirmModal';

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
  invoiceSerial: string | null;
  invoiceFkey: string | null;
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

interface ReceiptPayloadInvoice {
  id: number;
  kyHoaDon: string;
  tongTien: number;
  thue: number;
  paymentDate: string | null;
  invoicePublishStatus?: string | null;
  invoiceSerial?: string | null;
  invoiceFkey?: string | null;
  collectedByName?: string | null;
  household: {
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
  } | null;
}

interface ReceiptPayloadResponse {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyAccountNumber?: string;
  portalUrl?: string;
  generatedAt: string;
  totalInvoices: number;
  totalAmount: number;
  qrThanhToan?: string;
  vietQrPayload?: string;
  invoices: ReceiptPayloadInvoice[];
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

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function buildReceiptHtml(invoice: ReceiptPayloadInvoice, payload?: ReceiptPayloadResponse) {
  const total = Number(invoice.tongTien) + Number(invoice.thue);
  const generatedAt = new Date().toLocaleString('vi-VN');
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
      .card { border: 1px solid #cfe1db; border-radius: 12px; padding: 14px; max-width: 580px; margin: 0 auto; background: #ffffff; }
      .header-box { text-align: center; border-bottom: 1.5px solid #0d8a6a; padding-bottom: 10px; margin-bottom: 12px; }
      .company-name { font-size: 15px; font-weight: 800; color: #0d8a6a; margin: 0; text-transform: uppercase; }
      .company-sub { font-size: 11px; color: #4b7167; margin: 2px 0 0; }
      .title-box { text-align: center; margin: 10px 0; }
      .title { font-size: 18px; font-weight: 800; margin: 0; color: ${isInvoicePublished ? '#0b4f3f' : '#1e3a8a'}; text-transform: uppercase; }
      .title-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
      .badge-published { display: inline-block; background: #e6f4ea; color: #137333; font-weight: 700; font-size: 10px; padding: 2px 8px; border-radius: 12px; border: 1px solid #ceead6; margin-top: 4px; }
      .badge-receipt { display: inline-block; background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 10px; padding: 2px 8px; border-radius: 12px; border: 1px solid #bfdbfe; margin-top: 4px; }
      .invoice-info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; margin: 10px 0; }
      .invoice-info-box.receipt-box { background: #f8fafc; border-color: #e2e8f0; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 12px; }
      .info-item { display: flex; flex-direction: column; }
      .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
      .info-val { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 1px; }
      .row { display: flex; justify-content: space-between; margin: 5px 0; border-bottom: 1px dashed #e2e8f0; padding-bottom: 5px; font-size: 12px; }
      .strong { font-weight: 700; color: #0f2d25; }
      .total-row { display: flex; justify-content: space-between; margin: 8px 0 4px; padding: 8px 10px; background: #f1f9f6; border-radius: 8px; font-size: 14px; font-weight: 800; color: #0d8a6a; }
      .qr-container { text-align: center; margin-top: 8px; border-top: 1px dashed #cfe1db; padding-top: 8px; }
      .qr-img { width: 120px; height: 120px; object-fit: contain; }
      .qr-label { font-size: 11px; font-weight: 700; color: #0d8a6a; margin-top: 2px; }
      .invoice-lookup-box { background: #f0fdf4; border: 1px dashed #a7f3d0; border-radius: 8px; padding: 8px 10px; margin-top: 8px; text-align: center; }
      .invoice-lookup-text { font-size: 11px; color: #1e3a8a; margin: 0; line-height: 1.5; }
      .lookup-link { color: #0d8a6a; font-weight: 700; text-decoration: underline; }
      .fkey-code { color: #0d8a6a; font-size: 12px; font-weight: 800; }
      .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 6px; border-top: 1px solid #f1f5f9; padding-top: 4px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header-box">
        <h2 class="company-name">${payload?.companyName || 'CÔNG TRÌNH ĐÔ THỊ AN KHÊ'}</h2>
        <p class="company-sub">${payload?.companyAddress ? `ĐC: ${payload.companyAddress}` : ''} ${payload?.companyPhone ? `• ĐT: ${payload.companyPhone}` : ''}</p>
        ${payload?.companyAccountNumber ? `<p class="company-sub">STK: ${payload.companyAccountNumber}</p>` : ''}
      </div>

      <div class="title-box">
        <h1 class="title">${isInvoicePublished ? 'HÓA ĐƠN ĐIỆN TỬ (BIÊN NHẬN)' : 'PHIẾU THU TIỀN RÁC'}</h1>
        <p class="title-sub">Thời gian in: ${generatedAt}</p>
      </div>

      <div class="row"><span>Mã hộ dân</span><span class="strong">${invoice.household?.maHoDan ?? '---'}</span></div>
      <div class="row"><span>Chủ hộ</span><span class="strong">${invoice.household?.tenChuHo ?? '---'}</span></div>
      <div class="row"><span>Địa chỉ</span><span class="strong">${invoice.household?.diaChi ?? '---'}</span></div>
      <div class="row"><span>Kỳ thanh toán</span><span class="strong">${invoice.kyHoaDon}</span></div>
      <div class="row"><span>Tiền dịch vụ</span><span class="strong">${formatCurrency(Number(invoice.tongTien))}</span></div>
      <div class="row"><span>Thuế GTGT</span><span class="strong">${formatCurrency(Number(invoice.thue))}</span></div>
      <div class="total-row"><span>TỔNG CỘNG THANH TOÁN</span><span>${formatCurrency(total)}</span></div>
      <div class="row"><span>Ngày thu tiền</span><span class="strong">${invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleString('vi-VN') : '---'}</span></div>

      ${qrImageUrl ? `
      <div class="qr-container">
        <p class="qr-label">MÃ QR THANH TOÁN</p>
        <img class="qr-img" src="${qrImageUrl}" alt="Mã QR thanh toán" />
      </div>
      ` : ''}

      ${isInvoicePublished ? `
      <div class="invoice-lookup-box">
        <p class="invoice-lookup-text">
          Tra cứu hóa đơn <strong>(${invoice.invoiceSerial || '---'})</strong> tại: <br/>
          <a href="${portalUrl}" target="_blank" class="lookup-link">${portalUrl}</a> <br/>
          với mã FKey: <strong class="fkey-code">${invoice.invoiceFkey || '---'}</strong>
        </p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Cảm ơn quý khách đã thanh toán dịch vụ thu gom rác sinh hoạt!</p>
      </div>
    </div>
    <script>
      window.onload = function () { window.print(); };
    </script>
  </body>
</html>`;
}

export default function HouseholdDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ householdId?: string; kyHoaDon?: string }>();
  const householdId = Number(params.householdId);
  const selectedKyHoaDon = typeof params.kyHoaDon === 'string' ? params.kyHoaDon.trim() : '';

  const [session, setSession] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionLabel, setActionLabel] = useState<string>('');
  const [data, setData] = useState<HouseholdHistoryResponse | null>(null);

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

  const loadDetail = useCallback(async () => {
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
          ? error.response?.data?.message ?? 'Không tải được chi tiết hộ dân'
          : 'Không tải được chi tiết hộ dân';
      showAlert('Lỗi', message, () => router.back());
    } finally {
      setLoading(false);
    }
  }, [householdId, router]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const visibleInvoices = useMemo(() => {
    const rows = data?.invoices ?? [];
    if (!selectedKyHoaDon) {
      return rows;
    }

    return rows.filter((invoice) => invoice.kyHoaDon === selectedKyHoaDon);
  }, [data, selectedKyHoaDon]);

  const summaryTiles = useMemo(
    () => {
      const paid = visibleInvoices.filter((item) => item.trangThaiThanhToan === 'PAID' || item.trangThaiThanhToan === 'PUBLISHED').length;
      const unpaid = visibleInvoices.length - paid;

      return [
        { label: 'Tổng kỳ', value: visibleInvoices.length },
        { label: 'Đã thu', value: paid },
        { label: 'Chưa thu', value: unpaid },
      ];
    },
    [visibleInvoices],
  );

  const confirmPublish = (invoice: HouseholdHistoryInvoice) => {
    if (invoice.invoicePublishStatus === 'SUCCESS') {
      showAlert('Thông báo', 'Hóa đơn đã phát hành, không thể xuất lại');
      return;
    }

    if (Platform.OS === 'web') {
      const accepted = globalThis.confirm?.(`Bạn có đồng ý xuất hóa đơn kỳ ${invoice.kyHoaDon} cho hộ này không?`) ?? true;
      if (accepted) {
        void publishInvoice(invoice.id);
      }
      return;
    }

    showConfirm({
      title: 'Xác nhận xuất hóa đơn',
      message: `Bạn có đồng ý xuất hóa đơn kỳ ${invoice.kyHoaDon} cho hộ này không?`,
      confirmText: 'Xuất hóa đơn',
      type: 'primary',
      icon: '🧾',
      onConfirm: () => {
        hideConfirm();
        void publishInvoice(invoice.id);
      },
    });
  };

  const confirmCollect = (invoice: HouseholdHistoryInvoice) => {
    if (Platform.OS === 'web') {
      const accepted = globalThis.confirm?.(`Bạn có đồng ý xác nhận thu tiền kỳ ${invoice.kyHoaDon} không?`) ?? true;
      if (accepted) {
        void collectInvoice(invoice.id);
      }
      return;
    }

    showConfirm({
      title: 'Xác nhận thu tiền',
      message: `Bạn có đồng ý xác nhận thu tiền kỳ ${invoice.kyHoaDon} không?`,
      confirmText: 'Thu tiền',
      type: 'success',
      icon: '💰',
      onConfirm: () => {
        hideConfirm();
        void collectInvoice(invoice.id);
      },
    });
  };

  const publishInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    setActionLabel('Đang xuất hóa đơn...');
    try {
      const response = await httpClient.post('/invoices/publish', { invoiceIds: [invoiceId] }, { timeout: 120000 });
      showAlert('Thông báo', response.data?.message ?? 'Đã xuất hóa đơn');
      await loadDetail();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.code === 'ECONNABORTED'
          ? 'Xuất hóa đơn đang xử lý lâu hơn dự kiến. Vui lòng thử lại sau 1-2 phút.'
          : error.code === 'ERR_CANCELED'
            ? 'Yêu cầu xuất hóa đơn đã bị hủy. Vui lòng thử lại.'
            : error.response?.data?.message ?? 'Xuất hóa đơn thất bại'
        : 'Xuất hóa đơn thất bại';
      showAlert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
      setActionLabel('');
    }
  };

  const collectInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    setActionLabel('Đang thu tiền...');
    try {
      const formData = new FormData();
      formData.append('invoiceIds', JSON.stringify([invoiceId]));

      const response = await httpClient.post('/invoices/collect', formData, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showAlert('Thông báo', response.data?.message ?? 'Thu tiền thành công');
      await loadDetail();
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
      setActionLoadingId(null);
      setActionLabel('');
    }
  };

  const downloadInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    setActionLabel('Đang tải hóa đơn...');
    try {
      const response = await httpClient.get(`/invoices/${invoiceId}/download-vnpt`);
      const payload = response.data as {
        mimeType?: string;
        content?: string;
        base64?: boolean;
        filename?: string;
      };

      if (Platform.OS === 'web' && payload.content) {
        const popup = globalThis.open('', '_blank');
        if (!popup) {
          showAlert('Lỗi', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để mở hóa đơn.');
          return;
        }

        popup.document.write(payload.content);
        popup.document.close();
        showAlert('Thông báo', 'Đã mở hóa đơn trên trình duyệt');
        return;
      }

      if (Platform.OS !== 'web' && payload.content) {
        const baseName = (payload.filename || `hoa-don-${invoiceId}`)
          .replace(/\.html?$/i, '')
          .replace(/\.pdf$/i, '');
        const targetUri = `${FileSystem.documentDirectory ?? ''}${baseName}.pdf`;

        if (payload.mimeType === 'application/pdf' && payload.base64) {
          await FileSystem.writeAsStringAsync(targetUri, payload.content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          const html = payload.content;
          const printFile = await Print.printToFileAsync({ html });
          await FileSystem.copyAsync({ from: printFile.uri, to: targetUri });
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(targetUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Lưu hóa đơn PDF',
          });
        }

        showAlert('Thông báo', 'Đã tạo file PDF hóa đơn, bạn có thể lưu về điện thoại');
        return;
      }

      showAlert('Thông báo', 'Không nhận được dữ liệu hóa đơn hợp lệ');
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Tải hóa đơn thất bại'
          : 'Tải hóa đơn thất bại';
      showAlert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
      setActionLabel('');
    }
  };

  const printReceipt = async (invoiceId: number) => {
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

    setActionLoadingId(invoiceId);
    setActionLabel('Đang tạo phiếu thu...');
    try {
      const response = await httpClient.get<any>('/invoices/receipt', {
        params: { invoiceIds: String(invoiceId) },
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
        showAlert('In thành công', 'Đã in phiếu thu thành công trên máy in nhiệt Bluetooth RI-5809DD!');
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'In phiếu thu thất bại'
          : 'In phiếu thu thất bại';
      showAlert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
      setActionLabel('');
    }
  };

  const goToHistory = () => {
    router.push(`/households/${householdId}/history` as never);
  };

  const syncInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    setActionLabel('Đang đồng bộ hóa đơn...');
    try {
      const response = await httpClient.post<{
        successCount: number;
        failCount: number;
        results: Array<{
          invoiceId: number;
          success: boolean;
          message: string;
          invoiceSerial?: string | null;
          invoiceFkey?: string | null;
        }>;
      }>('/invoices/sync-metadata', {
        invoiceIds: [invoiceId],
      });

      const result = response.data?.results?.[0];
      if (result?.success) {
        showAlert('Thành công', 'Đồng bộ hóa đơn thành công!');
        void loadDetail();
      } else {
        showAlert('Thất bại', result?.message || 'Đồng bộ hóa đơn thất bại');
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Đồng bộ hóa đơn thất bại'
          : 'Đồng bộ hóa đơn thất bại';
      showAlert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
      setActionLabel('');
    }
  };

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
        <Text style={styles.kicker}>Chi tiết hộ dân</Text>
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
            <Text style={styles.secondaryButtonText}>↩ Quay lại</Text>
          </Pressable>
          <Pressable onPress={goToHistory} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>🕘 Lịch sử hộ dân</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          Danh sách kỳ hóa đơn{selectedKyHoaDon ? ` • Kỳ ${selectedKyHoaDon}` : ''}
        </Text>
        {actionLabel ? <Text style={styles.actionHint}>{actionLabel}</Text> : null}
        <View style={styles.invoiceList}>
          {visibleInvoices.map((invoice) => {
            const total = toNumber(invoice.tongTien) + toNumber(invoice.thue);
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
              <View key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoicePeriod}>Kỳ {invoice.kyHoaDon}</Text>
                    <Text style={styles.invoiceMoney}>{formatCurrency(total)}</Text>
                  </View>
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
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>

                <Text style={styles.invoiceMeta}>Phát hành: {invoice.invoicePublishStatus ?? 'Chưa phát hành'}</Text>
                <Text style={styles.invoiceMeta}>
                  Số hóa đơn: {invoice.invoiceSerial ?? '---'} • FKey: {invoice.invoiceFkey ?? '---'}
                </Text>
                <Text style={styles.invoiceMeta}>
                  Ngày thu: {invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleString('vi-VN') : '---'}
                </Text>
                <Text style={styles.invoiceMeta}>Kỳ trên hóa đơn: {invoice.mergedPeriodCodes ?? invoice.kyHoaDon}</Text>
                <Text style={styles.invoiceMeta}>Người xuất: {invoice.publishedByName ?? '---'}</Text>
                <Text style={styles.invoiceMeta}>Người thu: {invoice.collectedByName ?? '---'}</Text>
                {invoice.paymentNote ? <Text style={styles.invoiceNote}>Ghi chú: {invoice.paymentNote}</Text> : null}

                <View style={styles.invoiceActions}>
                  {/* 1. Thu tiền */}
                  <Pressable
                    onPress={() => confirmCollect(invoice)}
                    disabled={actionLoadingId === invoice.id}
                    style={({ pressed }) => [styles.actionButton, styles.actionButtonCollect, pressed && styles.pressed]}>
                    <Text style={styles.actionButtonText}>
                      {actionLoadingId === invoice.id ? 'Đang xử lý...' : '💰 Thu tiền'}
                    </Text>
                  </Pressable>

                  {/* 2. In phiếu thu */}
                  <Pressable
                    onPress={() => void printReceipt(invoice.id)}
                    disabled={actionLoadingId === invoice.id}
                    style={({ pressed }) => [styles.actionButton, styles.actionButtonPrint, pressed && styles.pressed]}>
                    <Text style={styles.actionButtonText}>🖨 In phiếu thu</Text>
                  </Pressable>

                  {/* 3. Xuất hóa đơn */}
                  <Pressable
                    onPress={() => confirmPublish(invoice)}
                    disabled={isPublished || actionLoadingId === invoice.id}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionButtonPublish,
                      (isPublished || actionLoadingId === invoice.id) && styles.actionButtonDisabled,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.actionButtonText}>
                      {isPublished ? 'Đã phát hành' : actionLoadingId === invoice.id ? 'Đang xử lý...' : '🧾 Xuất hóa đơn'}
                    </Text>
                  </Pressable>

                  {/* 4. Tải hóa đơn */}
                  <Pressable
                    onPress={() => void downloadInvoice(invoice.id)}
                    disabled={actionLoadingId === invoice.id}
                    style={({ pressed }) => [styles.actionButton, styles.actionButtonDownload, pressed && styles.pressed]}>
                    <Text style={styles.actionButtonText}>⬇ Tải hóa đơn</Text>
                  </Pressable>

                  {/* 5. ĐB hóa đơn */}
                  <Pressable
                    onPress={() => void syncInvoice(invoice.id)}
                    disabled={actionLoadingId === invoice.id}
                    style={({ pressed }) => [styles.actionButton, styles.actionButtonSync, pressed && styles.pressed]}>
                    <Text style={styles.actionButtonText}>
                      {actionLoadingId === invoice.id && actionLabel.includes('đồng bộ') ? 'Đang xử lý...' : '🔄 ĐB hóa đơn'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {visibleInvoices.length === 0 ? (
            <View style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeTitle}>Không có hóa đơn trong kỳ đang chọn</Text>
              <Text style={styles.emptyNoticeText}>Vui lòng bấm Lịch sử hộ dân để xem các kỳ trước.</Text>
            </View>
          ) : null}
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
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
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
  actionHint: {
    fontSize: 12,
    color: '#0b4f3f',
    fontWeight: '700',
  },
  invoiceList: {
    gap: 10,
  },
  emptyNotice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e8e2',
    backgroundColor: '#f7fbf9',
    padding: 12,
    gap: 4,
  },
  emptyNoticeTitle: {
    color: '#1d3d33',
    fontWeight: '700',
  },
  emptyNoticeText: {
    color: '#4b7167',
    fontSize: 12,
  },
  invoiceCard: {
    borderRadius: 14,
    backgroundColor: '#f9fcfb',
    borderWidth: 1,
    borderColor: '#dceae5',
    padding: 12,
    gap: 6,
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
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1f473d',
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
  invoiceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    minWidth: '47%',
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonPublish: {
    borderColor: '#bed8f6',
    backgroundColor: '#e9f2ff',
  },
  actionButtonCollect: {
    borderColor: '#bfe8d2',
    backgroundColor: '#e8f8ef',
  },
  actionButtonDownload: {
    borderColor: '#f1d596',
    backgroundColor: '#fff3cf',
  },
  actionButtonPrint: {
    borderColor: '#d6dce6',
    backgroundColor: '#eef2f7',
  },
  actionButtonSync: {
    borderColor: '#d8b4fe',
    backgroundColor: '#f3e8ff',
  },
  actionButtonText: {
    color: '#173a30',
    fontWeight: '700',
    fontSize: 12,
  },
});
