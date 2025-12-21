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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function DoctorDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showActivity, setShowActivity] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [activityData, setActivityData] = React.useState<
    Array<{
      id: string;
      title: string;
      time?: string;
      timestamp?: number;
      type?: string;
    }>
  >([]);
  const [apptCount, setApptCount] = React.useState(0);
  const [rxCount, setRxCount] = React.useState(0);
  const [prCount, setPrCount] = React.useState(0);
  const [reportCount, setReportCount] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(
    undefined,
  );
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [welcomeMsg, setWelcomeMsg] = React.useState<string>('');

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<
        string,
        string
      >;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id;
      const withAuth = token
        ? { ...base, Authorization: `Bearer ${token}` }
        : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch {
      return { 'Content-Type': 'application/json' } as Record<string, string>;
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('doctor_activity');
          const arr = raw ? JSON.parse(raw) : [];
          setActivityData(Array.isArray(arr) ? arr : []);
        } catch {
          setActivityData([]);
        }
        // Load unread notifications count
        try {
          const rawN = await AsyncStorage.getItem('doctor_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const count = Array.isArray(arrN)
            ? arrN.filter((n: any) => n && n.read === false).length
            : 0;
          setUnreadCount(count);
        } catch {
          setUnreadCount(0);
        }
        // Load counts
        try {
          const headers = await getAuthHeaders();
          // Appointments (pending)
          try {
            const res = await fetch(`${API_BASE}/api/appointments`, {
              headers,
            });
            if (res.ok) {
              const arr = await res.json();
              setApptCount(
                Array.isArray(arr)
                  ? arr.filter((a: any) => !a?.done).length
                  : 0,
              );
            } else {
              setApptCount(0);
            }
          } catch {
            setApptCount(0);
          }
          // Prescriptions from AsyncStorage
          try {
            const rawRx = await AsyncStorage.getItem('prescriptions');
            const list = rawRx ? JSON.parse(rawRx) : [];
            const n = Array.isArray(list)
              ? list.filter((p: any) => (p?.status || 'new') === 'new').length
              : 0;
            setRxCount(n);
          } catch {
            setRxCount(0);
          }
          // Patient Records count (distinct patients) via /api/patient-records
          try {
            const res2 = await fetch(`${API_BASE}/api/patient-records?own=1`, {
              headers,
            });
            if (res2.ok) {
              const rows = await res2.json();
              setPrCount(Array.isArray(rows) ? rows.length : 0);
            } else {
              setPrCount(0);
            }
          } catch {
            setPrCount(0);
          }
          // Reports + Monthly counts from /api/patient-records/all (mirror Reports screen logic)
          try {
            const res3 = await fetch(`${API_BASE}/api/patient-records/all`, {
              headers,
            });
            if (res3.ok) {
              const rows = await res3.json();
              const now = new Date();
              const m = now.getMonth();
              const y = now.getFullYear();
              const inMonth = (ts?: number) => {
                if (!ts) return false;
                const d = new Date(ts);
                return d.getMonth() === m && d.getFullYear() === y;
              };
              let apptM = 0;
              let rxM = 0;
              let totalM = 0;
              for (const r of Array.isArray(rows) ? rows : []) {
                const parsed = Date.parse(r?.created_at);
                const ts = isNaN(parsed) ? Date.now() : parsed;
                if (inMonth(ts)) {
                  const isRx = !!(
                    r?.medicine ||
                    r?.dosage ||
                    r?.dosage_strength
                  );
                  if (isRx) rxM += 1;
                  else apptM += 1;
                  totalM += 1;
                }
              }
              setApptCount(apptM);
              setRxCount(rxM);
              setReportCount(totalM);
            } else {
              setReportCount(0);
            }
          } catch {
            setReportCount(0);
          }
        } catch {}
        // Load avatar from session
        try {
          const rawS = await AsyncStorage.getItem('session');
          const sess = rawS ? JSON.parse(rawS) : null;
          const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
          setAvatarUri(uri || undefined);
        } catch {}
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
    }, [getAuthHeaders]),
  );
  const addActivity = React.useCallback(
    async (item: {
      id?: string;
      title: string;
      timestamp?: number;
      type?: string;
      time?: string;
    }) => {
      try {
        const raw = await AsyncStorage.getItem('doctor_activity');
        const arr: any[] = raw ? JSON.parse(raw) : [];
        const next = [
          {
            id: item.id || String(Date.now()),
            title: item.title,
            timestamp: item.timestamp || Date.now(),
            type: item.type,
            time: item.time,
          },
          ...(Array.isArray(arr) ? arr : []),
        ];
        await AsyncStorage.setItem(
          'doctor_activity',
          JSON.stringify(next.slice(0, 100)),
        );
        setActivityData(next);
      } catch {}
    },
    [],
  );
  const timeAgo = React.useCallback((ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, []);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Image
            source={require('../../assets/appicon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={async () => {
                await addActivity({
                  title: 'Viewed Notifications',
                  type: 'notifications',
                });
                navigation.navigate('DoctorNotification' as never);
              }}
            >
              <View style={{ position: 'relative' }}>
                <Image
                  source={require('../../assets/notification_icon.png')}
                  style={styles.headerIconImg}
                  resizeMode="contain"
                />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -6,
                      minWidth: 14,
                      height: 14,
                      paddingHorizontal: 3,
                      borderRadius: 7,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 9,
                        fontWeight: '700',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => setShowProfileMenu(true)}
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/appicon.png')}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {showWelcome && (
          <View style={[styles.welcomeBanner, { top: insets.top + 48 }]}>
            <Text style={styles.welcomeText}>
              {welcomeMsg || 'Welcome back!'}
            </Text>
            <TouchableOpacity onPress={() => setShowWelcome(false)}>
              <Text style={styles.welcomeClose}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.sectionDivider} />

          <View style={styles.grid}>
            <DashboardCard
              title="Appointment"
              iconSource={require('../../assets/appointment_icon.png')}
              accentColor="#2563EB"
              count={apptCount}
              tag="Pending"
              onPress={async () => {
                await addActivity({
                  title: 'Viewed Appointments',
                  type: 'appointment',
                });
                navigation.navigate('DoctorAppointment' as never);
              }}
            />
            <DashboardCard
              title="Prescription"
              iconSource={require('../../assets/prescription_icon.png')}
              accentColor="#10B981"
              count={rxCount}
              tag="New"
              onPress={async () => {
                await addActivity({
                  title: 'Viewed Prescriptions',
                  type: 'prescription',
                });
                navigation.navigate('DoctorPrescription' as never);
              }}
            />
            <DashboardCard
              title="Patient Records"
              iconSource={require('../../assets/patient_records_icon.png')}
              accentColor="#F59E0B"
              count={prCount}
              tag="Patients"
              onPress={async () => {
                await addActivity({
                  title: 'Viewed Patient Records',
                  type: 'records',
                });
                navigation.navigate('DoctorPatientRecords' as never);
              }}
            />
            <DashboardCard
              title="Reports"
              iconSource={require('../../assets/reports_icon.png')}
              accentColor="#8B5CF6"
              count={reportCount}
              tag="Entries"
              onPress={async () => {
                await addActivity({ title: 'Viewed Reports', type: 'reports' });
                navigation.navigate('DoctorReports' as never);
              }}
            />
          </View>

          <View style={[styles.activityCard, styles.cardShadow]}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => setShowActivity(true)}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activityBody}>
              {activityData.slice(0, 5).map((item, idx) => {
                const icon =
                  item.type === 'appointment'
                    ? require('../../assets/appointment_icon.png')
                    : item.type === 'prescription'
                    ? require('../../assets/prescription_icon.png')
                    : item.type === 'records'
                    ? require('../../assets/patient_records_icon.png')
                    : require('../../assets/reports_icon.png');
                const tint =
                  item.type === 'appointment'
                    ? '#3B82F6'
                    : item.type === 'prescription'
                    ? '#10B981'
                    : item.type === 'records'
                    ? '#F59E0B'
                    : '#8B5CF6';
                const bg =
                  item.type === 'appointment'
                    ? '#DBEAFE'
                    : item.type === 'prescription'
                    ? '#DCFCE7'
                    : item.type === 'records'
                    ? '#FEF3C7'
                    : '#EDE9FE';
                const subtitle =
                  item.time ||
                  (item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : '');
                const timeLabel = item.timestamp
                  ? timeAgo(item.timestamp)
                  : item.time || '';
                return (
                  <TouchableOpacity
                    key={item.id || String(idx)}
                    style={styles.activityItem}
                    activeOpacity={0.85}
                    onPress={() => setShowActivity(true)}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                      }}
                    >
                      <View
                        style={[
                          styles.activityLeft,
                          styles.activityLeftBadge,
                          { backgroundColor: bg },
                        ]}
                      >
                        <Image
                          source={icon}
                          style={[styles.activityIcon, { tintColor: tint }]}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={styles.activityItemTitle}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!!subtitle && (
                          <Text
                            style={styles.activityItemSub}
                            numberOfLines={1}
                          >
                            {subtitle}
                          </Text>
                        )}
                      </View>
                    </View>
                    {!!timeLabel && (
                      <Text style={styles.activityTime}>{timeLabel}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {activityData.length === 0 && (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={styles.activityItemSub}>
                    No recent activity.
                  </Text>
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
            onPress={() => navigation.navigate('DoctorDashboard')}
          />
          <BottomItem
            label="Appointment"
            source={require('../../assets/appointment_icon.png')}
            onPress={async () => {
              await addActivity({
                title: 'Viewed Appointments',
                type: 'appointment',
              });
              navigation.navigate('DoctorAppointment');
            }}
          />
          <BottomItem
            label="Prescription"
            source={require('../../assets/prescription_icon.png')}
            onPress={async () => {
              await addActivity({
                title: 'Viewed Prescriptions',
                type: 'prescription',
              });
              navigation.navigate('DoctorPrescription');
            }}
          />
          <BottomItem
            label="P-Records"
            source={require('../../assets/patient_records_icon.png')}
            onPress={async () => {
              await addActivity({
                title: 'Viewed Patient Records',
                type: 'records',
              });
              navigation.navigate('DoctorPatientRecords');
            }}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={async () => {
              await addActivity({ title: 'Viewed Reports', type: 'reports' });
              navigation.navigate('DoctorReports');
            }}
          />
        </View>
        {/* Recent Activity Modal */}
        <Modal
          visible={showActivity}
          animationType="fade"
          transparent
          onRequestClose={() => setShowActivity(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>All Recent Activity</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowActivity(false)}
                >
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={activityData}
                keyExtractor={item => item.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                  const icon =
                    item.type === 'appointment'
                      ? require('../../assets/appointment_icon.png')
                      : item.type === 'prescription'
                      ? require('../../assets/prescription_icon.png')
                      : item.type === 'records'
                      ? require('../../assets/patient_records_icon.png')
                      : require('../../assets/reports_icon.png');
                  const tint =
                    item.type === 'appointment'
                      ? '#3B82F6'
                      : item.type === 'prescription'
                      ? '#10B981'
                      : item.type === 'records'
                      ? '#F59E0B'
                      : '#8B5CF6';
                  const bg =
                    item.type === 'appointment'
                      ? '#DBEAFE'
                      : item.type === 'prescription'
                      ? '#DCFCE7'
                      : item.type === 'records'
                      ? '#FEF3C7'
                      : '#EDE9FE';
                  const subtitle =
                    item.time ||
                    (item.timestamp
                      ? new Date(item.timestamp).toLocaleString()
                      : '');
                  const timeLabel = item.timestamp
                    ? timeAgo(item.timestamp)
                    : item.time || '';
                  return (
                    <View style={styles.activityItem}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <View
                          style={[
                            styles.activityLeft,
                            styles.activityLeftBadge,
                            { backgroundColor: bg },
                          ]}
                        >
                          <Image
                            source={icon}
                            style={[styles.activityIcon, { tintColor: tint }]}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.activityItemTitle}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {!!subtitle && (
                            <Text
                              style={styles.activityItemSub}
                              numberOfLines={1}
                            >
                              {subtitle}
                            </Text>
                          )}
                        </View>
                      </View>
                      {!!timeLabel && (
                        <Text style={styles.activityTime}>{timeLabel}</Text>
                      )}
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowProfileMenu(false)}
            />
            <View
              style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}
            >
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  await addActivity({
                    title: 'Viewed Profile',
                    type: 'profile',
                  });
                  navigation.navigate('DoctorProfile');
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await AsyncStorage.multiRemove([
                      'session',
                      'doctor_activity',
                    ]);
                  } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function DashboardCard({
  title,
  iconSource,
  description,
  count,
  tag,
  accentColor = '#10B981',
  onPress,
}: {
  title: string;
  iconSource: any;
  description?: string;
  count?: number;
  tag?: string;
  accentColor?: string;
  onPress?: () => void;
}) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.card, styles.cardShadow]}
      {...(onPress ? { activeOpacity: 0.85, onPress } : {})}
    >
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardContentRow}>
        <View style={styles.iconCircle}>
          <Image
            source={iconSource}
            style={[styles.cardImg, { tintColor: accentColor }]}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bigNumber}>{Number(count || 0)}</Text>
          {!!(tag || description) && (
            <Text style={styles.subLabel} numberOfLines={2}>
              {tag || description}
            </Text>
          )}
        </View>
      </View>
    </Wrapper>
  );
}

function BottomItem({
  label,
  active,
  source,
  onPress,
}: {
  label: string;
  active?: boolean;
  source: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.bottomItem}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Image
        source={source}
        style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]}
        resizeMode="contain"
      />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>
        {label}
      </Text>
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
  iconText: { fontSize: 18, color: GREEN },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GREEN,
  },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  welcomeBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  welcomeText: { color: GREEN, fontWeight: '700' },
  welcomeClose: {
    color: GREEN,
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 18,
    paddingLeft: 8,
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 90 },
  title: { fontSize: 18, fontWeight: '700', color: '#000000', marginTop: 12 },
  sectionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 8,
    marginBottom: 12,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    position: 'relative',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardTitle: { color: '#0F172A', fontWeight: '700', marginBottom: 8 },
  cardContentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImg: { width: 22, height: 22 },
  bigNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 24,
  },
  subLabel: { color: MUTED, fontSize: 12, marginTop: 2 },

  activityCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTitle: { color: '#111827', fontWeight: '700' },
  viewAll: { color: GREEN, fontWeight: '700' },
  activityBody: { paddingTop: 8 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    gap: 10,
  },
  activityLeft: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLeftBadge: {
    borderWidth: 0,
  },
  activityIcon: { width: 18, height: 18, tintColor: GREEN },
  activityItemTitle: { color: '#111827', fontWeight: '700', fontSize: 13 },
  activityItemSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  activityTime: { color: MUTED, fontSize: 11 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 26, height: 26, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  // Dropdown styles
  dropdownOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  dropdownCard: {
    position: 'absolute',
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});
