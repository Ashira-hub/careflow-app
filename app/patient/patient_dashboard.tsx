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
  TouchableWithoutFeedback,
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

const API_BASE = 'https://capstone-production-8af8.up.railway.app';

const PatientDashboard = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PatientDashboardNavigationProp>();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [menuVisible, setMenuVisible] = useState(false);
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

      setRecentRecords(combined.slice(0, 3));
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
      return () => {};
    }, []),
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
        <View style={styles.appointmentInfoContainer}>
          <Text style={styles.doctorName}>{item.doctor}</Text>
          <Text style={styles.specialty}>{item.specialty}</Text>
          <View style={styles.timeContainer}>
            <Text style={styles.dateTime}>
              {item.date} • {item.time}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            >
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={handleAppointmentPress}
        >
          <Text style={styles.viewButtonText}>View</Text>
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
        <View style={styles.recordIcon}>
          <Text style={styles.recordIconText}>{getRecordIcon(item.type)}</Text>
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            <View style={styles.profileRight}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PatientProfile')}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.profileTextCol}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {userName}
                </Text>
                <Text style={styles.profileRole} numberOfLines={1}>
                  {userRole}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setMenuVisible(v => !v)}
                activeOpacity={0.7}
              >
                <Image
                  source={require('../../assets/dropdown.png')}
                  style={styles.dropdownIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('Appointments')}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}
                >
                  <Text style={[styles.actionIconText, { color: '#3B82F6' }]}>
                    📅
                  </Text>
                </View>
                <Text style={styles.actionText}>Appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('MedicalRecords')}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}
                >
                  <Text style={[styles.actionIconText, { color: '#10B981' }]}>
                    📋
                  </Text>
                </View>
                <Text style={styles.actionText}>My Records</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Upcoming Appointments */}
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
                data={upcomingAppointments}
                renderItem={renderAppointmentItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
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

          {/* Recent Medical Records */}
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
                    <View style={styles.recordIcon}>
                      <Text style={styles.recordIconText}>
                        {getRecordIcon(record.type)}
                      </Text>
                    </View>
                    <View style={styles.recordDetails}>
                      <Text style={styles.recordTitle}>{record.title}</Text>
                      <Text style={styles.recordDate}>{record.date}</Text>
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
        </ScrollView>
      </View>
      {menuVisible && (
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('PatientProfile');
                }}
              >
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem('session');
                  } catch {}
                  setMenuVisible(false);
                  // @ts-ignore
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
              >
                <Text style={styles.menuItemText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
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
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  // Top Navigation (matches doctor top bar)
  topHeader: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  topAvatarBtn: { padding: 4 },
  topAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  topAvatarImg: { width: '100%', height: '100%' },
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
    paddingVertical: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    height: '100%',
  },
  bottomImg: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  bottomLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  seeAll: {
    color: '#10B981',
    fontWeight: '500',
  },
  quickActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  appointmentList: {
    paddingVertical: 8,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: 280,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentInfoContainer: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
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
  viewButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#10B981',
    fontWeight: '500',
  },
  recordsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderBottomColor: '#F3F4F6',
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
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginTop: 80,
    marginRight: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    minWidth: 150,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
});

export default PatientDashboard;
