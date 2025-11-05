import React from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalImmediateNotification } from '../../utils/notifications';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function PharmacyPrescriptionDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item = route.params?.item;
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);

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

  const onAccept = async () => {
    try {
      // Notify backend (will create a doctor notification if the prescription has created_by_user_id)
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(`${API_BASE}/api/prescription/${encodeURIComponent(String(item?.id))}/status`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ status: 'accepted' }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          console.warn('Accept status failed:', resp.status, data?.message);
        }
      } catch (e) {
        console.warn('Accept notify error:', (e as any)?.message);
      }

      // Update prescriptions list to accepted
      try {
        const raw = await AsyncStorage.getItem('prescriptions');
        const arr = raw ? JSON.parse(raw) : [];
        const idx = Array.isArray(arr) ? arr.findIndex((r: any) => String(r.id) === String(item?.id)) : -1;
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], status: 'accepted' };
          await AsyncStorage.setItem('prescriptions', JSON.stringify(arr));
        }
      } catch {}

      // Send nurse notification: Prescription ready to claim
      try {
        const nraw = await AsyncStorage.getItem('nurse_notifications');
        const narr = nraw ? JSON.parse(nraw) : [];
        const summary = `${item?.medicine || ''}${item?.dosage ? ` • ${item?.dosage}` : ''}${item?.quantity ? ` • Qty: ${item?.quantity}` : ''}${item?.patient ? ` • Patient: ${item?.patient}` : ''}`.trim();
        const notif = {
          id: `NRX-${Date.now()}`,
          title: 'Prescription ready to claim',
          message: summary || 'A prescription has been accepted and is ready for pickup.',
          timestamp: Date.now(),
          read: false,
          status: 'accepted',
        };
        const nextN = [notif, ...Array.isArray(narr) ? narr : []];
        await AsyncStorage.setItem('nurse_notifications', JSON.stringify(nextN));
      } catch {}

      // Also notify doctor immediately (phone push + inbox)
      try {
        const summary = `${item?.medicine || ''}${item?.dosage ? ` • ${item?.dosage}` : ''}${item?.quantity ? ` • Qty: ${item?.quantity}` : ''}${item?.patient ? ` • Patient: ${item?.patient}` : ''}`.trim();
        const draw = await AsyncStorage.getItem('doctor_notifications');
        const darr = draw ? JSON.parse(draw) : [];
        const dnotif = {
          id: `PRX-ACC-${Date.now()}`,
          title: 'Prescription accepted by Pharmacy',
          message: summary || 'A prescription was accepted by the pharmacy.',
          timestamp: Date.now(),
          read: false,
          status: 'accepted',
        };
        await AsyncStorage.setItem('doctor_notifications', JSON.stringify([dnotif, ...Array.isArray(darr) ? darr : []]));
        try { await showLocalImmediateNotification(dnotif.title, dnotif.message); } catch {}
      } catch {}
    } finally {
      Alert.alert('Accepted', 'Prescription accepted.');
      navigation.goBack();
    }
  };
  const onReject = () => {
    Alert.alert('Rejected', 'Prescription rejected.');
    navigation.goBack();
  };

  // Refresh unread notification count on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('pharmacy_notifications');
          const arr = raw ? JSON.parse(raw) : [];
          const n = Array.isArray(arr) ? arr.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Load avatar from session or per-user key
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
      })();
      return () => {};
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PharmacyNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
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

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.primaryBtn]} activeOpacity={0.9} onPress={onAccept}>
              <Text style={styles.primaryText}>ACCEPT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineBtn]} activeOpacity={0.9} onPress={onReject}>
              <Text style={styles.outlineText}>REJECT</Text>
            </TouchableOpacity>
          </View>
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
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
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
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  primaryBtn: { flex: 1, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignItems: 'center', marginRight: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  outlineBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN, paddingVertical: 12, borderRadius: 20, alignItems: 'center', marginLeft: 8 },
  outlineText: { color: GREEN, fontWeight: '700' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

