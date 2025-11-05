import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

const API_BASE = 'https://capstone-production-8af8.up.railway.app';
const getAuthHeaders = async () => {
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
};

type LabRecord = {
  id: string;
  patient: string;
  test: string;
  category: 'Hematology' | 'Chemistry' | 'Microbiology' | 'Imaging';
  collectedOn: string;
  status: 'Pending' | 'Processing' | 'Completed';
  result?: string;
  notes?: string;
};

type PatientGroup = {
  patient: string;
  records: LabRecord[];
  lastDate: string;
  count: number;
};

export default function LabRecords() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'All' | LabRecord['status']>('All');
  const [selected, setSelected] = React.useState<PatientGroup | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const [records, setRecords] = React.useState<LabRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/api/lab-records`, { headers });
            if (!res.ok) throw new Error(`Failed to load records (${res.status})`);
            const rows = await res.json();
            const mapped: LabRecord[] = Array.isArray(rows)
              ? rows.map((r: any) => ({
                  id: String(r.id),
                  patient: String(r.patient || ''),
                  test: String(r.test_name || ''),
                  category: (r.category || 'Hematology') as LabRecord['category'],
                  collectedOn: String(r.date || ''),
                  status: ((r.status === 'In Progress') ? 'Processing' : (r.status || 'Pending')) as LabRecord['status'],
                  result: undefined,
                  notes: r.notes ? String(r.notes) : undefined,
                }))
              : [];
            setRecords(mapped);
          } catch (e) {
            setRecords([]);
          } finally {
            setLoading(false);
          }
        } catch {
          // ignore
        }
        // Load avatar from session
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
        // Load unread notifications count
        try {
          const rawN = await AsyncStorage.getItem('lab_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Log recent activity: Viewed Lab Records
        try {
          const rawA = await AsyncStorage.getItem('lab_activity');
          const arrA = rawA ? JSON.parse(rawA) : [];
          const entry = { id: String(Date.now()), title: 'Viewed Lab Records', timestamp: Date.now(), type: 'records' };
          const next = [entry, ...(Array.isArray(arrA) ? arrA : [])].slice(0, 50);
          await AsyncStorage.setItem('lab_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const filters: Array<'All' | LabRecord['status']> = ['All', 'Pending', 'Processing', 'Completed'];
  const list = React.useMemo<PatientGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const byPatient = new Map<string, LabRecord[]>();
    records.forEach(r => {
      if (filter !== 'All' && r.status !== filter) return;
      if (
        q &&
        !(r.patient.toLowerCase().includes(q) || r.test.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
      ) return;
      const key = r.patient.trim();
      const arr = byPatient.get(key) || [];
      arr.push(r);
      byPatient.set(key, arr);
    });
    const groups: PatientGroup[] = Array.from(byPatient.entries()).map(([patient, recs]) => {
      const sorted = recs.slice().sort((a, b) => String(b.collectedOn).localeCompare(String(a.collectedOn)));
      return { patient, records: sorted, lastDate: sorted[0]?.collectedOn || '', count: sorted.length };
    });
    // Sort by most recent activity
    groups.sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)));
    return groups;
  }, [records, filter, query]);

  const openDetails = (grp: PatientGroup) => { setSelected(grp); setShowDetails(true); };

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

        {/* Scrollable list with header */}
        <FlatList
          data={list}
          keyExtractor={(it) => it.patient}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View>
              <Text style={styles.title}>Lab Records</Text>
              <View style={styles.sectionDivider} />

              <View style={styles.searchRow}>
                <View style={styles.searchWrap}>
                  <Image source={require('../../assets/search_icon.png')} style={styles.searchIcon} resizeMode="contain" />
                  <TextInput
                    placeholder="Search patient, test, or category"
                    placeholderTextColor={MUTED}
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                  />
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {filters.map((f) => (
                  <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
                    <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
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
                    <Text style={styles.loadingText}>Loading lab records...</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No lab records found.</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.cardRow} activeOpacity={0.9} onPress={() => openDetails(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.patient)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.patient}</Text>
                <Text style={styles.rowMeta}>Last: {item.lastDate || '—'}  •  {item.count} record{item.count === 1 ? '' : 's'}</Text>
              </View>
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
                <Text style={styles.modalTitle}>Record Details</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              {!!selected && (
                <View style={{ gap: 12 }}>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.bigAvatar}>
                      <Text style={styles.bigAvatarText}>{initials(selected.patient)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName} numberOfLines={1}>{selected.patient}</Text>
                      <Text style={styles.detailMeta}>Total records: {selected.count}</Text>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  {/* Records list for this patient */}
                  <View style={{ gap: 8 }}>
                    {selected.records.map((r) => (
                      <View key={r.id} style={[styles.cardRow, { padding: 10 }]}> 
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{r.test}</Text>
                          <Text style={styles.rowMeta}>Collected: {r.collectedOn}  •  {r.category}</Text>
                        </View>
                        <View style={[styles.statusBadge, statusTint(r.status)]}><Text style={styles.statusBadgeText}>{r.status}</Text></View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
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
          <BottomItem label="Laboratory" source={require('../../assets/lab_icon.png')} onPress={() => navigation.navigate('LabLaboratory' as never)} />
          <BottomItem label="Lab Records" active source={require('../../assets/patient_records_icon.png')} onPress={() => {}} />
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
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function statusTint(status: LabRecord['status']) {
  switch (status) {
    case 'Completed':
      return { backgroundColor: '#E6FFF5', borderColor: GREEN } as const;
    case 'Processing':
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

  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12 },
  searchIcon: { width: 16, height: 16, tintColor: GREEN },
  searchInput: { flex: 1, color: '#111827' },
  
  chipsRow: { gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', marginRight: 6 },
  chipActive: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  chipText: { color: MUTED, fontWeight: '700' },
  chipTextActive: { color: GREEN },

  // Card-style rows (different from LabLaboratory)
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GREEN, fontWeight: '700' },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowMeta: { color: MUTED, fontSize: 12, marginTop: 2 },

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

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },

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

  // Details modal enhanced styles
  bigAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: GREEN, fontWeight: '700', fontSize: 16 },
  detailName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  detailMeta: { color: MUTED, fontSize: 12 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: GREEN },
  catChipText: { color: GREEN, fontWeight: '700', fontSize: 11 },
  statusBadge: { minWidth: 70, paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusBadgeText: { color: '#111827', fontWeight: '700', fontSize: 11 },
  modalDivider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: MUTED, fontWeight: '700' },
  fieldValue: { color: '#111827', fontWeight: '600' },
  notesBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10 },
  notesText: { color: '#111827' },
});

