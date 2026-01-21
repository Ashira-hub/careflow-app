import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://backend-careflow.vercel.app';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp?: number;
  read?: boolean;
  toName?: string;
  recipientName?: string;
  recipientId?: string | number;
  toId?: string | number;
};

function BottomItem({
  label,
  active,
  source,
  onPress,
}: {
  label: string;
  active?: boolean;
  source: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.bottomItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Image
        source={source}
        style={[styles.bottomImg, { tintColor: active ? GREEN : '#9CA3AF' }]}
        resizeMode="contain"
      />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function PatientNotification() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [userName, setUserName] = React.useState('');
  const [userRole, setUserRole] = React.useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [detailItem, setDetailItem] = React.useState<NotificationItem | null>(
    null,
  );

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<
        string,
        string
      >;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id;
      const withAuth = token
        ? { ...base, Authorization: `Bearer ${token}` }
        : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch {
      return { 'Content-Type': 'application/json' } as Record<string, string>;
    }
  }, []);

  const getCurrentUserName = React.useCallback(async (): Promise<
    string | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      return (
        sess?.user?.full_name ||
        sess?.user?.fullName ||
        sess?.user?.name ||
        sess?.full_name ||
        sess?.name
      );
    } catch {
      return undefined;
    }
  }, []);

  const getCurrentUserId = React.useCallback(async (): Promise<
    string | number | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      return sess?.user?.id ?? sess?.id ?? undefined;
    } catch {
      return undefined;
    }
  }, []);

  const nameMatches = React.useCallback((pRaw: string, meRaw: string) => {
    const p = String(pRaw || '')
      .toLowerCase()
      .trim();
    const me = String(meRaw || '')
      .toLowerCase()
      .trim();
    if (!p || !me) return false;
    if (p === me) return true;
    const meTokens = me.split(/\s+/).filter(Boolean);
    if (meTokens.length > 0 && meTokens.every(t => p.includes(t))) return true;
    const pTokens = p.split(/\s+/).filter(Boolean);
    if (pTokens.length > 0 && pTokens.every(t => me.includes(t))) return true;
    return false;
  }, []);

  const loadTopUser = React.useCallback(async () => {
    try {
      const session = await AsyncStorage.getItem('session');
      if (session) {
        const { user } = JSON.parse(session);
        const derivedName =
          user?.full_name ||
          user?.fullName ||
          user?.name ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ');
        setUserName(String(derivedName || 'Patient'));
        const rawRole = user?.role || user?.role_name || user?.roleName;
        const roleStr = String(rawRole || '').trim();
        const displayRole = roleStr
          ? roleStr.charAt(0).toUpperCase() + roleStr.slice(1)
          : 'Patient';
        setUserRole(displayRole);
      }
    } catch {
      setUserName('Patient');
      setUserRole('Patient');
    }
  }, []);

  const normalizeServerNotification = React.useCallback((n: any) => {
    const ts = n?.created_at
      ? new Date(n.created_at).getTime()
      : n?.timestamp
      ? Number(n.timestamp)
      : Date.now();
    return {
      id: String(
        n?.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ),
      title: String(n?.title || 'Notification'),
      message: String(n?.message || n?.body || ''),
      timestamp: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
      read: Boolean(n?.read) === true,
      toName: n?.toName ?? n?.to_name ?? n?.to ?? n?.recipientName,
      recipientName: n?.recipientName ?? n?.recipient_name ?? n?.toName,
      recipientId: n?.recipientId ?? n?.recipient_id,
      toId: n?.toId ?? n?.to_id,
    } as NotificationItem;
  }, []);

  const loadNotifications = React.useCallback(async () => {
    try {
      const [myName, myId] = await Promise.all([
        getCurrentUserName(),
        getCurrentUserId(),
      ]);

      const raw = await AsyncStorage.getItem('patient_notifications');
      const localArr: any[] = raw ? JSON.parse(raw) : [];
      const localList: NotificationItem[] = Array.isArray(localArr)
        ? localArr.filter(Boolean).map((x: any) => ({
            id: String(
              x?.id ??
                `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            ),
            title: String(x?.title || 'Notification'),
            message: String(x?.message || ''),
            timestamp:
              typeof x?.timestamp === 'number'
                ? x.timestamp
                : x?.created_at
                ? new Date(x.created_at).getTime()
                : undefined,
            read: Boolean(x?.read) === true,
            toName: x?.toName,
            recipientName: x?.recipientName,
            recipientId: x?.recipientId,
            toId: x?.toId,
          }))
        : [];

      let serverList: NotificationItem[] = [];
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications`, { headers });
        if (res.ok) {
          const rows = await res.json();
          serverList = (Array.isArray(rows) ? rows : [])
            .map(normalizeServerNotification)
            .filter(n => {
              const hasRecipientMeta =
                n.recipientId != null ||
                n.toId != null ||
                String(n.recipientName || n.toName || '').trim().length > 0;

              // If server doesn't include recipient metadata, assume API already
              // returned only the current user's notifications.
              if (!hasRecipientMeta) return true;

              if (myId != null) {
                if (
                  n.recipientId != null &&
                  String(n.recipientId) === String(myId)
                )
                  return true;
                if (n.toId != null && String(n.toId) === String(myId))
                  return true;
              }
              const rn = String(n.recipientName || n.toName || '').trim();
              if (rn && myName) return nameMatches(rn, myName);
              return false;
            });
        }
      } catch {}

      const byId: Record<string, NotificationItem> = {};
      for (const it of localList) {
        if (it?.id) byId[String(it.id)] = it;
      }
      for (const it of serverList) {
        if (!it?.id) continue;
        byId[String(it.id)] = { ...byId[String(it.id)], ...it };
      }

      const merged = Object.values(byId)
        .filter(Boolean)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setItems(merged);
      try {
        await AsyncStorage.setItem(
          'patient_notifications',
          JSON.stringify(merged),
        );
      } catch {}
    } catch {
      setItems([]);
    }
  }, [
    getAuthHeaders,
    getCurrentUserId,
    getCurrentUserName,
    nameMatches,
    normalizeServerNotification,
  ]);

  useFocusEffect(
    React.useCallback(() => {
      loadTopUser();
      loadNotifications();
      return () => {};
    }, [loadNotifications, loadTopUser]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const unreadCount = items.filter(n => !n.read).length;

  const markAsRead = React.useCallback(
    async (id: string) => {
      try {
        const next = items.map(n => (n.id === id ? { ...n, read: true } : n));
        setItems(next);
        await AsyncStorage.setItem(
          'patient_notifications',
          JSON.stringify(next),
        );
        try {
          const headers = await getAuthHeaders();
          await fetch(
            `${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`,
            { method: 'PUT', headers },
          );
        } catch {}
      } catch {}
    },
    [getAuthHeaders, items],
  );

  const clearAll = React.useCallback(async () => {
    try {
      setItems([]);
      await AsyncStorage.setItem('patient_notifications', JSON.stringify([]));
    } catch {}
  }, []);

  const openDetail = React.useCallback((it: NotificationItem) => {
    setDetailItem(it);
    setShowDetail(true);
  }, []);

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={async () => {
        if (!item.read) {
          try {
            await markAsRead(item.id);
          } catch {}
        }
        openDetail(item);
      }}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Image
            source={require('../../assets/notification_icon.png')}
            style={styles.rowIcon}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            {item.message}
          </Text>
          {!!item.timestamp && (
            <Text style={styles.rowTime}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          )}
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.topHeader, { paddingTop: insets.top }]}>
          <Image
            source={require('../../assets/appicon.png')}
            style={styles.topHeaderLogo}
            resizeMode="contain"
          />
          <View style={styles.topHeaderIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={require('../../assets/notification_icon.png')}
                  style={styles.topHeaderIconImg}
                  resizeMode="contain"
                />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -6,
                      minWidth: 14,
                      height: 14,
                      paddingHorizontal: 3,
                      borderRadius: 7,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 9,
                        fontWeight: '700',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topProfileBtn}
              onPress={() => setShowProfileMenu(true)}
              activeOpacity={0.8}
            >
              <View style={styles.topProfileAvatar}>
                <Text style={styles.topProfileAvatarText}>
                  {String(userName || 'P')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.topProfileTextCol}>
                <Text style={styles.topProfileName} numberOfLines={1}>
                  {String(userName || 'Patient')}
                </Text>
                <Text style={styles.topProfileRole} numberOfLines={1}>
                  {String(userRole || 'Patient')}
                </Text>
              </View>
              <Image
                source={require('../../assets/dropdown.png')}
                style={styles.topProfileChevron}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.topDivider} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifications</Text>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearAll}
              activeOpacity={0.85}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={items}
            keyExtractor={it => it.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={() => (
              <View style={{ paddingVertical: 18 }}>
                <Text style={{ color: MUTED, textAlign: 'center' }}>
                  No notifications yet.
                </Text>
              </View>
            )}
            renderItem={renderItem}
          />
        </View>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowProfileMenu(false)}
            />
            <View
              style={[
                styles.dropdownCard,
                { top: (insets.top || 0) + 60, right: 16 },
              ]}
            >
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('PatientProfile');
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await AsyncStorage.removeItem('session');
                  } catch {}
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  } as any);
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Modal
          visible={showDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDetail(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.detailIconWrap}>
                  <Image
                    source={require('../../assets/notification_icon.png')}
                    style={styles.detailIcon}
                    resizeMode="contain"
                  />
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowDetail(false)}
                >
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detailHeaderBlock}>
                <Text style={styles.detailTitle}>
                  {detailItem?.title || ''}
                </Text>
                {!!detailItem?.timestamp && (
                  <Text style={styles.detailTime}>
                    {new Date(detailItem.timestamp).toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={styles.detailPanel}>
                <Text style={styles.panelLabel}>Details</Text>
                <View style={styles.panelBody}>
                  <Text style={styles.detailBody}>
                    {detailItem?.message || ''}
                  </Text>
                </View>
              </View>
              <View style={styles.detailActions}>
                {!detailItem?.read && detailItem?.id && (
                  <TouchableOpacity
                    style={styles.markBtn}
                    onPress={async () => {
                      await markAsRead(detailItem.id);
                    }}
                  >
                    <Text style={styles.markBtnText}>Mark as Read</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.okBtn}
                  onPress={() => setShowDetail(false)}
                >
                  <Text style={styles.okBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View
          style={[
            styles.bottomNav,
            { paddingBottom: Math.max(0, (insets.bottom || 0) - 8) },
          ]}
        >
          <BottomItem
            label="Home"
            active={false}
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('PatientDashboard')}
          />
          <BottomItem
            label="Appointments"
            active={false}
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('Appointments')}
          />
          <BottomItem
            label="Prescription"
            active={false}
            source={require('../../assets/prescription_icon.png')}
            onPress={() => navigation.navigate('PatientPrescription')}
          />
          <BottomItem
            label="Records"
            active={false}
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('MedicalRecords')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { padding: 8 },
  topHeaderIconImg: { width: 20, height: 20, tintColor: GREEN },
  topProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  topProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  topProfileTextCol: {
    marginLeft: 12,
    marginRight: 10,
    maxWidth: 160,
  },
  topProfileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  topProfileRole: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  topProfileChevron: { width: 14, height: 14, tintColor: '#111827' },
  topDivider: { height: 1, backgroundColor: BORDER },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  clearBtnText: { color: '#111827', fontWeight: '700' },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  rowSub: { fontSize: 13, color: MUTED, lineHeight: 18 },
  rowTime: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginLeft: 10,
  },
  dropdownOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
  },
  dropdownCard: {
    position: 'absolute',
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailIcon: { width: 18, height: 18, tintColor: GREEN },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  closeText: { fontSize: 22, lineHeight: 22, color: '#111827' },
  detailHeaderBlock: { marginTop: 12, marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  detailTime: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  detailPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    padding: 12,
  },
  panelLabel: { fontSize: 12, color: MUTED, fontWeight: '700' },
  panelBody: { marginTop: 6 },
  detailBody: { fontSize: 14, color: '#111827', lineHeight: 20 },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: GREEN,
  },
  markBtnText: { color: '#FFFFFF', fontWeight: '800' },
  okBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  okBtnText: { color: '#FFFFFF', fontWeight: '800' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  bottomItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  bottomImg: { width: 28, height: 28, marginBottom: 4 },
  bottomLabel: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 2,
  },
});
