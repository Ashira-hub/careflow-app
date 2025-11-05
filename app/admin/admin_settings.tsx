import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ScrollView, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function AdminSettings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Load persisted dark mode preference
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('admin_dark_mode');
        if (raw != null) setDarkMode(raw === '1');
      } catch {}
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
  }, []);

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

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        <ScrollView contentContainerStyle={[styles.scrollContent]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.screenTitle, darkMode && { color: '#22C55E' }]}>Settings</Text>

          <View style={[styles.sectionCard, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}>
            <Text style={[styles.sectionTitle, darkMode && { color: '#E5E7EB' }]}>Profile & Appearance</Text>
            <TouchableOpacity style={[styles.itemRow, darkMode && { borderTopColor: '#1F2937' }]} onPress={() => navigation.navigate('AdminProfile' as never)}>
              <Text style={[styles.itemLabel, darkMode && { color: '#E5E7EB' }]}>Edit Profile</Text>
              <Text style={[styles.itemValue, darkMode && { color: '#9CA3AF' }]}>{'>'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.itemRow, darkMode && { borderTopColor: '#1F2937' }]} onPress={() => navigation.navigate('AdminNotification' as never)}>
              <Text style={[styles.itemLabel, darkMode && { color: '#E5E7EB' }]}>Notification</Text>
              <Text style={[styles.itemValue, darkMode && { color: '#9CA3AF' }]}>{'>'}</Text>
            </TouchableOpacity>
            <View style={[styles.itemRow, darkMode && { borderTopColor: '#1F2937' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.itemLabel, darkMode && { color: '#E5E7EB' }]}>Dark Mode</Text>
                <View style={[styles.badge, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={{ color: GREEN, fontWeight: '700', fontSize: 10 }}>BETA</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={async (v) => {
                  setDarkMode(v);
                  try { await AsyncStorage.setItem('admin_dark_mode', v ? '1' : '0'); } catch {}
                }}
                thumbColor={darkMode ? GREEN : '#FFF'}
                trackColor={{ true: '#BBF7D0', false: '#E5E7EB' }}
              />
            </View>
          </View>

          {/* Danger Zone removed per request */}
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
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <BottomItem label="Users" source={require('../../assets/profile_icon.png')} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('AdminReports' as never)} />
          <BottomItem label="Settings" active source={require('../../assets/settings_icon.png')} onPress={() => {}} />
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
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  scrollContent: { padding: 16, paddingBottom: 120 },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },

  sectionCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginTop: 16 },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  itemLabel: { color: '#111827', fontWeight: '700' },
  itemValue: { color: MUTED, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontWeight: '700' },

  dangerBtn: { marginTop: 8, backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  dangerText: { color: '#B91C1C', fontWeight: '800' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
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

