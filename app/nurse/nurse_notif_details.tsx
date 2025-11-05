import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function NurseNotifDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item: NotificationItem = route?.params?.item;
  const [current, setCurrent] = useState<NotificationItem | null>(item || null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('nurse_notifications');
        const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
        const idx = arr.findIndex(n => n.id === item?.id);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], read: true };
          await AsyncStorage.setItem('nurse_notifications', JSON.stringify(arr));
          setCurrent(arr[idx]);
        }
      } catch {}
    })();
  }, [item?.id]);

  // Refresh unread count on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('nurse_notifications');
          const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
          const n = Array.isArray(arr) ? arr.filter((n) => !n?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Load avatar
        try {
          const rawSession = await AsyncStorage.getItem('session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
            setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
          }
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const isSupervisorSchedule = (it?: NotificationItem | null) => {
    if (!it?.title) return false;
    return String(it.title).trim().toLowerCase().startsWith('new schedule:');
  };

  const parseScheduleFromNotif = (it: NotificationItem) => {
    const t = it.title || '';
    const colon = t.indexOf(':');
    const schedTitle = colon >= 0 ? t.slice(colon + 1).trim() : t.trim();
    const parts = (it.message || '').split('•').map(s => s.trim()).filter(Boolean);
    const date = parts[1] || '';
    let startTime: string | undefined;
    let endTime: string | undefined;
    if (parts[2]) {
      const dash = parts[2].indexOf(' - ');
      if (dash >= 0) {
        startTime = parts[2].slice(0, dash).trim();
        endTime = parts[2].slice(dash + 3).trim();
      } else {
        startTime = parts[2];
      }
    }
    // Try to extract Station from any segment
    let station: string | undefined;
    for (const p of parts) {
      if (/^station\s*:/i.test(p)) {
        station = p.replace(/^station\s*:\s*/i, '').trim() || undefined;
        break;
      }
    }
    const note = parts[3] || undefined;
    return { title: schedTitle || 'Schedule', date, startTime, endTime, note, station };
  };

  const acceptNotification = async () => {
    if (!current) return;
    try {
      const raw = await AsyncStorage.getItem('nurse_notifications');
      const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(n => n.id === current.id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], read: true, status: 'accepted' };
        await AsyncStorage.setItem('nurse_notifications', JSON.stringify(arr));
        setCurrent(arr[idx]);
      }
    } catch {}
    // Add to nurse schedules
    try {
      const d = parseScheduleFromNotif(current);
      const sched = {
        id: `NS-${Date.now()}`,
        title: d.title,
        date: d.date || undefined,
        startTime: d.startTime || undefined,
        endTime: d.endTime || undefined,
        station: d.station || undefined,
        patient: undefined,
        note: d.note || undefined,
      } as any;
      const sraw = await AsyncStorage.getItem('nurse_schedules');
      const sarr = sraw ? JSON.parse(sraw) : [];
      const next = [sched, ...(Array.isArray(sarr) ? sarr : [])];
      await AsyncStorage.setItem('nurse_schedules', JSON.stringify(next));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header (same structure as nurse_dashboard) */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NurseNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('NurseProfile' as never)}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.body}>
          <Text style={styles.pageTitle}>Notification Details</Text>
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.iconWrap}>
                  <Image source={require('../../assets/notification_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                </View>
                <Text style={styles.title} numberOfLines={2}>{current?.title || 'Notification'}</Text>
              </View>
              {!!current && (
                <View style={[
                  styles.statusPill,
                  current?.status === 'accepted' ? styles.statusAccepted : current?.status === 'rejected' ? styles.statusRejected : styles.statusPending,
                ]}>
                  <Text style={styles.statusText}>{(current?.status || 'pending').toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              {!!current?.timestamp && <Text style={styles.metaRight}>{new Date(current.timestamp).toLocaleString()}</Text>}
            </View>
            <View style={styles.sectionDivider} />

            <Text style={styles.message}>{current?.message || '—'}</Text>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
            {isSupervisorSchedule(current) && current?.status !== 'accepted' && (
              <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.9} onPress={acceptNotification}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeBtnSolid} activeOpacity={0.9} onPress={() => navigation.goBack()}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard' as never)} />
            <BottomItem label="Schedule" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NurseSchedule' as never)} />
            <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('NursePrescription' as never)} />
            <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('NurseReports' as never)} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function BottomItem({ label, active, source, onPress }: { label: string; active?: boolean; source: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.bottomItem} activeOpacity={0.85} onPress={onPress}>
      <Image source={source} style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]} resizeMode="contain" />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  headerTitle: { color: GREEN, fontWeight: '700' },
  iconBtn: { padding: 8 },
  headerBackText: { fontSize: 22, color: GREEN, lineHeight: 22 },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pageTitle: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },
  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  title: { color: '#111827', fontWeight: '800', fontSize: 16, flex: 1 },
  timeText: { color: MUTED, fontSize: 12, marginTop: 6, marginBottom: 10 },
  message: { color: '#111827', marginTop: 6, lineHeight: 20 },

  // Status pill
  statusPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  statusAccepted: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  statusRejected: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  statusPending: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#111827' },

  // Meta row
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRight: { color: MUTED, fontSize: 12 },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },

  // Bottom bar styles
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Close button
  closeBtnSolid: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER },
  closeBtnText: { color: MUTED, fontWeight: '700' },
  acceptBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN },
  acceptText: { color: GREEN, fontWeight: '700' },
})
;
