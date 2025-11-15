import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

type Rx = {
  id: string;
  patient: string;
  medicine: string;
  quantity: number;
  dosage: string;
  notes: string;
  status: 'new' | 'accepted' | 'dispensed';
};

export default function PharmacyPrescription() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | 'New' | 'Accepted' | 'Dispensed'>('All');
  const [items, setItems] = useState<Rx[]>([]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<string, string>;
      if (!raw) return base;
      const sess = raw ? JSON.parse(raw) : null;
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id || sess?.user_id || sess?.uid;
      const withAuth = token ? { ...base, Authorization: `Bearer ${token}` } : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const t = query.trim().toLowerCase();
      const matches = !t || [i.patient, i.medicine, i.dosage, i.notes].some((s) => s.toLowerCase().includes(t));
      const statusOk =
        status === 'All' ||
        (status === 'New' && i.status === 'new') ||
        (status === 'Accepted' && i.status === 'accepted') ||
        (status === 'Dispensed' && i.status === 'dispensed');
      return matches && statusOk;
    });
  }, [items, query, status]);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        // Try to load prescriptions from backend PostgreSQL table first
        let backendItems: Rx[] = [];
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_BASE}/api/prescription`, { headers });
          if (res.ok) {
            const rows = await res.json();
            backendItems = Array.isArray(rows)
              ? rows
                  .map((r: any) => ({
                    id: String(r.id ?? Date.now()),
                    patient: String(r.patient_name || r.patient || ''),
                    medicine: String(r.medicine ?? ''),
                    quantity: Number(r.quantity ?? 0),
                    dosage: String(r.dosage_strength || r.dosage || ''),
                    notes: String(r.description || ''),
                    // Backend table currently has no explicit status; treat as 'new' for listing
                    status: 'new' as const,
                  }))
                  .filter((r: Rx) => r.patient && r.medicine)
              : [];
          }
        } catch {}

        // Fallback: load from local AsyncStorage if backend not available or empty
        if (!Array.isArray(backendItems) || backendItems.length === 0) {
          try {
            const raw = await AsyncStorage.getItem('prescriptions');
            const stored = raw ? JSON.parse(raw) : [];
            backendItems = Array.isArray(stored)
              ? stored
                  .map((r: any) => ({
                    id: String(r.id ?? Date.now()),
                    patient: String(r.patient ?? ''),
                    medicine: String(r.medicine ?? ''),
                    quantity: Number(r.quantity ?? 0),
                    dosage: String(r.dosage ?? ''),
                    notes: String(r.notes ?? ''),
                    status: (r.status as 'new' | 'accepted' | 'dispensed') ?? 'new',
                  }))
                  .filter((r: any) => r.patient && r.medicine)
              : [];
          } catch {
            backendItems = [];
          }
        }

        setItems(backendItems);
      } catch {
        setItems([]);
      }
      // Load unread notifications for badge
      try {
        const rawN = await AsyncStorage.getItem('pharmacy_notifications');
        const arrN = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arrN) ? arrN.filter((n: any) => n && n.read === false).length : 0;
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
  }, [getAuthHeaders]));

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
            keyExtractor={(i) => i.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                <Text style={styles.title}>Prescription</Text>
                <View style={styles.searchRow}>
                  <Image source={require('../../assets/inventory_icon.png')} style={styles.searchIcon} resizeMode="contain" />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search patient or medicine"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.filterBar}>
                  <Text style={styles.filterLabel}>Filter</Text>
                  <View style={styles.filterRight}>
                    {(['All', 'New', 'Accepted', 'Dispensed'] as const).map((s) => (
                      <TouchableOpacity key={s} style={[styles.filterChip, status === s && styles.filterChipActive]} onPress={() => setStatus(s)}>
                        <Text style={[styles.filterText, status === s && styles.filterTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={item.status !== 'dispensed' ? 0.85 : 1}
                onPress={() => {
                  if (item.status === 'new') {
                    navigation.navigate('PharmacyPrescriptionDetails', { item });
                  } else if (item.status === 'accepted') {
                    navigation.navigate('PharmacyPrescriptionAccepted', { item });
                  }
                }}
              >
                <View style={styles.cardLeft}>
                  <Image source={require('../../assets/prescription_icon.png')} style={styles.cardIcon} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cardTitle}>{item.medicine}</Text>
                    {item.status === 'new' && (
                      <Text style={[styles.badge, styles.badgeNew]}>NEW</Text>
                    )}
                    {item.status === 'accepted' && (
                      <Text style={[styles.badge, styles.badgeAccepted]}>ACCEPTED</Text>
                    )}
                    {item.status === 'dispensed' && (
                      <Text style={[styles.badge, styles.badgeDone]}>DISPENSED</Text>
                    )}
                  </View>
                  <Text style={styles.cardMeta}>Patient: {item.patient}</Text>
                  <Text style={styles.cardMeta}>Qty: {item.quantity} • {item.dosage}</Text>
                  <Text style={styles.cardMeta}>Notes: {item.notes}</Text>
                  
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => navigation.navigate('PharmacyInventory')} />
          <BottomItem label="Prescription" active source={require('../../assets/prescription_icon.png')} onPress={() => {}} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports')} />
        </View>
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

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  searchIcon: { width: 16, height: 16, tintColor: MUTED, marginRight: 6 },
  searchInput: { flex: 1, color: '#111827' },

  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterLabel: { color: MUTED },
  filterRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFFFF' },
  filterChipActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  filterText: { color: MUTED, fontSize: 12 },
  filterTextActive: { color: GREEN, fontWeight: '700' },

  card: { flexDirection: 'row', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  cardLeft: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardIcon: { width: 20, height: 20, tintColor: GREEN },
  cardTitle: { color: '#111827', fontWeight: '700' },
  cardMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, color: '#FFFFFF', fontWeight: '700', fontSize: 10, lineHeight: 12 },
  badgeNew: { backgroundColor: '#F59E0B' },
  badgeAccepted: { backgroundColor: '#3B82F6' },
  badgeDone: { backgroundColor: GREEN },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  actionPrimary: { backgroundColor: GREEN },
  actionPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
  actionOutline: { borderWidth: 1, borderColor: GREEN, backgroundColor: '#FFFFFF' },
  actionOutlineText: { color: GREEN, fontWeight: '700' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -40,
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
});

