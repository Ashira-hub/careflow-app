import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, FlatList, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

type Med = {
  id: string;
  generic: string;
  brand: string;
  category: string;
  dosageType: 'Tablet' | 'Capsule' | 'Syrup' | 'Drops' | 'Ointment' | 'Other';
  strength?: string;
  unit?: string;
  stock: number;
};

export default function PharmacyMedicine() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showCategory, setShowCategory] = useState(false);
  const [items, setItems] = useState<Med[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  // Load medicines from backend API
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const res = await fetch(`${API_BASE}/api/inventory`);
          if (!res.ok) throw new Error('Failed to load medicines');
          const rows = await res.json();
          const mapped: Med[] = Array.isArray(rows)
            ? rows.map((r: any) => ({
                id: String(r.id),
                generic: r.genericName || 'Unknown',
                brand: r.brandName || '',
                category: r.category || 'Uncategorized',
                dosageType: (r.dosageType || 'Tablet') as Med['dosageType'],
                strength: r.strength || '',
                unit: r.unit || '',
                stock: Number.isFinite(Number(r.stock)) ? Number(r.stock) : 0,
              }))
            : [];
          setItems(mapped);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
        // Load unread notifications for badge
        try {
          const raw = await AsyncStorage.getItem('pharmacy_notifications');
          const arr = raw ? JSON.parse(raw) : [];
          const unread = Array.isArray(arr) ? arr.filter((n: any) => n && n.read === false).length : 0;
          setUnreadCount(unread);
        } catch { setUnreadCount(0); }
        // Load avatar
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
      })();
      return () => {};
    }, [])
  );

  // Get unique categories from items
  const categories = useMemo(() => {
    const set = new Set<string>(items.map(i => i.category));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return items.filter((m) => {
      const matches = !t || [m.generic, m.brand, m.category, m.dosageType, m.strength || '', m.unit || ''].some((s) => s.toLowerCase().includes(t));
      const categoryOk = categoryFilter === 'All' || m.category === categoryFilter;
      return matches && categoryOk;
    });
  }, [items, query, categoryFilter]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PharmacyNotification' as never)}>
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

        <View style={styles.body}>
          <FlatList
            data={filtered}
            keyExtractor={(m) => m.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <Text style={styles.title}>Medicine</Text>
                <View style={styles.searchRow}>
                  <Image source={require('../../assets/search_icon.png')} style={styles.searchIcon} resizeMode="contain" />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search generic, brand, or category"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                {/* Filter bar */}
                <View style={styles.filterBar}>
                  <Text style={styles.filterLabel}>Category</Text>
                  <TouchableOpacity style={[styles.selectBtn, categoryFilter !== 'All' && styles.selectBtnActive]} activeOpacity={0.85} onPress={() => setShowCategory(true)}>
                    <Text style={[styles.selectText, categoryFilter !== 'All' && styles.selectTextActive]}>
                      {categoryFilter}
                    </Text>
                    <Text style={[styles.selectCaret, categoryFilter !== 'All' && styles.selectTextActive]}>▾</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('PharmacyMedicineDetails', { item })}
              >
                <View style={styles.cardLeft}>
                  <Image source={require('../../assets/medicine_icon.png')} style={styles.cardIcon} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.generic}{item.strength ? ` ${item.strength}${item.unit ? item.unit : ''}` : ''}</Text>
                    <Text style={styles.stockBadge}>Stocks: {item.stock}</Text>
                  </View>
                  <Text style={styles.cardMeta}>Brand: {item.brand || '-'}</Text>
                  <Text style={styles.cardMeta}>Category: {item.category} • {item.dosageType}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading medicines...</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Image source={require('../../assets/medicine_icon.png')} style={styles.emptyIcon} resizeMode="contain" />
                  <Text style={styles.emptyTitle}>No Medicines Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {query.trim() ? 'Try adjusting your search or filter' : 'Add medicines to your inventory to get started'}
                  </Text>
                </View>
              )
            }
          />
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => navigation.navigate('PharmacyInventory')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription')} />
          <BottomItem label="Medicine" active source={require('../../assets/medicine_icon.png')} onPress={() => {}} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports')} />
        </View>
        {/* Category Modal */}
        <Modal visible={showCategory} transparent animationType="fade" onRequestClose={() => setShowCategory(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <View style={styles.optionCol}>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat} style={[styles.optionBtn, categoryFilter === cat && styles.optionBtnActive]} onPress={() => { setCategoryFilter(cat); setShowCategory(false); }}>
                    <Text style={[styles.optionText, categoryFilter === cat && styles.optionTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCategory(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('PharmacyProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
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
  container: { flex: 1, top: -36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  body: { paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  searchIcon: { width: 16, height: 16, tintColor: MUTED, marginRight: 6 },
  searchInput: { flex: 1, color: '#111827' },

  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterLabel: { color: MUTED },
  selectBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  selectText: { color: '#111827', marginRight: 6, fontWeight: '700' },
  selectCaret: { color: MUTED, fontSize: 12 },
  selectBtnActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  selectTextActive: { color: GREEN },

  card: { flexDirection: 'row', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  cardLeft: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardIcon: { width: 20, height: 20, tintColor: GREEN },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#111827', fontWeight: '700' },
  stockBadge: { color: MUTED, fontSize: 12, fontWeight: '700' },
  cardMeta: { color: MUTED, fontSize: 12, marginTop: 2 },


  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: -40, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
  // Profile menu styles
  menuOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end', padding: 16 },
  menuCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 70, borderWidth: 1, borderColor: BORDER },
  menuItem: { paddingVertical: 12, alignItems: 'center' },
  menuText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  menuCancel: { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  menuCancelText: { color: MUTED, fontWeight: '700' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  optionCol: { gap: 8 },
  optionBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF' },
  optionBtnActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  optionText: { color: '#111827', fontWeight: '700' },
  optionTextActive: { color: GREEN },
  closeBtn: { marginTop: 12, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  closeText: { color: MUTED, fontWeight: '700' },
  // Loading and empty state styles
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { color: MUTED, fontSize: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, tintColor: MUTED, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
});

