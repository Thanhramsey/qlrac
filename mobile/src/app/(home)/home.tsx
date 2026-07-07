import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { httpClient, setAccessToken } from '@/api/http-client';
import { clearAuthSession, loadAuthSession } from '@/auth/auth-storage';
import { API_BASE_URL } from '@/constants/api-base-url';
import type { AppMenuItem, LoginResponse } from '@/types/auth';

interface AssignedRoute {
  key: string;
  code: string;
  title: string;
}

interface HouseholdItem {
  id: string;
  maHoDan: string;
  chuHo: string;
  diaChi: string;
  routeCode: string;
  debt: string;
  status: 'Chưa thu' | 'Đã thu' | 'Nợ kỳ trước';
}

interface HouseholdAction {
  key: string;
  label: string;
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

const ASSIGNED_ROUTES: AssignedRoute[] = [
  { key: 'all', code: 'ALL', title: 'Tất cả tuyến' },
  { key: 'an-khe-01', code: 'AK-01', title: 'Tuyến Chợ An Khê' },
  { key: 'an-khe-02', code: 'AK-02', title: 'Tuyến Nguyễn Oanh' },
  { key: 'an-khe-03', code: 'AK-03', title: 'Tuyến Bờ Kè Kênh' },
];

const HOUSEHOLD_ITEMS: HouseholdItem[] = [
  {
    id: 'h-0001',
    maHoDan: 'AK0001',
    chuHo: 'Nguyễn Văn An',
    diaChi: '12 Lê Đức Thọ, P. An Khê',
    routeCode: 'AK-01',
    debt: '120.000đ',
    status: 'Chưa thu',
  },
  {
    id: 'h-0002',
    maHoDan: 'AK0102',
    chuHo: 'Trần Thị Bích',
    diaChi: '101 Nguyễn Oanh, P. An Khê',
    routeCode: 'AK-02',
    debt: '240.000đ',
    status: 'Nợ kỳ trước',
  },
  {
    id: 'h-0003',
    maHoDan: 'AK0305',
    chuHo: 'Phạm Đức Hưng',
    diaChi: '5/8 Kênh Tân Hóa, P. An Khê',
    routeCode: 'AK-03',
    debt: '0đ',
    status: 'Đã thu',
  },
  {
    id: 'h-0004',
    maHoDan: 'AK0008',
    chuHo: 'Lê Văn Toàn',
    diaChi: '19 Chợ An Khê, P. An Khê',
    routeCode: 'AK-01',
    debt: '80.000đ',
    status: 'Chưa thu',
  },
];

const HOUSEHOLD_ACTIONS: HouseholdAction[] = [
  { key: 'export-invoice', label: 'Xuất hóa đơn' },
  { key: 'collect', label: 'Thu tiền' },
  { key: 'history', label: 'Lịch sử hộ dân' },
  { key: 'update-status', label: 'Cập nhật trạng thái' },
  { key: 'download-invoice', label: 'Tải hóa đơn' },
  { key: 'download-receipt', label: 'Tải phiếu thu' },
];

export default function HomeRoute() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeRoute, setActiveRoute] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [menus, setMenus] = useState<AppMenuItem[]>([]);
  const [activeMenuKey, setActiveMenuKey] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  useEffect(() => {
    const bootstrap = async () => {
      const storedSession = await loadAuthSession();

      if (!storedSession?.accessToken) {
        setAccessToken(null);
        router.replace('/login');
        return;
      }

      setAccessToken(storedSession.accessToken);
      setSession(storedSession);

      try {
        const response = await httpClient.get<MyMenusResponse>('/menus/my');
        const roleMenus = filterMobileMenus(response.data.menus ?? []);
        setMenus(roleMenus);

        const firstChildKey = roleMenus.find((item) => item.children?.length)?.children?.[0]?.key;
        const firstMenuKey = firstChildKey ?? roleMenus[0]?.key ?? '';
        setActiveMenuKey(firstMenuKey);
      } catch {
        const fallbackMenus = filterMobileMenus(storedSession.menus ?? []);
        setMenus(fallbackMenus);

        const firstChildKey = fallbackMenus.find((item) => item.children?.length)?.children?.[0]?.key;
        const firstMenuKey = firstChildKey ?? fallbackMenus[0]?.key ?? '';
        setActiveMenuKey(firstMenuKey);
      }

      setBooting(false);
    };

    void bootstrap();
  }, [router]);

  useEffect(() => {
    setDrawerOpen(isDesktopWeb);
  }, [isDesktopWeb]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await httpClient.post('/auth/logout');
    } catch {
      // Xoa session local ke ca khi logout API loi.
    } finally {
      setAccessToken(null);
      await clearAuthSession();
      setSession(null);
      setLoading(false);
      router.replace('/login');
    }
  };

  const handleHouseholdAction = (household: HouseholdItem, action: HouseholdAction) => {
    Alert.alert('Thông báo', `${action.label}: ${household.chuHo} (${household.maHoDan})`);
  };

  const keyword = searchText.trim().toLowerCase();
  const filteredHouseholds = HOUSEHOLD_ITEMS.filter((item) => {
    const routeMatched = activeRoute === 'ALL' || item.routeCode === activeRoute;
    const searchMatched =
      keyword.length === 0 ||
      item.chuHo.toLowerCase().includes(keyword) ||
      item.maHoDan.toLowerCase().includes(keyword) ||
      item.diaChi.toLowerCase().includes(keyword);

    return routeMatched && searchMatched;
  });

  if (booting) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#0d8a6a" />
      </SafeAreaView>
    );
  }

  const renderMenuGroups = () => (
    <View style={styles.menuGroupList}>
      {menus.length > 0 ? (
        menus.map((menu) => (
          <View key={menu.key} style={styles.menuGroupCard}>
            <Text style={styles.menuGroupTitle}>{menu.label}</Text>
            {menu.children && menu.children.length > 0 ? (
              <View style={styles.menuChipWrap}>
                {menu.children.map((child) => (
                  <Pressable
                    key={child.key}
                    onPress={() => setActiveMenuKey(child.key)}
                    style={({ pressed }) => [
                      styles.menuChip,
                      activeMenuKey === child.key && styles.menuChipActive,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.menuChipText,
                        activeMenuKey === child.key && styles.menuChipTextActive,
                      ]}>
                      {child.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                onPress={() => setActiveMenuKey(menu.key)}
                style={({ pressed }) => [
                  styles.menuChip,
                  activeMenuKey === menu.key && styles.menuChipActive,
                  pressed && styles.buttonPressed,
                ]}>
                <Text
                  style={[
                    styles.menuChipText,
                    activeMenuKey === menu.key && styles.menuChipTextActive,
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

  const toggleDrawer = () => {
    setDrawerOpen((current) => !current);
  };

  const closeDrawer = () => {
    if (!isDesktopWeb) {
      setDrawerOpen(false);
    }
  };

  const renderMainContent = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.title}>Quản lý thu tiền</Text>
              <Text style={styles.dateText}>{today}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={toggleDrawer} style={styles.drawerToggleButton}>
                <Text style={styles.drawerToggleButtonText}>
                  {drawerOpen ? 'Thu menu' : 'Mở menu'}
                </Text>
              </Pressable>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{session?.user.hoVaTen?.slice(0, 1) ?? 'U'}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.userName}>{session?.user.hoVaTen}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Tài khoản: {session?.user.taiKhoan}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{session?.user.role}</Text>
            </View>
          </View>

          <Text style={styles.baseUrl}>API: {API_BASE_URL}</Text>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Danh mục tuyến của nhân viên</Text>
          <View style={styles.routeGrid}>
            {ASSIGNED_ROUTES.map((routeItem) => (
              <Pressable
                key={routeItem.key}
                onPress={() => setActiveRoute(routeItem.code)}
                style={({ pressed }) => [
                  styles.routeCard,
                  activeRoute === routeItem.code && styles.routeCardActive,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={[styles.routeCode, activeRoute === routeItem.code && styles.routeCodeActive]}>
                  {routeItem.code}
                </Text>
                <Text
                  style={[styles.routeTitle, activeRoute === routeItem.code && styles.routeTitleActive]}>
                  {routeItem.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Tìm kiếm hộ dân</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Nhập mã hộ dân, tên chủ hộ hoặc địa chỉ"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionTitle}>Danh sách hộ dân</Text>
            <Text style={styles.countText}>{filteredHouseholds.length} hộ</Text>
          </View>

          <View style={styles.householdList}>
            {filteredHouseholds.map((household) => (
              <View key={household.id} style={styles.householdCard}>
                <View style={styles.householdTopRow}>
                  <View style={styles.householdMetaWrap}>
                    <Text style={styles.householdCode}>{household.maHoDan}</Text>
                    <Text style={styles.householdName}>{household.chuHo}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      household.status === 'Đã thu'
                        ? styles.statusPaid
                        : household.status === 'Nợ kỳ trước'
                          ? styles.statusDebt
                          : styles.statusUnpaid,
                    ]}>
                    <Text style={styles.statusText}>{household.status}</Text>
                  </View>
                </View>

                <Text style={styles.householdAddress}>{household.diaChi}</Text>

                <View style={styles.householdInfoRow}>
                  <Text style={styles.householdInfo}>Tuyến: {household.routeCode}</Text>
                  <Text style={styles.householdInfo}>Công nợ: {household.debt}</Text>
                </View>

                <View style={styles.actionGrid}>
                  {HOUSEHOLD_ACTIONS.map((action) => (
                    <Pressable
                      key={action.key}
                      onPress={() => handleHouseholdAction(household, action)}
                      style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}>
                      <Text style={styles.actionButtonText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {filteredHouseholds.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Không tìm thấy hộ dân phù hợp</Text>
                <Text style={styles.emptyDescription}>
                  Hãy đổi tuyến hoặc từ khóa để nhân viên tìm hộ nhanh hơn.
                </Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          onPress={handleLogout}
          disabled={loading}
          style={({ pressed }) => [styles.primaryButton, (pressed || loading) && styles.buttonPressed]}>
          <Text style={styles.primaryButtonText}>{loading ? 'Đang xử lý...' : 'Đăng xuất'}</Text>
        </Pressable>
      </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {drawerOpen && !isDesktopWeb && <Pressable style={styles.drawerBackdrop} onPress={closeDrawer} />}

      {drawerOpen && !isDesktopWeb && (
        <View style={styles.mobileDrawer}>
          <View style={styles.leftMenuHeader}>
            <Text style={styles.leftMenuTitle}>Left Menu</Text>
            <Pressable onPress={toggleDrawer} style={styles.drawerRailButton}>
              <Text style={styles.drawerRailButtonText}>✕</Text>
            </Pressable>
          </View>
          {renderMenuGroups()}
        </View>
      )}

      {isDesktopWeb ? (
        <View style={styles.desktopLayout}>
          <View style={[styles.leftMenuPane, drawerOpen ? styles.leftMenuPaneOpen : styles.leftMenuPaneClosed]}>
            <View style={styles.leftMenuHeader}>
              <Text style={styles.leftMenuTitle}>{drawerOpen ? 'Left Menu' : ''}</Text>
              <Pressable onPress={toggleDrawer} style={styles.drawerRailButton}>
                <Text style={styles.drawerRailButtonText}>{drawerOpen ? '◀' : '▶'}</Text>
              </Pressable>
            </View>
            {drawerOpen ? renderMenuGroups() : null}
          </View>

          <View style={styles.mainPane}>{renderMainContent()}</View>
        </View>
      ) : (
        renderMainContent()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  mobileDrawer: {
    position: 'absolute',
    zIndex: 20,
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#d5e6e0',
    gap: 10,
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
  leftMenuPane: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  leftMenuPaneOpen: {
    width: 320,
  },
  leftMenuPaneClosed: {
    width: 64,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  leftMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#173a30',
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#173a30',
  },
  routeGrid: {
    gap: 8,
  },
  menuGroupList: {
    gap: 8,
  },
  menuGroupCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  menuGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#173a30',
  },
  menuChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfe4dc',
    backgroundColor: '#f1faf6',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  menuChipActive: {
    borderColor: '#0d8a6a',
    backgroundColor: '#dff2eb',
  },
  menuChipText: {
    fontSize: 12,
    color: '#0f5f4b',
    fontWeight: '600',
  },
  menuChipTextActive: {
    color: '#0b4f3f',
  },
  drawerToggleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  drawerToggleButtonText: {
    color: '#0b4f3f',
    fontWeight: '700',
    fontSize: 12,
  },
  drawerRailButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbe6dd',
    backgroundColor: '#f1faf6',
  },
  drawerRailButtonText: {
    fontSize: 12,
    color: '#0b4f3f',
    fontWeight: '700',
  },
  menuSingleHint: {
    fontSize: 12,
    color: '#537a6f',
  },
  routeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  routeCardActive: {
    borderColor: '#0d8a6a',
    backgroundColor: '#e8f7f2',
  },
  routeCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#50766b',
  },
  routeCodeActive: {
    color: '#0c614b',
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#284c42',
  },
  routeTitleActive: {
    color: '#0f2d25',
  },
  searchInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5e6e0',
    paddingHorizontal: 12,
    color: '#16352d',
    backgroundColor: '#ffffff',
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
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cde2da',
    backgroundColor: '#f3faf7',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d624c',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: {
    backgroundColor: '#e6f7ef',
  },
  statusUnpaid: {
    backgroundColor: '#ffe9e9',
  },
  statusDebt: {
    backgroundColor: '#fff3e7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#234d42',
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
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
