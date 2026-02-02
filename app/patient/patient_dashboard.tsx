import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../navigation/types';

// Types
type Appointment = {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

type MedicalRecord = {
  id: string;
  title: string;
  date: string;
  type: 'prescription' | 'lab_result' | 'consultation';
};

type PatientDashboardNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

const API_BASE = 'https://backend-careflow.vercel.app';

const PatientDashboard = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PatientDashboardNavigationProp>();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >([]);
  const [recentRecords, setRecentRecords] = useState<MedicalRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadUserData = async () => {
    try {
      const session = await AsyncStorage.getItem('session');
      if (session) {
        const { user } = JSON.parse(session);
        const derivedName =
          user?.full_name ||
          user?.fullName ||
          user?.name ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ');
        setUserName(derivedName || 'Patient');
        const rawRole = user?.role || user?.role_name || user?.roleName;
        const roleStr = String(rawRole || '').trim();
        const displayRole = roleStr
          ? roleStr.charAt(0).toUpperCase() + roleStr.slice(1)
          : 'Patient';
        setUserRole(displayRole);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadAppointments(), loadMedicalRecords()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load and refresh-on-focus (placed after function declarations)

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

  const syncUnread = React.useCallback(async () => {
    try {
      const rawLocal = await AsyncStorage.getItem('patient_notifications');
      const localArr: any[] = rawLocal ? JSON.parse(rawLocal) : [];
      const byId: Record<string, any> = {};
      if (Array.isArray(localArr)) {
        for (const it of localArr) {
          if (it?.id) byId[String(it.id)] = it;
        }
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications`, { headers });
        if (res.ok) {
          const rows = await res.json();
          const mapped = Array.isArray(rows)
            ? rows.map((n: any) => ({
                id: String(n?.id),
                title: String(n?.title || 'Notification'),
                message: String(n?.message || ''),
                timestamp: n?.created_at
                  ? new Date(n.created_at).getTime()
                  : Date.now(),
                read: Boolean(n?.read) === true,
              }))
            : [];
          for (const it of mapped) {
            if (it?.id) byId[String(it.id)] = { ...byId[String(it.id)], ...it };
          }
        }
      } catch {}

      const merged = Object.values(byId)
        .filter(Boolean)
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      try {
        await AsyncStorage.setItem(
          'patient_notifications',
          JSON.stringify(merged),
        );
      } catch {}
      setUnreadCount(merged.filter((n: any) => n && n.read === false).length);
    } catch {
      setUnreadCount(0);
    }
  }, [getAuthHeaders]);

  const getCurrentUserName = React.useCallback(async (): Promise<
    string | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      return (
        sess?.user?.full_name ||
        sess?.user?.fullName ||
        sess?.user?.name ||
        sess?.full_name ||
        sess?.name
      );
    } catch {
      return undefined;
    }
  }, []);

  const getCurrentUserId = React.useCallback(async (): Promise<
    string | number | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      return sess?.user?.id ?? sess?.id ?? undefined;
    } catch {
      return undefined;
    }
  }, []);

  const loadAppointments = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, { headers });
      if (!res.ok) return setUpcomingAppointments([]);
      const arr = await res.json();
      const myName = await getCurrentUserName();
      const myId = await getCurrentUserId();
      const list = Array.isArray(arr) ? arr : [];
      const nameMatches = (pRaw: string, meRaw: string) => {
        const p = String(pRaw || '')
          .toLowerCase()
          .trim();
        const me = String(meRaw || '')
          .toLowerCase()
          .trim();
        if (!p || !me) return false;
        if (p === me) return true;
        const meTokens = me.split(/\s+/).filter(Boolean);
        if (meTokens.length > 0 && meTokens.every(t => p.includes(t)))
          return true;
        const pTokens = p.split(/\s+/).filter(Boolean);
        if (pTokens.length > 0 && pTokens.every(t => me.includes(t)))
          return true;
        return false;
      };
      const mine = list.filter((a: any) => {
        const pid = a?.patientId ?? a?.patient_id;
        if (pid != null && myId != null) {
          return String(pid) === String(myId);
        }
        return nameMatches(String(a?.patient || ''), String(myName || ''));
      });
      const mapped: Appointment[] = mine.map((a: any) => ({
        id: String(
          a?.id ?? `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
        ),
        doctor: String(a?.createdByName || a?.created_by_name || 'Doctor'),
        specialty: String(a?.specialty || ''),
        date: String(a?.date || ''),
        time: String(a?.time || ''),
        status: a?.done ? 'completed' : 'upcoming',
      }));
      const upcomingOnly = mapped.filter(m => m.status === 'upcoming');
      setUpcomingAppointments(upcomingOnly);
    } catch {
      setUpcomingAppointments([]);
    }
  };

  const loadMedicalRecords = async () => {
    try {
      const headers = await getAuthHeaders();
      const myName = (await getCurrentUserName()) || '';
      const nameMatches = (pRaw: string, meRaw: string) => {
        const p = String(pRaw || '')
          .toLowerCase()
          .trim();
        const me = String(meRaw || '')
          .toLowerCase()
          .trim();
        if (!p || !me) return false;
        if (p === me) return true;
        const meTokens = me.split(/\s+/).filter(Boolean);
        if (meTokens.length > 0 && meTokens.every(t => p.includes(t)))
          return true;
        const pTokens = p.split(/\s+/).filter(Boolean);
        if (pTokens.length > 0 && pTokens.every(t => me.includes(t)))
          return true;
        return false;
      };

      const [resPR, resLab] = await Promise.all([
        fetch(`${API_BASE}/api/patient-records/all`, { headers }),
        fetch(`${API_BASE}/api/lab-records`, { headers }),
      ]);

      const prRows = resPR.ok ? await resPR.json() : [];
      const labRows = resLab.ok ? await resLab.json() : [];

      let rxRows: any[] = [];
      try {
        const resRx = await fetch(`${API_BASE}/api/prescriptions`, { headers });
        rxRows = resRx.ok ? await resRx.json() : [];
      } catch {}

      let apptRows: any[] = [];
      try {
        const resAppt = await fetch(`${API_BASE}/api/appointments`, {
          headers,
        });
        apptRows = resAppt.ok ? await resAppt.json() : [];
      } catch {}

      const minePR = (Array.isArray(prRows) ? prRows : []).filter((r: any) =>
        nameMatches(String(r?.patient || ''), String(myName || '')),
      );
      const mineLab = (Array.isArray(labRows) ? labRows : []).filter((r: any) =>
        nameMatches(String(r?.patient || ''), String(myName || '')),
      );
      const mineRx = (Array.isArray(rxRows) ? rxRows : []).filter((r: any) =>
        nameMatches(String(r?.patient_name || ''), String(myName || '')),
      );
      const mineAppt = (Array.isArray(apptRows) ? apptRows : []).filter(
        (a: any) =>
          nameMatches(String(a?.patient || ''), String(myName || '')) &&
          Boolean(a?.done),
      );

      const mappedPR: MedicalRecord[] = minePR.map((r: any) => {
        const hasMedicine = !!r?.medicine;
        const type: MedicalRecord['type'] = hasMedicine
          ? 'prescription'
          : 'consultation';
        const title = hasMedicine
          ? `Prescription - ${String(r?.medicine || '')}`
          : 'Consultation';
        const date = String(r?.date || r?.created_at || '');
        return {
          id: String(r?.id || `${r?.patient || ''}-${date}`),
          title,
          type,
          date,
        };
      });

      const mappedLab: MedicalRecord[] = mineLab.map((r: any) => {
        const title = r?.test_name
          ? `Lab Result - ${String(r.test_name)}`
          : 'Lab Result';
        const date = String(r?.date || r?.createdAt || '');
        return {
          id: `LAB-${String(r?.id || `${r?.patient || ''}-${date}`)}`,
          title,
          type: 'lab_result',
          date,
        };
      });

      const mappedRx: MedicalRecord[] = mineRx.map((r: any) => {
        const date = String(r?.created_at || r?.createdAt || '');
        return {
          id: `RX-${String(r?.id || `${r?.patient_name || ''}-${date}`)}`,
          title: r?.medicine
            ? `Prescription - ${String(r.medicine)}`
            : 'Prescription',
          type: 'prescription',
          date,
        };
      });

      const mappedAppt: MedicalRecord[] = mineAppt.map((a: any) => {
        const date = String(a?.date || '');
        return {
          id: `APT-${String(
            a?.id || `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
          )}`,
          title: 'Consultation',
          type: 'consultation',
          date,
        };
      });

      const combined = [...mappedPR, ...mappedLab, ...mappedRx, ...mappedAppt];
      combined.sort((a, b) => {
        const ta = Date.parse(a.date || '') || 0;
        const tb = Date.parse(b.date || '') || 0;
        return tb - ta;
      });

      setRecentRecords(combined.slice(0, 4));
    } catch {
      setRecentRecords([]);
    }
  };

  // Initial load and refresh-on-focus (after function declarations to avoid TS errors)
  useEffect(() => {
    loadUserData();
    loadAppointments();
    loadMedicalRecords();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
      loadAppointments();
      loadMedicalRecords();
      syncUnread();
      return () => {};
    }, [syncUnread]),
  );

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    const handleAppointmentPress = () => {
      navigation.navigate('Appointments');
    };

    return (
      <TouchableOpacity
        style={styles.appointmentCard}
        activeOpacity={0.8}
        onPress={handleAppointmentPress}
      >
        <View style={styles.appointmentHeaderRow}>
          <Text style={styles.doctorName}>{item.doctor}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.appointmentMetaRow}>
          <Text style={styles.appointmentMetaIcon}>📅</Text>
          <Text style={styles.appointmentMetaText}>{item.date}</Text>
        </View>
        <View style={styles.appointmentMetaRow}>
          <Text style={styles.appointmentMetaIcon}>🕒</Text>
          <Text style={styles.appointmentMetaText}>{item.time}</Text>
        </View>

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={handleAppointmentPress}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderRecordItem = ({ item }: { item: MedicalRecord }) => {
    const handleRecordPress = () => {
      navigation.navigate('MedicalRecords');
    };

    return (
      <TouchableOpacity
        style={styles.recordItemContainer}
        onPress={handleRecordPress}
      >
        <View
          style={[
            styles.recordIcon,
            getRecordIconSource(item.type) && {
              backgroundColor: 'transparent',
            },
          ]}
        >
          {getRecordIconSource(item.type) ? (
            <Image
              source={getRecordIconSource(item.type) as any}
              style={styles.recordIconImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.recordIconText}>
              {getRecordIcon(item.type)}
            </Text>
          )}
        </View>
        <View style={styles.recordDetails}>
          <Text style={styles.recordTitle}>{item.title}</Text>
          <Text style={styles.recordDate}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#10B981'; // green
      case 'completed':
        return '#6B7280'; // gray
      case 'cancelled':
        return '#EF4444'; // red
      default:
        return '#6B7280';
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return '💊';
      case 'lab_result':
        return '🔬';
      case 'consultation':
        return '📋';
      default:
        return '📄';
    }
  };

  const getRecordIconSource = (type: string) => {
    switch (type) {
      case 'prescription':
        return require('../../assets/medicine_emoji.png');
      case 'consultation':
        return require('../../assets/consultation_emoji.png');
      default:
        return undefined;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { paddingBottom: 70 }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: (insets?.bottom || 0) + 120 }}
          nestedScrollEnabled
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
        >
          <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
            <View style={styles.heroTopRow}>
              <Image
                source={require('../../assets/appicon.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />

              <View style={styles.heroTopIcons}>
                <TouchableOpacity
                  style={styles.heroCircleBtn}
                  onPress={() => navigation.navigate('PatientNotification')}
                  activeOpacity={0.85}
                >
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={require('../../assets/notification_icon.png')}
                      style={styles.heroCircleIcon}
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
                  style={styles.heroProfileBtn}
                  onPress={() => setShowProfileMenu(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.heroCircleBtn}>
                    <Text style={styles.heroCircleText}>
                      {String(userName || 'P')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.heroProfileTextCol}>
                    <Text style={styles.heroProfileName} numberOfLines={1}>
                      {String(userName || 'Patient')}
                    </Text>
                    <Text style={styles.heroProfileRole} numberOfLines={1}>
                      {String(userRole || 'Patient')}
                    </Text>
                  </View>
                  <Image
                    source={require('../../assets/dropdown.png')}
                    style={styles.heroProfileChevron}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.heroTitle}>Dashboard</Text>
          </View>

          <View style={styles.contentCard}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Appointments')}
                >
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>

              {upcomingAppointments.length > 0 ? (
                <FlatList
                  data={upcomingAppointments.slice(0, 2)}
                  renderItem={renderAppointmentItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.appointmentList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No upcoming appointments
                  </Text>
                  <TouchableOpacity
                    style={styles.bookNowButton}
                    onPress={() => navigation.navigate('BookAppointment')}
                  >
                    <Text style={styles.bookNowText}>Book Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Medical Records</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('MedicalRecords')}
                >
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>

              {recentRecords.length > 0 ? (
                <View style={styles.recordsList}>
                  {recentRecords.map(record => (
                    <TouchableOpacity
                      key={record.id}
                      style={styles.recordItemContainer}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('MedicalRecords')}
                    >
                      <View
                        style={[
                          styles.recordIcon,
                          getRecordIconSource(record.type) && {
                            backgroundColor: 'transparent',
                          },
                        ]}
                      >
                        {getRecordIconSource(record.type) ? (
                          <Image
                            source={getRecordIconSource(record.type) as any}
                            style={styles.recordIconImg}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={styles.recordIconText}>
                            {getRecordIcon(record.type)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.recordDetails}>
                        <Text style={styles.recordTitle} numberOfLines={1}>
                          {record.title}
                        </Text>
                        <Text style={styles.recordDate} numberOfLines={1}>
                          {record.date}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.viewRecordButton}
                        onPress={() => navigation.navigate('MedicalRecords')}
                      >
                        <Text style={styles.viewRecordText}>View</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No medical records found
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {showProfileMenu && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowProfileMenu(false)}
          />
          <View
            style={[styles.dropdownCard, { top: insets.top + 60, right: 16 }]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowProfileMenu(false);
                navigation.navigate('PatientProfile');
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
                  await AsyncStorage.removeItem('session');
                } catch {}
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                } as any);
              }}
            >
              <Text style={[styles.dropdownText, { color: '#EF4444' }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Navigation */}
      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(0, (insets.bottom || 0) - 8) },
        ]}
      >
        <BottomItem
          label="Home"
          active={true}
          source={require('../../assets/home_icon.png')}
          onPress={() => navigation.navigate('PatientDashboard')}
        />
        <BottomItem
          label="Appointments"
          active={false}
          source={require('../../assets/appointment_icon.png')}
          onPress={() => navigation.navigate('Appointments')}
        />
        <BottomItem
          label="Prescription"
          active={false}
          source={require('../../assets/prescription_icon.png')}
          onPress={() => navigation.navigate('PatientPrescription')}
        />
        <BottomItem
          label="Records"
          active={false}
          source={require('../../assets/patient_records_icon.png')}
          onPress={() => navigation.navigate('MedicalRecords')}
        />
      </View>
    </SafeAreaView>
  );
};

// Bottom Navigation Item Component
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
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Image
        source={source}
        style={[
          styles.bottomImg,
          { tintColor: active ? '#10B981' : '#9CA3AF' },
        ]}
        resizeMode="contain"
      />
      <Text style={[styles.bottomLabel, active && { color: '#10B981' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
    padding: 0,
  },
  // Top Navigation (matches doctor top bar)
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { padding: 8 },
  topHeaderIconImg: { width: 20, height: 20, tintColor: '#10B981' },
  topProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  topProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  topProfileTextCol: {
    marginLeft: 12,
    marginRight: 10,
    maxWidth: 160,
  },
  topProfileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  topProfileRole: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  topProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#111827',
  },
  topDivider: { height: 1, backgroundColor: '#E5E7EB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    marginTop: 0,
    fontSize: 16,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 0,
  },
  headerLeft: {
    justifyContent: 'center',
    minHeight: 50,
  },
  profileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 0,
    maxWidth: '50%',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 0,
    maxWidth: 140,
    textAlign: 'left',
  },
  profileTextCol: {
    flexDirection: 'column',
    marginLeft: 8,
    justifyContent: 'center',
  },
  profileRole: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  heroHeader: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroTopIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroLogo: {
    width: 44,
    height: 44,
    tintColor: '#FFFFFF',
  },
  heroTitle: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroProfileTextCol: {
    marginLeft: 10,
    marginRight: 8,
    maxWidth: 150,
  },
  heroProfileName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  heroProfileRole: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '600',
    fontSize: 12,
  },
  heroProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#FFFFFF',
    opacity: 0.9,
  },
  heroCircleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroCircleIcon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF',
  },
  contentCard: {
    marginTop: -22,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownBtn: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBtnText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownIcon: {
    width: 12,
    height: 12,
    tintColor: '#374151',
  },
  // Bottom Navigation Styles
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  bottomItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  bottomImg: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },
  bottomLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 2,
  },
  seeAll: {
    color: '#10B981',
    fontWeight: '500',
  },
  // Top profile dropdown (same behavior as doctor)
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
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: '#E5E7EB' },
  appointmentList: {
    paddingVertical: 4,
  },
  appointmentCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  appointmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  specialty: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateTime: {
    fontSize: 14,
    color: '#4B5563',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  appointmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  appointmentMetaIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  appointmentMetaText: {
    fontSize: 14,
    color: '#374151',
  },
  viewDetailsButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  viewDetailsText: {
    color: '#10B981',
    fontWeight: '700',
  },
  recordsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
  },
  recordItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordIconText: {
    fontSize: 18,
  },
  recordIconImg: {
    width: 20,
    height: 20,
  },
  recordDetails: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewRecordButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },
  viewRecordText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  bookNowButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default PatientDashboard;
