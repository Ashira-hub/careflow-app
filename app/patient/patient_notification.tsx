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
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://backend-careflow.vercel.app';
const DELETED_NOTIF_IDS_KEY = 'patient_deleted_notification_ids';

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
  meta?: any;
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

  const getDeletedIds = React.useCallback(async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(DELETED_NOTIF_IDS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr)
        ? arr.map((x: any) => String(x)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }, []);

  const addDeletedId = React.useCallback(
    async (id: string) => {
      try {
        const current = await getDeletedIds();
        const next = Array.from(new Set([String(id), ...current])).slice(
          0,
          1000,
        );
        await AsyncStorage.setItem(DELETED_NOTIF_IDS_KEY, JSON.stringify(next));
      } catch {}
    },
    [getDeletedIds],
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
      meta: n,
    } as NotificationItem;
  }, []);

  const loadNotifications = React.useCallback(async () => {
    try {
      const [myName, myId] = await Promise.all([
        getCurrentUserName(),
        getCurrentUserId(),
      ]);

      const deletedIdsArr = await getDeletedIds();
      const deletedSet = new Set(
        (deletedIdsArr || []).map((x: any) => String(x)).filter(Boolean),
      );

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
            meta: x,
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
        .filter((it: any) => !deletedSet.has(String(it?.id)))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const normalizedMerged = merged.map(it => {
        const meta = (it as any)?.meta || {};
        const fallbackTs = meta?.created_at
          ? new Date(meta.created_at).getTime()
          : meta?.timestamp
          ? Number(meta.timestamp)
          : undefined;
        const ts =
          typeof it.timestamp === 'number' && Number.isFinite(it.timestamp)
            ? it.timestamp
            : typeof fallbackTs === 'number' && Number.isFinite(fallbackTs)
            ? fallbackTs
            : undefined;
        const title =
          String(it.title || '').trim() ||
          String(meta?.title || '').trim() ||
          'Notification';
        const message =
          String(it.message || '').trim() ||
          String(meta?.message || meta?.body || '').trim() ||
          '';
        return {
          ...it,
          title,
          message,
          timestamp: ts,
        } as NotificationItem;
      });

      setItems(normalizedMerged);
      try {
        await AsyncStorage.setItem(
          'patient_notifications',
          JSON.stringify(normalizedMerged),
        );
      } catch {}
    } catch {
      setItems([]);
    }
  }, [
    getAuthHeaders,
    getCurrentUserId,
    getCurrentUserName,
    getDeletedIds,
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

  const deleteNotification = React.useCallback(
    async (id: string) => {
      try {
        await addDeletedId(id);
        const next = items.filter(n => n.id !== id);
        setItems(next);
        try {
          await AsyncStorage.setItem(
            'patient_notifications',
            JSON.stringify(next),
          );
        } catch {}

        try {
          const headers = await getAuthHeaders();
          await fetch(
            `${API_BASE}/api/notifications/${encodeURIComponent(id)}`,
            {
              method: 'DELETE',
              headers,
            },
          );
        } catch {}
      } catch {}
    },
    [addDeletedId, getAuthHeaders, items],
  );

  const getAccent = React.useCallback((it: NotificationItem) => {
    const title = String(it?.title || '').toLowerCase();
    if (title.includes('rescheduled')) {
      return { bg: '#FEF3C7', tint: '#F59E0B' };
    }
    if (title.includes('prescription')) {
      return { bg: '#DBEAFE', tint: '#2563EB' };
    }
    if (title.includes('accepted')) {
      return { bg: '#DCFCE7', tint: '#16A34A' };
    }
    return { bg: '#ECFDF5', tint: GREEN };
  }, []);

  const getDetailIcon = React.useCallback((it: NotificationItem | null) => {
    const title = String(it?.title || '').toLowerCase();
    if (title.includes('rescheduled')) {
      return require('../../assets/calendar_emoji.png');
    }
    if (title.includes('prescription')) {
      return require('../../assets/prescription_emoji.png');
    }
    return require('../../assets/notification_icon.png');
  }, []);

  const formatMaybeDateTime = React.useCallback((v: any) => {
    if (v == null) return '';
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      return new Date(v).toLocaleString();
    }
    const s = String(v || '').trim();
    if (!s) return '';
    const parsed = Date.parse(s);
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed).toLocaleString();
    }
    return s;
  }, []);

  const parseFieldsFromMessage = React.useCallback((msgRaw: string) => {
    const msg = String(msgRaw || '').trim();
    const parts = msg
      .split(/\n|•/)
      .map(p => String(p || '').trim())
      .filter(Boolean);

    const out: Record<string, string> = {};
    for (const p of parts) {
      const i = p.indexOf(':');
      if (i > 0) {
        const k = p.slice(0, i).trim().toLowerCase();
        const v = p.slice(i + 1).trim();
        if (k && v) out[k] = v;
      }
    }
    return out;
  }, []);

  const parseDoctorName = React.useCallback((msgRaw: string) => {
    const msg = String(msgRaw || '');
    const m = msg.match(/\bDr\.?\s+([A-Za-z][A-Za-z .'-]*)/);
    if (!m) return '';
    const full = `Dr. ${String(m[1] || '').trim()}`.replace(/\s+/g, ' ').trim();
    return full === 'Dr.' ? '' : full;
  }, []);

  const parseRescheduled = React.useCallback(
    (it: NotificationItem) => {
      const fields = parseFieldsFromMessage(it.message);
      const msg = String(it.message || '');
      const meta = (it as any)?.meta || {};
      const doctor =
        meta?.doctor ||
        meta?.doctorName ||
        meta?.doctor_name ||
        fields['doctor'] ||
        fields['dr'] ||
        fields['physician'] ||
        parseDoctorName(msg);

      let original =
        meta?.originalDate ||
        meta?.oldDate ||
        meta?.previousDate ||
        fields['original date'] ||
        fields['original'] ||
        fields['from'] ||
        fields['old date'] ||
        '';
      let next =
        meta?.newDate ||
        meta?.rescheduledTo ||
        meta?.updatedDate ||
        fields['new date'] ||
        fields['new'] ||
        fields['to'] ||
        fields['updated date'] ||
        '';

      const m = msg.match(/rescheduled\s+from\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i);
      if (m) {
        if (!original) original = String(m[1] || '').trim();
        if (!next) next = String(m[2] || '').trim();
      }

      const reason =
        meta?.reason ||
        meta?.notes ||
        meta?.note ||
        fields['reason'] ||
        fields['note'] ||
        fields['notes'] ||
        '';
      return {
        doctor,
        original: formatMaybeDateTime(original),
        next: formatMaybeDateTime(next),
        reason: String(reason || '').trim(),
      };
    },
    [formatMaybeDateTime, parseDoctorName, parseFieldsFromMessage],
  );

  const parseAccepted = React.useCallback(
    (it: NotificationItem) => {
      const fields = parseFieldsFromMessage(it.message);
      const msg = String(it.message || '');
      const meta = (it as any)?.meta || {};
      const doctor =
        meta?.doctor ||
        meta?.doctorName ||
        meta?.doctor_name ||
        fields['doctor'] ||
        fields['dr'] ||
        fields['physician'] ||
        parseDoctorName(msg);

      let appointmentDate =
        meta?.appointmentDate ||
        meta?.dateTime ||
        meta?.date ||
        fields['appointment date'] ||
        fields['date'] ||
        fields['when'] ||
        '';
      if (!appointmentDate) {
        const m = msg.match(
          /accepted\s+your\s+appointment\s+request\s+for\s+(.+?)(?:\.|$)/i,
        );
        if (m) appointmentDate = String(m[1] || '').trim();
      }

      const location =
        meta?.location ||
        meta?.clinic ||
        meta?.room ||
        fields['location'] ||
        fields['clinic'] ||
        '';
      const appointmentType =
        meta?.appointmentType ||
        meta?.type ||
        meta?.service ||
        meta?.specialty ||
        fields['appointment type'] ||
        fields['type'] ||
        fields['service'] ||
        '';

      return {
        doctor,
        appointmentDate: formatMaybeDateTime(appointmentDate),
        location: String(location || '').trim(),
        appointmentType: String(appointmentType || '').trim(),
      };
    },
    [formatMaybeDateTime, parseDoctorName, parseFieldsFromMessage],
  );

  const parsePrescription = React.useCallback(
    (it: NotificationItem) => {
      const fields = parseFieldsFromMessage(it.message);
      const msg = String(it.message || '');
      const meta = (it as any)?.meta || {};
      const doctor =
        meta?.prescribedBy ||
        meta?.prescribed_by ||
        meta?.doctor ||
        meta?.doctorName ||
        meta?.doctor_name ||
        fields['prescribed by'] ||
        fields['doctor'] ||
        fields['dr'] ||
        fields['physician'] ||
        parseDoctorName(msg);

      let medicine =
        meta?.medicine ||
        meta?.drug ||
        meta?.rx ||
        fields['medicine'] ||
        fields['drug'] ||
        fields['rx'] ||
        '';
      if (!medicine) {
        const parts = msg.split('•').map(s => String(s || '').trim());
        if (parts.length >= 2) medicine = parts[parts.length - 1];
      }

      let dosage = meta?.dosage || fields['dosage'] || '';
      if (!dosage) {
        const m = String(medicine || '').match(
          /(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml))/i,
        );
        if (m) dosage = String(m[1] || '').trim();
      }
      const instructions =
        meta?.instructions ||
        meta?.direction ||
        fields['instructions'] ||
        fields['direction'] ||
        '';
      const duration = meta?.duration || fields['duration'] || '';

      return {
        doctor: String(doctor || '').trim(),
        medicine: String(medicine || '').trim(),
        dosage: String(dosage || '').trim(),
        instructions: String(instructions || '').trim(),
        duration: String(duration || '').trim(),
      };
    },
    [parseDoctorName, parseFieldsFromMessage],
  );

  const openDetail = React.useCallback((it: NotificationItem) => {
    setDetailItem(it);
    setShowDetail(true);
  }, []);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const accent = getAccent(item);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardTop}
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
            <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
              <Image
                source={require('../../assets/notification_icon.png')}
                style={[styles.rowIcon, { tintColor: accent.tint }]}
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
          </View>
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.deleteRow}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'Delete Notification',
              'Are you sure you want to delete this notification?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteNotification(item.id);
                  },
                },
              ],
            );
          }}
        >
          <Image
            source={require('../../assets/delete_icon.png')}
            style={styles.deleteIcon}
            resizeMode="contain"
          />
          <Text style={styles.deleteText}>Delete Notification</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View
          style={[
            styles.headerContainer,
            { paddingTop: Math.max(0, (insets.top || 0) + 8) },
          ]}
        >
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {}}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative' }}>
                <Image
                  source={require('../../assets/notification_icon.png')}
                  style={styles.headerIconImg}
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
              style={styles.headerProfileBtn}
              onPress={() => setShowProfileMenu(true)}
              activeOpacity={0.85}
            >
              <View style={styles.headerProfileAvatar}>
                <Text style={styles.headerProfileAvatarText}>
                  {String(userName || 'P')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerProfileTextCol}>
                <Text style={styles.headerProfileName} numberOfLines={1}>
                  {String(userName || 'Patient')}
                </Text>
                <Text style={styles.headerProfileRole} numberOfLines={1}>
                  {String(userRole || 'Patient')}
                </Text>
              </View>
              <Image
                source={require('../../assets/dropdown.png')}
                style={styles.headerProfileChevron}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.pageTitle}>Notifications</Text>

        <View style={styles.body}>
          <FlatList
            data={items}
            keyExtractor={it => it.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
              <View style={styles.detailHeaderRow}>
                <Text style={styles.detailHeaderTitle} numberOfLines={1}>
                  {detailItem?.title || 'Notification'}
                </Text>
                <TouchableOpacity
                  style={styles.detailHeaderClose}
                  onPress={() => setShowDetail(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.detailHeaderCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.detailScrollView}
                contentContainerStyle={styles.detailScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receivedRow}>
                  <View
                    style={[
                      styles.receivedIconWrap,
                      {
                        backgroundColor: getAccent(detailItem || ({} as any))
                          .bg,
                      },
                    ]}
                  >
                    {String(detailItem?.title || '')
                      .toLowerCase()
                      .includes('accepted') ? (
                      <Text style={styles.receivedCheck}>✓</Text>
                    ) : (
                      <Image
                        source={getDetailIcon(detailItem)}
                        style={styles.receivedIcon}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receivedLabel}>Received</Text>
                    <Text style={styles.receivedValue}>
                      {detailItem?.timestamp
                        ? new Date(detailItem.timestamp).toLocaleString()
                        : '-'}
                    </Text>
                  </View>
                </View>

                {(() => {
                  const it = detailItem;
                  if (!it) return null;
                  const title = String(it.title || '').toLowerCase();

                  if (title.includes('rescheduled')) {
                    const p = parseRescheduled(it);
                    return (
                      <View style={styles.detailContent}>
                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Doctor</Text>
                          <Text style={styles.detailV}>{p.doctor || '-'}</Text>
                        </View>

                        <View
                          style={[styles.detailBox, styles.detailBoxDanger]}
                        >
                          <Text style={styles.detailBoxLabel}>
                            Original Date
                          </Text>
                          <Text
                            style={[styles.detailBoxValue, styles.detailStrike]}
                          >
                            {p.original || '-'}
                          </Text>
                        </View>

                        <View
                          style={[styles.detailBox, styles.detailBoxSuccess]}
                        >
                          <Text style={styles.detailBoxLabel}>New Date</Text>
                          <Text style={styles.detailBoxValue}>
                            {p.next || '-'}
                          </Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Reason</Text>
                          <View style={styles.detailOutlineBox}>
                            <Text style={styles.detailOutlineText}>
                              {p.reason || it.message || '-'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  if (title.includes('prescription')) {
                    const p = parsePrescription(it);
                    return (
                      <View style={styles.detailContent}>
                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Prescribed by</Text>
                          <Text style={styles.detailV}>{p.doctor || '-'}</Text>
                        </View>

                        <View style={[styles.detailBox, styles.detailBoxInfo]}>
                          <Text style={styles.detailBoxLabel}>Medicine</Text>
                          <Text style={styles.detailBoxValue}>
                            {p.medicine || '-'}
                          </Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Dosage</Text>
                          <Text style={styles.detailV}>{p.dosage || '-'}</Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Instructions</Text>
                          <Text style={styles.detailV}>
                            {p.instructions || it.message || '-'}
                          </Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Details</Text>
                          <Text style={styles.detailV}>
                            {String(it.message || '').trim() ||
                              'No details available.'}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  if (title.includes('accepted')) {
                    const p = parseAccepted(it);
                    return (
                      <View style={styles.detailContent}>
                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Doctor</Text>
                          <Text style={styles.detailV}>{p.doctor || '-'}</Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Appointment Date</Text>
                          <Text style={styles.detailV}>
                            {p.appointmentDate || '-'}
                          </Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Location</Text>
                          <Text style={styles.detailV}>
                            {p.location || '-'}
                          </Text>
                        </View>

                        <View style={styles.detailKV}>
                          <Text style={styles.detailK}>Appointment Type</Text>
                          <Text style={styles.detailV}>
                            {p.appointmentType || '-'}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View style={styles.detailContent}>
                      <View style={styles.detailKV}>
                        <Text style={styles.detailK}>Details</Text>
                        <Text style={styles.detailV}>
                          {String(it.message || '').trim() ||
                            'No details available.'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>

              <View style={styles.detailFooter}>
                <TouchableOpacity
                  style={styles.detailCloseBtn}
                  onPress={() => setShowDetail(false)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.detailCloseBtnText}>Close</Text>
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
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#F3F4F6' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 56,
    paddingBottom: 8,
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImg: { width: 20, height: 20, tintColor: '#111827' },
  headerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerProfileTextCol: {
    marginLeft: 10,
    marginRight: 8,
    maxWidth: 140,
  },
  headerProfileName: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 14,
  },
  headerProfileRole: {
    marginTop: 2,
    color: MUTED,
    fontWeight: '600',
    fontSize: 12,
  },
  headerProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#111827',
    opacity: 0.9,
  },
  body: { flex: 1, paddingTop: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTop: {
    padding: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BORDER,
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
  deleteRow: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteIcon: {
    width: 16,
    height: 16,
    tintColor: '#EF4444',
  },
  deleteText: {
    color: '#EF4444',
    fontWeight: '700',
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    height: '84%',
    maxHeight: '84%',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  detailHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    paddingRight: 10,
  },
  detailHeaderClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderCloseText: {
    fontSize: 22,
    lineHeight: 22,
    color: MUTED,
  },
  detailScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  detailScrollView: {
    flex: 1,
  },
  receivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  receivedIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivedIcon: {
    width: 22,
    height: 22,
  },
  receivedCheck: {
    fontSize: 22,
    lineHeight: 22,
    color: '#16A34A',
    fontWeight: '900',
  },
  receivedLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '700',
  },
  receivedValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
  },
  detailContent: {
    paddingBottom: 6,
  },
  detailKV: {
    marginTop: 10,
  },
  detailK: {
    fontSize: 12,
    color: MUTED,
  },
  detailV: {
    marginTop: 4,
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
    lineHeight: 20,
  },
  detailVBody: {
    marginTop: 4,
    fontSize: 15,
    color: '#111827',
    fontWeight: '400',
    lineHeight: 20,
  },
  detailOutlineBox: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    backgroundColor: 'transparent',
  },
  detailOutlineText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '400',
    lineHeight: 20,
  },
  detailBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  detailBoxDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  detailBoxSuccess: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  detailBoxInfo: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  detailBoxLabel: {
    fontSize: 12,
    color: MUTED,
  },
  detailBoxValue: {
    marginTop: 4,
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
    lineHeight: 20,
  },
  detailStrike: {
    textDecorationLine: 'line-through',
  },
  detailFooter: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  detailCloseBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
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
