import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';

import { httpClient } from '@/api/http-client';
import { loadAuthSession } from '@/auth/auth-storage';
import type { LoginResponse } from '@/types/auth';
import { ConfirmModal, ConfirmModalType } from '@/components/ConfirmModal';

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

interface MobileFiltersResponse {
  billingPeriods: Array<{ id: number; maKy: string; tenKy: string }>;
  routes: RouteOption[];
  serviceCatalogs: Array<{ id: number; maDichVu: string; tenDichVu: string }>;
}

interface InvoiceDetailByDateItem {
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

interface DetailByDateReportResponse {
  data: InvoiceDetailByDateItem[];
  summary: {
    soHoDaThu: number;
    soHoaDonDaPhatHanh: number;
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

function formatCurrency(value?: number | null) {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DetailByDateReportScreen() {
  const router = useRouter();
  const [session, setSession] = useState<LoginResponse | null>(null);

  // Date filters
  const todayStr = formatDate(new Date());
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  // Filter dropdown data
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [collectors, setCollectors] = useState<Array<{ id: number; hoVaTen: string; taiKhoan: string }>>([]);

  // Selected filters
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState<number | null>(null);

  // UI state
  const [expandedFilter, setExpandedFilter] = useState<'route' | 'collector' | null>(null);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState<InvoiceDetailByDateItem[]>([]);
  const [reportSummary, setReportSummary] = useState<DetailByDateReportResponse['summary'] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const isStaff = session?.user.role === 'STAFF';

  // Custom Modal Alert State
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

  const selectedRouteLabel = useMemo(() => {
    if (selectedRouteId === null) return 'Tất cả tuyến';
    const found = routes.find(r => r.id === selectedRouteId);
    return found ? `${found.maTuyen} - ${found.tenTuyen}` : 'Tất cả tuyến';
  }, [selectedRouteId, routes]);

  const selectedCollectorLabel = useMemo(() => {
    if (selectedCollectorId === null) return 'Tất cả nhân viên';
    const found = collectors.find(c => c.id === selectedCollectorId);
    return found ? `${found.hoVaTen} (${found.taiKhoan})` : 'Tất cả nhân viên';
  }, [selectedCollectorId, collectors]);

  // Load initial filter options
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

      const routeList = filterResponse.data.routes ?? [];
      setRoutes(routeList);

      const staffMap = new Map<number, { id: number; hoVaTen: string; taiKhoan: string }>();
      routeList.forEach((r) => {
        if (r.staff) {
          staffMap.set(r.staff.id, r.staff);
        }
      });
      setCollectors(Array.from(staffMap.values()));

      if (storedSession.user.role === 'STAFF') {
        setSelectedCollectorId(storedSession.user.id);
      }
    } catch (error) {
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
    if (!fromDate || !toDate) {
      showAlert('Thông báo', 'Vui lòng chọn khoảng thời gian hợp lệ');
      return;
    }

    if (pageToLoad === 1) {
      setLoadingReport(true);
    }

    try {
      const response = await httpClient.get<DetailByDateReportResponse>('/invoices/reports/detail-by-date', {
        params: {
          fromDate,
          toDate,
          routeId: selectedRouteId || undefined,
          collectorId: selectedCollectorId || undefined,
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
        ? error.response?.data?.message ?? 'Lỗi tải báo cáo theo ngày'
        : 'Lỗi tải báo cáo theo ngày';
      showAlert('Thất bại', msg);
    } finally {
      setLoadingReport(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate, selectedRouteId, selectedCollectorId]);

  const handleSearch = () => {
    setExpandedFilter(null);
    void fetchReport(1, false);
  };

  useEffect(() => {
    if (!loadingFilters) {
      void fetchReport(1, false);
    }
  }, [loadingFilters]);

  // Date Presets
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date();
    if (preset === 'today') {
      const s = formatDate(now);
      setFromDate(s);
      setToDate(s);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const s = formatDate(y);
      setFromDate(s);
      setToDate(s);
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(now.getDate() - 7);
      setFromDate(formatDate(w));
      setToDate(formatDate(now));
    } else if (preset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDate(m));
      setToDate(formatDate(now));
    }
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingReport) {
      void fetchReport(currentPage + 1, true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchReport(1, false);
  };

  const toggleFilter = (type: 'route' | 'collector') => {
    setExpandedFilter(prev => (prev === type ? null : type));
  };

  const renderSummaryHeader = () => (
    <View style={{ paddingHorizontal: 14, paddingTop: 4 }}>
      {/* Report Summary Cards */}
      {reportSummary && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>📊 Tổng quan báo cáo theo ngày</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{reportSummary.soHoDaThu}</Text>
              <Text style={styles.summaryLbl}>Số hộ đã thu</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#0d8a6a' }]}>{reportSummary.soHoaDonDaPhatHanh}</Text>
              <Text style={styles.summaryLbl}>Hóa đơn phát hành</Text>
            </View>
            <View style={[styles.summaryCard, { flex: 2, backgroundColor: '#0d8a6a' }]}>
              <Text style={[styles.summaryVal, { color: '#ffffff' }]}>{formatCurrency(reportSummary.tongCong)}</Text>
              <Text style={[styles.summaryLbl, { color: '#d8f3eb' }]}>Tổng doanh thu đã thu</Text>
            </View>
          </View>
        </View>
      )}

      {/* List Header */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Chi tiết danh sách thu tiền</Text>
        <Text style={styles.listHeaderCount}>{totalItems} dòng</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: InvoiceDetailByDateItem }) => {
    return (
      <View style={styles.dataCard}>
        <View style={styles.dataTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.householdName}>{item.tenChuHo}</Text>
            <Text style={styles.householdMeta}>Mã hộ: {item.maHoDan} • Kỳ: {item.kyHoaDon}</Text>
          </View>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyBadgeText}>{formatCurrency(item.tongCong)}</Text>
          </View>
        </View>

        <Text style={styles.householdMeta}>📍 Địa chỉ: {item.diaChi}</Text>
        <Text style={styles.householdMeta}>🛣️ Tuyến: {item.tuyenThuRac}</Text>
        <Text style={styles.householdMeta}>👤 Người thu: {item.nguoiThu || '---'}</Text>
        <Text style={styles.householdMeta}>
          📅 Ngày thu: {item.paymentDate ? new Date(item.paymentDate).toLocaleString('vi-VN') : '---'}
        </Text>

        <View style={styles.cardFooter}>
          <View style={[styles.invoiceChip, item.daPhatHanh ? styles.chipSuccess : styles.chipInfo]}>
            <Text style={[styles.invoiceChipText, item.daPhatHanh ? styles.chipSuccessText : styles.chipInfoText]}>
              {item.daPhatHanh ? `🧾 HĐ: ${item.invoiceSerial || 'Đã phát hành'}` : '📄 Phiếu thu'}
            </Text>
          </View>
          {item.invoiceFkey ? (
            <Text style={styles.fkeyText}>FKey: {item.invoiceFkey}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (loadingFilters) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0d8a6a" />
        <Text style={styles.loadingText}>Đang khởi tạo báo cáo...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* App Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Báo cáo chi tiết theo ngày</Text>
          <Text style={styles.subtitle}>Xem số liệu doanh thu đã thu theo ngày</Text>
        </View>
      </View>

      {/* Static Header & Filter Panel (Never unmounts, typing keyboard stays open) */}
      <View style={styles.headerContent}>
        {/* Top Report Tab Switcher */}
        <View style={styles.reportNavTabs}>
          <Pressable
            onPress={() => router.replace('/reports/detail-by-period' as never)}
            style={styles.navTabBtn}>
            <Text style={styles.navTabBtnText}>📅 Theo kỳ</Text>
          </Pressable>
          <Pressable style={[styles.navTabBtn, styles.navTabBtnActive]}>
            <Text style={[styles.navTabBtnText, styles.navTabBtnTextActive]}>📆 Theo ngày</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/reports/revenue-summary' as never)}
            style={styles.navTabBtn}>
            <Text style={styles.navTabBtnText}>📊 Doanh số</Text>
          </Pressable>
        </View>

        {/* Filter Card */}
        <View style={styles.filterCard}>
          <Pressable onPress={() => setFilterCollapsed(!filterCollapsed)} style={styles.filterHeaderPressable}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterTitle}>⚙️ Bộ lọc Báo cáo theo ngày</Text>
              {filterCollapsed && (
                <Text style={styles.filterSummaryText} numberOfLines={1}>
                  {fromDate} → {toDate} • {selectedRouteLabel}
                </Text>
              )}
            </View>
            <Text style={styles.filterToggleText}>{filterCollapsed ? 'Hiện bộ lọc ▾' : 'Thu gọn ▴'}</Text>
          </Pressable>

          {!filterCollapsed && (
            <>
              {/* Custom Date Inputs Row */}
              <View style={styles.dateInputsRow}>
                <View style={styles.dateField}>
                  <Text style={styles.filterLabel}>Từ ngày (YYYY-MM-DD)</Text>
                  <View style={styles.dateInputShell}>
                    <Text style={styles.dateInputIcon}>📅</Text>
                    <TextInput
                      value={fromDate}
                      onChangeText={setFromDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numbers-and-punctuation"
                      style={styles.dateTextInput}
                    />
                  </View>
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.filterLabel}>Đến ngày (YYYY-MM-DD)</Text>
                  <View style={styles.dateInputShell}>
                    <Text style={styles.dateInputIcon}>📅</Text>
                    <TextInput
                      value={toDate}
                      onChangeText={setToDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numbers-and-punctuation"
                      style={styles.dateTextInput}
                    />
                  </View>
                </View>
              </View>

              {/* Date Presets */}
              <View style={styles.presetRow}>
                <Pressable onPress={() => applyDatePreset('today')} style={styles.presetBtn}>
                  <Text style={styles.presetBtnText}>Hôm nay</Text>
                </Pressable>
                <Pressable onPress={() => applyDatePreset('yesterday')} style={styles.presetBtn}>
                  <Text style={styles.presetBtnText}>Hôm qua</Text>
                </Pressable>
                <Pressable onPress={() => applyDatePreset('week')} style={styles.presetBtn}>
                  <Text style={styles.presetBtnText}>7 ngày</Text>
                </Pressable>
                <Pressable onPress={() => applyDatePreset('month')} style={styles.presetBtn}>
                  <Text style={styles.presetBtnText}>Tháng này</Text>
                </Pressable>
              </View>

              <View style={styles.filterGrid}>
                {/* Route Dropdown */}
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>Tuyến thu gom</Text>
                  <Pressable onPress={() => toggleFilter('route')} style={styles.selectShell}>
                    <View style={styles.selectIconWrap}>
                      <Text style={styles.selectIcon}>{expandedFilter === 'route' ? '▴' : '▾'}</Text>
                    </View>
                    <Text style={styles.selectValueText}>{selectedRouteLabel}</Text>
                  </Pressable>
                  {expandedFilter === 'route' && (
                    <View style={styles.dropdownPanel}>
                      <Pressable onPress={() => { setSelectedRouteId(null); setExpandedFilter(null); }} style={styles.dropdownOption}>
                        <Text style={[styles.dropdownOptionText, selectedRouteId === null && styles.dropdownOptionTextActive]}>
                          Tất cả tuyến
                        </Text>
                        {selectedRouteId === null && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                      </Pressable>
                      {routes.map((item) => (
                        <Pressable key={item.id} onPress={() => { setSelectedRouteId(item.id); setExpandedFilter(null); }} style={styles.dropdownOption}>
                          <Text style={[styles.dropdownOptionText, selectedRouteId === item.id && styles.dropdownOptionTextActive]}>
                            {item.maTuyen} - {item.tenTuyen}
                          </Text>
                          {selectedRouteId === item.id && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                        </Pressable>
                      ))}
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
                        <Pressable onPress={() => { setSelectedCollectorId(null); setExpandedFilter(null); }} style={styles.dropdownOption}>
                          <Text style={[styles.dropdownOptionText, selectedCollectorId === null && styles.dropdownOptionTextActive]}>
                            Tất cả nhân viên
                          </Text>
                          {selectedCollectorId === null && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                        </Pressable>
                        {collectors.map((item) => (
                          <Pressable key={item.id} onPress={() => { setSelectedCollectorId(item.id); setExpandedFilter(null); }} style={styles.dropdownOption}>
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

                {/* Action Search Button */}
                <Pressable onPress={handleSearch} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
                  <Text style={styles.searchButtonText}>🔍 Xem số liệu báo cáo</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={reportData}
        keyExtractor={(item) => String(item.invoiceId)}
        renderItem={renderItem}
        ListHeaderComponent={renderSummaryHeader}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !loadingReport ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Không tìm thấy dữ liệu</Text>
              <Text style={styles.emptyText}>Thử thay đổi khoảng ngày hoặc tuyến thu gom để tìm lại.</Text>
            </View>
          ) : null
        }
      />

      {loadingReport && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="#0d8a6a" />
          <Text style={styles.overlayText}>Đang tải số liệu...</Text>
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
  reportNavTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  navTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e6f2ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cce3db',
  },
  navTabBtnActive: {
    backgroundColor: '#0d8a6a',
    borderColor: '#0d8a6a',
  },
  navTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#265447',
  },
  navTabBtnTextActive: {
    color: '#ffffff',
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
    elevation: 2,
    gap: 10,
  },
  filterHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0d8a6a',
    textTransform: 'uppercase',
  },
  filterSummaryText: {
    fontSize: 12,
    color: '#4f7368',
    marginTop: 2,
    fontWeight: '600',
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d8a6a',
    backgroundColor: '#eef7f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 4,
  },
  dateInputShell: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cde0da',
    backgroundColor: '#f8fbfa',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dateInputIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#16352d',
    padding: 0,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef7f3',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cde4dc',
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d8a6a',
  },
  filterGrid: {
    gap: 10,
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
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f7f4',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#2c4e44',
  },
  dropdownOptionTextActive: {
    fontWeight: '800',
    color: '#0d8a6a',
  },
  dropdownOptionCheck: {
    color: '#0d8a6a',
    fontWeight: 'bold',
  },
  searchButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#183b31',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f3faf7',
    borderWidth: 1,
    borderColor: '#d7e8e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#13352c',
  },
  summaryLbl: {
    fontSize: 11,
    color: '#4f7368',
    marginTop: 2,
    fontWeight: '600',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  listHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#163a30',
  },
  listHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d8a6a',
  },
  dataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    gap: 6,
  },
  dataTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  householdName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2d25',
  },
  householdMeta: {
    fontSize: 12,
    color: '#476d62',
    lineHeight: 18,
  },
  moneyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#e6f7f2',
  },
  moneyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f7f4',
  },
  invoiceChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipSuccess: { backgroundColor: '#e6f4ea' },
  chipInfo: { backgroundColor: '#e8f0fe' },
  invoiceChipText: { fontSize: 11, fontWeight: '700' },
  chipSuccessText: { color: '#137333' },
  chipInfoText: { color: '#1a73e8' },
  fkeyText: { fontSize: 11, color: '#64748b' },
  emptyCard: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e3830' },
  emptyText: { fontSize: 12, color: '#688c81', textAlign: 'center' },
  overlayLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#0d8a6a' },
  pressed: { opacity: 0.72 },
});
