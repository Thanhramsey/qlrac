import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
}

interface RouteOption {
  id: number;
  maTuyen: string;
  tenTuyen: string;
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

interface RevenueSummaryGroupItem {
  kyHoaDon: string;
  tuyenThuRacId: number | null;
  tuyenThuRac: string;
  serviceCatalogId: number | null;
  loaiDichVu: string;
  tongSoHo: number;
  daThuSoHo: number;
  chuaThuSoHo: number;
  tongTien: number;
  tongThue: number;
  tongCong: number;
  daThuTien: number;
  daThuThue: number;
  daThuCong: number;
  chuaThuTien: number;
  chuaThuThue: number;
  chuaThuCong: number;
}

interface RevenueSummaryReportResponse {
  data: RevenueSummaryGroupItem[];
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

export default function RevenueSummaryReportScreen() {
  const router = useRouter();
  const [session, setSession] = useState<LoginResponse | null>(null);

  // Filter options
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [services, setServices] = useState<ServiceCatalogOption[]>([]);

  // Selected filters
  const [selectedKyHoaDon, setSelectedKyHoaDon] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);

  // UI state
  const [expandedFilter, setExpandedFilter] = useState<'period' | 'route' | 'service' | null>(null);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState<RevenueSummaryGroupItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

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

  const selectedKyLabel = useMemo(() => {
    if (!selectedKyHoaDon) return 'Chọn kỳ hóa đơn (bắt buộc)';
    const found = billingPeriods.find(p => p.maKy === selectedKyHoaDon);
    return found ? found.tenKy : selectedKyHoaDon;
  }, [selectedKyHoaDon, billingPeriods]);

  const selectedRouteLabel = useMemo(() => {
    if (selectedRouteId === null) return 'Tất cả tuyến';
    const found = routes.find(r => r.id === selectedRouteId);
    return found ? `${found.maTuyen} - ${found.tenTuyen}` : 'Tất cả tuyến';
  }, [selectedRouteId, routes]);

  const selectedServiceLabel = useMemo(() => {
    if (selectedServiceId === null) return 'Tất cả loại dịch vụ';
    const found = services.find(s => s.id === selectedServiceId);
    return found ? found.tenDichVu : 'Tất cả loại dịch vụ';
  }, [selectedServiceId, services]);

  // Overall totals calculation across all groups
  const grandSummary = useMemo(() => {
    return reportData.reduce(
      (acc, item) => {
        acc.tongSoHo += item.tongSoHo;
        acc.daThuSoHo += item.daThuSoHo;
        acc.chuaThuSoHo += item.chuaThuSoHo;
        acc.tongCong += item.tongCong;
        acc.daThuCong += item.daThuCong;
        acc.chuaThuCong += item.chuaThuCong;
        return acc;
      },
      {
        tongSoHo: 0,
        daThuSoHo: 0,
        chuaThuSoHo: 0,
        tongCong: 0,
        daThuCong: 0,
        chuaThuCong: 0,
      },
    );
  }, [reportData]);

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

      const periods = filterResponse.data.billingPeriods ?? [];
      const routeList = filterResponse.data.routes ?? [];
      const serviceList = filterResponse.data.serviceCatalogs ?? [];

      setBillingPeriods(periods);
      setRoutes(routeList);
      setServices(serviceList);

      if (periods.length > 0) {
        setSelectedKyHoaDon(periods[0].maKy);
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
    if (!selectedKyHoaDon) {
      showAlert('Thông báo', 'Vui lòng chọn kỳ hóa đơn');
      return;
    }

    if (pageToLoad === 1) {
      setLoadingReport(true);
    }

    try {
      const response = await httpClient.get<RevenueSummaryReportResponse>('/invoices/reports/revenue-summary', {
        params: {
          kyHoaDon: selectedKyHoaDon,
          routeId: selectedRouteId || undefined,
          serviceCatalogId: selectedServiceId || undefined,
          page: pageToLoad,
          limit: 20,
        },
      });

      if (append) {
        setReportData(prev => [...prev, ...(response.data.data ?? [])]);
      } else {
        setReportData(response.data.data ?? []);
      }

      setCurrentPage(response.data.pagination.page);
      setTotalPages(response.data.pagination.totalPages);
      setTotalItems(response.data.pagination.total);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message ?? 'Lỗi tải báo cáo tổng hợp doanh số'
        : 'Lỗi tải báo cáo tổng hợp doanh số';
      showAlert('Thất bại', msg);
    } finally {
      setLoadingReport(false);
      setRefreshing(false);
    }
  }, [selectedKyHoaDon, selectedRouteId, selectedServiceId]);

  const handleSearch = () => {
    setExpandedFilter(null);
    void fetchReport(1, false);
  };

  useEffect(() => {
    if (!loadingFilters && selectedKyHoaDon) {
      void fetchReport(1, false);
    }
  }, [loadingFilters, selectedKyHoaDon]);

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingReport) {
      void fetchReport(currentPage + 1, true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchReport(1, false);
  };

  const toggleFilter = (type: 'period' | 'route' | 'service') => {
    setExpandedFilter(prev => (prev === type ? null : type));
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Top Report Tab Switcher */}
      <View style={styles.reportNavTabs}>
        <Pressable
          onPress={() => router.replace('/reports/detail-by-period' as never)}
          style={styles.navTabBtn}>
          <Text style={styles.navTabBtnText}>📅 Theo kỳ</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/reports/detail-by-date' as never)}
          style={styles.navTabBtn}>
          <Text style={styles.navTabBtnText}>📆 Theo ngày</Text>
        </Pressable>
        <Pressable style={[styles.navTabBtn, styles.navTabBtnActive]}>
          <Text style={[styles.navTabBtnText, styles.navTabBtnTextActive]}>📊 Doanh số</Text>
        </Pressable>
      </View>

      {/* Filter Card */}
      <View style={styles.filterCard}>
        <Pressable onPress={() => setFilterCollapsed(!filterCollapsed)} style={styles.filterHeaderPressable}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterTitle}>⚙️ Bộ lọc Doanh số</Text>
            {filterCollapsed && (
              <Text style={styles.filterSummaryText} numberOfLines={1}>
                Kỳ {selectedKyHoaDon} • {selectedRouteLabel}
              </Text>
            )}
          </View>
          <Text style={styles.filterToggleText}>{filterCollapsed ? 'Hiện bộ lọc ▾' : 'Thu gọn ▴'}</Text>
        </Pressable>

        {!filterCollapsed && (
          <View style={styles.filterGrid}>
            {/* Period Single Dropdown */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Kỳ hóa đơn *</Text>
              <Pressable onPress={() => toggleFilter('period')} style={styles.selectShell}>
                <View style={styles.selectIconWrap}>
                  <Text style={styles.selectIcon}>{expandedFilter === 'period' ? '▴' : '▾'}</Text>
                </View>
                <Text style={styles.selectValueText}>{selectedKyLabel}</Text>
              </Pressable>
              {expandedFilter === 'period' && (
                <View style={styles.dropdownPanel}>
                  {billingPeriods.map((item) => (
                    <Pressable key={item.id} onPress={() => { setSelectedKyHoaDon(item.maKy); setExpandedFilter(null); }} style={styles.dropdownOption}>
                      <Text style={[styles.dropdownOptionText, selectedKyHoaDon === item.maKy && styles.dropdownOptionTextActive]}>
                        {item.tenKy} ({item.maKy})
                      </Text>
                      {selectedKyHoaDon === item.maKy && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

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

            {/* Service Catalog Dropdown */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Loại dịch vụ</Text>
              <Pressable onPress={() => toggleFilter('service')} style={styles.selectShell}>
                <View style={styles.selectIconWrap}>
                  <Text style={styles.selectIcon}>{expandedFilter === 'service' ? '▴' : '▾'}</Text>
                </View>
                <Text style={styles.selectValueText}>{selectedServiceLabel}</Text>
              </Pressable>
              {expandedFilter === 'service' && (
                <View style={styles.dropdownPanel}>
                  <Pressable onPress={() => { setSelectedServiceId(null); setExpandedFilter(null); }} style={styles.dropdownOption}>
                    <Text style={[styles.dropdownOptionText, selectedServiceId === null && styles.dropdownOptionTextActive]}>
                      Tất cả loại dịch vụ
                    </Text>
                    {selectedServiceId === null && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                  </Pressable>
                  {services.map((item) => (
                    <Pressable key={item.id} onPress={() => { setSelectedServiceId(item.id); setExpandedFilter(null); }} style={styles.dropdownOption}>
                      <Text style={[styles.dropdownOptionText, selectedServiceId === item.id && styles.dropdownOptionTextActive]}>
                        {item.tenDichVu}
                      </Text>
                      {selectedServiceId === item.id && <Text style={styles.dropdownOptionCheck}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Search Button */}
            <Pressable onPress={handleSearch} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
              <Text style={styles.searchButtonText}>📊 Xem tổng hợp doanh số</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Grand Summary Section */}
      {reportData.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>🏆 Tổng doanh số toàn bộ (Kỳ {selectedKyHoaDon})</Text>
          
          <View style={styles.summaryGridRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryBoxVal}>{grandSummary.tongSoHo}</Text>
              <Text style={styles.summaryBoxLbl}>Tổng số hộ</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: '#e6f7f2' }]}>
              <Text style={[styles.summaryBoxVal, { color: '#0d8a6a' }]}>{grandSummary.daThuSoHo}</Text>
              <Text style={styles.summaryBoxLbl}>Hộ đã thu</Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: '#fff3ed' }]}>
              <Text style={[styles.summaryBoxVal, { color: '#e11d48' }]}>{grandSummary.chuaThuSoHo}</Text>
              <Text style={styles.summaryBoxLbl}>Hộ chưa thu</Text>
            </View>
          </View>

          <View style={styles.moneySummaryCard}>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLbl}>Tổng doanh thu kế hoạch:</Text>
              <Text style={styles.moneyVal}>{formatCurrency(grandSummary.tongCong)}</Text>
            </View>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLbl}>Đã thu thực tế:</Text>
              <Text style={[styles.moneyVal, { color: '#0d8a6a' }]}>{formatCurrency(grandSummary.daThuCong)}</Text>
            </View>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLbl}>Chưa thu còn nợ:</Text>
              <Text style={[styles.moneyVal, { color: '#e11d48' }]}>{formatCurrency(grandSummary.chuaThuCong)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* List Header */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Tổng hợp theo tuyến & dịch vụ</Text>
        <Text style={styles.listHeaderCount}>{totalItems} nhóm</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: RevenueSummaryGroupItem }) => {
    const paidRate = item.tongSoHo > 0 ? Math.round((item.daThuSoHo / item.tongSoHo) * 100) : 0;

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>🛣️ {item.tuyenThuRac}</Text>
          <Text style={styles.groupSub}>Dịch vụ: {item.loaiDichVu}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressText}>Tiến độ thu tiền: {item.daThuSoHo}/{item.tongSoHo} hộ</Text>
            <Text style={styles.progressPercent}>{paidRate}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${paidRate}%` }]} />
          </View>
        </View>

        {/* Detail Breakdown Grid */}
        <View style={styles.breakdownGrid}>
          <View style={styles.breakdownCol}>
            <Text style={styles.colHeader}>Kế hoạch</Text>
            <Text style={styles.colVal}>{formatCurrency(item.tongCong)}</Text>
            <Text style={styles.colSub}>{item.tongSoHo} hộ</Text>
          </View>
          <View style={[styles.breakdownCol, { backgroundColor: '#e6f7f2' }]}>
            <Text style={[styles.colHeader, { color: '#0d8a6a' }]}>Đã thu</Text>
            <Text style={[styles.colVal, { color: '#0d8a6a' }]}>{formatCurrency(item.daThuCong)}</Text>
            <Text style={styles.colSub}>{item.daThuSoHo} hộ</Text>
          </View>
          <View style={[styles.breakdownCol, { backgroundColor: '#fff3ed' }]}>
            <Text style={[styles.colHeader, { color: '#e11d48' }]}>Còn nợ</Text>
            <Text style={[styles.colVal, { color: '#e11d48' }]}>{formatCurrency(item.chuaThuCong)}</Text>
            <Text style={styles.colSub}>{item.chuaThuSoHo} hộ</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loadingFilters) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0d8a6a" />
        <Text style={styles.loadingText}>Đang khởi tạo báo cáo doanh số...</Text>
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
          <Text style={styles.title}>Báo cáo tổng hợp doanh số</Text>
          <Text style={styles.subtitle}>Tổng hợp doanh thu thu rác theo tuyến & dịch vụ</Text>
        </View>
      </View>

      <FlatList
        data={reportData}
        keyExtractor={(item, index) => `${item.tuyenThuRacId}-${item.serviceCatalogId}-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !loadingReport ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Không tìm thấy dữ liệu doanh số</Text>
              <Text style={styles.emptyText}>Thử thay đổi kỳ hóa đơn hoặc tuyến thu gom để tìm lại.</Text>
            </View>
          ) : null
        }
      />

      {loadingReport && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="#0d8a6a" />
          <Text style={styles.overlayText}>Đang tổng hợp số liệu doanh số...</Text>
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
    gap: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#183b31',
  },
  summaryGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f3faf7',
    borderWidth: 1,
    borderColor: '#d7e8e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBoxVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#13352c',
  },
  summaryBoxLbl: {
    fontSize: 11,
    color: '#4f7368',
    marginTop: 2,
    fontWeight: '600',
  },
  moneySummaryCard: {
    backgroundColor: '#f8fcfa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    padding: 12,
    gap: 6,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moneyLbl: {
    fontSize: 13,
    color: '#34554b',
    fontWeight: '600',
  },
  moneyVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2d25',
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
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 12,
    gap: 10,
  },
  groupHeader: {
    gap: 2,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2d25',
  },
  groupSub: {
    fontSize: 12,
    color: '#4f7368',
    fontWeight: '600',
  },
  progressWrap: {
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#35574d',
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e6f2ed',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0d8a6a',
    borderRadius: 4,
  },
  breakdownGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  breakdownCol: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f5faf8',
    borderWidth: 1,
    borderColor: '#d8e8e2',
    alignItems: 'center',
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#47695f',
  },
  colVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#13332a',
    marginTop: 2,
  },
  colSub: {
    fontSize: 10,
    color: '#63857b',
    marginTop: 2,
  },
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
