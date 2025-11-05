import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type Item = { id: string; nurse: string; title: string; station?: string; date: string; startTime?: string; endTime?: string; note?: string };
type Nurse = { id: string | number; name: string; role?: string; email?: string };

// API base (same host used elsewhere in the app)
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem('session');
    const base = { 'Content-Type': 'application/json' } as Record<string, string>;
    if (!raw) return base;
    const sess = JSON.parse(raw);
    const token = sess?.token || sess?.user?.token || sess?.accessToken;
    const uid = sess?.user?.id || sess?.id || sess?.user_id || sess?.uid;
    const withAuth = token ? { ...base, Authorization: `Bearer ${token}` } : base;
    return uid ? { ...withAuth, 'X-User-Id': String(uid) } : withAuth;
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

// Map server payload <-> Item
function mapFromApi(row: any): Item {
  return {
    id: String(row?.id ?? row?._id ?? Math.random().toString(36).slice(2)),
    nurse: row?.nurse ?? row?.nurse_name ?? '',
    title: row?.title ?? row?.ward ?? '',
    station: row?.station ?? undefined,
    date: row?.date ?? row?.scheduled_date ?? '',
    startTime: row?.startTime ?? row?.start_time ?? undefined,
    endTime: row?.endTime ?? row?.end_time ?? undefined,
    note: row?.note ?? row?.notes ?? undefined,
  };
}

function toApiPayload(it: Item) {
  return {
    nurse: it.nurse,
    title: it.title,
    station: it.station || null,
    date: it.date,
    startTime: it.startTime || null,
    endTime: it.endTime || null,
    note: it.note || null,
  };
}

async function apiListSchedules(): Promise<Item[] | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/schedules`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return arr.map(mapFromApi);
  } catch { return null; }
}

async function apiCreateSchedule(newItem: Item): Promise<Item | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/schedules`, { method: 'POST', headers, body: JSON.stringify(toApiPayload(newItem)) });
    if (!res.ok) return null;
    const data = await res.json();
    return mapFromApi(data);
  } catch { return null; }
}

async function apiUpdateSchedule(id: string, changes: Item): Promise<Item | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/schedules/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(toApiPayload(changes)) });
    if (!res.ok) return null;
    const data = await res.json();
    return mapFromApi(data);
  } catch { return null; }
}

async function apiDeleteSchedule(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    return res.ok;
  } catch { return false; }
}

export default function SupervisorSchedule() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const initial: Item[] = useMemo(() => ([]), []);
  const [items, setItems] = React.useState<Item[]>(initial);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [fNurse, setFNurse] = React.useState('');
  const [fTitle, setFTitle] = React.useState('');
  const [fStation, setFStation] = React.useState('');
  const [fDate, setFDate] = React.useState('');
  const [fStart, setFStart] = React.useState('');
  const [fEnd, setFEnd] = React.useState('');
  const [fNote, setFNote] = React.useState('');
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [timePicking, setTimePicking] = React.useState<'start' | 'end'>('start');
  const [selHour, setSelHour] = React.useState<number>(8);
  const [selMinute, setSelMinute] = React.useState<string>('00');
  const [selAmPm, setSelAmPm] = React.useState<'AM' | 'PM'>('AM');
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [nurses, setNurses] = React.useState<Nurse[]>([]);
  const [showNursePicker, setShowNursePicker] = React.useState(false);

  // Persistence (keep schedules across navigation)
  const STORAGE_KEY = 'supervisor_schedules';
  const loadSchedules = React.useCallback(async () => {
    setLoading(true);
    try {
      // Try API first
      const api = await apiListSchedules();
      if (api && Array.isArray(api)) {
        const normalized = api.map(it => {
          if (!it.station && typeof it.note === 'string' && /^\s*station\s*:/i.test(it.note)) {
            const s = it.note.replace(/^\s*station\s*:\s*/i, '').trim();
            return { ...it, station: s || undefined };
          }
          return it;
        });
        setItems(normalized);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return;
      }
      // Fallback to cache
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const normalized = arr.map((it: Item) => {
          if (!it.station && typeof it.note === 'string' && /^\s*station\s*:/i.test(it.note)) {
            const s = it.note.replace(/^\s*station\s*:\s*/i, '').trim();
            return { ...it, station: s || undefined };
          }
          return it;
        });
        setItems(normalized);
      } else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  const saveSchedules = React.useCallback(async (arr: Item[]) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {}
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
        // Load avatar
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
        // Log viewing schedules
        try {
          const raw = await AsyncStorage.getItem('supervisor_activity');
          const arr = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed Schedules', type: 'schedule', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
          await AsyncStorage.setItem('supervisor_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [loadSchedules])
  );

  // Calendar state
  const [current, setCurrent] = React.useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthMatrix = React.useMemo((): Array<Array<number | null>> => {
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

  // Time picker helpers
  const hours = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = React.useMemo((): string[] => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);
  const ampmList = React.useMemo((): Array<'AM' | 'PM'> => ['AM', 'PM'], []);
  const parseTime = (t?: string) => {
    const m = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m) {
      const hh = Math.min(12, Math.max(1, parseInt(m[1], 10)));
      const mm = m[2];
      const ap = m[3].toUpperCase() as 'AM' | 'PM';
      return { hh, mm, ap };
    }
    return null;
  };
  const fmtTime = (hh: number, mm: string, ap: 'AM' | 'PM') => `${hh}:${mm} ${ap}`;
  const openTime = (kind: 'start' | 'end') => {
    setTimePicking(kind);
    const src = kind === 'start' ? fStart : fEnd;
    const parsed = parseTime(src || undefined) || (kind === 'start' ? { hh: 8, mm: '00' as const, ap: 'AM' as const } : { hh: 5, mm: '00' as const, ap: 'PM' as const });
    setSelHour(parsed.hh);
    setSelMinute(parsed.mm);
    setSelAmPm(parsed.ap);
    setShowTimePicker(true);
  };

  const openNew = () => {
    setEditingId(null);
    setFNurse(''); setFTitle(''); setFDate(''); setFStart(''); setFEnd(''); setFNote('');
    setShowForm(true);
    // load nurses when opening the form
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = (Array.isArray(data) ? data : []).filter((u: any) => String(u.role || '').toLowerCase() === 'nurse');
          setNurses(list.map((u: any) => ({ id: u.id, name: u.name || u.full_name || u.fullName || '', role: u.role, email: u.email })));
        }
      } catch {}
    })();
  };
  const openEdit = (it: Item) => {
    setEditingId(it.id);
    setFNurse(it.nurse); setFTitle(it.title); setFStation(it.station || ''); setFDate(it.date); setFStart(it.startTime || ''); setFEnd(it.endTime || ''); setFNote(it.note || '');
    setShowForm(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = (Array.isArray(data) ? data : []).filter((u: any) => String(u.role || '').toLowerCase() === 'nurse');
          setNurses(list.map((u: any) => ({ id: u.id, name: u.name || u.full_name || u.fullName || '', role: u.role, email: u.email })));
        }
      } catch {}
    })();
  };
  const saveForm = () => {
    if (!fNurse || !fTitle || !fDate) {
      Alert.alert('Missing fields', 'Nurse, Title, and Date are required.');
      return;
    }
    if (editingId) {
      // Update via API then state/cache
      (async () => {
        const localUpdate: Item = { id: editingId, nurse: fNurse, title: fTitle, station: fStation || undefined, date: fDate, startTime: fStart || undefined, endTime: fEnd || undefined, note: fNote || undefined };
        const updated = await apiUpdateSchedule(editingId, localUpdate);
        setItems((prev) => {
          const apply = updated ?? localUpdate;
          const next = prev.map((x) => x.id === editingId ? apply : x);
          saveSchedules(next);
          return next;
        });
      })();
    } else {
      (async () => {
        const draft: Item = { id: Math.random().toString(36).slice(2), nurse: fNurse, title: fTitle, station: fStation || undefined, date: fDate, startTime: fStart || undefined, endTime: fEnd || undefined, note: fNote || undefined };
        const created = await apiCreateSchedule(draft);
        const toAdd = created ?? draft;
        setItems((prev) => {
          const next = [toAdd, ...prev];
          saveSchedules(next);
          return next;
        });
        pushNurseNotification(`New Schedule: ${fTitle}`, `${fNurse} • ${fDate}${fStart ? ` • ${fStart}` : ''}${fEnd ? ` - ${fEnd}` : ''}${fStation ? ` • Station: ${fStation}` : ''}${fNote ? ` • ${fNote}` : ''}`);
        // Log added schedule
        try {
          const raw = await AsyncStorage.getItem('supervisor_activity');
          const arr = raw ? JSON.parse(raw) : [];
          const entry = { id: String(Date.now()), title: `Added Schedule: ${fTitle}`, type: 'schedule', timestamp: Date.now() };
          const next = [entry, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
          await AsyncStorage.setItem('supervisor_activity', JSON.stringify(next));
        } catch {}
      })();
    }
    setShowForm(false);
  };

  const pushNurseNotification = async (title: string, message: string) => {
    try {
      const raw = await AsyncStorage.getItem('nurse_notifications');
      const arr = raw ? JSON.parse(raw) : [];
      const notif = { id: Math.random().toString(36).slice(2), title, message, timestamp: Date.now(), read: false };
      await AsyncStorage.setItem('nurse_notifications', JSON.stringify([notif, ...(Array.isArray(arr) ? arr : [])]));
    } catch {}
  };
  const deleteItem = (id: string) => {
    Alert.alert('Delete schedule', 'Are you sure you want to delete this schedule?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          // Try API delete, but remove locally regardless to keep UX snappy
          try { await apiDeleteSchedule(id); } catch {}
          setItems((prev) => { const next = prev.filter((x) => x.id !== id); saveSchedules(next); return next; });
        }
      },
    ]);
  };

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

          <FlatList
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, backgroundColor: CARD_BG }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading schedules...</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No schedules yet.</Text>
                )}
              </View>
            )}
            ListHeaderComponent={() => (
            <View style={{ paddingTop: 8, paddingBottom: 12 }}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Schedules</Text>
                <TouchableOpacity style={styles.newBtn} onPress={openNew} activeOpacity={0.85}>
                  <Text style={styles.newBtnText}>New Schedule</Text>
                </TouchableOpacity>
              </View>
              {/* Calendar Block */}
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
                  {monthMatrix.map((week, rIdx) => (
                    <View key={rIdx} style={styles.weekRow}>
                      {week.map((d, cIdx) => (
                        <View
                          key={`${rIdx}-${cIdx}`}
                          style={[styles.dayCell, d === null && styles.dayCellEmpty, isToday(d) && styles.dayCellToday]}
                        >
                          <Text style={[styles.dayText, d === null && styles.dayTextEmpty, isToday(d) && styles.dayTextToday]}>
                            {d ?? ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.sectionDivider} />
            </View>
          )}
          data={items}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSub}>Nurse: {item.nurse}</Text>
                  {!!item.station && <Text style={styles.cardSub}>Station: {item.station}</Text>}
                  <Text style={styles.cardSub}>Date: {item.date}</Text>
                  <Text style={styles.cardSub}>Time: {(item.startTime || '—')}{item.endTime ? ` - ${item.endTime}` : ''}</Text>
                </View>
                <View style={styles.actionsCol}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#3B82F6' }]} onPress={() => openEdit(item)}>
                    <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#EF4444' }]} onPress={() => deleteItem(item.id)}>
                    <Text style={[styles.actionText, { color: '#B91C1C' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
        {/* Create/Edit Form Modal */
        }
        <Modal visible={showForm} animationType="fade" transparent onRequestClose={() => setShowForm(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}> 
                <Text style={styles.modalTitle}>{editingId ? 'Edit Schedule' : 'New Schedule'}</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowForm(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                <View>
                  <Text style={styles.inputLabel}>Nurse</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      placeholder={nurses.length ? 'Select nurse' : 'No nurses found'}
                      value={fNurse}
                      editable={false}
                      style={[styles.input, { paddingRight: 40, backgroundColor: '#F3F4F6' }]}
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowNursePicker((v) => !v)}>
                      <Image source={require('../../assets/dropdown.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                    {showNursePicker && (
                      <View style={[styles.inlineDropdown, styles.dropdownPanel]}>
                        {nurses.length === 0 ? (
                          <Text style={{ color: MUTED, textAlign: 'center', paddingVertical: 8 }}>No nurses found.</Text>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.optionItem} onPress={() => { setFNurse(''); setShowNursePicker(false); }}>
                              <Text style={[styles.optionText, { color: MUTED }]}>---|---</Text>
                            </TouchableOpacity>
                            {nurses.map((n) => (
                              <TouchableOpacity key={String(n.id)} style={styles.optionItem} onPress={() => { setFNurse(n.name); setShowNursePicker(false); }}>
                                <Text style={styles.optionText}>{n.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                <View>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput value={fTitle} onChangeText={setFTitle} placeholder="e.g. Shift A" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Station</Text>
                  <TextInput value={fStation} onChangeText={setFStation} placeholder="e.g. Station 1" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Date</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput value={fDate} onChangeText={setFDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" style={[styles.input, { paddingRight: 40 }]} />
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowDatePicker(true)}>
                      <Image source={require('../../assets/appointment_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <View style={styles.inputWithIcon}>
                      <TextInput value={fStart} onChangeText={setFStart} placeholder="08:00 AM" placeholderTextColor="#9CA3AF" style={[styles.input, { paddingRight: 40 }]} />
                      <TouchableOpacity style={styles.iconOverlay} onPress={() => openTime('start')}>
                        <Image source={require('../../assets/time_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <View style={styles.inputWithIcon}>
                      <TextInput value={fEnd} onChangeText={setFEnd} placeholder="05:00 PM" placeholderTextColor="#9CA3AF" style={[styles.input, { paddingRight: 40 }]} />
                      <TouchableOpacity style={styles.iconOverlay} onPress={() => openTime('end')}>
                        <Image source={require('../../assets/time_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View>
                  <Text style={styles.inputLabel}>Note</Text>
                  <TextInput value={fNote} onChangeText={setFNote} placeholder="Optional notes" placeholderTextColor="#9CA3AF" style={[styles.input, { height: 80 }]} multiline />
                </View>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={[styles.formBtn, { borderColor: '#6B7280' }]} onPress={() => setShowForm(false)}>
                  <Text style={[styles.formBtnText, { color: '#374151' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, { borderColor: GREEN }]} onPress={saveForm}>
                  <Text style={[styles.formBtnText, { color: GREEN }]}>{editingId ? 'Save Changes' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Nurse inline dropdown rendered above; no modal */}

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
                        style={[styles.dayCell, d === null && styles.dayCellEmpty, isToday(d) && styles.dayCellToday, isPastCalendarDate(d) && styles.dayCellDisabled]}
                        disabled={d === null || isPastCalendarDate(d)}
                        onPress={() => {
                          if (d) {
                            const mm = String(month + 1).padStart(2, '0');
                            const dd = String(d).padStart(2, '0');
                            setFDate(`${year}-${mm}-${dd}`);
                            setShowDatePicker(false);
                          }
                        }}
                      >
                        <Text style={[styles.dayText, d === null && styles.dayTextEmpty, isToday(d) && styles.dayTextToday, isPastCalendarDate(d) && styles.dayTextDisabled]}>{d ?? ''}</Text>
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
            <View style={[styles.modalCard, { maxWidth: 420 }]}> 
              <View style={styles.modalHeader}> 
                <Text style={styles.modalTitle}>Select Time</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeColLabel}>Hour</Text>
                  <FlatList
                    data={hours}
                    keyExtractor={(t) => `h-${t}`}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[styles.timeItem, selHour === item && styles.timeItemActive]} onPress={() => setSelHour(item)}>
                        <Text style={[styles.timeText, selHour === item && styles.timeTextActive]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.timeColLabel}>Minute</Text>
                  <FlatList
                    data={minutes}
                    keyExtractor={(t) => `m-${t}`}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[styles.timeItem, selMinute === item && styles.timeItemActive]} onPress={() => setSelMinute(item)}>
                        <Text style={[styles.timeText, selMinute === item && styles.timeTextActive]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.timeColLabel}>AM/PM</Text>
                  <FlatList
                    data={ampmList}
                    keyExtractor={(t) => `ap-${t}`}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[styles.timeItem, selAmPm === item && styles.timeItemActive]} onPress={() => setSelAmPm(item)}>
                        <Text style={[styles.timeText, selAmPm === item && styles.timeTextActive]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity style={[styles.formBtn, { borderColor: '#6B7280' }]} onPress={() => setShowTimePicker(false)}>
                  <Text style={[styles.formBtnText, { color: '#374151' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, { borderColor: GREEN }]}
                  onPress={() => {
                    const v = fmtTime(selHour, selMinute, selAmPm);
                    if (timePicking === 'start') setFStart(v); else setFEnd(v);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[styles.formBtnText, { color: GREEN }]}>Set Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('SupervisorDashboard')} />
          <BottomItem label="Schedules" active source={require('../../assets/appointment_icon.png')} onPress={() => {}} />
          <BottomItem label="List" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('SupervisorList' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('SupervisorReports' as never)} />
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
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  title: { fontSize: 18, fontWeight: '700', color: GREEN },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8 },
  calendarBlock: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12, marginTop: 10, marginBottom: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { color: '#111827', fontWeight: '800' },
  cardSub: { color: MUTED, marginTop: 4, fontSize: 12 },
  actionsCol: { gap: 8 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF' },
  actionText: { fontWeight: '700' },
  newBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  newBtnText: { color: GREEN, fontWeight: '700' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, overflow: 'visible' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  inputLabel: { color: MUTED, marginBottom: 4, fontSize: 12 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  inputWithIcon: { position: 'relative' },
  pickerWrap: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#FFFFFF', height: 44, justifyContent: 'center', paddingHorizontal: 4 },
  inlineDropdown: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownPanel: { position: 'absolute', left: 0, right: 0, top: 46, zIndex: 20, elevation: 5, maxHeight: 200 },
  optionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  optionText: { color: '#111827' },
  iconOverlay: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 32, alignItems: 'center', justifyContent: 'center' },
  inlineIcon: { width: 18, height: 18, tintColor: GREEN },
  row2: { flexDirection: 'row', alignItems: 'flex-start' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  formBtn: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, backgroundColor: '#FFFFFF' },
  formBtnText: { fontWeight: '700' },

  // Calendar styles (date picker)
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
  dayCellDisabled: { backgroundColor: '#F3F4F6' },
  dayText: { color: '#111827', fontSize: 12 },
  dayTextEmpty: { color: MUTED },
  dayTextToday: { color: GREEN, fontWeight: '700' },
  dayTextDisabled: { color: '#D1D5DB' },

  // Time list styles (time picker)
  timePickerRow: { flexDirection: 'row', gap: 10, maxHeight: 260 },
  timeCol: { flex: 1 },
  timeColLabel: { color: MUTED, fontSize: 12, marginBottom: 8 },
  timeItem: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#FFFFFF' },
  timeItemActive: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  timeText: { color: '#111827', fontWeight: '700' },
  timeTextActive: { color: GREEN },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },

  // Loading styles
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  emptyText: { color: MUTED, fontSize: 14, textAlign: 'center' },
});

/* Form Modal */
// Placed after styles for clarity; uses same file-scoped styles
// We add JSX for the modal at the end of the component tree above bottom bar
