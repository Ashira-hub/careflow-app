import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, Modal, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type Report = {
  id: string;
  nurse: string;
  ward: string;
  date: string;
  hours: string; // e.g., 8h, 4h
  notes?: string;
};
type ScheduleItem = { id: string; nurse: string; title: string; date: string; startTime?: string; endTime?: string; note?: string };

export default function SupervisorReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year] = useState<number>(new Date().getFullYear());
  const [notificationCount, setNotificationCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const STORAGE_KEY = 'supervisor_schedules';
  const loadSchedules = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setSchedules(Array.isArray(arr) ? arr : []);
    } catch { setSchedules([]); }
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      loadSchedules();
      // Load notification count
      (async () => {
        try {
          const rawNotifications = await AsyncStorage.getItem('supervisor_notifications');
          const notifications = rawNotifications ? JSON.parse(rawNotifications) : [];
          const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.read).length : 0;
          setNotificationCount(unreadCount);
        } catch (error) {
          console.error('Error loading notification count:', error);
        }
        // Load avatar from session or stored avatar_<uid>
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
        // Log viewing reports
        try {
          const raw = await AsyncStorage.getItem('supervisor_activity');
          const arr = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed Reports', type: 'report', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
          await AsyncStorage.setItem('supervisor_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [loadSchedules])
  );

  const toHours = (start?: string, end?: string): number => {
    if (!start || !end) return 0;
    const m1 = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const m2 = end.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m1 || !m2) return 0;
    const toM = (m: RegExpMatchArray) => {
      let h = parseInt(m[1], 10) % 12;
      const mm = parseInt(m[2], 10);
      const ap = m[3].toUpperCase();
      if (ap === 'PM') h += 12;
      return h * 60 + mm;
    };
    const s = toM(m1), e = toM(m2);
    const diff = Math.max(0, e - s);
    return Math.round((diff / 60) * 10) / 10; // 1 decimal
  };

  const data: Report[] = useMemo(() => {
    const filtered = schedules.filter((s) => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return filtered.map((s) => ({
      id: s.id,
      nurse: s.nurse,
      ward: s.title,
      date: s.date,
      hours: `${toHours(s.startTime, s.endTime)}h`,
      notes: s.note,
    }));
  }, [schedules, month, year]);

  const metrics = useMemo(() => {
    const nurses = Array.from(new Set(data.map((d) => d.nurse))).length;
    const totalShifts = data.length;
    const totalHours = data.reduce((acc, d) => acc + (parseFloat(String(d.hours).replace(/h/i, '')) || 0), 0);
    return { nurses, totalShifts, totalHours };
  }, [data]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SupervisorNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {notificationCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, notificationCount)}</Text>
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
          {/* Title and Month Filter */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Reports</Text>
            <View style={styles.monthWrap}>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth((m) => (m + 11) % 12)}>
                <Text style={styles.monthText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthName(month)} {year}</Text>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth((m) => (m + 1) % 12)}>
                <Text style={styles.monthText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.cardsRow}>
            <SummaryCard label="Nurses" value={metrics.nurses} tint="#D1FAE5" />
            <SummaryCard label="Shifts" value={metrics.totalShifts} tint="#E0E7FF" />
          </View>
          <View style={styles.cardsRow}>
            <SummaryCard label="Total Hours" value={metrics.totalHours} tint="#FEF3C7" />
          </View>

          {/* Recent Reports */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            {data.length === 0 ? (
              <Text style={{ color: MUTED, textAlign: 'center', paddingVertical: 10 }}>No reports yet.</Text>
            ) : (
              data.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.avatar}> 
                    <Text style={styles.avatarText}>{initials(item.nurse)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.nurse}</Text>
                    <Text style={styles.meta}>Ward: {item.ward}  •  Date: {item.date}</Text>
                    <Text style={styles.meta}>Hours: {item.hours}{item.notes ? `  •  ${item.notes}` : ''}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('SupervisorProfile' as never); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try { await AsyncStorage.removeItem('session'); } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('SupervisorDashboard')} />
          <BottomItem label="Schedules" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('SupervisorSchedule')} />
          <BottomItem label="List" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('SupervisorList')} />
          <BottomItem label="Reports" active source={require('../../assets/reports_icon.png')} onPress={() => {}} />
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

function SummaryCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={[styles.card]}> 
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`;
}

function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][((m % 12) + 12) % 12];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { padding: 16, paddingBottom: 120 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 18 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBtn: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  monthText: { color: GREEN, fontWeight: '700' },
  monthLabel: { color: '#111827', fontWeight: '700' },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, backgroundColor: CARD_BG, borderColor: '#F3F4F6' },
  cardLabel: { color: MUTED },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4, color: GREEN },
  cardBar: { height: 6, borderRadius: 4, marginTop: 10 },

  sectionCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginTop: 16 },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: GREEN, fontWeight: '700' },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

