import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import { httpClient, setAccessToken } from '@/api/http-client';
import { clearAuthSession, loadAuthSession } from '@/auth/auth-storage';
import { API_BASE_URL } from '@/constants/api-base-url';
import type { AppMenuItem, LoginResponse } from '@/types/auth';

type PaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'PUBLISHED';

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
}

interface ServiceCatalogOption {
  id: number;
  maDichVu: string;
  tenDichVu: string;
}

interface HouseholdInvoiceItem {
  id: number;
  householdId: number;
  kyHoaDon: string;
  trangThaiThanhToan: PaymentStatus;
  tongTien: number;
  thue: number;
  tongCong: number;
  paymentDate: string | null;
  paymentNote: string | null;
  receiptImageUrl: string | null;
  invoicePublishStatus: string | null;
  household: {
    id: number;
    maHoDan: string;
    tenChuHo: string;
    diaChi: string;
    soDienThoai: string | null;
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

interface MobileFiltersResponse {
  billingPeriods: BillingPeriodOption[];
  routes: RouteOption[];
  serviceCatalogs: ServiceCatalogOption[];
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

interface MobileUnpaidCountResponse {
  kyHoaDons: string[];
  unpaidHouseholdCount: number;
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
}

type MyMenusResponse = {
  roleCode: string;
  menus: AppMenuItem[];
};

function filterMobileMenus(menus: AppMenuItem[]): AppMenuItem[] {
  const filtered: AppMenuItem[] = [];

  for (const menu of menus) {
    const children = filterMobileMenus(menu.children ?? []);
    if (menu.viewMobile || children.length > 0) {
      filtered.push({
        ...menu,
        children,
      });
    }
  }

  return filtered;
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

export default function HomeRoute() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(320, Math.max(280, Math.round(width * 0.82)));
  const drawerTranslateX = useRef(new Animated.Value(-drawerWidth)).current;

  const [session, setSession] = useState<LoginResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [menus, setMenus] = useState<AppMenuItem[]>([]);
  const [activeMenuKey, setActiveMenuKey] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [services, setServices] = useState<ServiceCatalogOption[]>([]);

  const [selectedKyHoaDons, setSelectedKyHoaDons] = useState<string[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PUBLISHED'>('ALL');
  const [expandedFilter, setExpandedFilter] = useState<'period' | 'route' | 'service' | 'status' | null>(null);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'ky' | 'tuyen' | 'dichVu' | 'trangThai'>('ky');
  const [searchText, setSearchText] = useState('');

  const activeFilterCount =
    selectedKyHoaDons.length +
    selectedRouteIds.length +
    selectedServiceIds.length +
    (selectedStatus !== 'ALL' ? 1 : 0);

  const [invoices, setInvoices] = useState<HouseholdInvoiceItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: drawerOpen ? 0 : -drawerWidth,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerTranslateX, drawerWidth]);

  const edgeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_event, gestureState) => gestureState.x0 <= 24,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          gestureState.x0 <= 24 && gestureState.dx > 8,
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx > 40 || gestureState.vx > 0.4) {
            setDrawerOpen(true);
          }
        },
      }),
    [],
  );

  const loadHouseholds = useCallback(
    async (payload: {
      kyHoaDons?: string[];
      tuyenThuRacIds?: number[];
      serviceCatalogIds?: number[];
      trangThaiThanhToan?: string;
      keyword?: string;
      page?: number;
    }) => {
      const pageToLoad = payload.page ?? 1;
      if (pageToLoad === 1) {
        setLoadingList(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const response = await httpClient.get<MobileHouseholdsResponse>('/invoices/mobile/households', {
          params: {
            page: pageToLoad,
            limit: 20,
            kyHoaDons: payload.kyHoaDons && payload.kyHoaDons.length > 0 ? payload.kyHoaDons.join(',') : undefined,
            tuyenThuRacIds:
              payload.tuyenThuRacIds && payload.tuyenThuRacIds.length > 0 ? payload.tuyenThuRacIds.join(',') : undefined,
            serviceCatalogIds:
              payload.serviceCatalogIds && payload.serviceCatalogIds.length > 0
                ? payload.serviceCatalogIds.join(',')
                : undefined,
            trangThaiThanhToan: payload.trangThaiThanhToan || undefined,
            keyword: payload.keyword || undefined,
          },
        });

        if (pageToLoad === 1) {
          setInvoices(response.data.data ?? []);
        } else {
          setInvoices((prev) => [...prev, ...(response.data.data ?? [])]);
        }

        setCurrentPage(response.data.pagination?.page ?? 1);
        setTotalPages(response.data.pagination?.totalPages ?? 1);
        setTotalItems(response.data.pagination?.total ?? 0);
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403) {
          Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại để tải bộ lọc và dữ liệu.');
          setAccessToken(null);
          await clearAuthSession();
          setSession(null);
          router.replace('/login');
          return;
        }

        const message =
          axios.isAxiosError(error)
            ? error.response?.data?.message ?? 'Không tải được danh sách thu tiền'
            : 'Không tải được danh sách thu tiền';
        Alert.alert('Lỗi', message);
      } finally {
        setLoadingList(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  const loadUnpaidCount = useCallback(
    async (payload?: {
      kyHoaDons?: string[];
      tuyenThuRacIds?: number[];
      serviceCatalogIds?: number[];
      keyword?: string;
    }) => {
      try {
        const response = await httpClient.get<MobileUnpaidCountResponse>('/invoices/mobile/unpaid-count', {
          params: {
            kyHoaDons: payload?.kyHoaDons && payload.kyHoaDons.length > 0 ? payload.kyHoaDons.join(',') : undefined,
            tuyenThuRacIds:
              payload?.tuyenThuRacIds && payload.tuyenThuRacIds.length > 0
                ? payload.tuyenThuRacIds.join(',')
                : undefined,
            serviceCatalogIds:
              payload?.serviceCatalogIds && payload.serviceCatalogIds.length > 0
                ? payload.serviceCatalogIds.join(',')
                : undefined,
            keyword: payload?.keyword || undefined,
          },
        });
        setUnpaidCount(Number(response.data?.unpaidHouseholdCount ?? 0));
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403) {
          setAccessToken(null);
          await clearAuthSession();
          setSession(null);
          router.replace('/login');
          return;
        }
      }
    },
    [router],
  );

  const loadInitialData = useCallback(async () => {
    const storedSession = await loadAuthSession();

    if (!storedSession?.accessToken) {
      setAccessToken(null);
      router.replace('/login');
      return;
    }

    setAccessToken(storedSession.accessToken);
    setSession(storedSession);

    try {
      const [menuResponse, filterResponse] = await Promise.all([
        httpClient.get<MyMenusResponse>('/menus/my'),
        httpClient.get<MobileFiltersResponse>('/invoices/mobile/filters'),
      ]);

      const mobileMenus = filterMobileMenus(menuResponse.data.menus ?? []);
      setMenus(mobileMenus);

      const firstChildKey = mobileMenus.find((item) => item.children?.length)?.children?.[0]?.key;
      const firstMenuKey = firstChildKey ?? mobileMenus[0]?.key ?? '';
      setActiveMenuKey(firstMenuKey);

      const periodOptions = filterResponse.data.billingPeriods ?? [];
      const routeOptions = filterResponse.data.routes ?? [];
      const serviceOptions = filterResponse.data.serviceCatalogs ?? [];

      setBillingPeriods(periodOptions);
      setRoutes(routeOptions);
      setServices(serviceOptions);

      const defaultKy = periodOptions[0]?.maKy ?? '';
      setSelectedKyHoaDons(defaultKy ? [defaultKy] : []);

      if (!defaultKy) {
        await loadHouseholds({
          kyHoaDons: undefined,
        });
      }
    } catch {
      const fallbackMenus = filterMobileMenus(storedSession.menus ?? []);
      setMenus(fallbackMenus);
      const firstChildKey = fallbackMenus.find((item) => item.children?.length)?.children?.[0]?.key;
      const firstMenuKey = firstChildKey ?? fallbackMenus[0]?.key ?? '';
      setActiveMenuKey(firstMenuKey);
      Alert.alert('Thông báo', 'Không tải được bộ lọc từ backend hoặc phiên đăng nhập đã hết hạn.');
    } finally {
      setBooting(false);
    }
  }, [loadHouseholds, router]);

  const refreshHomeData = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }

    setRefreshing(true);
    try {
      const [menuResponse, filterResponse] = await Promise.all([
        httpClient.get<MyMenusResponse>('/menus/my'),
        httpClient.get<MobileFiltersResponse>('/invoices/mobile/filters'),
      ]);

      const mobileMenus = filterMobileMenus(menuResponse.data.menus ?? []);
      setMenus(mobileMenus);

      const periodOptions = filterResponse.data.billingPeriods ?? [];
      const routeOptions = filterResponse.data.routes ?? [];
      const serviceOptions = filterResponse.data.serviceCatalogs ?? [];

      setBillingPeriods(periodOptions);
      setRoutes(routeOptions);
      setServices(serviceOptions);

      const validKySet = new Set(periodOptions.map((item) => item.maKy));
      const nextKys = selectedKyHoaDons.filter((item) => validKySet.has(item));
      const ensuredKys = nextKys.length > 0 ? nextKys : periodOptions[0]?.maKy ? [periodOptions[0].maKy] : [];

      const validRouteSet = new Set(routeOptions.map((item) => item.id));
      const nextRouteIds = selectedRouteIds.filter((id) => validRouteSet.has(id));

      const validServiceSet = new Set(serviceOptions.map((item) => item.id));
      const nextServiceIds = selectedServiceIds.filter((id) => validServiceSet.has(id));

      setSelectedKyHoaDons(ensuredKys);
      setSelectedRouteIds(nextRouteIds);
      setSelectedServiceIds(nextServiceIds);

      await loadHouseholds({
        kyHoaDons: ensuredKys,
        tuyenThuRacIds: nextRouteIds,
        serviceCatalogIds: nextServiceIds,
        trangThaiThanhToan: selectedStatus,
        keyword: searchText.trim() || undefined,
      });
      await loadUnpaidCount({
        kyHoaDons: ensuredKys,
        tuyenThuRacIds: nextRouteIds,
        serviceCatalogIds: nextServiceIds,
        keyword: searchText.trim() || undefined,
      });
      Alert.alert('Thông báo', 'Đã làm mới dữ liệu phân tuyến và bộ lọc.');
    } catch {
      Alert.alert('Lỗi', 'Không tải lại được dữ liệu. Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }, [
    loadHouseholds,
    loadUnpaidCount,
    searchText,
    selectedKyHoaDons,
    selectedRouteIds,
    selectedServiceIds,
    session?.accessToken,
  ]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!session?.accessToken || booting) {
      return;
    }

    void loadHouseholds({
      kyHoaDons: selectedKyHoaDons,
      tuyenThuRacIds: selectedRouteIds,
      serviceCatalogIds: selectedServiceIds,
      trangThaiThanhToan: selectedStatus,
      keyword: searchText.trim() || undefined,
      page: 1,
    });
  }, [
    session?.accessToken,
    booting,
    selectedKyHoaDons,
    selectedRouteIds,
    selectedServiceIds,
    selectedStatus,
    loadHouseholds,
  ]);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    void loadUnpaidCount({
      kyHoaDons: selectedKyHoaDons,
      tuyenThuRacIds: selectedRouteIds,
      serviceCatalogIds: selectedServiceIds,
      keyword: searchText.trim() || undefined,
    });
  }, [
    session?.accessToken,
    selectedKyHoaDons,
    selectedRouteIds,
    selectedServiceIds,
    searchText,
    loadUnpaidCount,
  ]);

  const runSearch = async () => {
    await loadHouseholds({
      kyHoaDons: selectedKyHoaDons,
      tuyenThuRacIds: selectedRouteIds,
      serviceCatalogIds: selectedServiceIds,
      trangThaiThanhToan: selectedStatus,
      keyword: searchText.trim() || undefined,
      page: 1,
    });
    await loadUnpaidCount({
      kyHoaDons: selectedKyHoaDons,
      tuyenThuRacIds: selectedRouteIds,
      serviceCatalogIds: selectedServiceIds,
      keyword: searchText.trim() || undefined,
    });
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingList && !loadingMore) {
      void loadHouseholds({
        kyHoaDons: selectedKyHoaDons,
        tuyenThuRacIds: selectedRouteIds,
        serviceCatalogIds: selectedServiceIds,
        trangThaiThanhToan: selectedStatus,
        keyword: searchText.trim() || undefined,
        page: currentPage + 1,
      });
    }
  };

  const handleRefresh = () => {
    void refreshHomeData();
  };

  const showUnpaidNotice = () => {
    router.push({
      pathname: '/unpaid-invoices',
      params: {
        kyHoaDons: selectedKyHoaDons.join(','),
        tuyenThuRacIds: selectedRouteIds.join(','),
        serviceCatalogIds: selectedServiceIds.join(','),
        keyword: searchText.trim(),
      },
    } as never);
  };

  const toggleKy = (maKy: string) => {
    setSelectedKyHoaDons((current) =>
      current.includes(maKy) ? current.filter((item) => item !== maKy) : [...current, maKy],
    );
  };

  const toggleRoute = (routeId: number) => {
    setSelectedRouteIds((current) =>
      current.includes(routeId) ? current.filter((item) => item !== routeId) : [...current, routeId],
    );
  };

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((item) => item !== serviceId) : [...current, serviceId],
    );
  };

  const selectedKyLabel =
    selectedKyHoaDons.length === 0
      ? 'Tất cả kỳ hóa đơn'
      : `${selectedKyHoaDons.length} kỳ đã chọn`;

  const selectedRouteLabel =
    selectedRouteIds.length === 0
      ? 'Tất cả tuyến đường'
      : `${selectedRouteIds.length} tuyến đã chọn`;

  const selectedServiceLabel =
    selectedServiceIds.length === 0
      ? 'Tất cả dịch vụ'
      : `${selectedServiceIds.length} dịch vụ đã chọn`;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await httpClient.post('/auth/logout');
    } catch {
      // keep silent, clear local session anyway
    } finally {
      setAccessToken(null);
      await clearAuthSession();
      setSession(null);
      setLoggingOut(false);
      router.replace('/login');
    }
  };

  const handlePublishInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    try {
      const response = await httpClient.post('/invoices/publish', {
        invoiceIds: [invoiceId],
      }, { timeout: 120000 });
      Alert.alert('Thông báo', response.data?.message ?? 'Đã xử lý xuất hóa đơn');
      await runSearch();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.code === 'ECONNABORTED'
          ? 'Xuất hóa đơn đang xử lý lâu hơn dự kiến. Vui lòng thử lại sau 1-2 phút.'
          : error.code === 'ERR_CANCELED'
            ? 'Yêu cầu xuất hóa đơn đã bị hủy. Vui lòng thử lại.'
            : error.response?.data?.message ?? 'Xuất hóa đơn thất bại'
        : 'Xuất hóa đơn thất bại';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCollectInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    try {
      const formData = new FormData();
      formData.append('invoiceIds', JSON.stringify([invoiceId]));

      const response = await httpClient.post('/invoices/collect', formData, {
        timeout: 120000,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Thông báo', response.data?.message ?? 'Thu tiền thành công');
      await runSearch();
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
      setActionLoadingId(null);
    }
  };

  const handleHistory = async (householdId: number) => {
    setActionLoadingId(householdId);
    try {
      const response = await httpClient.get<HouseholdHistoryResponse>(
        `/invoices/household/${householdId}/history`,
      );
      const data = response.data;
      Alert.alert(
        'Lịch sử hộ dân',
        `Hộ: ${data.household.tenChuHo} (${data.household.maHoDan})\nTổng: ${data.summary.total}\nĐã thu: ${data.summary.paid}\nChưa thu: ${data.summary.unpaid}`,
      );
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không tải được lịch sử hộ dân';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    try {
      await httpClient.get(`/invoices/${invoiceId}/download-vnpt`);
      Alert.alert('Thông báo', 'Đã gọi API tải hóa đơn');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Tải hóa đơn thất bại';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadReceipt = async (invoiceId: number) => {
    setActionLoadingId(invoiceId);
    try {
      await httpClient.get('/invoices/receipt', {
        params: {
          invoiceIds: invoiceId,
        },
      });
      Alert.alert('Thông báo', 'Đã gọi API tải phiếu thu');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Tải phiếu thu thất bại';
      Alert.alert('Lỗi', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePrint = () => {
    Alert.alert('Thông báo', 'Tính năng in sẽ tích hợp sau với máy in bluetooth');
  };

  const openHouseholdDetail = (householdId: number, kyHoaDon?: string) => {
    const normalizedKy = kyHoaDon?.trim() || '';
    const query = normalizedKy ? `?kyHoaDon=${encodeURIComponent(normalizedKy)}` : '';
    router.push(`/households/${householdId}${query}` as never);
  };

  const toggleDrawer = () => {
    setDrawerOpen((current) => !current);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const handleDrawerLogout = () => {
    setDrawerOpen(false);
    void handleLogout();
  };

  const handleMenuPress = (menu: AppMenuItem) => {
    setActiveMenuKey(menu.key);
    setDrawerOpen(false);

    if (menu.routePath) {
      if (menu.routePath === '/invoice-collections') {
        router.push('/home' as never);
      } else {
        router.push(menu.routePath as never);
      }
    }
  };

  const handleChildMenuPress = (menu: AppMenuItem, child: AppMenuItem) => {
    setActiveMenuKey(child.key);
    setDrawerOpen(false);

    if (child.routePath) {
      if (child.routePath === '/invoice-collections') {
        router.push('/home' as never);
      } else {
        router.push(child.routePath as never);
      }
    }
  };

  const renderMenuGroups = () => (
    <View style={styles.menuGroupList}>
      {menus.length > 0 ? (
        menus.map((menu) => (
          <View key={menu.key} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{menu.label}</Text>
            {menu.children && menu.children.length > 0 ? (
              <View style={styles.menuItemList}>
                {menu.children.map((child) => (
                  <Pressable
                    key={child.key}
                    onPress={() => handleChildMenuPress(menu, child)}
                    style={({ pressed }) => [
                      styles.menuItemRow,
                      activeMenuKey === child.key && styles.menuItemRowActive,
                      pressed && styles.buttonPressed,
                    ]}>
                    <View style={styles.menuBullet} />
                    <Text
                      style={[
                        styles.menuItemText,
                        activeMenuKey === child.key && styles.menuItemTextActive,
                      ]}>
                      {child.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                onPress={() => handleMenuPress(menu)}
                style={({ pressed }) => [
                  styles.menuItemRow,
                  styles.menuItemRowSingle,
                  activeMenuKey === menu.key && styles.menuItemRowActive,
                  pressed && styles.buttonPressed,
                ]}>
                <View style={styles.menuBullet} />
                <Text
                  style={[
                    styles.menuItemText,
                    activeMenuKey === menu.key && styles.menuItemTextActive,
                  ]}>
                  {menu.label}
                </Text>
              </Pressable>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Chưa có menu được cấp quyền</Text>
          <Text style={styles.emptyDescription}>Vui lòng kiểm tra lại phân quyền menu.</Text>
        </View>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.flatListHeader}>
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.title} numberOfLines={1}>Quản lý thu tiền rác</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => void refreshHomeData()}
              disabled={refreshing}
              style={({ pressed }) => [styles.refreshButton, (pressed || refreshing) && styles.buttonPressed]}>
              <Text style={styles.refreshIcon}>{refreshing ? '...' : '↻'}</Text>
            </Pressable>
            <Pressable onPress={showUnpaidNotice} style={styles.noticeButton}>
              <Text style={styles.noticeIcon}>🔔</Text>
              <View style={styles.noticeBadge}>
                <Text style={styles.noticeBadgeText}>{unpaidCount}</Text>
              </View>
            </Pressable>
            <Pressable onPress={toggleDrawer} style={styles.drawerToggleButton}>
              <Text style={styles.drawerToggleButtonText}>☰ Menu</Text>
            </Pressable>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{session?.user.hoVaTen?.slice(0, 1) ?? 'U'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.userInfoRow}>
          <Text style={styles.userName}>{session?.user.hoVaTen}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{session?.user.role}</Text>
          </View>
        </View>
      </View>

      {/* Streamlined Compact Search & Filter Section */}
      <View style={styles.compactFilterCard}>
        <View style={styles.searchBarRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => void runSearch()}
            placeholder="Tìm tên chủ hộ, mã hộ, địa chỉ..."
            placeholderTextColor="#8aa69b"
            style={styles.compactSearchInput}
          />
          {searchText ? (
            <Pressable onPress={() => { setSearchText(''); void runSearch(); }} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void runSearch()} style={({ pressed }) => [styles.searchSubmitBtn, pressed && styles.buttonPressed]}>
            <Text style={styles.searchSubmitText}>Tìm</Text>
          </Pressable>
        </View>

        {/* Quick Horizontal Filter Pills Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            style={({ pressed }) => [
              styles.filterPillMain,
              activeFilterCount > 0 && styles.filterPillActive,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={[styles.filterPillMainText, activeFilterCount > 0 && styles.filterPillActiveText]}>
              ⚙️ Bộ lọc {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setModalActiveTab('ky'); setFilterModalVisible(true); }}
            style={({ pressed }) => [
              styles.filterPill,
              selectedKyHoaDons.length > 0 && styles.filterPillActive,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={[styles.filterPillText, selectedKyHoaDons.length > 0 && styles.filterPillActiveText]}>
              📅 {selectedKyHoaDons.length === 0 ? 'Kỳ: Tất cả' : `${selectedKyHoaDons.length} kỳ`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setModalActiveTab('tuyen'); setFilterModalVisible(true); }}
            style={({ pressed }) => [
              styles.filterPill,
              selectedRouteIds.length > 0 && styles.filterPillActive,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={[styles.filterPillText, selectedRouteIds.length > 0 && styles.filterPillActiveText]}>
              🛣️ {selectedRouteIds.length === 0 ? 'Tuyến: Tất cả' : `${selectedRouteIds.length} tuyến`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setModalActiveTab('trangThai'); setFilterModalVisible(true); }}
            style={({ pressed }) => [
              styles.filterPill,
              selectedStatus !== 'ALL' && styles.filterPillActive,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={[styles.filterPillText, selectedStatus !== 'ALL' && styles.filterPillActiveText]}>
              💳 {selectedStatus === 'ALL' ? 'TT: Tất cả' : selectedStatus === 'UNPAID' ? 'Chưa thu' : selectedStatus === 'PAID' ? 'Đã thu' : 'Đã xuất HĐ'}
            </Text>
          </Pressable>

          {activeFilterCount > 0 ? (
            <Pressable
              onPress={() => {
                setSelectedKyHoaDons([]);
                setSelectedRouteIds([]);
                setSelectedServiceIds([]);
                setSelectedStatus('ALL');
              }}
              style={styles.filterPillClear}>
              <Text style={styles.filterPillClearText}>✕ Xóa lọc</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionTitle}>Danh sách hộ dân</Text>
        <Text style={styles.countBadge}>{totalItems} hộ</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: HouseholdInvoiceItem }) => {
    const isPaid = item.trangThaiThanhToan === 'PAID';
    const isPublished = item.trangThaiThanhToan === 'PUBLISHED';
    const isOverdue = item.trangThaiThanhToan === 'OVERDUE';

    const statusBorderColor = isPublished
      ? '#0d8a6a'
      : isPaid
        ? '#2563eb'
        : isOverdue
          ? '#d97706'
          : '#e11d48';

    return (
      <Pressable
        key={item.id}
        onPress={() => openHouseholdDetail(item.householdId, item.kyHoaDon)}
        style={({ pressed }) => [
          styles.householdCard,
          { borderLeftColor: statusBorderColor, borderLeftWidth: 5 },
          pressed && styles.householdCardPressed,
        ]}>
        <View style={styles.householdTopRow}>
          <View style={styles.householdMetaWrap}>
            <View style={styles.codeTagRow}>
              <Text style={styles.householdCodeTag}>#{item.household?.maHoDan ?? '---'}</Text>
              {item.household?.soDienThoai ? (
                <Text style={styles.householdPhoneText}>📞 {item.household.soDienThoai}</Text>
              ) : null}
            </View>
            <Text style={styles.householdName} numberOfLines={1}>{item.household?.tenChuHo ?? '---'}</Text>
          </View>

          <View
            style={[
              styles.statusChip,
              isPaid
                ? styles.statusPaid
                : isPublished
                  ? styles.statusPublished
                  : isOverdue
                    ? styles.statusDebt
                    : styles.statusUnpaid,
            ]}>
            <Text
              style={[
                styles.statusText,
                isPublished
                  ? { color: '#0d8a6a' }
                  : isPaid
                    ? { color: '#1d4ed8' }
                    : isOverdue
                      ? { color: '#d97706' }
                      : { color: '#e11d48' },
              ]}>
              {getStatusLabel(item.trangThaiThanhToan)}
            </Text>
          </View>
        </View>

        <Text style={styles.householdAddress} numberOfLines={2}>
          📍 {item.household?.diaChi ?? '---'}
        </Text>

        <View style={styles.householdInfoRow}>
          <Text style={styles.householdInfoBadge} numberOfLines={1}>
            🛣️ {item.household?.tuyenThuRac?.tenTuyen ?? 'Chưa phân tuyến'}
          </Text>
          <Text style={styles.householdInfoBadge} numberOfLines={1}>
            🏷️ {item.household?.serviceCatalog?.tenDichVu ?? 'Rác sinh hoạt'}
          </Text>
        </View>

        <View style={styles.householdFooterRow}>
          <View style={styles.pricePeriodBox}>
            <Text style={styles.householdPeriodText}>Kỳ: {item.kyHoaDon}</Text>
            <Text style={styles.householdPriceText}>{formatCurrency(item.tongCong)}</Text>
          </View>
          <Text style={styles.householdChevron}>›</Text>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => (
    <View style={{ gap: 14 }}>
      {loadingMore ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color="#0d8a6a" />
        </View>
      ) : null}

      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={({ pressed }) => [styles.primaryButton, (pressed || loggingOut) && styles.buttonPressed, { marginHorizontal: 16, marginBottom: 20 }]}>
        <Text style={styles.primaryButtonText}>{loggingOut ? 'Đang xử lý...' : 'Đăng xuất'}</Text>
      </Pressable>
    </View>
  );

  const renderMainContent = () => (
    <FlatList
      data={invoices}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={renderHeader()}
      ListFooterComponent={renderFooter()}
      ListEmptyComponent={
        loadingList ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="small" color="#0d8a6a" />
            <Text style={styles.loaderText}>Đang tải danh sách...</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Không tìm thấy hộ dân phù hợp</Text>
            <Text style={styles.emptyDescription}>Hãy đổi bộ lọc hoặc từ khóa để tìm nhanh hơn.</Text>
          </View>
        )
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#0d8a6a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {drawerOpen ? <Pressable style={styles.drawerBackdrop} onPress={closeDrawer} /> : null}

      <Animated.View
        style={[
          styles.drawerPanel,
          {
            width: drawerWidth,
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}>
        <View style={styles.drawerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.drawerKicker}>Menu điều hướng</Text>
            <Text style={styles.drawerTitle}>Quản lý thu tiền</Text>
          </View>
          <Pressable onPress={closeDrawer} style={styles.drawerCloseButton}>
            <Text style={styles.drawerCloseText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerContent}>
          {renderMenuGroups()}
        </ScrollView>

        <View style={styles.drawerFooter}>
          <Pressable
            onPress={() => {
              setDrawerOpen(false);
              router.push('/printer-connection' as never);
            }}
            style={({ pressed }) => [
              styles.drawerPrinterButton,
              { opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={styles.drawerPrinterText}>🖨 Máy in Bluetooth</Text>
          </Pressable>

          <Pressable
            onPress={handleDrawerLogout}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.drawerLogoutButton,
              (pressed || loggingOut) && styles.buttonPressed,
            ]}>
            <Text style={styles.drawerLogoutText}>{loggingOut ? 'Đang xử lý...' : 'Đăng xuất'}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.mainPane}>
        {!drawerOpen ? <View style={styles.edgeSwipeArea} {...edgeSwipeResponder.panHandlers} /> : null}
        {renderMainContent()}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdropPress} onPress={() => setFilterModalVisible(false)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bộ lọc tìm kiếm</Text>
                <Text style={styles.modalSubTitle}>Chọn điều kiện để lọc danh sách thu tiền</Text>
              </View>
              <Pressable onPress={() => setFilterModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Modal Tabs Bar */}
            <View style={styles.modalTabsRow}>
              <Pressable
                onPress={() => setModalActiveTab('ky')}
                style={[styles.modalTab, modalActiveTab === 'ky' && styles.modalTabActive]}>
                <Text style={[styles.modalTabText, modalActiveTab === 'ky' && styles.modalTabTextActive]}>
                  Kỳ ({selectedKyHoaDons.length || 'Tất cả'})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setModalActiveTab('tuyen')}
                style={[styles.modalTab, modalActiveTab === 'tuyen' && styles.modalTabActive]}>
                <Text style={[styles.modalTabText, modalActiveTab === 'tuyen' && styles.modalTabTextActive]}>
                  Tuyến ({selectedRouteIds.length || 'Tất cả'})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setModalActiveTab('dichVu')}
                style={[styles.modalTab, modalActiveTab === 'dichVu' && styles.modalTabActive]}>
                <Text style={[styles.modalTabText, modalActiveTab === 'dichVu' && styles.modalTabTextActive]}>
                  Dịch vụ
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setModalActiveTab('trangThai')}
                style={[styles.modalTab, modalActiveTab === 'trangThai' && styles.modalTabActive]}>
                <Text style={[styles.modalTabText, modalActiveTab === 'trangThai' && styles.modalTabTextActive]}>
                  Trạng thái
                </Text>
              </Pressable>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {modalActiveTab === 'ky' && (
                <View style={styles.modalOptionsGroup}>
                  <Pressable onPress={() => setSelectedKyHoaDons([])} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedKyHoaDons.length === 0 && styles.modalOptionTextActive]}>
                      Tất cả kỳ hóa đơn
                    </Text>
                    {selectedKyHoaDons.length === 0 ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  {billingPeriods.map((item) => {
                    const selected = selectedKyHoaDons.includes(item.maKy);
                    return (
                      <Pressable key={item.id} onPress={() => toggleKy(item.maKy)} style={styles.modalOptionRow}>
                        <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                          Kỳ: {item.tenKy} ({item.maKy})
                        </Text>
                        {selected ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {modalActiveTab === 'tuyen' && (
                <View style={styles.modalOptionsGroup}>
                  <Pressable onPress={() => setSelectedRouteIds([])} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedRouteIds.length === 0 && styles.modalOptionTextActive]}>
                      Tất cả tuyến đường
                    </Text>
                    {selectedRouteIds.length === 0 ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  {routes.map((item) => {
                    const selected = selectedRouteIds.includes(item.id);
                    return (
                      <Pressable key={item.id} onPress={() => toggleRoute(item.id)} style={styles.modalOptionRow}>
                        <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                          {item.maTuyen} - {item.tenTuyen}
                        </Text>
                        {selected ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {modalActiveTab === 'dichVu' && (
                <View style={styles.modalOptionsGroup}>
                  <Pressable onPress={() => setSelectedServiceIds([])} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedServiceIds.length === 0 && styles.modalOptionTextActive]}>
                      Tất cả dịch vụ
                    </Text>
                    {selectedServiceIds.length === 0 ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  {services.map((item) => {
                    const selected = selectedServiceIds.includes(item.id);
                    return (
                      <Pressable key={item.id} onPress={() => toggleService(item.id)} style={styles.modalOptionRow}>
                        <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                          {item.tenDichVu}
                        </Text>
                        {selected ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {modalActiveTab === 'trangThai' && (
                <View style={styles.modalOptionsGroup}>
                  <Pressable onPress={() => setSelectedStatus('ALL')} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedStatus === 'ALL' && styles.modalOptionTextActive]}>
                      Tất cả trạng thái
                    </Text>
                    {selectedStatus === 'ALL' ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  <Pressable onPress={() => setSelectedStatus('UNPAID')} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedStatus === 'UNPAID' && styles.modalOptionTextActive]}>
                      ⏳ Chưa thu tiền
                    </Text>
                    {selectedStatus === 'UNPAID' ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  <Pressable onPress={() => setSelectedStatus('PAID')} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedStatus === 'PAID' && styles.modalOptionTextActive]}>
                      💰 Đã thu (Chưa xuất HĐ)
                    </Text>
                    {selectedStatus === 'PAID' ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                  <Pressable onPress={() => setSelectedStatus('PUBLISHED')} style={styles.modalOptionRow}>
                    <Text style={[styles.modalOptionText, selectedStatus === 'PUBLISHED' && styles.modalOptionTextActive]}>
                      🧾 Đã xuất hóa đơn
                    </Text>
                    {selectedStatus === 'PUBLISHED' ? <Text style={styles.modalOptionCheck}>✓</Text> : null}
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  setSelectedKyHoaDons([]);
                  setSelectedRouteIds([]);
                  setSelectedServiceIds([]);
                  setSelectedStatus('ALL');
                }}
                style={styles.modalResetBtn}>
                <Text style={styles.modalResetText}>Đặt lại</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFilterModalVisible(false);
                  void runSearch();
                }}
                style={styles.modalApplyBtn}>
                <Text style={styles.modalApplyText}>Áp dụng ({totalItems} hộ)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  mainPane: {
    flex: 1,
  },
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  outsideFilterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  drawerPanel: {
    position: 'absolute',
    zIndex: 20,
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#d5e6e0',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 20,
  },
  drawerBackdrop: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,45,37,0.28)',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2ef',
  },
  drawerKicker: {
    fontSize: 12,
    color: '#4c776b',
    fontWeight: '600',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f2d25',
  },
  drawerCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
  },
  drawerCloseText: {
    color: '#0b4f3f',
    fontWeight: '700',
    fontSize: 14,
  },
  drawerContent: {
    paddingBottom: 24,
  },
  drawerFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
  },
  drawerPrinterButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#e6f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bcdccf',
  },
  drawerPrinterText: {
    color: '#0b4f3f',
    fontWeight: '700',
  },
  drawerLogoutButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerLogoutText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  edgeSwipeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 5,
  },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  noticeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f4b000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  noticeBadgeText: {
    color: '#173a30',
    fontSize: 11,
    fontWeight: '800',
  },
  drawerToggleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  drawerToggleButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
    fontSize: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8efe8',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f2d25',
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#0f2d25',
  },
  dateText: {
    color: '#4c776b',
    marginTop: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c3f35',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#35574d',
    fontSize: 14,
    flex: 1,
  },
  roleChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#ebf7f2',
    borderWidth: 1,
    borderColor: '#cbe6dd',
  },
  roleText: {
    color: '#0f5e4a',
    fontSize: 12,
    fontWeight: '700',
  },
  baseUrl: {
    color: '#4c776b',
    fontSize: 12,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#173a30',
  },
  filterLabel: {
    fontSize: 12,
    color: '#4c776b',
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  filterCard: {
    zIndex: 7,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e7e1',
    padding: 12,
    gap: 12,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  filterGrid: {
    gap: 10,
  },
  filterField: {
    gap: 0,
  },
  filterFieldFull: {
    marginTop: 2,
  },
  selectWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
  },
  selectShell: {
    width: '100%',
    height: 48,
    borderRadius: 14,
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
  selectPickerWrap: {
    width: '100%',
    height: 48,
    minWidth: 0,
    overflow: 'hidden',
  },
  selectIcon: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0d8a6a',
    marginTop: -2,
  },
  selectValueText: {
    flex: 1,
    color: '#16352d',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  multiSelectPanel: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  multiOptionRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf3f0',
  },
  multiOptionText: {
    flex: 1,
    color: '#32584d',
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 8,
  },
  multiOptionTextActive: {
    color: '#0b4f3f',
    fontWeight: '800',
  },
  multiOptionCheck: {
    color: '#0d8a6a',
    fontWeight: '800',
    fontSize: 14,
  },
  selectBox: {
    width: '100%',
    height: 48,
    color: '#16352d',
    fontSize: 14,
  },
  filterActionRow: {
    marginTop: 4,
  },
  searchInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cde0da',
    paddingHorizontal: 14,
    color: '#16352d',
    backgroundColor: '#f8fbfa',
    fontSize: 14,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    color: '#4f776c',
    fontWeight: '600',
  },
  loaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loaderText: {
    color: '#4b7268',
    fontSize: 13,
  },
  menuGroupList: {
    gap: 8,
  },
  menuSection: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2ef',
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#173a30',
  },
  menuItemList: {
    gap: 6,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f7fbf9',
  },
  menuItemRowSingle: {
    marginTop: 2,
  },
  menuItemRowActive: {
    backgroundColor: '#dff2eb',
    borderWidth: 1,
    borderColor: '#0d8a6a',
  },
  menuBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#86bfb0',
  },
  menuItemText: {
    fontSize: 13,
    color: '#0f5f4b',
    fontWeight: '600',
    flex: 1,
  },
  menuItemTextActive: {
    color: '#0b4f3f',
  },
  householdList: {
    gap: 8,
  },
  householdCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  householdCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  householdTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  householdMetaWrap: {
    flex: 1,
    gap: 2,
  },
  householdCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4d766a',
  },
  householdName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#173a30',
  },
  householdAddress: {
    fontSize: 13,
    lineHeight: 19,
    color: '#41675c',
  },
  householdInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  householdInfo: {
    fontSize: 13,
    color: '#315b50',
    fontWeight: '600',
    flexShrink: 1,
  },
  householdFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  householdHint: {
    fontSize: 12,
    color: '#5a7d72',
    fontWeight: '600',
  },
  householdChevron: {
    fontSize: 24,
    lineHeight: 24,
    color: '#0d8a6a',
    fontWeight: '700',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: {
    backgroundColor: '#e5f7eb',
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
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b3e34',
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4a7267',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  filterHeaderPressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d8a6a',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  compactFilterCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    padding: 10,
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    shadowColor: '#0b2e25',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6faf8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cde0da',
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    fontSize: 15,
  },
  compactSearchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#16352d',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#8aa69b',
    fontSize: 14,
    fontWeight: '700',
  },
  searchSubmitBtn: {
    backgroundColor: '#0d8a6a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchSubmitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  filterPillMain: {
    borderRadius: 20,
    backgroundColor: '#0d8a6a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillMainText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPill: {
    borderRadius: 20,
    backgroundColor: '#edf6f2',
    borderWidth: 1,
    borderColor: '#cbe4db',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    color: '#2a5448',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  filterPillActiveText: {
    color: '#166534',
    fontWeight: '800',
  },
  filterPillClear: {
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillClearText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '700',
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d8a6a',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b7e4cf',
  },
  codeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  householdCodeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d8a6a',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  householdPhoneText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  householdInfoBadge: {
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 1,
  },
  pricePeriodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  householdPeriodText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  householdPriceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d8a6a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  modalTabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  modalTabTextActive: {
    color: '#0d8a6a',
    fontWeight: '800',
  },
  modalBody: {
    maxHeight: 280,
  },
  modalOptionsGroup: {
    gap: 2,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: '#0d8a6a',
    fontWeight: '800',
  },
  modalOptionCheck: {
    fontSize: 15,
    color: '#0d8a6a',
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalResetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  modalApplyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  flatListHeader: {
    paddingBottom: 8,
  },
  statusPublished: {
    backgroundColor: '#e6f4ea',
  },
});
