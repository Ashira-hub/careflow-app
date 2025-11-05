import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function LabDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showActivity, setShowActivity] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [activityData, setActivityData] = React.useState<Array<{ id: string; title: string; time?: string; timestamp?: number; type?: string }>>([]);
  const [labCount, setLabCount] = React.useState(0);
  const [recordsCount, setRecordsCount] = React.useState(0);
  const [reportsCount, setReportsCount] = React.useState(0);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [welcomeMsg, setWelcomeMsg] = React.useState<string>('');

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<string, string>;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      return token ? { ...base, Authorization: `Bearer ${token}` } : base;
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        // Load activity data
        const raw = await AsyncStorage.getItem('lab_activity');
        const arr = raw ? JSON.parse(raw) : [];
        setActivityData(Array.isArray(arr) ? arr : []);

        // Load notification count
        const rawNotifications = await AsyncStorage.getItem('lab_notifications');
        const notifications = rawNotifications ? JSON.parse(rawNotifications) : [];
        const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.read).length : 0;
        setNotificationCount(unreadCount);

        // Load counts from local lab_results (added tests/records/reports)
        try {
          const rawResults = await AsyncStorage.getItem('lab_results');
          const results = rawResults ? JSON.parse(rawResults) : [];
          const total = Array.isArray(results) ? results.length : 0;
          setLabCount(total);
          setRecordsCount(total);
          setReportsCount(total);
        } catch {
          setLabCount(0);
          setRecordsCount(0);
          setReportsCount(0);
        }
      } catch (error) {
        console.error('Error loading lab dashboard data:', error);
      }
      // Load avatar from session or stored avatar_<uid>
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
  }, [getAuthHeaders]);

  // Refresh counts and notifications when returning to dashboard
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        // Refresh recent activity
        try {
          const raw = await AsyncStorage.getItem('lab_activity');
          const arr = raw ? JSON.parse(raw) : [];
          setActivityData(Array.isArray(arr) ? arr : []);
        } catch { setActivityData([]); }

        try {
          const rawNotifications = await AsyncStorage.getItem('lab_notifications');
          const notifications = rawNotifications ? JSON.parse(rawNotifications) : [];
          const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.read).length : 0;
          setNotificationCount(unreadCount);
        } catch { setNotificationCount(0); }

        try {
          const rawResults = await AsyncStorage.getItem('lab_results');
          const results = rawResults ? JSON.parse(rawResults) : [];
          const total = Array.isArray(results) ? results.length : 0;
          setLabCount(total);
          setRecordsCount(total);
          setReportsCount(total);
        } catch {
          setLabCount(0);
          setRecordsCount(0);
          setReportsCount(0);
        }
        // Welcome banner
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
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('LabNotification' as never)}
              >
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {notificationCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, notificationCount)}</Text>
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

        {showWelcome && (
          <View style={[styles.welcomeBanner, { top: insets.top + 48 }]}> 
            <Text style={styles.welcomeText}>{welcomeMsg || 'Welcome back!'}</Text>
            <TouchableOpacity onPress={() => setShowWelcome(false)}>
              <Text style={styles.welcomeClose}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Laboratory Dashboard</Text>
          <View style={styles.sectionDivider} />

          <View style={styles.grid}>
            <DashboardCard
              title="Laboratory"
              icon={<Image source={require('../../assets/lab_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              count={labCount}
              tag="Tests"
              onPress={() => navigation.navigate('LabLaboratory' as never)}
            />
            <DashboardCard
              title="Lab Records"
              icon={<Image source={require('../../assets/patient_records_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              count={recordsCount}
              tag="Records"
              onPress={() => navigation.navigate('LabRecords' as never)}
            />
            <DashboardCard
              title="Reports"
              icon={<Image source={require('../../assets/reports_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              count={reportsCount}
              tag="Reports"
              onPress={() => navigation.navigate('LabReports' as never)}
            />
            <DashboardCard
              title="Notifications"
              icon={<Image source={require('../../assets/notification_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              count={notificationCount}
              tag="Unread"
              onPress={() => navigation.navigate('LabNotification' as never)}
            />
          </View>

          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => setShowActivity(true)}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activityBody}>
              {(activityData.slice(0, 5)).map((item, idx) => {
                const icon = item.type === 'lab'
                  ? require('../../assets/lab_icon.png')
                  : item.type === 'records'
                  ? require('../../assets/patient_records_icon.png')
                  : item.type === 'reports'
                  ? require('../../assets/reports_icon.png')
                  : require('../../assets/profile_icon.png');
                const subtitle = item.time || (item.timestamp ? new Date(item.timestamp).toLocaleString() : '');
                return (
                  <TouchableOpacity key={item.id || String(idx)} style={styles.activityItem} activeOpacity={0.85} onPress={() => setShowActivity(true)}>
                    <View style={styles.activityLeft}>
                      <Image source={icon} style={styles.activityIcon} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityItemTitle} numberOfLines={1}>{item.title}</Text>
                      {!!subtitle && <Text style={styles.activityItemSub}>{subtitle}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {activityData.length === 0 && (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={styles.activityItemSub}>No recent activity.</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            active
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('LabDashboard' as never)}
          />
          <BottomItem
            label="Laboratory"
            source={require('../../assets/lab_icon.png')}
            onPress={() => navigation.navigate('LabLaboratory' as never)}
          />
          <BottomItem
            label="Lab Records"
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('LabRecords' as never)}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={() => navigation.navigate('LabReports' as never)}
          />
        </View>

        <Modal visible={showActivity} animationType="fade" transparent onRequestClose={() => setShowActivity(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>All Recent Activity</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowActivity(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={activityData}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                  const icon = item.type === 'lab'
                    ? require('../../assets/lab_icon.png')
                    : item.type === 'records'
                    ? require('../../assets/patient_records_icon.png')
                    : item.type === 'reports'
                    ? require('../../assets/reports_icon.png')
                    : require('../../assets/profile_icon.png');
                  const subtitle = item.time || (item.timestamp ? new Date(item.timestamp).toLocaleString() : '');
                  return (
                    <View style={styles.activityItem}>
                      <View style={styles.activityLeft}>
                        <Image source={icon} style={styles.activityIcon} resizeMode="contain" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityItemTitle} numberOfLines={1}>{item.title}</Text>
                        {!!subtitle && <Text style={styles.activityItemSub}>{subtitle}</Text>}
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('LabProfile' as never); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try { await AsyncStorage.removeItem('session'); } catch {}
                  try { await AsyncStorage.removeItem('lab_activity'); } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function DashboardCard({ title, icon, description, count, tag, onPress }: { title: string; icon: React.ReactNode; description?: string; count?: number; tag?: string; onPress?: () => void }) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.cardIconWrap}>{icon}</View>
      </View>
      {!!(tag || count) && (
        <View style={styles.cardMetaRow}>
          {!!tag && (
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          )}
          {!!count && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{count}</Text>
            </View>
          )}
        </View>
      )}
      {!!description && <Text style={styles.cardText} numberOfLines={5}>{description}</Text>}
    </Container>
  );
}

function BottomItem({ label, active, source, onPress }: { label: string; active?: boolean; source: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.bottomItem} activeOpacity={0.8} onPress={onPress}>
      <Image source={source} style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]} resizeMode="contain" />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
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
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  welcomeBanner: { position: 'absolute', left: 16, right: 16, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  welcomeText: { color: GREEN, fontWeight: '700' },
  welcomeClose: { color: GREEN, fontWeight: '800', fontSize: 18, lineHeight: 18, paddingLeft: 8 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 90 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginTop: 12 },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginTop: 8, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { width: '48%', backgroundColor: CARD_BG, borderRadius: 14, padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { color: GREEN, fontWeight: '700' },
  cardIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardImg: { width: 18, height: 18, tintColor: GREEN },
  cardText: { color: MUTED, fontSize: 12 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badgeCount: { alignSelf: 'flex-start', marginBottom: 0, backgroundColor: '#E6FFF5', borderColor: GREEN, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, height: 22, alignItems: 'center', justifyContent: 'center' },
  badgeCountText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  tagPill: { backgroundColor: '#E6FFF5', borderColor: GREEN, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, height: 20, alignItems: 'center', justifyContent: 'center' },
  tagText: { color: GREEN, fontWeight: '700', fontSize: 10 },

  activityCard: { marginTop: 16, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityTitle: { color: GREEN, fontWeight: '700' },
  viewAll: { color: MUTED },
  activityBody: { paddingTop: 8 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F7', gap: 10 },
  activityLeft: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: GREEN, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  activityIcon: { width: 18, height: 18, tintColor: GREEN },
  activityItemTitle: { color: '#111827', fontWeight: '700', fontSize: 13 },
  activityItemSub: { color: MUTED, fontSize: 11, marginTop: 2 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 999 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, zIndex: 1000 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

