import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type Item = { id: string; nurse: string; title: string; date?: string; startTime?: string; endTime?: string; note?: string };

export default function SupervisorList() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = React.useState<Item[]>([]);
  const STORAGE_KEY = 'supervisor_schedules';
  const loadSchedules = React.useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(arr) ? arr : []);
    } catch { 
      setItems([]); 
    } finally {
      setLoading(false);
    }
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
        // Log viewing list
        try {
          const raw = await AsyncStorage.getItem('supervisor_activity');
          const arr = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed List', type: 'staff', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
          await AsyncStorage.setItem('supervisor_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [loadSchedules])
  );
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  // Filter state (by Ward)
  const [showFilter, setShowFilter] = React.useState(false);
  const wards = React.useMemo(() => {
    const base = items.map((i) => i.title);
    const extras = ['Ward D', 'Ward E', 'Ward F', 'Ward G'];
    return Array.from(new Set([...base, ...extras])).sort();
  }, [items]);
  const [selectedWard, setSelectedWard] = React.useState<string>('All');
  const filteredItems = React.useMemo(() => {
    if (selectedWard === 'All') return items;
    return items.filter((i) => i.title === selectedWard);
  }, [items, selectedWard]);

  // Group items by nurse
  const groupedItems = React.useMemo(() => {
    const filtered = filteredItems;
    const groups: { [nurse: string]: Item[] } = {};
    
    filtered.forEach((item) => {
      if (!groups[item.nurse]) {
        groups[item.nurse] = [];
      }
      groups[item.nurse].push(item);
    });
    
    // Convert to array and sort nurses alphabetically
    return Object.entries(groups)
      .map(([nurse, schedules]) => ({ nurse, schedules }))
      .sort((a, b) => a.nurse.localeCompare(b.nurse));
  }, [filteredItems]);
  // Details modal state
  const [showDetails, setShowDetails] = React.useState(false);
  const [detailItem, setDetailItem] = React.useState<Item | null>(null);
  const openDetails = (it: Item) => {
    setDetailItem(it);
    setShowDetails(true);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('supervisor_activity');
        const arr = raw ? JSON.parse(raw) : [];
        const entry = { id: String(Date.now()), title: `Viewed Schedule: ${it.title}`, type: 'schedule', timestamp: Date.now() };
        const next = [entry, ...(Array.isArray(arr) ? arr : [])].slice(0, 100);
        await AsyncStorage.setItem('supervisor_activity', JSON.stringify(next));
      } catch {}
    })();
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

        <View style={{ paddingHorizontal: 16, paddingTop: 12, position: 'relative' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.title}>Nurses Schedule List</Text>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter((s) => !s)} activeOpacity={0.9}>
              <Text style={styles.filterText}>{selectedWard}</Text>
              <Image source={require('../../assets/dropdown.png')} style={styles.filterIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
          {showFilter && (
            <View style={[styles.filterCard, { position: 'absolute', right: 16, top: 44, zIndex: 10 }]}> 
              <TouchableOpacity style={styles.filterItem} onPress={() => { setSelectedWard('All'); setShowFilter(false); }}>
                <Text style={[styles.dropdownText, selectedWard === 'All' && { color: GREEN }]}>All</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              {wards.map((w) => (
                <TouchableOpacity key={w} style={styles.filterItem} onPress={() => { setSelectedWard(w); setShowFilter(false); }}>
                  <Text style={[styles.dropdownText, selectedWard === w && { color: GREEN }]}>{w}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.sectionDivider} />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <FlatList
            data={groupedItems}
            keyExtractor={(group) => group.nurse}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading nurse schedules...</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No nurse schedules found.</Text>
                )}
              </View>
            )}
            renderItem={({ item: group }) => (
              <View style={styles.nurseGroup}>
                <View style={styles.nurseHeader}>
                  <View style={styles.nurseAvatar}>
                    <Text style={styles.nurseInitials}>{group.nurse.split(' ').map(n => n[0]).join('').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.nurseName}>{group.nurse}</Text>
                  <Text style={styles.scheduleCount}>{group.schedules.length} schedule{group.schedules.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.schedulesList}>
                  {group.schedules.map((schedule, index) => (
                    <TouchableOpacity 
                      key={schedule.id} 
                      style={[styles.scheduleItem, index === group.schedules.length - 1 && styles.lastScheduleItem]} 
                      activeOpacity={0.9} 
                      onPress={() => openDetails(schedule)}
                    >
                      <View style={styles.scheduleContent}>
                        <Text style={styles.scheduleTitle}>{schedule.title}</Text>
                        <Text style={styles.scheduleDetails}>
                          {schedule.date && `Date: ${schedule.date}`}
                          {(schedule.startTime || schedule.endTime) && (
                            <Text>
                              {schedule.date ? ' • ' : ''}Time: {schedule.startTime || ''}{schedule.endTime ? ` - ${schedule.endTime}` : ''}
                            </Text>
                          )}
                        </Text>
                        {schedule.note && <Text style={styles.scheduleNote}>{schedule.note}</Text>}
                      </View>
                      <Image source={require('../../assets/appointment_icon.png')} style={styles.scheduleIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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

        {/* Details Modal */}
        <Modal visible={showDetails} animationType="fade" transparent onRequestClose={() => setShowDetails(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule Details</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              {!!detailItem && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.rowTitle}>Nurse: <Text style={{ fontWeight: '400' }}>{detailItem.nurse}</Text></Text>
                  <Text style={styles.rowTitle}>Ward: <Text style={{ fontWeight: '400' }}>{detailItem.title}</Text></Text>
                  {!!detailItem.date && <Text style={styles.rowTitle}>Date: <Text style={{ fontWeight: '400' }}>{detailItem.date}</Text></Text>}
                  {(detailItem.startTime || detailItem.endTime) && (
                    <Text style={styles.rowTitle}>Time: <Text style={{ fontWeight: '400' }}>{detailItem.startTime || ''}{detailItem.endTime ? ` - ${detailItem.endTime}` : ''}</Text></Text>
                  )}
                  {!!detailItem.note && <Text style={styles.rowTitle}>Note: <Text style={{ fontWeight: '400' }}>{detailItem.note}</Text></Text>}
                </View>
              )}
            </View>
          </View>
        </Modal>

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('SupervisorDashboard')} />
          <BottomItem label="Schedules" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('SupervisorSchedule')} />
          <BottomItem label="List" active source={require('../../assets/patient_records_icon.png')} onPress={() => {}} />
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
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8, marginBottom: 12 },

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: BORDER, backgroundColor: CARD_BG, paddingHorizontal: 10, borderRadius: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  actionsCol: { gap: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1 },
  actionText: { fontWeight: '700' },

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

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  inputLabel: { color: MUTED, marginBottom: 4, fontSize: 12 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  row2: { flexDirection: 'row', alignItems: 'flex-start' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  formBtn: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, backgroundColor: '#FFFFFF' },
  formBtnText: { fontWeight: '700' },

  // Filter controls
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  filterIcon: { width: 16, height: 16, tintColor: GREEN },
  filterText: { color: '#111827', fontWeight: '700' },
  filterCard: { width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  filterItem: { paddingVertical: 10, paddingHorizontal: 12 },

  // Grouped nurse styles
  nurseGroup: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 8 },
  nurseHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  nurseAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  nurseInitials: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nurseName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  scheduleCount: { fontSize: 12, color: MUTED, fontWeight: '600' },
  schedulesList: { paddingHorizontal: 12 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  lastScheduleItem: { borderBottomWidth: 0 },
  scheduleContent: { flex: 1 },
  scheduleTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  scheduleDetails: { fontSize: 12, color: MUTED },
  scheduleNote: { fontSize: 12, color: MUTED, marginTop: 4, fontStyle: 'italic' },
  scheduleIcon: { width: 20, height: 20, tintColor: GREEN, marginLeft: 8 },

  // Loading styles
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  emptyText: { color: MUTED, fontSize: 14, textAlign: 'center' },
});

