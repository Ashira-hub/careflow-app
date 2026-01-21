import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getRecords,
  PatientRecord,
  getLastVisitString,
} from '../../state/patient_records_store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DoctorTopNav from './DoctorTopNav';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type Patient = PatientRecord & { age?: number };

export default function DoctorPatientRecords() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<Patient[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE = 'https://backend-careflow.vercel.app';
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
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_BASE}/api/patient-records?own=1`, {
            headers,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rows = await res.json();
          // rows: [{ patient, last_ts }]
          const mapped: Patient[] = (Array.isArray(rows) ? rows : []).map(
            (r: any) => {
              const ts = r?.last_ts ? Date.parse(r.last_ts) : Date.now();
              const rec: PatientRecord = {
                id: `PR-${r.patient}`,
                name: String(r.patient || ''),
                appointments: [
                  {
                    date: '',
                    time: '',
                    notes: undefined,
                    createdAt: isNaN(ts) ? Date.now() : ts,
                  },
                ],
                prescriptions: [],
              };
              return rec;
            },
          );
          setRecords(mapped);
        } catch {
          // Fallback to in-memory store to avoid empty list if offline
          try {
            setRecords(getRecords());
          } catch {
            setRecords([]);
          }
        }
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
      })();
      return () => {};
    }, [getAuthHeaders]),
  );

  const reload = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/patient-records?own=1`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const mapped: Patient[] = (Array.isArray(rows) ? rows : []).map(
        (r: any) => {
          const ts = r?.last_ts ? Date.parse(r.last_ts) : Date.now();
          const rec: PatientRecord = {
            id: `PR-${r.patient}`,
            name: String(r.patient || ''),
            appointments: [
              {
                date: '',
                time: '',
                notes: undefined,
                createdAt: isNaN(ts) ? Date.now() : ts,
              },
            ],
            prescriptions: [],
          };
          return rec;
        },
      );
      setRecords(mapped);
    } catch {
      try {
        setRecords(getRecords());
      } catch {
        setRecords([]);
      }
    }
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
    setRefreshing(false);
  }, [getAuthHeaders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [query, records]);

  const handleViewPatient = async (item: Patient) => {
    // Log activity: patient record viewed
    try {
      const rawAct = await AsyncStorage.getItem('doctor_activity');
      const arrAct = rawAct ? JSON.parse(rawAct) : [];
      const activityItem = {
        id: String(Date.now()),
        title: `Patient record viewed: ${item.name}`,
        type: 'records',
        timestamp: Date.now(),
      };
      const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : []; // Keep only latest 100
      await AsyncStorage.setItem(
        'doctor_activity',
        JSON.stringify([activityItem, ...updatedAct]),
      );
    } catch {}
    navigation.navigate('DoctorPatientRecordsDetails', {
      patientName: item.name,
    });
  };

  const renderItem = ({ item }: { item: Patient }) => (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          Recently added: {getLastVisitString(item)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.viewBtn}
        onPress={() => handleViewPatient(item)}
      >
        <Text style={styles.viewText}>View</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <DoctorTopNav
          unreadCount={unreadCount}
          onPressNotifications={() =>
            navigation.navigate('DoctorNotification' as never)
          }
          onPressProfile={() => setShowProfileMenu(true)}
        />

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Patient Records</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Search by name or ID"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => {}}>
            <Text style={styles.searchText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filtered}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={reload}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No patients found.</Text>
            </View>
          )}
        />

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('DoctorDashboard')}
          />
          <BottomItem
            label="Appointment"
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('DoctorAppointment')}
          />
          <BottomItem
            label="Prescription"
            source={require('../../assets/prescription_icon.png')}
            onPress={() => navigation.navigate('DoctorPrescription')}
          />
          <BottomItem
            label="P-Records"
            active
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => {}}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={() => navigation.navigate('DoctorReports')}
          />
        </View>
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
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('DoctorProfile');
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  searchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: GREEN,
    borderRadius: 10,
  },
  searchText: { color: '#FFFFFF', fontWeight: '700' },

  listContent: { padding: 16, paddingBottom: 80 },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { color: MUTED },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E6FFF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: GREEN,
  },
  avatarText: { color: GREEN, fontWeight: '700' },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 1 },
  chev: { width: 18, height: 18, tintColor: GREEN, marginLeft: 10 },
  viewBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: GREEN,
    borderRadius: 8,
  },
  viewText: { color: '#FFFFFF', fontWeight: '700' },

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
