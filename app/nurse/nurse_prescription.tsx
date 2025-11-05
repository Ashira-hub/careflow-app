import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type RxItem = {
  id: string;
  patient: string;
  subject: string;
  quantity: string;
  dosageStrength: string;
  description?: string;
  from?: 'pharmacy' | 'doctor';
  status?: 'new' | 'acknowledged' | 'done';
  submittedAt?: string;
};

export default function NursePrescription() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const initial: RxItem[] = useMemo(() => {
    const fromParams: RxItem[] = (route?.params?.prescriptions as any) || [];
    if (Array.isArray(fromParams) && fromParams.length) return fromParams.map((r) => ({ ...r, status: r.status || 'new' }));
    return [];
  }, [route?.params]);

  const [items, setItems] = useState<RxItem[]>(initial);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);

  const setStatusOverride = async (id: string, status: RxItem['status']) => {
    try {
      const sraw = await AsyncStorage.getItem('nurse_prescription_status');
      const map = sraw ? JSON.parse(sraw) : {};
      map[String(id)] = status;
      await AsyncStorage.setItem('nurse_prescription_status', JSON.stringify(map));
    } catch {}
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const addActivity = React.useCallback(async (title: string) => {
    try {
      const raw = await AsyncStorage.getItem('nurse_activity');
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const next = [{ id: String(Date.now()), title, type: 'prescription', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
      await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
    } catch {}
  }, []);

  // Parse summary built by pharmacy acceptance notification
  // Example: "Amoxicillin • 500mg • Qty: 14 • Patient: John Doe"
  const parseNotifToRx = (id: string, title: string, message: string): RxItem | null => {
    try {
      if (!title?.toLowerCase().includes('prescription ready to claim')) return null;
      const parts = message.split('•').map(p => p.trim()).filter(Boolean);
      const medicine = parts[0] || '';
      let dosageStrength = '';
      let quantity = '';
      let patient = '';
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (/^qty:/i.test(p)) quantity = p.split(':').slice(1).join(':').trim();
        else if (/^patient:/i.test(p)) patient = p.split(':').slice(1).join(':').trim();
        else if (!dosageStrength) dosageStrength = p;
      }
      return {
        id,
        patient,
        subject: medicine,
        quantity: String(quantity || ''),
        dosageStrength: String(dosageStrength || ''),
        description: 'Ready to claim',
        from: 'pharmacy',
        status: 'new',
        submittedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  };

  // Load pharmacy-accepted notifications into nurse prescription list
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const nraw = await AsyncStorage.getItem('nurse_notifications');
          const narr = nraw ? JSON.parse(nraw) : [];
          const notifs: any[] = Array.isArray(narr) ? narr : [];
          const rxFromNotifs: RxItem[] = notifs
            .filter(n => n && typeof n === 'object' && (String(n.id).startsWith('NRX-') || String(n.title || '').toLowerCase().includes('prescription ready to claim')))
            .map(n => parseNotifToRx(String(n.id), String(n.title || ''), String(n.message || '')))
            .filter(Boolean) as RxItem[];

          // Merge with any items from route params-derived initial
          const base = initial;
          const byId: Record<string, RxItem> = {};
          for (const r of base) byId[r.id] = r;
          for (const r of rxFromNotifs) byId[r.id] = r;
          let merged = Object.values(byId);

          // Apply status overrides from storage
          try {
            const sraw = await AsyncStorage.getItem('nurse_prescription_status');
            const statusMap = sraw ? JSON.parse(sraw) : {};
            if (statusMap && typeof statusMap === 'object') {
              merged = merged.map((it) => ({ ...it, status: (statusMap as any)[it.id] || it.status }));
            }
          } catch {}

          // Hide prescriptions already marked as done
          setItems(merged.filter((it) => it.status !== 'done'));
        } catch {
          // fall back to initial
          setItems(initial.filter((it) => it.status !== 'done'));
        }
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
        // Load unread notifications count
        try {
          const rawN = await AsyncStorage.getItem('nurse_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Log activity for viewing prescriptions
        try {
          const raw = await AsyncStorage.getItem('nurse_activity');
          const arr: any[] = raw ? JSON.parse(raw) : [];
          const next = [{ id: String(Date.now()), title: 'Viewed Prescriptions', type: 'prescription', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
          await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
        } catch {}
      })();
      return () => {};
    }, [initial])
  );

  const ack = (id: string) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'acknowledged' } : x)));
  const done = async (id: string) => {
    try { await setStatusOverride(id, 'done'); } catch {}
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const onAcknowledge = async (id: string) => {
    try { await setStatusOverride(id, 'acknowledged'); } catch {}
    await addActivity('Acknowledged a prescription');
    ack(id);
  };

  const onDone = async (id: string) => {
    await done(id);
    await addActivity('Marked a prescription as done');
  };

  const badgeStyle = (s?: RxItem['status']) => {
    if (s === 'done') return { bg: '#DCFCE7', bd: '#16A34A', tx: '#166534', label: 'DONE' };
    if (s === 'acknowledged') return { bg: '#FEF9C3', bd: '#F59E0B', tx: '#92400E', label: 'ACK' };
    return { bg: '#DBEAFE', bd: '#3B82F6', tx: '#1E3A8A', label: 'NEW' };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NurseNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.notifBadgeWrap}>
                  <Text style={styles.notifBadgeText}>{Math.min(99, unreadCount)}</Text>
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

        <FlatList
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, backgroundColor: CARD_BG }}
          ListHeaderComponent={() => (
            <View style={{ paddingTop: 8, paddingBottom: 12 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Prescriptions</Text>
              </View>
              <View style={styles.sectionDivider} />
            </View>
          )}
          data={items}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={() => (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: MUTED }}>No prescriptions received.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const b = badgeStyle(item.status);
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('NursePrescriptionDetails', { rx: item })}>
                <View style={styles.rxCard}>
                  <View style={styles.rxRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rxTitle} numberOfLines={1}>{item.subject} • {item.dosageStrength}</Text>
                      <Text style={styles.rxSub} numberOfLines={1}>Patient: {item.patient}</Text>
                      <Text style={styles.rxSub} numberOfLines={2}>Qty: {item.quantity}{item.description ? ` • ${item.description}` : ''}</Text>
                      {!!item.submittedAt && <Text style={[styles.rxSub, { fontStyle: 'italic' }]}>{new Date(item.submittedAt).toLocaleString()}</Text>}
                    </View>
                    <View style={styles.rightCol}>
                      <View style={[styles.badge, { backgroundColor: b.bg, borderColor: b.bd }]}>
                        <Text style={[styles.badgeText, { color: b.tx }]}>{b.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard')} />
          <BottomItem label="Schedule" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NurseSchedule')} />
          <BottomItem label="Prescription" active source={require('../../assets/prescription_icon.png')} onPress={() => {}} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('NurseReports')} />
        </View>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('NurseProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={async () => { setShowProfileMenu(false); try { await AsyncStorage.removeItem('session'); } catch {}; navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
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
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  notifBadgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { paddingHorizontal: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, textAlign: 'left', flex: 1 },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8, marginBottom: 12 },

  rxCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  rxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  rxTitle: { color: '#111827', fontWeight: '800' },
  rxSub: { color: MUTED, marginTop: 2, fontSize: 12 },
  actionsCol: { gap: 8 },
  rightCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF' },
  actionText: { fontWeight: '700' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

