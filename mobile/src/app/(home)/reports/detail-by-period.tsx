import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';

import { httpClient } from '@/api/http-client';
import { loadAuthSession } from '@/auth/auth-storage';
import type { LoginResponse } from '@/types/auth';
import { ConfirmModal, ConfirmModalType } from '@/components/ConfirmModal';

interface BillingPeriodOption {
  id: number;
  maKy: string;
  tenKy: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  isClosed: boolean;
}

interface RouteOption {
  id: number;
  maTuyen: string;
  tenTuyen: string;
  staffId: number | null;
  staff: {
    id: number;
    hoVaTen: string;
    taiKhoan: string;
  } | null;
}

interface ServiceCatalogOption {
  id: number;
  maDichVu: string;
  tenDichVu: string;
}

interface MobileFiltersResponse {
  billingPeriods: BillingPeriodOption[];
  routes: RouteOption[];
  serviceCatalogs: ServiceCatalogOption[];
}

interface InvoiceDetailItem {
  invoiceId: number;
  kyHoaDon: string;
  maHoDan: string;
  tenChuHo: string;
  diaChi: string;
  tuyenThuRac: string;
  nguoiThu: string;
  invoiceSerial: string | null;
  invoiceFkey: string | null;
  daPhatHanh: boolean;
  tongTien: number;
  thue: number;
  tongCong: number;
  paymentDate: string | null;
  trangThaiThanhToan: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PUBLISHED';
}

interface InvoiceDetailReportResponse {
  data: InvoiceDetailItem[];
  summary: {
    soHoDaThu: number;
    soHoChuaThu: number;
    soHoaDonDaPhatHanh: number;
    tongTienDaThu: number;
    thueDaThu: number;
    tongCongDaThu: number;
    tongTienChuaThu: number;
    thueChuaThu: number;
    tongCongChuaThu: number;
    tongTien: number;
    thue: number;
    tongCong: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '---';
  }
  return new Date(value).toLocaleString('vi-VN');
}

export default function DetailByPeriodReportRoute() {
  const router = useRouter();

  const [session, setSession] = useState<LoginResponse | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [collectors, setCollectors] = useState<{ id: number; hoVaTen: string; taiKhoan: string }[]>([]);

  // Selected filters (Arrays for multi-select)
  const [selectedKyHoaDons, setSelectedKyHoaDons] = useState<string[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'PAID' | 'UNPAID' | 'ALL' | 'PUBLISHED'>('ALL');

  // Dropdown expand states
  const [expandedFilter, setExpandedFilter] = useState<'period' | 'route' | 'collector' | 'status' | null>(null);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState<InvoiceDetailItem[]>([]);
  const [reportSummary, setReportSummary] = useState<InvoiceDetailReportResponse['summary'] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const isStaff = session?.user.role === 'STAFF';

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

  // Labels for UI representation
  const selectedKyLabel = useMemo(() => {
    if (selectedKyHoaDons.length === 0) return 'Chọn kỳ hóa đơn (bắt buộc)';
    if (selectedKyHoaDons.length === 1) {
      const found = billingPeriods.find(p => p.maKy === selectedKyHoaDons[0]);
      return found ? found.tenKy : selectedKyHoaDons[0];
    }
    return `${selectedKyHoaDons.length} kỳ đã chọn`;
  }, [selectedKyHoaDons, billingPeriods]);

  const selectedRouteLabel = useMemo(() => {
    if (selectedRouteIds.length === 0) return 'Tất cả tuyến';
    if (selectedRouteIds.length === 1) {
      const found = routes.find(r => r.id === selectedRouteIds[0]);
      return found ? `${found.maTuyen} - ${found.tenTuyen}` : 'Tất cả tuyến';
    }
    return `${selectedRouteIds.length} tuyến đã chọn`;
  }, [selectedRouteIds, routes]);

  const selectedCollectorLabel = useMemo(() => {
    if (selectedCollectorId === null) return 'Tất cả nhân viên';
    const found = collectors.find(c => c.id === selectedCollectorId);
    return found ? `${found.hoVaTen} (${found.taiKhoan})` : 'Tất cả nhân viên';
  }, [selectedCollectorId, collectors]);

  const selectedStatusLabel = useMemo(() => {
    if (selectedStatus === 'PAID') return 'Đã thu (chưa xuất HĐ)';
    if (selectedStatus === 'PUBLISHED') return 'Đã xuất hóa đơn';
    if (selectedStatus === 'UNPAID') return 'Chưa thu';
    return 'Tất cả';
  }, [selectedStatus]);

  // Load initial filter data
  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const storedSession = await loadAuthSession();
      if (!storedSession?.accessToken) {
        router.replace('/login');
        return;
      }
      setSession(storedSession);

      const filterResponse = await httpClient.get<MobileFiltersResponse>('/invoices/mobile/filters', {
        headers: { Authorization: `Bearer ${storedSession.accessToken}` }
      });

      const periods = filterResponse.data.billingPeriods ?? [];
      const routeList = filterResponse.data.routes ?? [];

      setBillingPeriods(periods);
      setRoutes(routeList);

      // Extract unique collectors from route staff fields
      const staffMap = new Map<number, { id: number; hoVaTen: string; taiKhoan: string }>();
      routeList.forEach((r) => {
        if (r.staff) {
          staffMap.set(r.staff.id, r.staff);
        }
      });
      const uniqueCollectors = Array.from(staffMap.values());
      setCollectors(uniqueCollectors);

      // Set default selected values
      if (periods.length > 0) {
        setSelectedKyHoaDons([periods[0].maKy]);
      }

      if (storedSession.user.role === 'STAFF') {
        setSelectedCollectorId(storedSession.user.id);
      }
    } catch (error) {
      console.error('Error loading report filters:', error);
      showAlert('Lỗi', 'Không thể tải bộ lọc báo cáo');
    } finally {
      setLoadingFilters(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  // Fetch report data
  const fetchReport = useCallback(async (pageToLoad: number, append = false) => {
    if (selectedKyHoaDons.length === 0) {
      showAlert('Thông báo', 'Vui lòng chọn ít nhất một kỳ hóa đơn');
      return;
    }

    if (pageToLoad === 1) {
      setLoadingReport(true);
    }

    try {
      const response = await httpClient.get<InvoiceDetailReportResponse>('/invoices/reports/detail-by-period', {
        params: {
          kyHoaDons: selectedKyHoaDons.join(','),
          routeIds: selectedRouteIds.length > 0 ? selectedRouteIds.join(',') : undefined,
          collectorId: selectedCollectorId || undefined,
          trangThaiThanhToan: selectedStatus,
          page: pageToLoad,
          limit: 20,
        },
      });

      if (append) {
        setReportData(prev => [...prev, ...(response.data.data ?? [])]);
      } else {
        setReportData(response.data.data ?? []);
      }

      setReportSummary(response.data.summary);
      setCurrentPage(response.data.pagination.page);
      setTotalPages(response.data.pagination.totalPages);
      setTotalItems(response.data.pagination.total);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message ?? 'Lỗi tải báo cáo'
        : 'Lỗi tải báo cáo';
      showAlert('Thất bại', msg);
    } finally {
      setLoadingReport(false);
      setRefreshing(false);
    }
  }, [selectedKyHoaDons, selectedRouteIds, selectedCollectorId, selectedStatus]);

  // Handle Search Trigger
  const handleSearch = () => {
    setExpandedFilter(null);
    void fetchReport(1, false);
  };

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    void fetchReport(1, false);
  };

  // Infinite Scroll / Load more
  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingReport) {
      void fetchReport(currentPage + 1, true);
    }
  };

  const toggleFilter = (type: 'period' | 'route' | 'collector' | 'status') => {
    setExpandedFilter(current => (current === type ? null : type));
  };

  const toggleKy = (maKy: string) => {
    setSelectedKyHoaDons(current =>
      current.includes(maKy) ? current.filter(k => k !== maKy) : [...current, maKy]
    );
  };

  const toggleRoute = (id: number) => {
    setSelectedRouteIds(current =>
      current.includes(id) ? current.filter(r => r !== id) : [...current, id]
    );
  };

  const toggleAllRoutes = () => {
    setSelectedRouteIds([]);
  };

  const selectCollector = (id: number | null) => {
    setSelectedCollectorId(id);
    setExpandedFilter(null);
  };

  const selectStatus = (status: 'PAID' | 'UNPAID' | 'ALL' | 'PUBLISHED') => {
    setSelectedStatus(status);
    setExpandedFilter(null);
  };

  // Render invoice card item
  const renderItem = ({ item }: { item: InvoiceDetailItem }) => (
    <View style={styles.invoiceCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.householdCode}>{item.maHoDan}</Text>
          <Text style={styles.householdName}>{item.tenChuHo}</Text>
        </View>
        <Text style={styles.amountText}>{formatCurrency(item.tongCong)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Kỳ hóa đơn:</Text>
          <Text style={styles.infoValue}>{item.kyHoaDon}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Địa chỉ:</Text>
          <Text style={styles.infoValue}>{item.diaChi}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tuyến thu:</Text>
          <Text style={styles.infoValue}>{item.tuyenThuRac}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nhân viên:</Text>
          <Text style={styles.infoValue}>{item.nguoiThu}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ngày thu:</Text>
          <Text style={styles.infoValue}>{formatDateTime(item.paymentDate)}</Text>
        </View>

        {item.invoiceSerial || item.invoiceFkey ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hóa đơn:</Text>
            <Text style={styles.infoValue}>
              Seri: {item.invoiceSerial || '---'} | Fkey: {item.invoiceFkey || '---'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <View style={[
          styles.statusChip,
          item.trangThaiThanhToan === 'PAID'
            ? styles.statusPaid
            : item.trangThaiThanhToan === 'PUBLISHED'
              ? styles.statusPublished
              : item.trangThaiThanhToan === 'OVERDUE'
                ? styles.statusDebt
                : styles.statusUnpaid
        ]}>
          <Text style={styles.statusText}>
            {item.trangThaiThanhToan === 'PUBLISHED' ? 'Đã xuất HĐ' : item.trangThaiThanhToan === 'PAID' ? 'Đã thu' : item.trangThaiThanhToan === 'OVERDUE' ? 'Quá hạn' : 'Chưa thu'}
          </Text>
        </View>
        <View style={[styles.publishChip, item.daPhatHanh ? styles.publishSuccess : styles.publishPending]}>
          <Text style={[styles.publishText, item.daPhatHanh ? styles.publishTextSuccess : styles.publishTextPending]}>
            {item.daPhatHanh ? 'Đã phát hành HĐ' : 'Chưa phát hành HĐ'}
          </Text>
        </View>
      </View>
    </View>
  );

  // Render filters and stats header component of FlatList
  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Filters Form */}
      <View style={styles.filterCard}>
        <Pressable onPress={() => setFilterCollapsed(!filterCollapsed)} style={styles.filterHeaderPressable}>
          <Text style={styles.filterTitle}>Bộ lọc báo cáo</Text>
          <Text style={styles.filterToggleText}>{filterCollapsed ? 'Hiện bộ lọc ▾' : 'Thu gọn ▴'}</Text>
        </Pressable>

        {!filterCollapsed && (
          <>
            <View style={styles.filterGrid}>
          {/* Billing Period Multi-Select Dropdown */}
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Kỳ hóa đơn * (Chọn nhiều)</Text>
            <Pressable onPress={() => toggleFilter('period')} style={styles.selectShell}>
              <View style={styles.selectIconWrap}>
                <Text style={styles.selectIcon}>{expandedFilter === 'period' ? '▴' : '▾'}</Text>
              </View>
              <Text style={styles.selectValueText} numberOfLines={1}>
                {selectedKyLabel}
              </Text>
            </Pressable>
            {expandedFilter === 'period' && (
              <View style={styles.dropdownPanel}>
                {billingPeriods.map((item) => {
                  const isSelected = selectedKyHoaDons.includes(item.maKy);
                  return (
                    <Pressable key={item.id} onPress={() => toggleKy(item.maKy)} style={styles.dropdownOption}>
                      <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextActive]}>
                        {item.tenKy}
                      </Text>
                      {isSelected && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Route Multi-Select Dropdown */}
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Tuyến thu (Chọn nhiều)</Text>
            <Pressable onPress={() => toggleFilter('route')} style={styles.selectShell}>
              <View style={styles.selectIconWrap}>
                <Text style={styles.selectIcon}>{expandedFilter === 'route' ? '▴' : '▾'}</Text>
              </View>
              <Text style={styles.selectValueText} numberOfLines={1}>
                {selectedRouteLabel}
              </Text>
            </Pressable>
            {expandedFilter === 'route' && (
              <View style={styles.dropdownPanel}>
                <Pressable onPress={toggleAllRoutes} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selectedRouteIds.length === 0 && styles.dropdownOptionTextActive]}>
                    Tất cả tuyến
                  </Text>
                  {selectedRouteIds.length === 0 && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                </Pressable>
                {routes.map((item) => {
                  const isSelected = selectedRouteIds.includes(item.id);
                  return (
                    <Pressable key={item.id} onPress={() => toggleRoute(item.id)} style={styles.dropdownOption}>
                      <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextActive]}>
                        {item.maTuyen} - {item.tenTuyen}
                      </Text>
                      {isSelected && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Payment Status Dropdown */}
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Trạng thái thanh toán</Text>
            <Pressable onPress={() => toggleFilter('status')} style={styles.selectShell}>
              <View style={styles.selectIconWrap}>
                <Text style={styles.selectIcon}>{expandedFilter === 'status' ? '▴' : '▾'}</Text>
              </View>
              <Text style={styles.selectValueText}>{selectedStatusLabel}</Text>
            </Pressable>
            {expandedFilter === 'status' && (
              <View style={styles.dropdownPanel}>
                <Pressable onPress={() => selectStatus('PAID')} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selectedStatus === 'PAID' && styles.dropdownOptionTextActive]}>
                    Đã thu (chưa xuất HĐ)
                  </Text>
                  {selectedStatus === 'PAID' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                </Pressable>
                <Pressable onPress={() => selectStatus('PUBLISHED')} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selectedStatus === 'PUBLISHED' && styles.dropdownOptionTextActive]}>
                    Đã xuất hóa đơn
                  </Text>
                  {selectedStatus === 'PUBLISHED' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                </Pressable>
                <Pressable onPress={() => selectStatus('UNPAID')} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selectedStatus === 'UNPAID' && styles.dropdownOptionTextActive]}>
                    Chưa thu
                  </Text>
                  {selectedStatus === 'UNPAID' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                </Pressable>
                <Pressable onPress={() => selectStatus('ALL')} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selectedStatus === 'ALL' && styles.dropdownOptionTextActive]}>
                    Tất cả
                  </Text>
                  {selectedStatus === 'ALL' && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                </Pressable>
              </View>
            )}
          </View>

          {/* Collector Dropdown */}
          {!isStaff ? (
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Nhân viên thu</Text>
              <Pressable onPress={() => toggleFilter('collector')} style={styles.selectShell}>
                <View style={styles.selectIconWrap}>
                  <Text style={styles.selectIcon}>{expandedFilter === 'collector' ? '▴' : '▾'}</Text>
                </View>
                <Text style={styles.selectValueText}>{selectedCollectorLabel}</Text>
              </Pressable>
              {expandedFilter === 'collector' && (
                <View style={styles.dropdownPanel}>
                  <Pressable onPress={() => selectCollector(null)} style={styles.dropdownOption}>
                    <Text style={[styles.dropdownOptionText, selectedCollectorId === null && styles.dropdownOptionTextActive]}>
                      Tất cả nhân viên
                    </Text>
                    {selectedCollectorId === null && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                  </Pressable>
                  {collectors.map((item) => (
                    <Pressable key={item.id} onPress={() => selectCollector(item.id)} style={styles.dropdownOption}>
                      <Text style={[styles.dropdownOptionText, selectedCollectorId === item.id && styles.dropdownOptionTextActive]}>
                        {item.hoVaTen} ({item.taiKhoan})
                      </Text>
                      {selectedCollectorId === item.id && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Nhân viên thu</Text>
              <View style={[styles.selectShell, styles.disabledShell]}>
                <Text style={styles.disabledText}>
                  {session?.user.hoVaTen} ({session?.user.taiKhoan})
                </Text>
              </View>
            </View>
          )}
        </View>

            <Pressable onPress={handleSearch} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Tìm kiếm báo cáo</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Summary Card */}
      {reportSummary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tổng hợp số liệu</Text>
          
          {/* Row 1: Household counts (3 columns) */}
          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Đã thu</Text>
              <Text style={[styles.statValue, styles.successText]}>{reportSummary.soHoDaThu} hộ</Text>
            </View>
            <View style={[styles.statColumn, styles.borderLeftRight]}>
              <Text style={styles.statLabel}>Chưa thu</Text>
              <Text style={[styles.statValue, styles.errorText]}>{reportSummary.soHoChuaThu} hộ</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Đã xuất HĐ</Text>
              <Text style={[styles.statValue, styles.infoText]}>{reportSummary.soHoaDonDaPhatHanh} HĐ</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          {/* Row 2: Financials (Clean list design) */}
          <View style={styles.financeRow}>
            <View style={styles.financeDetail}>
              <Text style={styles.financeLabel}>Tiền dịch vụ</Text>
              <Text style={styles.financeValue}>{formatCurrency(reportSummary.tongTien)}</Text>
            </View>
            <View style={styles.financeDetail}>
              <Text style={styles.financeLabel}>Thuế VAT (10%)</Text>
              <Text style={styles.financeValue}>{formatCurrency(reportSummary.thue)}</Text>
            </View>
            <View style={styles.summaryDividerMini} />
            <View style={styles.financeDetail}>
              <Text style={styles.financeLabel}>Thực thu (Đã thu)</Text>
              <Text style={[styles.financeValue, styles.successText]}>{formatCurrency(reportSummary.tongCongDaThu)}</Text>
            </View>
            <View style={styles.financeDetail}>
              <Text style={styles.financeLabel}>Còn nợ (Chưa thu)</Text>
              <Text style={[styles.financeValue, styles.errorText]}>{formatCurrency(reportSummary.tongCongChuaThu)}</Text>
            </View>
            <View style={[styles.financeDetail, styles.grandTotalDetail]}>
              <Text style={styles.grandTotalLabel}>Tổng cộng phải thu</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(reportSummary.tongCong)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Danh sách hóa đơn</Text>
        {reportSummary && <Text style={styles.listCount}>{totalItems} hóa đơn</Text>}
      </View>
    </View>
  );

  // Footer loading indicator for infinite scroll
  const renderFooter = () => {
    if (currentPage < totalPages && !loadingReport) {
      return (
        <View style={styles.loaderFooter}>
          <ActivityIndicator size="small" color="#0d8a6a" />
        </View>
      );
    }
    return <View style={{ height: 20 }} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Báo cáo theo kỳ</Text>
          <Text style={styles.subtitle}>Chi tiết hóa đơn đã thu</Text>
        </View>
      </View>

      {loadingFilters ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0d8a6a" />
          <Text style={styles.loadingText}>Đang tải bộ lọc...</Text>
        </View>
      ) : (
        <FlatList
          data={reportData}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.invoiceId)}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loadingReport ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Không tìm thấy hóa đơn nào</Text>
                <Text style={styles.emptySubText}>Vui lòng chọn kỳ hóa đơn khác hoặc thay đổi bộ lọc.</Text>
              </View>
            ) : null
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {loadingReport && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0d8a6a" />
          <Text style={styles.overlayText}>Đang lấy số liệu...</Text>
        </View>
      )}

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
    backgroundColor: '#0d8a6a',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff25',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: -2,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#bbf2e3',
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#32584d',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 24,
  },
  headerContent: {
    padding: 14,
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d8a6a',
    textTransform: 'uppercase',
  },
  filterHeaderPressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d8a6a',
  },
  filterGrid: {
    gap: 12,
  },
  filterField: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4c776b',
  },
  selectShell: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cde0da',
    backgroundColor: '#f8fbfa',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  disabledShell: {
    backgroundColor: '#edf3f1',
    borderColor: '#d5e2de',
  },
  selectIconWrap: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#dbe9e4',
    backgroundColor: '#eef7f3',
    height: '100%',
  },
  selectIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0d8a6a',
  },
  selectValueText: {
    flex: 1,
    color: '#16352d',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  disabledText: {
    color: '#718e86',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  dropdownPanel: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    maxHeight: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  dropdownOption: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf3f0',
  },
  dropdownOptionText: {
    color: '#32584d',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownOptionTextActive: {
    color: '#0d8a6a',
    fontWeight: '800',
  },
  dropdownOptionCheck: {
    color: '#0d8a6a',
    fontWeight: '800',
    fontSize: 14,
  },
  searchButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d8a6a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0d8a6a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderLeftRight: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e8f2ef',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718e86',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16352d',
  },
  successText: {
    color: '#0d8a6a',
  },
  errorText: {
    color: '#c0392b',
  },
  infoText: {
    color: '#2980b9',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#edf3f1',
    marginVertical: 14,
  },
  summaryDividerMini: {
    height: 1,
    backgroundColor: '#edf3f1',
    marginVertical: 4,
  },
  financeRow: {
    gap: 8,
  },
  financeDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 12,
    color: '#718e86',
    fontWeight: '600',
  },
  financeValue: {
    fontSize: 13,
    color: '#32584d',
    fontWeight: '700',
  },
  grandTotalDetail: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f6f4',
  },
  grandTotalLabel: {
    fontSize: 13,
    color: '#16352d',
    fontWeight: '800',
  },
  grandTotalValue: {
    fontSize: 16,
    color: '#0d8a6a',
    fontWeight: '800',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16352d',
  },
  listCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d8a6a',
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2ece8',
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 14,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  householdCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d8a6a',
    backgroundColor: '#eef7f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  householdName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16352d',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  divider: {
    height: 1,
    backgroundColor: '#edf3f1',
    marginVertical: 10,
  },
  cardBody: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 75,
    fontSize: 12,
    color: '#718e86',
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 12,
    color: '#32584d',
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  publishChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  publishSuccess: {
    backgroundColor: '#e3f7f0',
  },
  publishPending: {
    backgroundColor: '#f1f5f3',
  },
  publishText: {
    fontSize: 11,
    fontWeight: '700',
  },
  publishTextSuccess: {
    color: '#0d8a6a',
  },
  publishTextPending: {
    color: '#7c978f',
  },
  loaderFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4c776b',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#718e86',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffffcc',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  overlayText: {
    marginTop: 12,
    color: '#0d8a6a',
    fontSize: 14,
    fontWeight: '700',
  },
  debtValue: {
    color: '#c0392b',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: {
    backgroundColor: '#e5f7eb',
  },
  statusPublished: {
    backgroundColor: '#e1f5fe',
  },
  statusUnpaid: {
    backgroundColor: '#fff6d8',
  },
  statusDebt: {
    backgroundColor: '#ffe7d7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f473d',
  },
});
