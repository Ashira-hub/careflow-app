import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getRecords,
  getLastVisitString,
  PatientRecord,
} from '../../state/patient_records_store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function DoctorReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
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
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        // Log activity: reports viewed
        try {
          const rawAct = await AsyncStorage.getItem('doctor_activity');
          const arrAct = rawAct ? JSON.parse(rawAct) : [];
          const activityItem = {
            id: String(Date.now()),
            title: `Reports viewed for ${new Date(
              year,
              month,
            ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            type: 'reports',
            timestamp: Date.now(),
          };
          await AsyncStorage.setItem(
            'doctor_activity',
            JSON.stringify([
              activityItem,
              ...(Array.isArray(arrAct) ? arrAct.slice(0, 99) : []),
            ]),
          );
        } catch {}

        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_BASE}/api/patient-records/all`, {
            headers,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rows = await res.json();
          // rows: [{ id, patient, created_at, ... }]
          const byPatient = new Map<string, PatientRecord>();
          for (const r of Array.isArray(rows) ? rows : []) {
            const name = String(r.patient || '').trim();
            if (!name) continue;
            if (!byPatient.has(name))
              byPatient.set(name, {
                id: `PR-${name}`,
                name,
                appointments: [],
                prescriptions: [],
              });
            const rec = byPatient.get(name)!;
            const ts = Date.parse(r.created_at);
            // Infer: if medicine or dosage exists, treat as prescription entry; else as appointment entry
            if (r.medicine || r.dosage) {
              rec.prescriptions.unshift({
                doctorName: r.doctor || '',
                subject: r.medicine || '',
                quantity: '0',
                dosageStrength: r.dosage || '',
                description: r.notes || '',
                submittedAt: isNaN(ts) ? Date.now() : ts,
              });
            } else {
              rec.appointments.unshift({
                date: r.date || '',
                time: r.time || '',
                notes: r.notes || undefined,
                createdAt: isNaN(ts) ? Date.now() : ts,
              });
            }
          }
          setRecords(Array.from(byPatient.values()));
        } catch {
          // Fallback to in-memory store
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
        // Load avatar from session
        try {
          const rawS = await AsyncStorage.getItem('session');
          const sess = rawS ? JSON.parse(rawS) : null;
          const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
          setAvatarUri(uri || undefined);
        } catch {}
      })();
      return () => {};
    }, [getAuthHeaders, month, year]),
  );

  const metrics = useMemo(() => {
    const m = month;
    const y = year;
    const inMonth = (ts?: number) => {
      if (!ts) return false;
      const d = new Date(ts);
      return d.getMonth() === m && d.getFullYear() === y;
    };
    const perPatient = records.map(r => {
      const appts = r.appointments.filter(a => inMonth(a.createdAt));
      const rxs = r.prescriptions.filter(p => inMonth(p.submittedAt));
      const lastTs = Math.max(
        appts[0]?.createdAt || 0,
        rxs[0]?.submittedAt || 0,
        ...appts.map(a => a.createdAt),
        ...rxs.map(p => p.submittedAt),
      );
      const lastVisit = lastTs
        ? new Date(lastTs).toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })
        : '—';
      return {
        name: r.name,
        id: r.id,
        apptCount: appts.length,
        rxCount: rxs.length,
        lastVisit,
      };
    });
    const totalAppointments = perPatient.reduce(
      (acc, p) => acc + p.apptCount,
      0,
    );
    const totalPrescriptions = perPatient.reduce(
      (acc, p) => acc + p.rxCount,
      0,
    );
    const totalPatients = perPatient.filter(
      p => p.apptCount + p.rxCount > 0,
    ).length;
    const ranking = perPatient
      .map(p => ({
        name: p.name,
        id: p.id,
        lastVisit: p.lastVisit,
        count: p.apptCount + p.rxCount,
      }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { totalPatients, totalAppointments, totalPrescriptions, ranking };
  }, [records, month, year]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Image
            source={require('../../assets/appicon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('DoctorNotification' as never)}
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

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title and Month Filter */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Reports</Text>
            <View style={styles.monthWrap}>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() =>
                  setMonth(m => {
                    const nm = (m + 11) % 12;
                    if (m === 0) setYear(y => y - 1);
                    return nm;
                  })
                }
              >
                <Text style={styles.monthText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {monthName(month)} {year}
              </Text>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() =>
                  setMonth(m => {
                    const nm = (m + 1) % 12;
                    if (m === 11) setYear(y => y + 1);
                    return nm;
                  })
                }
              >
                <Text style={styles.monthText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.cardsRow}>
            <SummaryCard
              label="Patients"
              value={metrics.totalPatients}
              tint="#D1FAE5"
            />
            <SummaryCard
              label="Appointments"
              value={metrics.totalAppointments}
              tint="#E0E7FF"
            />
          </View>
          <View style={styles.cardsRow}>
            <SummaryCard
              label="Prescriptions"
              value={metrics.totalPrescriptions}
              tint="#FEF3C7"
            />
          </View>

          {/* Top Patients */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Patients</Text>
            {metrics.ranking.length === 0 ? (
              <Text style={styles.empty}>No data yet.</Text>
            ) : (
              metrics.ranking.map(p => (
                <View key={p.id} style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(p.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>Last visit: {p.lastVisit}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{p.count}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

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
            source={require('../../assets/patient_records_icon.png')}
            onPress={() => navigation.navigate('DoctorPatientRecords')}
          />
          <BottomItem
            label="Reports"
            active
            source={require('../../assets/reports_icon.png')}
            onPress={() => {}}
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

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: CARD_BG, borderColor: '#F3F4F6' },
      ]}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }]}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
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
      activeOpacity={0.85}
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

function monthName(m: number) {
  return [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][((m % 12) + 12) % 12];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingBottom: 110 },

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
  scrollContent: { padding: 16, paddingBottom: 120 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  monthText: { color: GREEN, fontWeight: '700' },
  monthLabel: { color: '#111827', fontWeight: '700' },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardLabel: { color: MUTED },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  cardBar: { height: 6, borderRadius: 4, marginTop: 10 },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginTop: 16,
  },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6FFF5',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: GREEN, fontWeight: '700' },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  badge: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5F7F0',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: GREEN, fontWeight: '700' },
  empty: { color: MUTED, fontStyle: 'italic' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 45,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
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
