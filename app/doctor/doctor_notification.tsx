import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DoctorTopNav from './DoctorTopNav';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp?: number;
  read?: boolean;
  status?: string;
};

export default function DoctorNotification() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const API_BASE = 'https://backend-careflow.vercel.app';

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
      return { 'Content-Type': 'application/json' };
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

  const ingestAppointmentRequests = React.useCallback(
    async (existing: any[]) => {
      try {
        const headers = await getAuthHeaders();
        const myName = (await getCurrentUserName()) || '';
        if (!myName) return existing;

        const res = await fetch(`${API_BASE}/api/appointments`, { headers });
        if (!res.ok) return existing;
        const arr = await res.json();
        const list = Array.isArray(arr) ? arr : [];
        const mine = list.filter((a: any) => {
          const createdBy = String(
            a?.createdByName || a?.created_by_name || '',
          );
          const done = Boolean(a?.done);
          return !done && nameMatches(createdBy, myName);
        });

        const mapped = mine.map((a: any) => {
          const base = String(
            a?.id ?? `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
          );
          const ts = Date.parse(String(a?.created_at || a?.createdAt || ''));
          const patient = String(a?.patient || 'A patient');
          const date = String(a?.date || '');
          const time = String(a?.time || '');
          const notes = String(a?.notes || '').trim();
          const when = [date, time].filter(Boolean).join(' ');
          const msgBase = when
            ? `New appointment request from ${patient} (${when}).`
            : `New appointment request from ${patient}.`;
          const message = notes ? `${msgBase} ${notes}` : msgBase;
          return {
            id: `apptreq-${base}`,
            title: 'Appointment Request',
            message,
            timestamp: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
            read: false,
            status: 'pending',
          } as NotificationItem;
        });

        const byId: Record<string, any> = {};
        for (const it of Array.isArray(existing) ? existing : []) {
          if (it?.id) byId[String(it.id)] = it;
        }
        for (const it of mapped) {
          if (!byId[it.id]) byId[it.id] = it;
        }
        const merged = Object.values(byId)
          .filter(Boolean)
          .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        await AsyncStorage.setItem(
          'doctor_notifications',
          JSON.stringify(merged),
        );
        return merged;
      } catch {
        return existing;
      }
    },
    [API_BASE, getAuthHeaders, getCurrentUserName, nameMatches],
  );

  const checkDueReminders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('doctor_reminders');
      const rems = Array.isArray(raw ? JSON.parse(raw) : [])
        ? JSON.parse(raw as string)
        : [];
      const now = Date.now();
      const due = rems.filter(
        (r: any) => !r.fired && typeof r.ts === 'number' && r.ts <= now,
      );
      if (due.length === 0) return;
      const rawN = await AsyncStorage.getItem('doctor_notifications');
      const cur = Array.isArray(rawN ? JSON.parse(rawN) : [])
        ? JSON.parse(rawN as string)
        : [];
      const toAdd = due.map((r: any) => {
        const title =
          r.kind === 'tomorrow'
            ? 'Appointment Reminder'
            : 'Appointment Starting Soon';
        const message =
          r.kind === 'tomorrow'
            ? `Appointment for ${r.patient} is tomorrow at ${r.time}.`
            : `Appointment for ${r.patient} at ${r.time} is starting soon.`;
        return {
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          title,
          message,
          timestamp: Date.now(),
          read: false,
        };
      });
      await AsyncStorage.setItem(
        'doctor_notifications',
        JSON.stringify([...toAdd, ...cur]),
      );
      const updated = rems.map((r: any) => ({
        ...r,
        fired: r.fired || due.some((d: any) => d.id === r.id),
      }));
      await AsyncStorage.setItem('doctor_reminders', JSON.stringify(updated));
    } catch {}
  }, []);

  const loadNotifications = React.useCallback(async () => {
    try {
      // Ensure reminders due are pushed into notifications when opening this screen
      await checkDueReminders();
      // Load existing local notifications
      const raw = await AsyncStorage.getItem('doctor_notifications');
      let localArr: any[] = raw ? JSON.parse(raw) : [];
      // Ingest appointment requests for this doctor and merge into local notifications
      try {
        localArr = await ingestAppointmentRequests(localArr);
      } catch {}
      // Fetch server notifications and merge
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications`, {
          headers,
        });
        if (res.ok) {
          const serverArr = await res.json();
          // Normalize to common shape
          const mapped = Array.isArray(serverArr)
            ? serverArr.map((n: any) => ({
                id: String(n.id),
                title: String(n.title || 'Notification'),
                message: String(n.message || ''),
                timestamp: n.created_at
                  ? new Date(n.created_at).getTime()
                  : Date.now(),
                read: Boolean(n.read) === true,
              }))
            : [];
          // Merge by id (server wins)
          const byId: Record<string, any> = {};
          for (const it of localArr) {
            if (it?.id) byId[String(it.id)] = it;
          }
          for (const it of mapped) {
            byId[it.id] = { ...byId[it.id], ...it };
          }
          const merged = Object.values(byId)
            .filter(Boolean)
            .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          await AsyncStorage.setItem(
            'doctor_notifications',
            JSON.stringify(merged),
          );
          setItems(merged as NotificationItem[]);
        } else {
          setItems(Array.isArray(localArr) ? localArr : []);
        }
      } catch {
        setItems(Array.isArray(localArr) ? localArr : []);
      }
    } catch {
      setItems([]);
    }
  }, [API_BASE, checkDueReminders, getAuthHeaders, ingestAppointmentRequests]);

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
      return () => {};
    }, [loadNotifications]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const openDetail = (it: NotificationItem) => {
    setDetailItem(it);
    setShowDetail(true);
  };

  const markAsRead = async (id: string) => {
    try {
      const next = items.map(n => (n.id === id ? { ...n, read: true } : n));
      setItems(next);
      await AsyncStorage.setItem('doctor_notifications', JSON.stringify(next));
      // Persist to server (best-effort)
      try {
        const headers = await getAuthHeaders();
        await fetch(
          `${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`,
          { method: 'PUT', headers },
        );
      } catch {}
    } catch {}
  };

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

  const unread = items.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <DoctorTopNav
          unreadCount={unread}
          onPressNotifications={() => {}}
          onPressProfile={() => setShowProfileMenu(true)}
        />

        <View style={styles.body}>
          <Text style={styles.title}>Notifications</Text>
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

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('DoctorDashboard')}
          />
          <BottomItem
            label="Appointment"
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('DoctorAppointment')}
          />
          <BottomItem
            label="Prescription"
            source={require('../../assets/prescription_icon.png')}
            onPress={() => navigation.navigate('DoctorPrescription')}
          />
          <BottomItem
            label="P-Records"
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('DoctorPatientRecords')}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={() => navigation.navigate('DoctorReports')}
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
              style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}
            >
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('DoctorProfile' as never);
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' as never }],
                  });
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

                {(String(detailItem?.title || '')
                  .toLowerCase()
                  .includes('appointment request') ||
                  String(detailItem?.id || '').startsWith('apptreq-')) && (
                  <TouchableOpacity
                    style={styles.goBtn}
                    onPress={() => {
                      setShowDetail(false);
                      navigation.navigate('DoctorAppointment');
                    }}
                  >
                    <Text style={styles.goBtnText}>Go to Requests</Text>
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
      </View>
    </SafeAreaView>
  );
}

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
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Image
        source={source}
        style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]}
        resizeMode="contain"
      />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  badgeWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GREEN,
  },
  avatarImg: { width: '100%', height: '100%' },

  divider: { height: 1, backgroundColor: BORDER },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  rowTime: { color: MUTED, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  detailIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6FFF5',
  },
  detailIcon: { width: 22, height: 22, tintColor: GREEN },
  detailHeaderBlock: { marginTop: 10, marginBottom: 8 },
  detailTitle: { color: '#111827', fontWeight: '800', fontSize: 16 },
  detailTime: { color: MUTED, fontSize: 12, marginTop: 2 },
  detailPanel: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    backgroundColor: CARD_BG,
    padding: 12,
    marginTop: 6,
    maxHeight: 260,
  },
  panelLabel: { color: MUTED, fontSize: 12, marginBottom: 6 },
  panelBody: {},
  detailBody: { color: '#111827' },
  detailActions: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  markBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBtnText: { color: '#FFFFFF', fontWeight: '700' },

  goBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  goBtnText: { color: '#FFFFFF', fontWeight: '700' },

  okBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnText: { color: '#111827', fontWeight: '700' },

  bottomBar: {
    height: 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 26, height: 26, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
  // Dropdown styles
  dropdownOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  dropdownCard: {
    position: 'absolute',
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});
