import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  stock: number;
  dispensedThisMonth: number;
};

type Prescription = {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  status: 'pending' | 'dispensed' | 'cancelled';
  createdAt: string;
  dispensedAt?: string | number;
};

export default function PharmacyReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year] = useState<number>(new Date().getFullYear());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Med[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  // Load data from backend API; fallback to local AsyncStorage where needed
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          
          // Load inventory items
          const inventoryRes = await fetch(`${API_BASE}/api/inventory`);
          if (!inventoryRes.ok) throw new Error('Failed to load inventory');
          const inventoryRows = await inventoryRes.json();
          
          const mappedInventory: Med[] = Array.isArray(inventoryRows)
            ? inventoryRows.map((r: any) => ({
                id: String(r.id),
                generic: r.genericName || 'Unknown',
                brand: r.brandName || '',
                category: r.category || 'Uncategorized',
                dosageType: (r.dosageType || 'Tablet') as Med['dosageType'],
                stock: Number.isFinite(Number(r.stock)) ? Number(r.stock) : 0,
                dispensedThisMonth: 0, // Will be calculated from prescriptions
              }))
            : [];

          // Load prescriptions (backend optional). Fallback to local AsyncStorage 'prescriptions'.
          let mappedPrescriptions: Prescription[] = [];
          try {
            const prescriptionsRes = await fetch(`${API_BASE}/api/prescriptions?year=${year}`);
            if (prescriptionsRes.ok) {
              const prescriptionRows = await prescriptionsRes.json();
              mappedPrescriptions = Array.isArray(prescriptionRows)
                ? prescriptionRows.map((r: any) => ({
                    id: String(r.id),
                    medicineId: String(r.medicineId || r.medicine_id || r.medicine || ''),
                    medicineName: r.medicineName || r.medicine || 'Unknown',
                    quantity: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
                    status: (r.status as Prescription['status']) || 'pending',
                    createdAt: r.createdAt || r.created_at || new Date().toISOString(),
                    dispensedAt: r.dispensedAt || r.dispensed_at,
                  }))
                : [];
            }
          } catch {}
          // Fallback to local if backend not available or returned empty
          try {
            if (!Array.isArray(mappedPrescriptions) || mappedPrescriptions.length === 0) {
              const rawLocal = await AsyncStorage.getItem('prescriptions');
              const arrLocal = rawLocal ? JSON.parse(rawLocal) : [];
              mappedPrescriptions = Array.isArray(arrLocal)
                ? arrLocal.map((r: any) => ({
                    id: String(r.id ?? Date.now()),
                    medicineId: String(r.medicine || ''),
                    medicineName: String(r.medicine || 'Unknown'),
                    quantity: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
                    status: (r.status as Prescription['status']) || 'pending',
                    createdAt: r.createdAt || r.created_at || new Date().toISOString(),
                    dispensedAt: r.dispensedAt,
                  }))
                : [];
            }
          } catch {}

          // Remove the old dispensed calculation since we'll do it per month in metrics
          const updatedInventory = mappedInventory.map(med => ({
            ...med,
            dispensedThisMonth: 0, // Will be calculated per month in metrics
          }));

          setInventoryItems(updatedInventory);
          setPrescriptions(mappedPrescriptions);
        } catch (error) {
          console.error('Error loading pharmacy reports:', error);
          // Still try to load inventory even if prescriptions fail
          try {
            const inventoryRes = await fetch(`${API_BASE}/api/inventory`);
            if (inventoryRes.ok) {
              const inventoryRows = await inventoryRes.json();
              const mappedInventory: Med[] = Array.isArray(inventoryRows)
                ? inventoryRows.map((r: any) => ({
                    id: String(r.id),
                    generic: r.genericName || 'Unknown',
                    brand: r.brandName || '',
                    category: r.category || 'Uncategorized',
                    dosageType: (r.dosageType || 'Tablet') as Med['dosageType'],
                    stock: Number.isFinite(Number(r.stock)) ? Number(r.stock) : 0,
                    dispensedThisMonth: 0,
                  }))
                : [];
              setInventoryItems(mappedInventory);
            } else {
              setInventoryItems([]);
            }
          } catch (inventoryError) {
            console.error('Error loading inventory:', inventoryError);
            setInventoryItems([]);
          }
          setPrescriptions([]);
        } finally {
          setLoading(false);
        }
        // Load unread notifications for badge
        try {
          const rawN = await AsyncStorage.getItem('pharmacy_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const unread = Array.isArray(arrN) ? arrN.filter((n: any) => n && n.read === false).length : 0;
          setUnreadCount(unread);
        } catch { setUnreadCount(0); }
        // Load avatar image
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
    }, [month, year])
  );

  const metrics = useMemo(() => {
    const totalItems = inventoryItems.length;
    const lowStock = inventoryItems.filter((m) => m.stock < 20).length;
    
    // Determine if a prescription falls within the selected month/year.
    const inSelectedMonth = (p: Prescription) => {
      try {
        const t = p.dispensedAt ?? p.createdAt;
        const d = new Date(t);
        return d.getMonth() === month && d.getFullYear() === year;
      } catch {
        return false;
      }
    };

    // Use dispensedAt when present to count per-month metrics.
    const dispensedOnly = prescriptions.filter(p => p.status === 'dispensed' && inSelectedMonth(p));
    const totalDispensed = dispensedOnly.length; // number of dispensed prescriptions
    const totalQtyDispensed = dispensedOnly.reduce((acc, p) => acc + (Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0), 0);
    
    // Calculate dispensed quantities for the selected month only
    const monthlyDispensedCounts = dispensedOnly
      .reduce((acc, p) => {
        const key = p.medicineId || p.medicineName;
        acc[key] = (acc[key] || 0) + (Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0);
        return acc;
      }, {} as Record<string, number>);

    // Update inventory with monthly dispensed counts
    const monthlyInventory = inventoryItems.map(med => ({
      ...med,
      dispensedThisMonth: monthlyDispensedCounts[med.id] || 0,
    }));

    const topMeds = [...monthlyInventory]
      .sort((a, b) => b.dispensedThisMonth - a.dispensedThisMonth)
      .slice(0, 5);
      
    return { totalItems, lowStock, totalDispensed, totalQtyDispensed, topMeds };
  }, [inventoryItems, prescriptions, month, year]);

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

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Title and Month Filter */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Reports</Text>
            <View style={styles.monthWrap}>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth((m) => (m + 11) % 12)}>
                <Text style={styles.monthText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthName(month)} {year}</Text>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth((m) => (m + 1) % 12)}>
                <Text style={styles.monthText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          ) : (
            <>
              {/* Summary Cards */}
              <View style={styles.cardsRow}>
                <SummaryCard label="Inventory Items" value={metrics.totalItems} tint="#D1FAE5" />
                <SummaryCard label="Low Stock" value={metrics.lowStock} tint="#FEE2E2" />
              </View>
              <View style={styles.cardsRow}>
                <SummaryCard label="Dispensed Prescriptions" value={metrics.totalDispensed} tint="#E0E7FF" />
              </View>
              <View style={styles.cardsRow}>
                <SummaryCard label="Total Medicines Dispensed" value={metrics.totalQtyDispensed} tint="#FDE68A" />
              </View>

              {/* Top Medicines */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Top Medicines (Dispensed)</Text>
                {metrics.topMeds.length === 0 ? (
                  <Text style={styles.empty}>No data yet.</Text>
                ) : (
                  metrics.topMeds.map((m) => (
                    <View key={m.id} style={styles.row}> 
                      <View style={styles.avatar}>
                        <Image source={require('../../assets/medicine_icon.png')} style={{ width: 16, height: 16, tintColor: GREEN }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{m.generic} • {m.dosageType}</Text>
                        <Text style={styles.meta}>Brand: {m.brand} • Stock: {m.stock}</Text>
                      </View>
                      <View style={styles.badge}><Text style={styles.badgeText}>{m.dispensedThisMonth}</Text></View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => navigation.navigate('PharmacyInventory')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription')} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine')} />
          <BottomItem label="Reports" active source={require('../../assets/reports_icon.png')} onPress={() => {}} />
        </View>
        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('PharmacyProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => {
                setShowProfileMenu(false);
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: '#F3F4F6' }]}> 
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }]}>{value}</Text>
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
  container: { flex: 1, paddingBottom: 110 },

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
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },

  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { padding: 16, paddingBottom: 120 },

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
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  badge: { minWidth: 28, height: 24, borderRadius: 12, backgroundColor: '#E5F7F0', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  badgeText: { color: GREEN, fontWeight: '700' },
  empty: { color: MUTED, fontStyle: 'italic' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { color: MUTED, fontSize: 16 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
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
  // Profile menu styles
  menuOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end', padding: 16 },
  menuCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 70, borderWidth: 1, borderColor: BORDER },
  menuItem: { paddingVertical: 12, alignItems: 'center' },
  menuText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  menuCancel: { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  menuCancelText: { color: MUTED, fontWeight: '700' },
});

