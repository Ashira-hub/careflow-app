import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, FlatList, SafeAreaView, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { showLocalImmediateNotification } from '../../utils/notifications';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB'; 
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

type Item = { id: string; name: string; category: string; stock: number };

export default function PharmacyInventory() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [filterCat, setFilterCat] = useState<string>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStock, setFormStock] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  // Load from backend so Add Medicine reflects here
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          const res = await fetch(`${API_BASE}/api/inventory`);
          if (!res.ok) throw new Error('Failed to load inventory');
          const rows = await res.json();
          const mapped: Item[] = Array.isArray(rows)
            ? rows.map((r: any) => ({
                id: String(r.id),
                name: `${r.genericName}${r.brandName ? ` (${r.brandName})` : ''}`,
                category: r.category || 'Uncategorized',
                stock: Number.isFinite(Number(r.stock)) ? Number(r.stock) : 0,
              }))
            : [];
          setItems(mapped);
          // Low stock push notifications (once per day per item)
          try {
            const LOW = 5; // threshold
            const todayKey = new Date().toISOString().slice(0,10);
            const rawSeen = await AsyncStorage.getItem('pharmacy_lowstock_notified');
            const seen = rawSeen ? JSON.parse(rawSeen) : {};
            const toNotify = mapped.filter(i => i.stock <= LOW);
            for (const i of toNotify) {
              const last = seen[i.id];
              if (last !== todayKey) {
                const title = 'Low Stock Alert';
                const message = `${i.name} is low on stock (${i.stock} left).`;
                try { await showLocalImmediateNotification(title, message); } catch {}
                try {
                  const rawN = await AsyncStorage.getItem('pharmacy_notifications');
                  const arrN = rawN ? JSON.parse(rawN) : [];
                  const notif = { id: `LOW-${i.id}-${Date.now()}`, title, message, timestamp: Date.now(), read: false, kind: 'lowstock' } as any;
                  await AsyncStorage.setItem('pharmacy_notifications', JSON.stringify([notif, ...(Array.isArray(arrN) ? arrN : [])]));
                } catch {}
                seen[i.id] = todayKey;
              }
            }
            await AsyncStorage.setItem('pharmacy_lowstock_notified', JSON.stringify(seen));
          } catch {}
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

  const categories = useMemo(() => {
    const set = new Set<string>(items.map(i => i.category));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const byCat = filterCat === 'All' ? items : items.filter(i => i.category === filterCat);
    const q = query.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [query, items, filterCat]);

  const inc = async (id: string) => {
    // Optimistic update
    setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: i.stock + 1 } : i)));
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: 1 }),
      });
      if (!res.ok) throw new Error('Failed to update stock');
      const row = await res.json();
      setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: Number(row.stock) || 0 } : i)));
    } catch {
      // Revert if error by reloading this item from server
      try {
        const res2 = await fetch(`${API_BASE}/api/inventory`);
        const rows = await res2.json();
        const found = Array.isArray(rows) ? rows.find((r: any) => String(r.id) === id) : null;
        if (found) setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: Number(found.stock) || 0 } : i)));
      } catch {}
    }
  };
  const dec = async (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: Math.max(0, i.stock - 1) } : i)));
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: -1 }),
      });
      if (!res.ok) throw new Error('Failed to update stock');
      const row = await res.json();
      setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: Number(row.stock) || 0 } : i)));
    } catch {
      try {
        const res2 = await fetch(`${API_BASE}/api/inventory`);
        const rows = await res2.json();
        const found = Array.isArray(rows) ? rows.find((r: any) => String(r.id) === id) : null;
        if (found) setItems(prev => prev.map(i => (i.id === id ? { ...i, stock: Number(found.stock) || 0 } : i)));
      } catch {}
    }
  };

  const openAdd = () => {
    navigation.navigate('PharmacyAddMedicine');
  };
  const openEdit = (item: Item) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormStock(String(item.stock));
    setShowForm(true);
  };
  const saveForm = async () => {
    const name = formName.trim();
    const category = formCategory.trim() || 'Uncategorized';
    const stock = Math.max(0, parseInt(formStock || '0', 10) || 0);
    if (!name) {
      Alert.alert('Validation', 'Please enter a medicine name.');
      return;
    }
    try {
      if (editingId) {
        const res = await fetch(`${API_BASE}/api/inventory/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category, stock }),
        });
        if (!res.ok) throw new Error('Failed to update item');
        const row = await res.json();
        setItems(prev => prev.map(i => (i.id === editingId ? { ...i, name: `${row.genericName}${row.brandName ? ` (${row.brandName})` : ''}`, category: row.category || 'Uncategorized', stock: Number(row.stock) || 0 } : i)));
      } else {
        // Local modal add is legacy; prefer using Add Medicine screen for inserts. We'll add locally for now.
        setItems(prev => [{ id: String(Date.now()), name, category, stock }, ...prev]);
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
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
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 260 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <Text style={styles.title}>Inventory</Text>
                <View style={styles.searchRow}>
                  <Image source={require('../../assets/search_icon.png')} style={styles.searchIcon} resizeMode="contain" />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search medicine or category"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.filterBar}>
                  <Text style={styles.filterLabel}>Category</Text>
                  <TouchableOpacity style={[styles.filterBtn, filterCat !== 'All' && styles.filterBtnActive]} onPress={() => setShowFilter(true)}>
                    <Text style={[styles.filterBtnText, filterCat !== 'All' && styles.filterBtnTextActive]}>{filterCat}</Text>
                    <Text style={[styles.filterBtnCaret, filterCat !== 'All' && styles.filterBtnTextActive]}>▾</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <Image source={require('../../assets/medicine_icon.png')} style={styles.itemIcon} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.category}</Text>
                </View>
                <View style={styles.qtyCol}>
                  <Text style={styles.stockLabel}>Stock</Text>
                  <Text style={styles.stockValue}>{item.stock}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => dec(item.id)}>
                    <Text style={styles.actionText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionInc]} onPress={() => inc(item.id)}>
                    <Text style={[styles.actionText, { color: '#FFFFFF' }]}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading inventory...</Text>
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

        <TouchableOpacity style={styles.addFab} activeOpacity={0.9} onPress={openAdd}>
          <Text style={styles.addFabText}>+</Text>
        </TouchableOpacity>

        <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Medicine' : 'Add Medicine'}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput value={formName} onChangeText={setFormName} style={styles.input} placeholder="e.g. Paracetamol 500mg" placeholderTextColor="#9CA3AF" />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput value={formCategory} onChangeText={setFormCategory} style={styles.input} placeholder="e.g. Analgesic" placeholderTextColor="#9CA3AF" />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput value={formStock} onChangeText={setFormStock} keyboardType="number-pad" style={styles.input} placeholder="0" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowForm(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalSave]} onPress={saveForm}>
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

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

        <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowFilter(false)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>
              </View>
              {categories.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.optionItem, filterCat === cat && styles.optionItemActive]} onPress={() => { setFilterCat(cat); setShowFilter(false); }}>
                  <Text style={[styles.optionText, filterCat === cat && styles.optionTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" active source={require('../../assets/inventory_icon.png')} onPress={() => {}} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription')} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports')} />
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
  container: { flex: 1, top: 0 },

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
  filterBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  filterBtnText: { color: '#111827', marginRight: 6, fontWeight: '700' },
  filterBtnCaret: { color: MUTED, fontSize: 12 },
  filterBtnActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  filterBtnTextActive: { color: GREEN },

  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  itemLeft: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  itemIcon: { width: 20, height: 20, tintColor: GREEN },
  itemName: { color: '#111827', fontWeight: '700' },
  itemMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  qtyCol: { alignItems: 'center', marginLeft: 10, marginRight: 10 },
  stockLabel: { color: MUTED, fontSize: 10 },
  stockValue: { color: '#111827', fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  actionInc: { backgroundColor: GREEN },
  actionText: { color: GREEN, fontWeight: '800', fontSize: 14 },
  editBtn: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  editText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },

  addFab: { position: 'absolute', right: 16, bottom: 120, width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  addFabText: { color: '#FFFFFF', fontWeight: '800', fontSize: 24, lineHeight: 26 },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalCloseBtn: { padding: 6, borderRadius: 14 },
  modalCloseText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancel: { backgroundColor: '#F3F4F6' },
  modalCancelText: { color: '#111827', fontWeight: '700' },
  modalSave: { backgroundColor: GREEN },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 40, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
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
  optionItem: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#FFFFFF', marginBottom: 8 },
  optionItemActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  optionText: { color: MUTED },
  optionTextActive: { color: GREEN, fontWeight: '700' },
  // Loading and empty state styles
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { color: MUTED, fontSize: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, tintColor: MUTED, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
});

// Form Modal - appended after styles for clarity
export function InventoryFormModal() { return null }

