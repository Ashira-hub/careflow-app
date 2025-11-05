import React from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalImmediateNotification } from '../../utils/notifications';
import { useNavigation, useRoute } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function PharmacyPrescriptionAccepted() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item = route.params?.item;
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<string, string>;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id;
      const withAuth = token ? { ...base, Authorization: `Bearer ${token}` } : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  const onDispensed = async () => {
    try {
      // Update backend status to dispensed (best-effort)
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(`${API_BASE}/api/prescription/${encodeURIComponent(String(item?.id))}/status`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ status: 'dispensed' }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          console.warn('Dispense status failed:', resp.status, data?.message);
        }
      } catch (e) {
        console.warn('Dispense notify error:', (e as any)?.message);
      }

      // Mirror to AsyncStorage list so UI updates immediately
      try {
        const raw = await AsyncStorage.getItem('prescriptions');
        const arr = raw ? JSON.parse(raw) : [];
        const idx = Array.isArray(arr) ? arr.findIndex((r: any) => String(r.id) === String(item?.id)) : -1;
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], status: 'dispensed', dispensedAt: Date.now() };
          await AsyncStorage.setItem('prescriptions', JSON.stringify(arr));
        }
      } catch {}

      // Reduce inventory stock based on dispensed quantity (best-effort name match)
      try {
        const qty = Number(item?.quantity || 0);
        if (Number.isFinite(qty) && qty > 0) {
          // Load inventory and try to find a match by name
          const resInv = await fetch(`${API_BASE}/api/inventory`);
          if (resInv.ok) {
            const rows = await resInv.json();
            const list = Array.isArray(rows) ? rows.map((r: any) => ({
              id: String(r.id),
              name: `${r.genericName || ''}${r.brandName ? ` (${r.brandName})` : ''}`.trim(),
            })) : [];
            const medName = String(item?.medicine || '').trim().toLowerCase();
            let found = list.find((m: any) => m.name.toLowerCase() === medName);
            if (!found && medName) {
              found = list.find((m: any) => m.name.toLowerCase().includes(medName));
            }
            if (found?.id) {
              try {
                await fetch(`${API_BASE}/api/inventory/${encodeURIComponent(found.id)}/stock`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ delta: -qty }),
                });
              } catch {}
            }
          }
        }
      } catch {}

      // Notify doctor immediately (phone push + inbox)
      try {
        const summary = `${item?.medicine || ''}${item?.dosage ? ` • ${item?.dosage}` : ''}${item?.quantity ? ` • Qty: ${item?.quantity}` : ''}${item?.patient ? ` • Patient: ${item?.patient}` : ''}`.trim();
        const draw = await AsyncStorage.getItem('doctor_notifications');
        const darr = draw ? JSON.parse(draw) : [];
        const dnotif = {
          id: `PRX-DISP-${Date.now()}`,
          title: 'Prescription dispensed by Pharmacy',
          message: summary || 'A prescription was dispensed by the pharmacy.',
          timestamp: Date.now(),
          read: false,
          status: 'dispensed',
        };
        await AsyncStorage.setItem('doctor_notifications', JSON.stringify([dnotif, ...Array.isArray(darr) ? darr : []]));
        try { await showLocalImmediateNotification(dnotif.title, dnotif.message); } catch {}
      } catch {}

      Alert.alert('Dispensed', 'Prescription marked as dispensed.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark as dispensed');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => Alert.alert('Notifications')}>
              <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileMenu(true)}>
              <View style={styles.avatarCircle}>
                <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={{ padding: 16 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Prescription Details</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn2}>
              <Text style={styles.backText2}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Medicine</Text>
            <Text style={styles.value}>{item?.medicine || '-'}</Text>

            <Text style={styles.label}>Patient</Text>
            <Text style={styles.value}>{item?.patient || '-'}</Text>

            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>{item?.quantity ?? '-'}</Text>

            <Text style={styles.label}>Dosage</Text>
            <Text style={styles.value}>{item?.dosage || '-'}</Text>

            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{item?.notes || '-'}</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={onDispensed}>
            <Text style={styles.primaryText}>DISPENSED</Text>
          </TouchableOpacity>
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
  title: { color: GREEN, fontWeight: '700', fontSize: 16, marginTop: 12, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -10, marginBottom: 6 },
  backBtn2: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  backText2: { color: GREEN, fontWeight: '700' },
  card: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  label: { color: MUTED, marginTop: 8 },
  value: { color: '#111827', fontWeight: '700' },
  primaryBtn: { marginTop: 16, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

