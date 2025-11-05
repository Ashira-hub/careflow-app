import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalImmediateNotification } from '../../utils/notifications';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function NursePrescriptionDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rx = route?.params?.rx || {};
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const addActivity = React.useCallback(async (title: string) => {
    try {
      const raw = await AsyncStorage.getItem('nurse_activity');
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const next = [{ id: String(Date.now()), title, type: 'prescription', timestamp: Date.now() }, ...(Array.isArray(arr) ? arr : [])];
      await AsyncStorage.setItem('nurse_activity', JSON.stringify(next.slice(0, 100)));
    } catch {}
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('session');
          if (raw) {
            const sess = JSON.parse(raw);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
            setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
          }
        } catch {}
        // load unread notifications
        try {
          const rawN = await AsyncStorage.getItem('nurse_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        try { await addActivity('Opened Prescription Details'); } catch {}
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
              <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
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

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Prescription Details</Text>
            <TouchableOpacity style={styles.backBtnCorner} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.backText}>{'<'} Back</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.title}>{rx?.subject ?? '—'} • {rx?.dosageStrength ?? ''}</Text>
              {!!rx?.status && (
                <View style={[styles.badge, badgeColors(rx?.status)]}>
                  <Text style={[styles.badgeText, badgeText(rx?.status)]}>{(rx?.status || 'NEW').toUpperCase()}</Text>
                </View>
              )}
            </View>
            {!!rx?.patient && <Text style={styles.row}>Patient: <Text style={styles.val}>{rx.patient}</Text></Text>}
            {!!rx?.quantity && <Text style={styles.row}>Quantity: <Text style={styles.val}>{rx.quantity}</Text></Text>}
            {!!rx?.description && <Text style={styles.row}>Instruction: <Text style={styles.val}>{rx.description}</Text></Text>}
            {!!rx?.submittedAt && <Text style={[styles.row, { fontStyle: 'italic' }]}>Submitted: <Text style={styles.val}>{new Date(rx.submittedAt).toLocaleString()}</Text></Text>}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#3B82F6' }]}
                onPress={async () => {
                  try {
                    // Persist status override
                    const sraw = await AsyncStorage.getItem('nurse_prescription_status');
                    const map = sraw ? JSON.parse(sraw) : {};
                    map[String(rx?.id)] = 'acknowledged';
                    await AsyncStorage.setItem('nurse_prescription_status', JSON.stringify(map));

                    // Notify doctor and pharmacy
                    const summary = `${rx?.subject || ''}${rx?.dosageStrength ? ` • ${rx?.dosageStrength}` : ''}${rx?.quantity ? ` • Qty: ${rx?.quantity}` : ''}${rx?.patient ? ` • Patient: ${rx?.patient}` : ''}`.trim();
                    const notif = {
                      id: `ACK-${Date.now()}`,
                      title: 'Prescription acknowledged by Nurse',
                      message: summary || 'A prescription has been acknowledged by the nurse.',
                      timestamp: Date.now(),
                      read: false,
                      status: 'acknowledged',
                    };
                    try {
                      const draw = await AsyncStorage.getItem('doctor_notifications');
                      const darr = draw ? JSON.parse(draw) : [];
                      await AsyncStorage.setItem('doctor_notifications', JSON.stringify([notif, ...Array.isArray(darr) ? darr : []]));
                      try { await showLocalImmediateNotification(notif.title, notif.message); } catch {}
                    } catch {}
                    try {
                      const praw = await AsyncStorage.getItem('pharmacy_notifications');
                      const parr = praw ? JSON.parse(praw) : [];
                      await AsyncStorage.setItem('pharmacy_notifications', JSON.stringify([notif, ...Array.isArray(parr) ? parr : []]));
                      try { await showLocalImmediateNotification(notif.title, notif.message); } catch {}
                    } catch {}
                  } finally {
                    try { await addActivity('Acknowledged a prescription'); } catch {}
                    Alert.alert('Acknowledge', 'Prescription acknowledged.');
                    navigation.goBack();
                  }
                }}
              >
                <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Acknowledge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#16A34A' }]}
                onPress={async () => {
                  try {
                    const sraw = await AsyncStorage.getItem('nurse_prescription_status');
                    const map = sraw ? JSON.parse(sraw) : {};
                    map[String(rx?.id)] = 'done';
                    await AsyncStorage.setItem('nurse_prescription_status', JSON.stringify(map));
                    const summary = `${rx?.subject || ''}${rx?.dosageStrength ? ` • ${rx?.dosageStrength}` : ''}${rx?.quantity ? ` • Qty: ${rx?.quantity}` : ''}${rx?.patient ? ` • Patient: ${rx?.patient}` : ''}`.trim();
                    const notif = {
                      id: `DONE-${Date.now()}`,
                      title: 'Prescription accepted by Nurse',
                      message: summary || 'A prescription has been accepted by the nurse.',
                      timestamp: Date.now(),
                      read: false,
                      status: 'done',
                    };
                    try {
                      const draw = await AsyncStorage.getItem('doctor_notifications');
                      const darr = draw ? JSON.parse(draw) : [];
                      await AsyncStorage.setItem('doctor_notifications', JSON.stringify([notif, ...Array.isArray(darr) ? darr : []]));
                      try { await showLocalImmediateNotification(notif.title, notif.message); } catch {}
                    } catch {}
                    // Also notify pharmacy inbox + push
                    try {
                      const praw = await AsyncStorage.getItem('pharmacy_notifications');
                      const parr = praw ? JSON.parse(praw) : [];
                      await AsyncStorage.setItem('pharmacy_notifications', JSON.stringify([notif, ...Array.isArray(parr) ? parr : []]));
                      try { await showLocalImmediateNotification(notif.title, notif.message); } catch {}
                    } catch {}
                  } finally {
                    try { await addActivity('Marked a prescription as done'); } catch {}
                    Alert.alert('Done', 'Prescription marked done.');
                    navigation.goBack();
                  }
                }}
              >
                <Text style={[styles.actionText, { color: '#166534' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('NurseDashboard' as never)} />
          <BottomItem label="Schedule" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('NurseSchedule' as never)} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('NursePrescription' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('NurseReports' as never)} />
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

function badgeColors(status?: string) {
  if (status === 'done') return { backgroundColor: '#DCFCE7', borderColor: '#16A34A' };
  if (status === 'acknowledged') return { backgroundColor: '#FEF9C3', borderColor: '#F59E0B' };
  return { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' };
}
function badgeText(status?: string) {
  if (status === 'done') return { color: '#166534' };
  if (status === 'acknowledged') return { color: '#92400E' };
  return { color: '#1E3A8A' };
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
  backText: { color: GREEN, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 0, marginBottom: 12 },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
  backBtnCorner: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  card: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  title: { color: '#111827', fontWeight: '800', marginBottom: 8 },
  row: { color: MUTED, marginTop: 6 },
  val: { color: '#111827' },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF' },
  actionText: { fontWeight: '700' },

  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  // Bottom bar styles
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
});

