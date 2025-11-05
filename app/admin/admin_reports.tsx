import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [users, setUsers] = React.useState<any[]>([]);
  const [showAllModal, setShowAllModal] = React.useState(false);

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return { 'Content-Type': 'application/json' } as Record<string,string>;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string,string>;
      return { 'Content-Type': 'application/json' };
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users`, { headers });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : (Array.isArray(data.data) ? data.data : []));
        setUsers(arr);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, getAuthHeaders]);

  React.useEffect(() => { loadUsers(); }, [loadUsers]);
  useFocusEffect(React.useCallback(() => { loadUsers(); return () => {}; }, [loadUsers]));

  const metrics = React.useMemo(() => {
    const norm = (s: any) => String(s || '').trim().toLowerCase();
    const counts = { doctor: 0, nurse: 0, pharmacist: 0, lab: 0 };
    users.forEach(u => {
      const r = norm(u.role);
      if (r.includes('doctor')) counts.doctor += 1;
      else if (r.includes('nurse')) counts.nurse += 1;
      else if (r.includes('pharm')) counts.pharmacist += 1;
      else if (r.includes('lab')) counts.lab += 1;
    });
    return counts;
  }, [users]);

  React.useEffect(() => {
    (async () => {
      try { 
        setLoading(true);
        const raw = await AsyncStorage.getItem('admin_dark_mode'); 
        if (raw != null) setDarkMode(raw === '1'); 
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
        if (av) setAvatarUri(String(av)); else {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          setAvatarUri(cache?.avatar_uri || undefined);
        }
      } catch {}
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arr: any[] = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => !n.read).length : 0;
        setUnreadCount(unread);
      } catch {}
    })();
    return () => {};
  }, []));

  return (
    <SafeAreaView style={[styles.safe, darkMode && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.container, darkMode && { backgroundColor: '#0B1220' }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AdminNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={[styles.headerIconImg, darkMode && { tintColor: '#9CA3AF' }]} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileMenu(true)}>
              <View style={[styles.avatarCircle, darkMode && { borderColor: '#374151' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={[styles.screenTitle, darkMode && { color: '#22C55E' }]}>Admin Reports</Text>
          </View>

          <View style={styles.cardsRow}>
            <SummaryCard label="Doctor" value={metrics.doctor} tint="#D1FAE5" darkMode={darkMode} />
            <SummaryCard label="Nurses" value={metrics.nurse} tint="#E0E7FF" darkMode={darkMode} />
          </View>
          <View style={styles.cardsRow}>
            <SummaryCard label="Pharmacist" value={metrics.pharmacist} tint="#FEF3C7" darkMode={darkMode} />
            <SummaryCard label="Lab Staff" value={metrics.lab} tint="#FDE68A" darkMode={darkMode} />
          </View>

          <View style={[styles.sectionCard, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}>
            <View style={[styles.sectionHeaderRow]}>
              <Text style={[styles.sectionTitle, darkMode && { color: '#E5E7EB' }]}>Recent Reports</Text>
              {users.length > 5 && (
                <TouchableOpacity onPress={() => setShowAllModal(true)}>
                  <Text style={[styles.viewAllText]}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, darkMode && { color: '#9CA3AF' }]}>Loading reports...</Text>
              </View>
            ) : users.length === 0 ? (
              <Text style={[styles.empty, darkMode && { color: '#9CA3AF' }]}>No reports generated yet.</Text>
            ) : (
              users
                .slice()
                .sort((a: any, b: any) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))
                .slice(0, 5)
                .map((u: any) => (
                  <View key={u.id} style={[styles.row, darkMode && { borderTopColor: '#1F2937' }]}> 
                    <View style={[styles.rowLeft, darkMode && { backgroundColor: '#0B1220', borderColor: '#374151' }]}>
                      <Image source={require('../../assets/reports_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, darkMode && { color: '#E5E7EB' }]} numberOfLines={1}>New User: {u.full_name || u.fullname || u.email || `User ${u.id}`}</Text>
                      <Text style={[styles.meta, darkMode && { color: '#9CA3AF' }]}>{String(u.role || '').toUpperCase()} • {String((u.created_at || u.createdAt || '')).slice(0,10)}</Text>
                    </View>
                  </View>
                ))
            )}
          </View>
          {/* View All Modal */}
          <Modal visible={showAllModal} transparent animationType="fade" onRequestClose={() => setShowAllModal(false)}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, darkMode && { backgroundColor: '#111827' }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, darkMode && { color: '#E5E7EB' }]}>All Recent Reports</Text>
                  <TouchableOpacity onPress={() => setShowAllModal(false)}>
                    <Text style={[styles.closeText, darkMode && { color: '#9CA3AF' }]}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalListWrap}>
                  <FlatList
                    data={users.slice().sort((a: any, b: any) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))}
                    keyExtractor={(it: any) => String(it.id)}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    renderItem={({ item: u }: any) => (
                      <View style={[styles.row, darkMode && { borderTopColor: '#1F2937' }]}> 
                        <View style={[styles.rowLeft, darkMode && { backgroundColor: '#0B1220', borderColor: '#374151' }]}>
                          <Image source={require('../../assets/reports_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.name, darkMode && { color: '#E5E7EB' }]} numberOfLines={1}>New User: {u.full_name || u.fullname || u.email || `User ${u.id}`}</Text>
                          <Text style={[styles.meta, darkMode && { color: '#9CA3AF' }]}>{String(u.role || '').toUpperCase()} • {String((u.created_at || u.createdAt || '')).slice(0,10)}</Text>
                        </View>
                      </View>
                    )}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('AdminProfile' as never); }}>
                <Text style={[styles.dropdownText, darkMode && { color: '#E5E7EB' }]}>Profile</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, darkMode && { backgroundColor: '#1F2937' }]} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try { setUsers([]); } catch {}
                  try { await AsyncStorage.removeItem('session'); } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.bottomBar, darkMode && { backgroundColor: '#111827', borderTopColor: '#1F2937' }]}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <BottomItem label="Users" source={require('../../assets/profile_icon.png')} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
          <BottomItem label="Reports" active source={require('../../assets/reports_icon.png')} onPress={() => {}} />
          <BottomItem label="Settings" source={require('../../assets/settings_icon.png')} onPress={() => navigation.navigate('AdminSettings' as never)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, tint, darkMode }: { label: string; value: number; tint: string; darkMode?: boolean }) {
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: '#F3F4F6' }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
      <Text style={[styles.cardLabel, darkMode && { color: '#9CA3AF' }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }, darkMode && { color: '#22C55E' }]}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
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

function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][((m % 12) + 12) % 12];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingBottom: 80 },
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

  scrollContent: { padding: 16, paddingBottom: 80 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  viewAllText: { color: GREEN, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  rowLeft: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginRight: 12 },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  empty: { color: MUTED, fontStyle: 'italic' },

  // Modal styles for View All
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 560, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: '#111827', fontWeight: '800', fontSize: 16 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  modalListWrap: { maxHeight: 420 },

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

  // Loading and empty states
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
});

