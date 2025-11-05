import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function AdminProfile() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [birthdate, setBirthdate] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);

  const initials = React.useMemo(() => {
    const parts = (name || '').trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  const roleLabel = (r?: string) => {
    if (!r) return '';
    const key = String(r).toLowerCase();
    if (key === 'labstaff') return 'Lab Staff';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  const loadSession = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return;
      const sess = JSON.parse(raw);
      const user = sess?.user || sess;
      setName(user?.full_name || user?.fullName || user?.name || '');
      setEmail(user?.email || '');
      setRole(roleLabel(user?.role));
      setPhone(user?.phone || '');
      setAddress(user?.address || '');
      setBirthdate(user?.birthdate || '');
      setGender(user?.gender || '');
      let av = user?.avatar_uri || user?.avatarUrl || undefined;
      if (!av) {
        try {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          if (cache?.avatar_uri) av = cache.avatar_uri;
        } catch {}
      }
      setAvatarUri(av);
    } catch {}
  }, []);

  React.useEffect(() => { loadSession(); }, [loadSession]);
  useFocusEffect(React.useCallback(() => { loadSession(); return () => {}; }, [loadSession]));
  React.useEffect(() => {
    (async () => { try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {} })();
  }, []);
  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
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
                  <Image source={{ uri: avatarUri }} style={styles.avatarImgSm} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImgSm} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={[styles.screenTitle, darkMode && { color: '#22C55E' }]}>Profile</Text>

            <View style={[styles.profileCard, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}>
              <View style={styles.avatar}> 
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarText, darkMode && { color: '#22C55E' }]}>{initials}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, darkMode && { color: '#E5E7EB' }]}>{name}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('AdminEditProfile' as never)} activeOpacity={0.85}>
                    <Text style={[styles.editLink, darkMode && { color: '#22C55E' }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.role, darkMode && { color: '#9CA3AF' }]}>{role}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, darkMode && { backgroundColor: '#0B1220', borderColor: '#1F2937' }]}>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Full Name</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]} numberOfLines={2}>: {name || '—'}</Text></View>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Role</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]}>: {role || '—'}</Text></View>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Email</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]}>: {email || '—'}</Text></View>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Phone</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]}>: {phone || '—'}</Text></View>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Birthdate</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]}>: {birthdate || '—'}</Text></View>
              <View style={styles.kvRow}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Gender</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]}>: {gender || '—'}</Text></View>
              <View style={[styles.kvRow, { borderBottomWidth: 0 }]}><Text style={[styles.kvLabel, darkMode && { color: '#9CA3AF' }]}>Address</Text><Text style={[styles.kvValue, darkMode && { color: '#E5E7EB' }]} numberOfLines={2}>: {address || '—'}</Text></View>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.9} onPress={async () => {
                try { await AsyncStorage.removeItem('session'); } catch {}
                navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
              }}>
                <Text style={styles.logoutText}>LOGOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, darkMode && { backgroundColor: '#111827', borderTopColor: '#1F2937' }]}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <BottomItem label="Users" source={require('../../assets/profile_icon.png')} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('AdminReports' as never)} />
          <BottomItem label="Settings" source={require('../../assets/settings_icon.png')} onPress={() => navigation.navigate('AdminSettings' as never)} />
        </View>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); }}>
                <Text style={[styles.dropdownText, darkMode && { color: '#E5E7EB' }]}>Profile</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, darkMode && { backgroundColor: '#1F2937' }]} />
              <TouchableOpacity style={styles.dropdownItem} onPress={async () => {
                setShowProfileMenu(false);
                try { await AsyncStorage.removeItem('session'); } catch {}
                navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
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
  container: { flex: 1, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImgSm: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12, position: 'relative' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: GREEN, fontWeight: '700', fontSize: 18 },
  name: { color: '#111827', fontWeight: '800' },
  role: { color: MUTED, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  editLink: { color: GREEN, fontWeight: '700' },

  infoCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8, marginBottom: 8 },
  kvRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomColor: '#F3F4F6', borderBottomWidth: 1 },
  kvLabel: { width: 110, color: MUTED, fontWeight: '700' },
  kvValue: { flex: 1, color: '#111827', fontWeight: '600' },

  buttonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { marginTop: 16, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 28, minWidth: 180, alignItems: 'center' },
  logoutText: { color: '#FFFFFF', fontWeight: '700' },

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

