import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalImmediateNotification } from '../../utils/notifications';

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
  from?: string;
  details?: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    station?: string;
    notes?: string;
  };
  status?: 'accepted' | 'rejected' | 'pending';
};

export default function SupervisorNotificationDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item: NotificationItem = route?.params?.item;
  const [current, setCurrent] = useState<NotificationItem | null>(item || null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  // Parse legacy message string (pre-details) to extract fields
  const parseLegacyMessage = (msg?: string) => {
    if (!msg) return null;
    try {
      let title: string | undefined;
      let date: string | undefined;
      let startTime: string | undefined;
      let endTime: string | undefined;
      let station: string | undefined;
      let notes: string | undefined;

      // Example legacy pattern built in NurseRequest:
      // "<title> on <YYYY-MM-DD>, <start> - <end> • Station: <station> • <note>"
      const parts = msg.split(' • ').map(p => p.trim());
      const first = parts.shift() || '';

      // Station and notes if present
      for (const p of parts) {
        if (p.toLowerCase().startsWith('station:')) station = p.split(':').slice(1).join(':').trim();
        else if (!notes) notes = p;
      }

      // Handle first segment: may contain title, date and time range
      // e.g., "Morning on 2025-10-27, 1:00PM - 4:00AM"
      const onIdx = first.indexOf(' on ');
      if (onIdx >= 0) {
        title = first.slice(0, onIdx).trim();
        const rest = first.slice(onIdx + 4).trim();
        const commaIdx = rest.indexOf(',');
        if (commaIdx >= 0) {
          date = rest.slice(0, commaIdx).trim();
          const timeSeg = rest.slice(commaIdx + 1).trim();
          const dashIdx = timeSeg.indexOf(' - ');
          if (dashIdx >= 0) {
            startTime = timeSeg.slice(0, dashIdx).trim();
            endTime = timeSeg.slice(dashIdx + 3).trim();
          } else if (timeSeg) {
            startTime = timeSeg;
          }
        } else {
          // no comma -> only date
          date = rest.trim();
        }
      } else {
        // No ' on ' -> attempt to split title and times by comma
        const commaIdx = first.indexOf(',');
        if (commaIdx >= 0) {
          title = first.slice(0, commaIdx).trim();
          const timeSeg = first.slice(commaIdx + 1).trim();
          const dashIdx = timeSeg.indexOf(' - ');
          if (dashIdx >= 0) {
            startTime = timeSeg.slice(0, dashIdx).trim();
            endTime = timeSeg.slice(dashIdx + 3).trim();
          } else if (timeSeg) {
            startTime = timeSeg;
          }
        } else {
          title = first.trim();
        }
      }

      return { title, date, startTime, endTime, station, notes };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Mark as read when opened
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('supervisor_notifications');
        const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
        const idx = arr.findIndex((n) => n.id === item?.id);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], read: true, status: arr[idx].status || 'pending' };
          await AsyncStorage.setItem('supervisor_notifications', JSON.stringify(arr));
          setCurrent(arr[idx]);
        }
      } catch {}
    })();
    // Load avatar for header
    (async () => {
      try {
        const rawS = await AsyncStorage.getItem('session');
        if (rawS) {
          const sess = JSON.parse(rawS);
          const user = sess?.user || sess;
          const uid = user?.id || user?.user_id || user?.uid;
          const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
          setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
        }
      } catch {}
    })();
  }, [item?.id]);

  const updateStatus = async (status: 'accepted' | 'rejected') => {
    try {
      const raw = await AsyncStorage.getItem('supervisor_notifications');
      const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((n) => n.id === current?.id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], read: true, status };
        await AsyncStorage.setItem('supervisor_notifications', JSON.stringify(arr));
        setCurrent(arr[idx]);
      }
      // Append a nurse notification reflecting the decision
      try {
        const nraw = await AsyncStorage.getItem('nurse_notifications');
        const narr = nraw ? JSON.parse(nraw) : [];
        const d = (current?.details || {});
        const summary = `${d.title || ''}${d.date ? ` • ${d.date}` : ''}${(d.startTime || d.endTime) ? ` • ${d.startTime || ''}${d.endTime ? ` - ${d.endTime}` : ''}` : ''}${d.station ? ` • Station: ${d.station}` : ''}`.trim();
        const nurseNotif = {
          id: `NN-${Date.now()}`,
          title: status === 'accepted' ? 'Requested shift schedule approved' : 'Requested shift schedule rejected',
          message: summary || 'Your schedule request has been updated.',
          timestamp: Date.now(),
          read: false,
          status,
        };
        const nextN = [nurseNotif, ...Array.isArray(narr) ? narr : []];
        await AsyncStorage.setItem('nurse_notifications', JSON.stringify(nextN));
        if (status === 'accepted') {
          try { await showLocalImmediateNotification(nurseNotif.title, nurseNotif.message); } catch {}
        }
      } catch {}
      // If accepted, also add to nurse schedule storage so it reflects in the list
      if (status === 'accepted' && current?.details) {
        try {
          const d = current.details;
          const sched = {
            id: `SCH-${Date.now()}`,
            title: d.title || 'Schedule',
            date: d.date || undefined,
            startTime: d.startTime || undefined,
            endTime: d.endTime || undefined,
            patient: d.station || undefined,
            note: d.notes || undefined,
          };

          // Add to nurse schedules
          const sraw = await AsyncStorage.getItem('nurse_schedules');
          const sarr = sraw ? JSON.parse(sraw) : [];
          const nextS = [sched, ...Array.isArray(sarr) ? sarr : []];
          await AsyncStorage.setItem('nurse_schedules', JSON.stringify(nextS));

          // Add to supervisor schedules
          const supervisorSched = {
            id: `SUP-${Date.now()}`,
            nurse: current.from || 'Nurse',
            title: d.title || 'Schedule',
            date: d.date || undefined,
            startTime: d.startTime || undefined,
            endTime: d.endTime || undefined,
            note: d.notes || undefined,
          };

          const supRaw = await AsyncStorage.getItem('supervisor_schedules');
          const supArr = supRaw ? JSON.parse(supRaw) : [];
          const nextSupS = [supervisorSched, ...Array.isArray(supArr) ? supArr : []];
          await AsyncStorage.setItem('supervisor_schedules', JSON.stringify(nextSupS));
        } catch {}
      }
      // Navigate back after action
      navigation.goBack();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header (same structure as supervisor_dashboard) */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SupervisorNotification' as never)}>
              <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileMenu(true)}>
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
          <View style={styles.card}>
            {/* Title row + status pill */}
            <View style={styles.cardTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.iconWrap}>
                  <Image source={require('../../assets/notification_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                </View>
                <Text style={styles.title} numberOfLines={1}>{current?.title || 'Notification'}</Text>
              </View>
              {!!current && (
                <View style={[styles.statusPill, current?.status === 'accepted' ? styles.statusAccepted : current?.status === 'rejected' ? styles.statusRejected : styles.statusPending]}>
                  <Text style={styles.statusText}>{(current?.status || 'pending').toUpperCase()}</Text>
                </View>
              )}
            </View>

            {/* Meta row */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLeft}>From: <Text style={styles.metaStrong}>{current?.from || '—'}</Text></Text>
              {!!current?.timestamp && <Text style={styles.metaRight}>{new Date(current.timestamp).toLocaleString()}</Text>}
            </View>
            <View style={styles.sectionDivider} />

            {/* Fields with legacy fallback (merge missing fields from message) */}
            {(() => {
              const d = current?.details;
              const legacy = parseLegacyMessage(current?.message) || {} as any;
              const data = {
                title: d?.title || legacy.title,
                date: d?.date || legacy.date,
                startTime: d?.startTime || legacy.startTime,
                endTime: d?.endTime || legacy.endTime,
                station: d?.station || legacy.station,
                notes: d?.notes || legacy.notes,
              } as { title?: string; date?: string; startTime?: string; endTime?: string; station?: string; notes?: string };
              const allEmpty = !data.title && !data.date && !data.startTime && !data.endTime && !data.station && !data.notes;
              if (allEmpty) return <Text style={styles.message}>{current?.message || '—'}</Text>;
              return (
                <View style={{ gap: 10 }}>
                  <View style={styles.dualRow}>
                    <Text style={styles.detailLine}>Title: <Text style={styles.detailValue}>{data.title || '—'}</Text></Text>
                    <Text style={styles.detailLine}>Date: <Text style={styles.detailValue}>{data.date || '—'}</Text></Text>
                  </View>
                  <View style={styles.dualRow}>
                    <Text style={styles.detailLine}>Start Time: <Text style={styles.detailValue}>{data.startTime || '—'}</Text></Text>
                    <Text style={styles.detailLine}>End Time: <Text style={styles.detailValue}>{data.endTime || '—'}</Text></Text>
                  </View>
                  <Text style={styles.detailLine}>Station: <Text style={styles.detailValue}>{data.station || '—'}</Text></Text>
                  <Text style={styles.detailLabel}>Notes:</Text>
                  <Text style={styles.notesValue}>{data.notes || '—'}</Text>
                </View>
              );
            })()}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => updateStatus('rejected')}
              activeOpacity={0.9}
            >
              <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => updateStatus('accepted')}
              activeOpacity={0.9}
            >
              <Text style={[styles.actionText, styles.acceptText]}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.9}
            >
              <Text style={[styles.actionText, { color: MUTED }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Bottom Bar (same as supervisor_dashboard) */}
        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('SupervisorDashboard' as never)}
          />
          <BottomItem
            label="Schedule"
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('SupervisorSchedule' as never)}
          />
          <BottomItem
            label="Staff"
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('SupervisorList' as never)}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={() => navigation.navigate('SupervisorReports' as never)}
          />
        </View>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('SupervisorProfile' as never); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }); }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function BottomItem({ label, active, source, onPress }: { label: string; active?: boolean; source: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.bottomItem} activeOpacity={0.8} onPress={onPress}>
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
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },

  divider: { height: 1, backgroundColor: BORDER },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 },

  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  title: { color: '#111827', fontWeight: '800', fontSize: 16 },
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
  metaLeft: { color: MUTED },
  metaRight: { color: MUTED, fontSize: 12 },
  metaStrong: { color: '#111827', fontWeight: '700' },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginVertical: 10 },

  // Key/Value rows
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  kvKey: { color: MUTED, minWidth: 110 },
  kvValue: { color: '#111827', flex: 1, textAlign: 'right' },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  fieldLabel: { color: MUTED, minWidth: 100 },
  fieldValue: { color: '#111827', flex: 1, textAlign: 'right' },

  actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  actionText: { fontWeight: '700' },
  acceptBtn: { backgroundColor: GREEN },
  acceptText: { color: '#FFFFFF' },
  rejectBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FCA5A5' },
  rejectText: { color: '#DC2626' },

  // Bottom bar styles (same as supervisor_dashboard)
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Custom detail layout
  dualRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  detailLine: { color: MUTED, flex: 1 },
  detailValue: { color: '#111827', fontWeight: '700' },
  detailLabel: { color: MUTED, marginTop: 6 },
  notesValue: { color: '#111827', marginTop: 2, lineHeight: 20 },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});
