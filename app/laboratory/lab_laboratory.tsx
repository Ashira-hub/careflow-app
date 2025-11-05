import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type TestItem = {
  id: string;
  name: string;
  category: 'Hematology' | 'Chemistry' | 'Microbiology';
  patient: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  requestedOn: string;
  notes?: string;
};

export default function LabLaboratory() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<'All' | TestItem['category']>('All');
  const [showDetails, setShowDetails] = React.useState(false);
  const [selected, setSelected] = React.useState<TestItem | null>(null);

  const [tests, setTests] = React.useState<TestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<string, string>;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const uid = sess?.user?.id || sess?.user_id || sess?.id;
      const headers = token ? { ...base, Authorization: `Bearer ${token}` } : base;
      return uid ? { ...headers, 'X-User-Id': String(uid) } : headers;
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  const [showAdd, setShowAdd] = React.useState(false);
  const [formName, setFormName] = React.useState('');
  const [formPatient, setFormPatient] = React.useState('');
  const [formCategory, setFormCategory] = React.useState<TestItem['category']>('Hematology');
  const [formStatus, setFormStatus] = React.useState<TestItem['status']>('Pending');
  const [formDate, setFormDate] = React.useState('');
  const [formNotes, setFormNotes] = React.useState('');

  // Calendar state for Requested On
  const today = React.useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [pickerMonth, setPickerMonth] = React.useState<number>(new Date().getMonth());
  const [pickerYear, setPickerYear] = React.useState<number>(new Date().getFullYear());
  const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const categories: Array<'All' | TestItem['category']> = ['All', 'Hematology', 'Chemistry', 'Microbiology'];
  const filtered = React.useMemo(() => {
    return tests.filter(t => (category === 'All' || t.category === category) && (t.name.toLowerCase().includes(query.toLowerCase()) || t.patient.toLowerCase().includes(query.toLowerCase())));
  }, [tests, category, query]);

  const openDetails = (it: TestItem) => { setSelected(it); setShowDetails(true); };

  

  // Load and save lab results to persist across navigation and login
  const loadLabResults = React.useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('lab_results');
      const arr = raw ? JSON.parse(raw) : [];
      setTests(Array.isArray(arr) ? arr : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const saveLabResults = React.useCallback(async (list: TestItem[]) => {
    try {
      await AsyncStorage.setItem('lab_results', JSON.stringify(list));
    } catch {}
  }, []);

  const findServerLabTestId = React.useCallback(async (test: TestItem): Promise<number | null> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/lab-tests`, { headers });
      if (!res.ok) return null;
      const rows = await res.json();
      const match = Array.isArray(rows) ? rows.find((r: any) =>
        String(r.test_name || '').trim().toLowerCase() === test.name.trim().toLowerCase() &&
        String(r.patient || '').trim().toLowerCase() === test.patient.trim().toLowerCase() &&
        String(r.date || '').trim() === test.requestedOn.trim()
      ) : null;
      return match ? Number(match.id) : null;
    } catch { return null; }
  }, [API_BASE, getAuthHeaders]);

  const updateServerStatus = React.useCallback(async (test: TestItem, status: TestItem['status']): Promise<boolean> => {
    try {
      const id = await findServerLabTestId(test);
      if (!id) return false;
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/lab-tests/${id}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch { return false; }
  }, [API_BASE, getAuthHeaders, findServerLabTestId]);

  const setStatusForSelected = React.useCallback(async (nextStatus: TestItem['status']) => {
    try {
      const sel = selected;
      if (!sel) return;
      const ok = await updateServerStatus(sel, nextStatus);
      if (!ok) { Alert.alert('Update Failed', 'Could not update status on server.'); return; }
      setSelected({ ...sel, status: nextStatus });
      setTests(prev => {
        const next = prev.map(t => t.id === sel.id ? { ...t, status: nextStatus } : t);
        saveLabResults(next);
        return next;
      });
      setShowDetails(false);
    } catch {}
  }, [selected, saveLabResults, updateServerStatus]);

  const completeSelected = React.useCallback(async () => {
    try {
      const sel = selected;
      if (!sel) return;
      const ok = await updateServerStatus(sel, 'Completed');
      if (!ok) { Alert.alert('Update Failed', 'Could not mark as completed on server.'); return; }
      setTests(prev => {
        const next = prev.filter(t => t.id !== sel.id);
        saveLabResults(next);
        return next;
      });
      setSelected(null);
      setShowDetails(false);
    } catch {}
  }, [selected, saveLabResults, updateServerStatus]);

  useFocusEffect(
    React.useCallback(() => {
      loadLabResults();
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
        // Load unread lab notifications count
        try {
          const rawN = await AsyncStorage.getItem('lab_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Log recent activity: Viewed Laboratory
        try {
          const rawA = await AsyncStorage.getItem('lab_activity');
          const arrA = rawA ? JSON.parse(rawA) : [];
          const entry = { id: String(Date.now()), title: 'Viewed Laboratory', timestamp: Date.now(), type: 'lab' };
          const next = [entry, ...(Array.isArray(arrA) ? arrA : [])].slice(0, 50);
          await AsyncStorage.setItem('lab_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [loadLabResults])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('LabNotification' as never)}>
              <View style={{ position: 'relative' }}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', right: -6, top: -6, minWidth: 14, height: 14, paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                  </View>
                )}
              </View>
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

        {/* Scrollable Tests list with header */}
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View>
              <Text style={styles.title}>Laboratory</Text>
              <View style={styles.sectionDivider} />

              <View style={styles.searchRow}>
                <View style={styles.searchWrap}>
                  <Image source={require('../../assets/search_icon.png')} style={styles.searchIcon} resizeMode="contain" />
                  <TextInput
                    placeholder="Search patient or test"
                    placeholderTextColor={MUTED}
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                  />
                </View>
                <TouchableOpacity style={[styles.refreshBtn, { borderColor: GREEN }]} onPress={() => setShowAdd(true)}>
                  <Text style={styles.refreshText}>+</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {categories.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {loading ? (
                <>
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading laboratory tests...</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No laboratory tests found.</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.9}
              onPress={() => openDetails(item)}
            >
              <View style={styles.rowLeft}>
                <Image source={require('../../assets/lab_icon.png')} style={styles.rowIcon} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta}>Patient: {item.patient}  •  {item.category}</Text>
                <Text style={styles.rowMeta}>Requested: {item.requestedOn}</Text>
              </View>
              <View style={[styles.badge, badgeTint(item.status)]}><Text style={styles.badgeText}>{item.status}</Text></View>
            </TouchableOpacity>
          )}
        />

        {/* Details Modal */}
        <Modal
          visible={!!selected && showDetails}
          animationType="fade"
          transparent
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setShowDetails(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Test Details</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              {!!selected && (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.bigAvatar}>
                      <Text style={styles.bigAvatarText}>{initials(selected.patient)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName} numberOfLines={1}>{selected.patient}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {!!selected.requestedOn && <Text style={styles.detailMeta}>Requested: {selected.requestedOn}</Text>}
                        <View style={[styles.statusBadge, badgeTint(selected.status)]}>
                          <Text style={styles.statusBadgeText}>{selected.status}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={{ gap: 10 }}>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Test</Text>
                      <Text style={styles.fieldValue}>{selected.name || '-'}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Patient</Text>
                      <Text style={styles.fieldValue}>{selected.patient || '-'}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Category</Text>
                      <Text style={styles.fieldValue}>{selected.category || '-'}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Requested On</Text>
                      <Text style={styles.fieldValue}>{selected.requestedOn || '-'}</Text>
                    </View>
                    {!!selected.notes && (
                      <View style={styles.notesBox}>
                        <Text style={styles.fieldLabel}>Notes</Text>
                        <Text style={styles.notesText}>{selected.notes}</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowDetails(false)}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={() => setStatusForSelected('In Progress')}>
                      <Text style={styles.modalSaveText}>In Progress</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={completeSelected}>
                      <Text style={styles.modalSaveText}>Complete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Requested On: Calendar Date Picker */}
        <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.calendarCard}>
              <View style={styles.calHeader}>
                <TouchableOpacity
                  style={[styles.calNavBtn, !((pickerYear > today.getFullYear()) || (pickerYear === today.getFullYear() && pickerMonth > today.getMonth())) && { opacity: 0.4 }]}
                  disabled={!((pickerYear > today.getFullYear()) || (pickerYear === today.getFullYear() && pickerMonth > today.getMonth()))}
                  onPress={() => {
                    if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(pickerYear - 1); }
                    else { setPickerMonth(pickerMonth - 1); }
                  }}
                >
                  <Text style={styles.calNavText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.calTitleContainer}>
                  <Text style={styles.calTitle}>{new Date(pickerYear, pickerMonth).toLocaleString('default', { month: 'long' })}</Text>
                  <Text style={styles.calYear}>{pickerYear}</Text>
                </View>
                <TouchableOpacity
                  style={styles.calNavBtn}
                  onPress={() => {
                    if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(pickerYear + 1); }
                    else { setPickerMonth(pickerMonth + 1); }
                  }}
                >
                  <Text style={styles.calNavText}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekRow}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                  <View key={d} style={styles.weekDayContainer}>
                    <Text style={styles.weekText}>{d}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {Array.from({ length: lastDayOfMonth(pickerYear, pickerMonth) }, (_, idx) => idx + 1).map((day) => {
                  const isPastMonth = (pickerYear < today.getFullYear()) || (pickerYear === today.getFullYear() && pickerMonth < today.getMonth());
                  const isPastDay = pickerYear === today.getFullYear() && pickerMonth === today.getMonth() && day < today.getDate();
                  const disabled = isPastMonth || isPastDay;
                  const ymd = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const selected = formDate === ymd;
                  const isToday = pickerYear === today.getFullYear() && pickerMonth === today.getMonth() && day === today.getDate();
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell, 
                        disabled && styles.dayCellDisabled, 
                        selected && styles.dayCellSelected,
                        isToday && !selected && styles.dayCellToday
                      ]}
                      activeOpacity={disabled ? 1 : 0.8}
                      onPress={() => {
                        if (disabled) return;
                        setFormDate(ymd);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.dayText,
                        disabled && styles.dayTextDisabled,
                        selected && styles.dayTextSelected,
                        isToday && !selected && styles.dayTextToday
                      ]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.calFooter}>
                <TouchableOpacity 
                  style={styles.calTodayBtn} 
                  onPress={() => {
                    const todayStr = today.toISOString().slice(0, 10);
                    setFormDate(todayStr);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.calTodayText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.calCancelBtn} 
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.calCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Result Modal */}
        <Modal
          visible={showAdd}
          animationType="fade"
          transparent
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setShowAdd(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Laboratory Result</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAdd(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 10 }}>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Test Name</Text>
                  <TextInput value={formName} onChangeText={setFormName} style={styles.input} placeholder="e.g. Lipid Profile" placeholderTextColor={MUTED} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Patient</Text>
                  <TextInput value={formPatient} onChangeText={setFormPatient} style={styles.input} placeholder="e.g. John Doe" placeholderTextColor={MUTED} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {(['Hematology','Chemistry','Microbiology'] as TestItem['category'][]).map((c) => (
                      <TouchableOpacity key={c} style={[styles.chip, formCategory === c && styles.chipActive]} onPress={() => setFormCategory(c)}>
                        <Text style={[styles.chipText, formCategory === c && styles.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {(['Pending','In Progress','Completed'] as TestItem['status'][]).map((s) => (
                      <TouchableOpacity key={s} style={[styles.chip, formStatus === s && styles.chipActive]} onPress={() => setFormStatus(s)}>
                        <Text style={[styles.chipText, formStatus === s && styles.chipTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Requested On (YYYY-MM-DD)</Text>
                  <View style={styles.inputWithIcon}>
                    <TouchableOpacity style={[styles.input, { paddingRight: 42, justifyContent: 'center' }]} activeOpacity={0.8} onPress={() => setShowDatePicker(true)}>
                      <Text style={{ color: formDate ? '#111827' : MUTED }}>{formDate || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowDatePicker(true)}>
                      <Image source={require('../../assets/appointment_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Notes (optional)</Text>
                  <TextInput value={formNotes} onChangeText={setFormNotes} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Findings..." placeholderTextColor={MUTED} multiline />
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowAdd(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalSave]}
                    onPress={() => {
                      const name = formName.trim();
                      const patient = formPatient.trim();
                      const requestedOn = (formDate || '').trim() || new Date().toISOString().slice(0,10);
                      if (!name || !patient) { Alert.alert('Validation','Please fill in Test Name and Patient.'); return; }
                      const newItem: TestItem = {
                        id: String(Date.now()),
                        name,
                        patient,
                        category: formCategory,
                        status: formStatus,
                        requestedOn,
                        notes: formNotes.trim() || undefined,
                      };
                      (async () => {
                        // Send to backend
                        try {
                          const headers = await getAuthHeaders();
                          const res = await fetch(`${API_BASE}/api/lab-tests`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                              test_name: name,
                              patient,
                              category: formCategory,
                              status: formStatus,
                              date: requestedOn,
                              notes: formNotes.trim() || undefined,
                            }),
                          });
                          if (!res.ok) {
                            const txt = await res.text().catch(() => '');
                            throw new Error(txt || `Failed to save lab test (${res.status})`);
                          }
                        } catch (e: any) {
                          Alert.alert('Save Failed', e?.message || 'Unable to save to server.');
                          return;
                        }

                        // Optimistically update local list and storage
                        setTests(prev => {
                          const next = [newItem, ...prev];
                          saveLabResults(next);
                          return next;
                        });
                        // Push lab notification for new test
                        try {
                          const rawN = await AsyncStorage.getItem('lab_notifications');
                          const arrN = rawN ? JSON.parse(rawN) : [];
                          const notif = {
                            id: `LABTEST-${Date.now()}`,
                            title: 'New Lab Test Added',
                            message: `${name} • Patient: ${patient} • ${formCategory} • ${requestedOn}`,
                            timestamp: Date.now(),
                            read: false,
                          } as any;
                          const nextN = [notif, ...(Array.isArray(arrN) ? arrN : [])];
                          await AsyncStorage.setItem('lab_notifications', JSON.stringify(nextN));
                        } catch {}

                        // Log recent activity for dashboard
                        try {
                          const rawA = await AsyncStorage.getItem('lab_activity');
                          const arrA = rawA ? JSON.parse(rawA) : [];
                          const entry = { id: String(Date.now()), title: `Added Lab Test: ${name} • ${patient}` , timestamp: Date.now(), type: 'lab' };
                          const nextA = [entry, ...(Array.isArray(arrA) ? arrA : [])].slice(0, 50);
                          await AsyncStorage.setItem('lab_activity', JSON.stringify(nextA));
                        } catch {}

                        setShowAdd(false);
                        setFormName(''); setFormPatient(''); setFormCategory('Hematology'); setFormStatus('Pending'); setFormDate(''); setFormNotes('');
                      })();
                    }}
                  >
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('LabProfile' as never); }}>
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

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('LabDashboard' as never)} />
          <BottomItem label="Laboratory" active source={require('../../assets/lab_icon.png')} onPress={() => {}} />
          <BottomItem label="Lab Records" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('LabRecords' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('LabReports' as never)} />
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

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function badgeTint(status: TestItem['status']) {
  switch (status) {
    case 'Completed':
      return { backgroundColor: '#E6FFF5', borderColor: GREEN } as const;
    case 'In Progress':
      return { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' } as const;
    default:
      return { backgroundColor: '#F3F4F6', borderColor: BORDER } as const;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  title: { fontSize: 18, fontWeight: '700', color: GREEN },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8, marginBottom: 12 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12, height: 44 },
  searchIcon: { width: 16, height: 16, tintColor: GREEN },
  searchInput: { flex: 1, color: '#111827', paddingVertical: 0 },
  refreshBtn: { paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: GREEN, fontWeight: '700' },
  chipsRow: { gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', marginRight: 6 },
  chipActive: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  chipText: { color: MUTED, fontWeight: '700' },
  chipTextActive: { color: GREEN },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: BORDER, backgroundColor: CARD_BG, paddingHorizontal: 10, borderRadius: 12 },
  rowLeft: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  badge: { minWidth: 90, paddingHorizontal: 8, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeText: { color: '#111827', fontWeight: '700', fontSize: 12 },

  // Form inputs in Add Result modal
  formGroup: { marginTop: 8 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  inputWithIcon: { position: 'relative' },
  iconOverlay: { position: 'absolute', right: 10, top: 6, bottom: 6, width: 28, alignItems: 'center', justifyContent: 'center' },
  inlineIcon: { width: 18, height: 18, tintColor: GREEN },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancel: { backgroundColor: '#F3F4F6' },
  modalCancelText: { color: '#111827', fontWeight: '700' },
  modalSave: { backgroundColor: GREEN },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700' },

  // Details modal enhanced styles
  bigAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: GREEN, fontWeight: '700', fontSize: 16 },
  detailName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  detailMeta: { color: MUTED, fontSize: 12 },
  statusBadge: { minWidth: 70, paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusBadgeText: { color: '#111827', fontWeight: '700', fontSize: 11 },
  modalDivider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: MUTED, fontWeight: '700' },
  fieldValue: { color: '#111827', fontWeight: '600' },
  notesBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10 },
  notesText: { color: '#111827' },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },

  // Calendar modal styles
  calendarCard: { 
    width: '100%', 
    maxWidth: 350, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8
  },
  calHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 20,
    paddingHorizontal: 4
  },
  calTitleContainer: { 
    alignItems: 'center', 
    flex: 1 
  },
  calTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#111827',
    marginBottom: 2
  },
  calYear: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: MUTED 
  },
  calNavBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#F9FAFB', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  calNavText: { 
    color: GREEN, 
    fontWeight: '700',
    fontSize: 18
  },
  weekRow: { 
    flexDirection: 'row', 
    marginBottom: 12,
    paddingHorizontal: 4
  },
  weekDayContainer: { 
    flex: 1, 
    alignItems: 'center' 
  },
  weekText: { 
    color: MUTED, 
    fontSize: 12, 
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  daysGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    marginBottom: 20
  },
  dayCell: { 
    width: '14.28%', 
    aspectRatio: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 12, 
    marginBottom: 8,
    backgroundColor: '#FFFFFF'
  },
  dayCellDisabled: { 
    opacity: 0.3 
  },
  dayCellSelected: { 
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  dayCellToday: {
  },
  dayText: { color: '#111827', fontWeight: '600' },
  dayTextDisabled: { color: MUTED },
  dayTextSelected: { color: '#FFFFFF' },
  dayTextToday: { color: GREEN, fontWeight: '800' },
  modalInlineIcon: { 
    width: 18, 
    height: 18, 
    tintColor: GREEN 
  },
  calFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  calTodayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  calTodayText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14
  },
  calCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  calCancelText: {
    color: MUTED,
    fontWeight: '600',
    fontSize: 14
  },

  // Loading and empty states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500'
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500'
  },
});

