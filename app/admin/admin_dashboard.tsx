import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [usersCount, setUsersCount] = React.useState(0);
  const [activeUsersCount, setActiveUsersCount] = React.useState(0);
  const [darkMode, setDarkMode] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [welcomeMsg, setWelcomeMsg] = React.useState<string>('');

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return { 'Content-Type': 'application/json' } as Record<string, string>;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string, string>;
      return { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  const loadCounts = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : (Array.isArray(data.data) ? data.data : []));
      setUsersCount(arr.length);
      setActiveUsersCount(arr.filter((u: any) => u.active === true).length);
    } catch {}
  }, [API_BASE, getAuthHeaders]);

  React.useEffect(() => {
    loadCounts();
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
        if (av) setAvatarUri(String(av)); else {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          if (cache?.avatar_uri) setAvatarUri(String(cache.avatar_uri));
        }
      } catch {}
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arr: any[] = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => !n.read).length : 0;
        setUnreadCount(unread);
      } catch {}
    })();
  }, [loadCounts]);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
        if (av) setAvatarUri(String(av)); else {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          setAvatarUri(cache?.avatar_uri || undefined);
        }
      } catch {}
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arr: any[] = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => !n.read).length : 0;
        setUnreadCount(unread);
      } catch {}
      try {
        const msg = await AsyncStorage.getItem('welcome_pending_message');
        if (msg) {
          setWelcomeMsg(msg);
          setShowWelcome(true);
          await AsyncStorage.removeItem('welcome_pending_message');
          setTimeout(() => setShowWelcome(false), 4000);
        }
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
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {showWelcome && (
          <View style={[styles.welcomeBanner, { top: insets.top + 48 }, darkMode && { backgroundColor: '#052e1f', borderColor: '#14532d' }]}> 
            <Text style={[styles.welcomeText]}>{welcomeMsg || 'Welcome back!'}</Text>
            <TouchableOpacity onPress={() => setShowWelcome(false)}>
              <Text style={styles.welcomeClose}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Admin Dashboard</Text>
          </View>

          <View style={styles.cardsRow}>
            <SummaryCard label="Users" value={usersCount} tint="#D1FAE5" darkMode={darkMode} />
            <SummaryCard label="Active Users" value={activeUsersCount} tint="#FEF3C7" darkMode={darkMode} />
          </View>

          <View style={[styles.sectionCard, darkMode && { backgroundColor: '#1F2937', borderColor: '#1F2937' }]}>
            <Text style={[styles.sectionTitle, darkMode && { color: '#22C55E' }]}>Quick Actions</Text>
            <View style={styles.grid}>
              <DashboardCard title="Manage Users" icon={require('../../assets/patient_records_icon.png')} description="Add, edit, or disable user accounts" darkMode={darkMode} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
              <DashboardCard title="Reports" icon={require('../../assets/reports_icon.png')} description="View activity and audit logs" darkMode={darkMode} onPress={() => navigation.navigate('AdminReports' as never)} />
              <DashboardCard title="Settings" icon={require('../../assets/settings_icon.png')} description="Configure app preferences" darkMode={darkMode} onPress={() => navigation.navigate('AdminSettings' as never)} />
            </View>
          </View>
        </ScrollView>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('AdminProfile' as never); }}>
                <Text style={[styles.dropdownText, darkMode && { color: '#E5E7EB' }]}>Profile</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, darkMode && { backgroundColor: '#1F2937' }]} />
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

        <View style={[styles.bottomBar, darkMode && { backgroundColor: '#111827', borderTopColor: '#1F2937' }]}>
          <BottomItem
            label="Home"
            active
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('AdminDashboard' as never)}
          />
          <BottomItem label="Users" source={require('../../assets/profile_icon.png')} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('AdminReports' as never)} />
          <BottomItem label="Settings" source={require('../../assets/settings_icon.png')} onPress={() => navigation.navigate('AdminSettings' as never)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, tint, darkMode }: { label: string; value: number; tint: string; darkMode?: boolean }) {
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: '#F3F4F6' }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
      <Text style={[styles.cardLabel, darkMode && { color: '#9CA3AF' }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }, darkMode && { color: '#22C55E' }]}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
  );
}

function DashboardCard({ title, icon, description, darkMode, onPress }: { title: string; icon: any; description: string; darkMode?: boolean; onPress?: () => void }) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container style={[styles.cardItem, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <Text style={[styles.cardTitle, darkMode && { color: '#E5E7EB' }]}>{title}</Text>
        <Image source={icon} style={styles.cardImg} resizeMode="contain" />
      </View>
      <Text style={[styles.cardText, darkMode && { color: '#9CA3AF' }]} numberOfLines={3}>{description}</Text>
    </Container>
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
  welcomeBanner: { position: 'absolute', left: 16, right: 16, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  welcomeText: { color: GREEN, fontWeight: '700' },
  welcomeClose: { color: GREEN, fontWeight: '800', fontSize: 18, lineHeight: 18, paddingLeft: 8 },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  scrollContent: { padding: 16, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardLabel: { color: MUTED },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  cardBar: { height: 6, borderRadius: 4, marginTop: 10 },

  sectionCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginTop: 16 },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  cardItem: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#111827', fontWeight: '700' },
  cardImg: { width: 24, height: 24, tintColor: GREEN },
  cardText: { color: MUTED, fontSize: 12, marginTop: 8 },

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

