import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import {
  getRecords,
  getLastVisitString,
  PatientRecord,
} from '../../state/patient_records_store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DoctorTopNav from './DoctorTopNav';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type RouteParams = { patientName?: string };

export default function DoctorPatientRecordsDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { patientName } = (route?.params || {}) as RouteParams;
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const rawN = await AsyncStorage.getItem('doctor_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN)
            ? arrN.filter((x: any) => !x?.read).length
            : 0;
          setUnreadCount(n);
        } catch {
          setUnreadCount(0);
        }
      })();
      return () => {};
    }, []),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      try {
        const rawN = await AsyncStorage.getItem('doctor_notifications');
        const arrN = rawN ? JSON.parse(rawN) : [];
        const n = Array.isArray(arrN)
          ? arrN.filter((x: any) => !x?.read).length
          : 0;
        setUnreadCount(n);
      } catch {
        setUnreadCount(0);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const record: PatientRecord | undefined = React.useMemo(() => {
    const name = (patientName || '').trim().toLowerCase();
    return getRecords().find(r => r.name.toLowerCase() === name);
  }, [patientName]);

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

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.topRow}>
            <Text style={styles.title}>Patient Record</Text>
            <TouchableOpacity
              style={styles.backBtnCorner}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.backText}>{'<'} Back</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={styles.infoCard}>
              <Text style={styles.patientName}>
                {record?.name || patientName || 'Unknown Patient'}
              </Text>
              <Text style={styles.metaText}>
                Recently added: {record ? getLastVisitString(record) : '—'}
              </Text>
              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  Appointments: {record?.appointments.length ?? 0}
                </Text>
                <Text style={styles.countText}>
                  Prescriptions: {record?.prescriptions.length ?? 0}
                </Text>
              </View>
            </View>

            {/* Appointments */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Appointments</Text>
              {record?.appointments.length ? (
                record.appointments.map((a, i) => (
                  <View key={i} style={styles.row}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>APPT</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {a.date} • {a.time}
                      </Text>
                      {!!a.notes && (
                        <Text style={styles.rowSub}>{a.notes}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>No appointments yet.</Text>
              )}
            </View>

            {/* Prescriptions */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Prescriptions</Text>
              {record?.prescriptions.length ? (
                record.prescriptions.map((p, i) => (
                  <View key={i} style={styles.row}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: '#FDE68A', borderColor: '#F59E0B' },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: '#92400E' }]}>
                        RX
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.subject}</Text>
                      <Text style={styles.rowSub}>
                        {new Date(p.submittedAt).toLocaleString()}
                      </Text>
                      <Text style={styles.rowSub}>Doctor: {p.doctorName}</Text>
                      <Text style={styles.rowSub}>
                        Qty: {p.quantity} • Strength: {p.dosageStrength}
                      </Text>
                      {!!p.description && (
                        <Text style={styles.rowSub}>{p.description}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>No prescriptions yet.</Text>
              )}
            </View>
          </View>
        </ScrollView>
        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('DoctorDashboard' as never)}
          />
          <BottomItem
            label="Appointment"
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('DoctorAppointment' as never)}
          />
          <BottomItem
            label="Prescription"
            source={require('../../assets/prescription_icon.png')}
            onPress={() => navigation.navigate('DoctorPrescription' as never)}
          />
          <BottomItem
            label="P-Records"
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('DoctorPatientRecords' as never)}
          />
          <BottomItem
            label="Reports"
            source={require('../../assets/reports_icon.png')}
            onPress={() => navigation.navigate('DoctorReports' as never)}
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
  notifBadgeWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
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
  title: { color: GREEN, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  backBtnCorner: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  backText: { color: GREEN, fontWeight: '700' },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginBottom: 12,
  },
  patientName: { color: '#111827', fontWeight: '700', fontSize: 16 },
  metaText: { color: MUTED, marginTop: 2, marginBottom: 8 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between' },
  countText: { color: MUTED },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginTop: 10,
  },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  badge: {
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: '#E6FFF5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  badgeText: { color: GREEN, fontWeight: '700', fontSize: 10 },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowSub: { color: MUTED, marginTop: 2, fontSize: 12 },
  empty: { color: MUTED, fontStyle: 'italic' },
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
});
