import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  FlatList,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type ScheduleItem = {
  id: string;
  title: string;
  time?: string; // legacy
  date?: string;
  startTime?: string;
  endTime?: string;
  patient?: string;
  note?: string;
};

export default function NurseSchedule() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initial: ScheduleItem[] = useMemo(() => {
    const fromParams: ScheduleItem[] = (route?.params?.schedules as any) || [];
    if (Array.isArray(fromParams) && fromParams.length) return fromParams;
    return [];
  }, [route?.params]);

  const [items, setItems] = useState<ScheduleItem[]>(initial);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [rqTitle, setRqTitle] = useState('');
  const [rqDate, setRqDate] = useState('');
  const [rqStart, setRqStart] = useState('');
  const [rqEnd, setRqEnd] = useState('');
  const [rqPatient, setRqPatient] = useState('');
  const [rqNote, setRqNote] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load approved schedules from storage when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('nurse_schedules');
          const arr: any[] = raw ? JSON.parse(raw) : [];
          const mapped: ScheduleItem[] = (Array.isArray(arr) ? arr : []).map((r: any) => ({
            id: String(r.id || Date.now()),
            title: String(r.title || ''),
            date: r.date || undefined,
            startTime: r.startTime || undefined,
            endTime: r.endTime || undefined,
            patient: r.patient || undefined,
            note: r.note || undefined,
          }));
          setItems(mapped);
        } catch {
          // ignore
        }
        // Load avatar from storage
        try {
          const rawSession = await AsyncStorage.getItem('session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            if (uid) {
              const stored = await AsyncStorage.getItem(`avatar_${uid}`);
              setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
            } else {
              setAvatarUri(user?.avatar_uri || user?.avatarUrl || undefined);
            }
          }
        } catch {}
        // Load unread notifications
        try {
          const rawN = await AsyncStorage.getItem('nurse_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Log activity for viewing schedules
        try {
          const raw = await AsyncStorage.getItem('nurse_activity');
          const arr: any[] = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed Schedule', type: 'schedule', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
          await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const submitRequest = () => {
    if (!rqTitle.trim()) {
      Alert.alert('Validation', 'Please enter a title');
      return;
    }
    const newItem: ScheduleItem = {
      id: String(Date.now()),
      title: rqTitle.trim(),
      date: rqDate.trim() || undefined,
      startTime: rqStart.trim() || undefined,
      endTime: rqEnd.trim() || undefined,
      patient: rqPatient.trim() || undefined,
      note: rqNote.trim() || undefined,
    };

    setItems((prev) => [newItem, ...prev]);
    setShowRequest(false);
    setRqTitle('');
    setRqDate('');
    setRqStart('');
    setRqEnd('');
    setRqPatient('');
    setRqNote('');
    Alert.alert('Request Submitted', 'Your schedule request has been added.');
  };

  // Calendar state (same pattern as doctor_appointment)
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthMatrix = useMemo((): Array<Array<number | null>> => {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = 42; // 6x7
    const matrix: Array<number | null> = Array(cells).fill(null);
    for (let d = 1; d <= daysInMonth; d++) matrix[startWeekday + (d - 1)] = d;
    const rows: Array<Array<number | null>> = [];
    for (let i = 0; i < cells; i += 7) rows.push(matrix.slice(i, i + 7));
    return rows;
  }, [year, month]);
  const today = new Date();
  const isToday = (d: number | null) => d !== null && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

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
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
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

        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Schedule</Text>
                <TouchableOpacity style={styles.requestBtn} onPress={() => navigation.navigate('NurseRequest')}>
                  <Text style={styles.requestText}>Request</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sectionDivider} />

              {/* Calendar */}
              <View style={styles.calendarBlock}>
                <View style={styles.monthRow}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => setCurrent(new Date(year, month - 1, 1))}>
                    <Text style={styles.navText}>{'<'}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.monthText}>{monthNames[month]}</Text>
                    <Text style={styles.yearText}>{year}</Text>
                  </View>
                  <TouchableOpacity style={styles.navBtn} onPress={() => setCurrent(new Date(year, month + 1, 1))}>
                    <Text style={styles.navText}>{'>'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.weekHeader}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                    <Text key={d} style={styles.weekText}>{d}</Text>
                  ))}
                </View>
                <View style={styles.daysGrid}>
                  {monthMatrix.map((week: Array<number | null>, rIdx: number) => (
                    <View key={rIdx} style={styles.weekRow}>
                      {week.map((d: number | null, cIdx: number) => (
                        <View key={`${rIdx}-${cIdx}`} style={[styles.dayCell, d === null && styles.dayCellEmpty, isToday(d) && styles.dayCellToday]}>
                          <Text style={[styles.dayText, d === null && styles.dayTextEmpty, isToday(d) && styles.dayTextToday]}>{d ?? ''}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionDivider} />
              <Text style={styles.cardTitle}>Schedule List</Text>
            </>
          }
          ListEmptyComponent={() => (
            <View style={{ paddingVertical: 12 }}>
              <Text style={{ color: MUTED, textAlign: 'center' }}>No schedule yet.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}> 
                <View style={styles.iconWrap}>
                  <Image source={require('../../assets/appointment_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {(item.date) && (
                    <Text style={styles.rowSub}>Date: {item.date}</Text>
                  )}
                  {(item.startTime || item.endTime) ? (
                    <Text style={styles.rowSub}>Time: {item.startTime || ''}{item.endTime ? ` - ${item.endTime}` : ''}</Text>
                  ) : (
                    !!item.time && <Text style={styles.rowSub}>Time: {item.time}</Text>
                  )}
                  {!!item.patient && <Text style={styles.rowSub}>Station: {item.patient}</Text>}
                  {!!item.note && <Text style={styles.rowSub}>{item.note}</Text>}
                </View>
              </View>
            </View>
          )}
        />

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard')} />
          <BottomItem label="Schedule" active source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NursePrescription')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('NursePrescription')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('NurseReports')} />
        </View>

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
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 110 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, textAlign: 'left', flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  requestBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: GREEN, borderRadius: 10, backgroundColor: '#FFFFFF' },
  requestText: { color: GREEN, fontWeight: '700' },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8, marginBottom: 12 },

  card: { backgroundColor: CARD_BG, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: BORDER },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },

  // Calendar styles
  calendarBlock: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10, backgroundColor: '#FFFFFF' },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  monthText: { fontSize: 18, color: '#111827' },
  yearText: { fontSize: 18, color: '#111827' },
  navBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  navText: { fontSize: 16, color: GREEN, fontWeight: '700' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: MUTED, fontSize: 12 },
  daysGrid: { flexDirection: 'column' },
  weekRow: { flexDirection: 'row' },
  dayCell: { width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: BORDER },
  dayCellEmpty: { backgroundColor: '#F9FAFB' },
  dayCellToday: { borderColor: GREEN, borderWidth: 1.5, borderRadius: 6 },
  dayText: { color: '#111827', fontSize: 12 },
  dayTextEmpty: { color: MUTED },
  dayTextToday: { color: GREEN, fontWeight: '700' },

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

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  formGroup: { marginTop: 10 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', backgroundColor: '#FFFFFF' },
  row2: { flexDirection: 'row', alignItems: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  cancelBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER },
  saveBtn: { backgroundColor: GREEN },
  cancelText: { color: MUTED, fontWeight: '700' },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
});

