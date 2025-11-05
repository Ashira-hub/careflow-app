import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalImmediateNotification } from '../../utils/notifications';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function NurseRequest() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [patient, setPatient] = useState('');
  const [note, setNote] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeTarget, setTimeTarget] = useState<'start' | 'end'>('start');
  const [tpHour, setTpHour] = useState<number>((new Date().getHours() % 12) || 12);
  const [tpMinute, setTpMinute] = useState<number>(Math.floor(new Date().getMinutes() / 5) * 5);
  const [tpPeriod, setTpPeriod] = useState<'AM' | 'PM'>(new Date().getHours() >= 12 ? 'PM' : 'AM');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);

  // Calendar state (mirrors doctor_appointment)
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
  const isPastCalendarDate = (d: number | null) => {
    if (d === null) return true;
    const cand = new Date(year, month, d);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cand < start;
  };

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

  const formatTimeString = React.useCallback((hour: number, minute: number, period: 'AM' | 'PM') => {
    const safeHour = ((hour - 1 + 12) % 12) + 1;
    const safeMinute = ((minute % 60) + 60) % 60;
    return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')} ${period}`;
  }, []);

  const toMinutesOfDay = React.useCallback((hour: number, minute: number, period: 'AM' | 'PM') => {
    const safeMinute = ((minute % 60) + 60) % 60;
    let h = hour % 12;
    if (period === 'PM') h += 12;
    return h * 60 + safeMinute;
  }, []);

  const fromMinutesOfDay = React.useCallback((total: number) => {
    const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour: hour12, minute, period };
  }, []);

  const openTimePicker = React.useCallback((target: 'start' | 'end') => {
    setTimeTarget(target);
    const value = target === 'start' ? start : end;
    const parsed = parseTimeString(value);
    if (parsed) {
      setTpHour(parsed.hour);
      setTpMinute(parsed.minute);
      setTpPeriod(parsed.period);
    } else {
      const now = new Date();
      let minutes = now.getHours() * 60 + now.getMinutes();
      minutes = Math.round(minutes / 5) * 5;
      const next = fromMinutesOfDay(minutes);
      setTpHour(next.hour);
      setTpMinute(next.minute);
      setTpPeriod(next.period);
    }
    setShowTimePicker(true);
  }, [start, end, parseTimeString, fromMinutesOfDay]);

  const adjustHour = React.useCallback((delta: number) => {
    const total = toMinutesOfDay(tpHour, tpMinute, tpPeriod) + delta * 60;
    const next = fromMinutesOfDay(total);
    setTpHour(next.hour);
    setTpMinute(next.minute);
    setTpPeriod(next.period);
  }, [tpHour, tpMinute, tpPeriod, toMinutesOfDay, fromMinutesOfDay]);

  const adjustMinute = React.useCallback((delta: number) => {
    const total = toMinutesOfDay(tpHour, tpMinute, tpPeriod) + delta;
    const next = fromMinutesOfDay(total);
    setTpHour(next.hour);
    setTpMinute(next.minute);
    setTpPeriod(next.period);
  }, [tpHour, tpMinute, tpPeriod, toMinutesOfDay, fromMinutesOfDay]);

  const applyTimeSelection = React.useCallback(() => {
    const formatted = formatTimeString(tpHour, tpMinute, tpPeriod);
    if (timeTarget === 'start') setStart(formatted);
    else setEnd(formatted);
    setShowTimePicker(false);
  }, [tpHour, tpMinute, tpPeriod, timeTarget, formatTimeString]);

  // Load avatar on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('session');
          if (raw) {
            const sess = JSON.parse(raw);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
            setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
          }
        } catch {}
        // load unread notifications count
        try {
          const rawN = await AsyncStorage.getItem('nurse_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
      })();
      return () => {};
    }, [])
  );

  const addActivity = React.useCallback(async (title: string) => {
    try {
      const raw = await AsyncStorage.getItem('nurse_activity');
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const next = [{ id: String(Date.now()), title, type: 'request', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
      await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
    } catch {}
  }, []);

  const submit = () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a title');
      return;
    }
    const newSchedule = {
      id: String(Date.now()),
      title: title.trim(),
      date: date.trim() || undefined,
      startTime: start.trim() || undefined,
      endTime: end.trim() || undefined,
      patient: patient.trim() || undefined,
      note: note.trim() || undefined,
    };
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('supervisor_notifications');
        const arr = raw ? JSON.parse(raw) : [];
        // Try to get nurse name from session
        let fromName = 'Nurse';
        try {
          const sessRaw = await AsyncStorage.getItem('session');
          if (sessRaw) {
            const sess = JSON.parse(sessRaw);
            fromName = sess?.user?.full_name || sess?.user?.name || sess?.full_name || sess?.name || 'Nurse';
          }
        } catch {}
        const notif = {
          id: `SN-${Date.now()}`,
          title: 'New schedule request',
          message: `${title.trim()}${date ? ` on ${date}` : ''}${start || end ? `, ${start || ''}${end ? ` - ${end}` : ''}` : ''}${patient ? ` • Station: ${patient}` : ''}${note ? ` • ${note}` : ''}`,
          timestamp: Date.now(),
          read: false,
          from: fromName,
          details: {
            title: title.trim(),
            date: date.trim() || '',
            startTime: start.trim() || '',
            endTime: end.trim() || '',
            station: patient.trim() || '',
            notes: note.trim() || '',
          },
        };
        const next = [notif, ...Array.isArray(arr) ? arr : []];
        await AsyncStorage.setItem('supervisor_notifications', JSON.stringify(next));
        try { await showLocalImmediateNotification('New schedule request', notif.message); } catch {}
      } catch {}
      addActivity(`Submitted request: ${title.trim()}`);
      navigation.navigate('NurseSchedule', { newSchedule });
    })();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
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

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Request Schedule</Text>
              <TouchableOpacity style={styles.backBtnCorner} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                <Text style={styles.backText}>{'<'} Back</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formGroup}> 
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput placeholder="Afternoon shift" value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor="#9CA3AF" />
              </View>
              <View style={styles.row2}> 
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput placeholder="Date" value={date} onChangeText={setDate} style={[styles.input, { paddingRight: 40 }]} placeholderTextColor="#9CA3AF" />
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowDatePicker(true)}>
                      <Image source={require('../../assets/appointment_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Station</Text>
                  <TextInput placeholder="Station" value={patient} onChangeText={setPatient} style={styles.input} placeholderTextColor="#9CA3AF" />
                </View>
              </View>
              <View style={styles.row2}> 
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput placeholder="03:30 AM" value={start} onChangeText={setStart} style={[styles.input, { paddingRight: 40 }]} placeholderTextColor="#9CA3AF" />
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => openTimePicker('start')}>
                      <Image source={require('../../assets/time_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput placeholder="04:00 PM" value={end} onChangeText={setEnd} style={[styles.input, { paddingRight: 40 }]} placeholderTextColor="#9CA3AF" />
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => openTimePicker('end')}>
                      <Image source={require('../../assets/time_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.formGroup}> 
                <Text style={styles.inputLabel}>Note</Text>
                <TextInput placeholder="Additional details (optional)" value={note} onChangeText={setNote} style={[styles.input, { height: 90, textAlignVertical: 'top' }]} placeholderTextColor="#9CA3AF" multiline />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.9}>
                <Text style={styles.submitText}>SUBMIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard')} />
          <BottomItem label="Schedule" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NurseSchedule')} />
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

        {/* Date Picker Modal */}
        <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 420 }]}> 
              <View style={styles.modalHeader}> 
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
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
                      <TouchableOpacity
                        key={`${rIdx}-${cIdx}`}
                        style={[
                          styles.dayCell,
                          d === null && styles.dayCellEmpty,
                          isToday(d) && styles.dayCellToday,
                          isPastCalendarDate(d) && styles.dayCellDisabled,
                        ]}
                        disabled={d === null || isPastCalendarDate(d)}
                        onPress={() => {
                          if (d) {
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(d).padStart(2, '0');
                            setDate(`${year}-${mm}-${dd}`);
                            setShowDatePicker(false);
                          }
                        }}
                      >
                        <Text style={[
                          styles.dayText,
                          d === null && styles.dayTextEmpty,
                          isToday(d) && styles.dayTextToday,
                          isPastCalendarDate(d) && styles.dayTextDisabled,
                        ]}>{d ?? ''}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 360 }]}> 
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {timeTarget === 'start' ? 'Start' : 'End'} Time</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timePickerRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Hour</Text>
                  <View style={styles.timeAdjustRow}>
                    <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustHour(1)}>
                      <Text style={styles.timeAdjustText}>▲</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>{String(tpHour).padStart(2, '0')}</Text>
                    <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustHour(-1)}>
                      <Text style={styles.timeAdjustText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Minute</Text>
                  <View style={styles.timeAdjustRow}>
                    <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustMinute(5)}>
                      <Text style={styles.timeAdjustText}>▲</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>{String(tpMinute).padStart(2, '0')}</Text>
                    <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustMinute(-5)}>
                      <Text style={styles.timeAdjustText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Period</Text>
                  <View style={styles.periodToggle}>
                    <TouchableOpacity
                      style={[styles.periodBtn, tpPeriod === 'AM' && styles.periodBtnActive]}
                      onPress={() => setTpPeriod('AM')}
                    >
                      <Text style={[styles.periodText, tpPeriod === 'AM' && styles.periodTextActive]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.periodBtn, tpPeriod === 'PM' && styles.periodBtnActive]}
                      onPress={() => setTpPeriod('PM')}
                    >
                      <Text style={[styles.periodText, tpPeriod === 'PM' && styles.periodTextActive]}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.timeSummaryRow}>
                <Text style={styles.timeSummaryLabel}>Selected Time</Text>
                <Text style={styles.timeSummaryValue}>{formatTimeString(tpHour, tpMinute, tpPeriod)}</Text>
              </View>

              <View style={styles.timeModalButtons}>
                <TouchableOpacity style={[styles.timeActionBtn, styles.timeCancelBtn]} onPress={() => setShowTimePicker(false)}>
                  <Text style={[styles.timeActionText, { color: MUTED }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.timeActionBtn, styles.timeSaveBtn]} onPress={applyTimeSelection}>
                  <Text style={[styles.timeActionText, { color: '#FFFFFF' }]}>Set Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtnCorner: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  backText: { color: GREEN, fontWeight: '700' },
  formCard: { marginTop: 12, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  formGroup: { marginTop: 10 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  row2: { flexDirection: 'row', alignItems: 'center' },
  submitBtn: { marginTop: 16, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 28, minWidth: 180, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '700' },

  // Bottom bar styles
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

  // Modal container styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },

  // Inline icon styles
  inputWithIcon: { position: 'relative' },
  iconOverlay: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 32, alignItems: 'center', justifyContent: 'center' },
  inlineIcon: { width: 18, height: 18, tintColor: GREEN },

  // Calendar styles (modal)
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
  dayCellDisabled: { backgroundColor: '#F3F4F6' },
  dayTextDisabled: { color: '#D1D5DB' },

  // Time picker styles
  timePickerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeColumn: { flex: 1, alignItems: 'center' },
  timeLabel: { color: MUTED, fontSize: 12, marginBottom: 6 },
  timeAdjustRow: { alignItems: 'center', gap: 6 },
  timeAdjustBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
  timeAdjustText: { color: GREEN, fontWeight: '700' },
  timeValue: { fontSize: 22, fontWeight: '700', color: '#111827', minWidth: 40, textAlign: 'center' },
  periodToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 999, overflow: 'hidden' },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  periodBtnActive: { backgroundColor: GREEN },
  periodText: { color: GREEN, fontWeight: '700' },
  periodTextActive: { color: '#FFFFFF' },
  timeSummaryRow: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeSummaryLabel: { color: MUTED },
  timeSummaryValue: { color: GREEN, fontWeight: '700', fontSize: 16 },
  timeModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  timeActionBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  timeCancelBtn: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  timeSaveBtn: { backgroundColor: GREEN },
  timeActionText: { fontWeight: '700' },
});

