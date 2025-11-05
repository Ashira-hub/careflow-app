import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type ScheduleEntry = {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  station?: string;
  note?: string;
  patient?: string;
  timestamp?: number;
};

type RequestEntry = {
  id: string;
  timestamp: number;
};

export default function NurseReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [nurseName, setNurseName] = useState<string>('Nurse');
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        let nurse = 'Nurse';
        try {
          const sessionRaw = await AsyncStorage.getItem('session');
          if (sessionRaw) {
            const sess = JSON.parse(sessionRaw);
            nurse = (sess?.user?.full_name || sess?.user?.fullName || sess?.user?.name || sess?.full_name || sess?.name || 'Nurse').trim() || 'Nurse';
          }
        } catch {}
        if (active) setNurseName(nurse);

        try {
          const rawSchedules = await AsyncStorage.getItem('nurse_schedules');
          const arr = rawSchedules ? JSON.parse(rawSchedules) : [];
          const mapped: ScheduleEntry[] = (Array.isArray(arr) ? arr : []).map((item: any, idx: number) => ({
            id: String(item?.id ?? item?.scheduleId ?? `sched-${idx}-${Date.now()}`),
            date: typeof item?.date === 'string' ? item.date : undefined,
            startTime: typeof item?.startTime === 'string' ? item.startTime : (typeof item?.start === 'string' ? item.start : undefined),
            endTime: typeof item?.endTime === 'string' ? item.endTime : (typeof item?.finish === 'string' ? item.finish : undefined),
            station: typeof item?.station === 'string' ? item.station : undefined,
            note: typeof item?.note === 'string' ? item.note : undefined,
            patient: typeof item?.patient === 'string' ? item.patient : undefined,
            timestamp: typeof item?.timestamp === 'number' ? item.timestamp : (typeof item?.date === 'string' ? Date.parse(item.date) : undefined),
          }));
          // Attempt to derive station when missing from note or patient; also persist back to storage
          const normalized = mapped.map((e, idx) => {
            if (e.station && e.station.trim()) return e;
            let station = e.station;
            if ((!station || !station.trim()) && typeof e.note === 'string' && /^\s*station\s*:/i.test(e.note)) {
              station = e.note.replace(/^\s*station\s*:\s*/i, '').trim();
            }
            if ((!station || !station.trim()) && typeof e.patient === 'string' && e.patient.trim()) {
              station = e.patient.trim();
            }
            return { ...e, station: station && station.trim() ? station.trim() : undefined };
          });
          if (active) setScheduleEntries(normalized);
          // Persist back if we derived any station values
          try {
            const updatedRaw = await AsyncStorage.getItem('nurse_schedules');
            const originalArr: any[] = updatedRaw ? JSON.parse(updatedRaw) : [];
            let changed = false;
            const next = (Array.isArray(originalArr) ? originalArr : []).map((it: any, i: number) => {
              const derived = normalized[i];
              if (derived && derived.station && (!it.station || it.station !== derived.station)) {
                changed = true;
                return { ...it, station: derived.station };
              }
              return it;
            });
            if (changed) await AsyncStorage.setItem('nurse_schedules', JSON.stringify(next));
          } catch {}
        } catch {
          if (active) setScheduleEntries([]);
        }

        try {
          const rawNotif = await AsyncStorage.getItem('supervisor_notifications');
          const arrN = rawNotif ? JSON.parse(rawNotif) : [];
          const nurseLower = nurse.toLowerCase();
          const filtered: RequestEntry[] = (Array.isArray(arrN) ? arrN : [])
            .filter((n: any) => {
              const from = String(n?.from || '').trim().toLowerCase();
              return nurseLower ? from === nurseLower : false;
            })
            .map((n: any, idx: number) => ({
              id: String(n?.id ?? `req-${idx}-${Date.now()}`),
              timestamp: typeof n?.timestamp === 'number' ? n.timestamp : (typeof n?.details?.date === 'string' ? Date.parse(n.details.date) : Date.now()),
            }));
          if (active) setRequests(filtered);
        } catch {
          if (active) setRequests([]);
        }
        // Load avatar image
        try {
          const rawSession = await AsyncStorage.getItem('session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
            if (active) setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
          }
        } catch {}
        // Load unread notifications count
        try {
          const rawN = await AsyncStorage.getItem('nurse_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          if (active) setUnreadCount(n);
        } catch { if (active) setUnreadCount(0); }
        // Log activity for viewing reports
        try {
          const raw = await AsyncStorage.getItem('nurse_activity');
          const arr: any[] = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed Reports', type: 'reports', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
          await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
        } catch {}
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const parseTimeString = React.useCallback((value: string): { hour: number; minute: number; period: 'AM' | 'PM' } | null => {
    if (!value) return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Math.min(59, Math.max(0, Number(match[2])));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    const period: 'AM' | 'PM' = match[3].toUpperCase() === 'PM' ? 'PM' : 'AM';
    hour = ((hour - 1 + 12) % 12) + 1;
    return { hour, minute, period };
  }, []);

  const toMinutesOfDay = React.useCallback((hour: number, minute: number, period: 'AM' | 'PM') => {
    const safeMinute = ((minute % 60) + 60) % 60;
    let h = hour % 12;
    if (period === 'PM') h += 12;
    return h * 60 + safeMinute;
  }, []);

  const computeDurationMinutes = React.useCallback((startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 0;
    const startParsed = parseTimeString(startTime);
    const endParsed = parseTimeString(endTime);
    if (!startParsed || !endParsed) return 0;
    const startTotal = toMinutesOfDay(startParsed.hour, startParsed.minute, startParsed.period);
    const endTotal = toMinutesOfDay(endParsed.hour, endParsed.minute, endParsed.period);
    let diff = endTotal - startTotal;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }, [parseTimeString, toMinutesOfDay]);

  const metrics = useMemo(() => {
    const parseDateTs = (d?: string) => {
      if (!d) return undefined;
      const ts = Date.parse(d);
      return Number.isFinite(ts) ? ts : undefined;
    };
    const isInMonthTs = (ts?: number) => {
      if (typeof ts !== 'number' || !Number.isFinite(ts)) return false;
      const dt = new Date(ts);
      return dt.getMonth() === month && dt.getFullYear() === year;
    };

    const scheduleInMonth = scheduleEntries.filter((entry) => {
      const ts = typeof entry.timestamp === 'number' ? entry.timestamp : parseDateTs(entry.date);
      return isInMonthTs(ts);
    });

    let totalMinutes = 0;
    const stationMap = new Map<string, { station: string; count: number; totalMinutes: number; lastTs: number }>();
    scheduleInMonth.forEach((entry) => {
      const minutes = computeDurationMinutes(entry.startTime, entry.endTime);
      totalMinutes += minutes;
      // Derive station safely: explicit station -> from note (Station: ...) -> from patient -> Unassigned
      let derivedStation = (entry.station || '').trim();
      if (!derivedStation && typeof entry.note === 'string' && /^\s*station\s*:/i.test(entry.note)) {
        derivedStation = entry.note.replace(/^\s*station\s*:\s*/i, '').trim();
      }
      if (!derivedStation && typeof entry.patient === 'string') {
        derivedStation = entry.patient.trim();
      }
      const stationName = derivedStation || 'Unassigned';
      const existing = stationMap.get(stationName) || { station: stationName, count: 0, totalMinutes: 0, lastTs: 0 };
      existing.count += 1;
      existing.totalMinutes += minutes;
      const ts = typeof entry.timestamp === 'number' ? entry.timestamp : parseDateTs(entry.date) ?? 0;
      if (ts > existing.lastTs) existing.lastTs = ts;
      stationMap.set(stationName, existing);
    });

    const totalShifts = scheduleInMonth.length;
    const ranking = Array.from(stationMap.values())
      .sort((a, b) => (b.count - a.count) || (b.totalMinutes - a.totalMinutes))
      .slice(0, 5)
      .map((item) => ({
        id: item.station,
        station: item.station,
        count: item.count,
        totalHoursLabel: `${(item.totalMinutes / 60).toFixed(2)} hrs`,
        lastVisit: item.lastTs ? new Date(item.lastTs).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '—',
      }));

    const requestsInMonth = requests.filter((req) => isInMonthTs(req.timestamp)).length;

    return {
      totalRequests: requestsInMonth,
      totalHoursLabel: `${(totalMinutes / 60).toFixed(2)} hrs`,
      totalShifts,
      distinctStations: stationMap.size,
      ranking,
    };
  }, [scheduleEntries, requests, month, year, computeDurationMinutes]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NurseNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.notifBadgeWrap}>
                  <Text style={styles.notifBadgeText}>{Math.min(99, unreadCount)}</Text>
                </View>
              )}
            </View>
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

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Reports</Text>
            <View style={styles.monthWrap}>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() =>
                  setMonth((m) => {
                    const nm = (m + 11) % 12;
                    if (m === 0) setYear((y) => y - 1);
                    return nm;
                  })
                }
              >
                <Text style={styles.monthText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthName(month)} {year}</Text>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() =>
                  setMonth((m) => {
                    const nm = (m + 1) % 12;
                    if (m === 11) setYear((y) => y + 1);
                    return nm;
                  })
                }
              >
                <Text style={styles.monthText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardsRow}>
            <SummaryCard label="Requests" value={metrics.totalRequests} tint="#D1FAE5" />
            <SummaryCard label="Total Hours" value={metrics.totalHoursLabel} tint="#E0E7FF" />
          </View>
          <View style={styles.cardsRow}>
            <SummaryCard label="Active Shifts" value={metrics.totalShifts} tint="#FEF3C7" />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Most Visited</Text>
            {metrics.ranking.length === 0 ? (
              <Text style={styles.empty}>No data yet.</Text>
            ) : (
              metrics.ranking.map((n) => (
                <TouchableOpacity 
                  key={n.id} 
                  style={[styles.row, styles.clickableRow]} 
                  activeOpacity={0.6}
                  onPress={() => {
                    // Navigate to schedule or show station details
                    Alert.alert(
                      n.station,
                      `Visits: ${n.count}\nTotal Hours: ${n.totalHoursLabel}\nLast Visit: ${n.lastVisit}`,
                      [
                        { text: 'View Schedule', onPress: () => navigation.navigate('NurseSchedule') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(n.station)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{n.station}</Text>
                    <Text style={styles.meta}>Last visit: {n.lastVisit}</Text>
                  </View>
                  <View style={styles.badge}><Text style={styles.badgeText}>{n.count}</Text></View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Profile dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('NurseProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={async () => { setShowProfileMenu(false); try { await AsyncStorage.removeItem('session'); } catch {}; navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard')} />
          <BottomItem label="Schedule" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NurseSchedule')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('NursePrescription')} />
          <BottomItem label="Reports" active source={require('../../assets/reports_icon.png')} onPress={() => {}} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// no badge for simplified hours view

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  notifBadgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  scrollContent: { padding: 16, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: GREEN, fontWeight: '700', fontSize: 16 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBtn: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  monthText: { color: GREEN, fontWeight: '700' },
  monthLabel: { color: '#111827', fontWeight: '700' },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardLabel: { color: MUTED },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  cardBar: { height: 6, borderRadius: 4, marginTop: 10 },

  sectionCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginTop: 16 },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER, borderRadius: 8, marginVertical: 2 },
  clickableRow: { backgroundColor: '#FFFFFF', paddingHorizontal: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: GREEN, fontWeight: '700' },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  badge: { minWidth: 28, height: 24, borderRadius: 12, backgroundColor: '#E5F7F0', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  badgeText: { color: GREEN, fontWeight: '700' },
  empty: { color: MUTED, fontStyle: 'italic' },

  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 45,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
});

function SummaryCard({ label, value, tint }: { label: string; value: number | string; tint: string }) {
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: '#F3F4F6' }]}> 
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }]}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) || '').toUpperCase();
  return `${(parts[0]?.[0] || '').toUpperCase()}${(parts[1]?.[0] || '').toUpperCase()}`;
}

function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][((m % 12) + 12) % 12];
}

function BottomItem({ label, active, source, onPress }: { label: string; active?: boolean; source: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.bottomItem} activeOpacity={0.85} onPress={onPress}>
      <Image source={source} style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]} resizeMode="contain" />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>{label}</Text>
    </TouchableOpacity>
  );
}
