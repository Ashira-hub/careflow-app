import React, { useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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

export default function DoctorReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [records, setRecords] = useState<PatientRecord[]>([]);
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
      })();
      return () => {};
    }, [getAuthHeaders, month, year]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/patient-records/all`, {
          headers,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
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
    } finally {
      setRefreshing(false);
    }
  }, [API_BASE, getAuthHeaders]);

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
        <DoctorTopNav
          unreadCount={unreadCount}
          onPressNotifications={() =>
            navigation.navigate('DoctorNotification' as never)
          }
          onPressProfile={() => setShowProfileMenu(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Analytics: Monthly Totals */}
          <View style={[styles.sectionCard, { marginTop: 0 }]}>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Monthly Analytics</Text>
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
            <VerticalBarChart
              labels={['Appointments', 'Prescriptions', 'Patients']}
              values={[
                metrics.totalAppointments,
                metrics.totalPrescriptions,
                metrics.totalPatients,
              ]}
              colors={['#3B82F6', '#F59E0B', GREEN]}
              height={220}
              barWidth={34}
            />
          </View>

          {/* Analytics: Top Patients */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Patients</Text>
            {metrics.ranking.length === 0 ? (
              <Text style={styles.empty}>No data yet.</Text>
            ) : (
              <HorizontalBarChart
                labels={metrics.ranking.map(p => p.name)}
                values={metrics.ranking.map(p => p.count)}
                maxBars={5}
              />
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

function VerticalBarChart({
  labels,
  values,
  colors,
  height = 200,
  barWidth = 32,
  valueFormatter,
}: {
  labels: string[];
  values: number[];
  colors?: string[];
  height?: number;
  barWidth?: number;
  valueFormatter?: (n: number) => string;
}) {
  const rawMax = Math.max(1, ...values);
  // Compute a "nice" max and step for ticks (roughly 4 lines)
  const pow10 = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const norm = rawMax / pow10;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const yMax = niceNorm * pow10;
  const steps = 4;
  const step = yMax / steps;
  const ticks = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round(i * step),
  );
  // Leave visual headroom so value bubbles don't clip the top
  const HEADROOM = 0.15; // 15% of the plot height
  const scaleMax = yMax / (1 - HEADROOM);
  const h = Math.max(120, height);
  const fmt = valueFormatter || ((n: number) => n.toLocaleString());
  return (
    <View style={styles.vChart}>
      <View style={styles.vChartRow}>
        {/* Y Axis */}
        <View style={[styles.yAxis, { height: h }]}>
          {ticks
            .slice()
            .reverse()
            .map((t, idx) => (
              <Text key={idx} style={styles.yAxisLabel}>
                {fmt(t)}
              </Text>
            ))}
        </View>
        {/* Plot */}
        <View style={[styles.vPlot, { height: h }]}>
          {/* Grid lines */}
          <View style={styles.gridLayer} pointerEvents="none">
            {ticks.map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>
          <View style={styles.vBarWrap}>
            {values.map((v, i) => {
              const hPct = Math.min(100, Math.round((v / scaleMax) * 100));
              const c = colors?.[i] || GREEN;
              return (
                <View key={i} style={styles.vBarItem}>
                  <View style={[styles.vBar, { width: barWidth }]}>
                    <View
                      style={[
                        styles.vBarFill,
                        { height: `${hPct}%`, backgroundColor: c },
                      ]}
                    >
                      {v > 0 && (
                        <Text style={styles.vBarValueInside}>{fmt(v)}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.vBarLabel} numberOfLines={1}>
                    {labels[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
      {/* Legend */}
      <View style={styles.legendRow}>
        {labels.map((l, i) => (
          <View key={i} style={styles.legendItemRow}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: colors?.[i] || GREEN },
              ]}
            />
            <Text style={styles.legendLabel}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HorizontalBarChart({
  labels,
  values,
  maxBars = 5,
}: {
  labels: string[];
  values: number[];
  maxBars?: number;
}) {
  const items = labels.map((l, i) => ({ label: l, value: values[i] || 0 }));
  const top = items
    .slice(0, maxBars)
    .map((x, i) => ({ ...x, color: i === 0 ? GREEN : '#34D399' }));
  const max = Math.max(1, ...top.map(x => x.value));
  return (
    <View style={{ paddingVertical: 8 }}>
      {top.map((it, idx) => {
        const wPct = Math.round((it.value / max) * 100);
        return (
          <View key={idx} style={{ marginVertical: 6 }}>
            <View style={styles.hRow}>
              <Text style={styles.hLabel} numberOfLines={1}>
                {it.label}
              </Text>
              <Text style={styles.hValue}>{it.value}</Text>
            </View>
            <View style={styles.hBar}>
              <View
                style={[
                  styles.hBarFill,
                  { width: `${wPct}%`, backgroundColor: it.color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
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
  scrollContent: { padding: 16, paddingBottom: 80 },

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
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  monthText: { color: '#111827', fontWeight: '700' },
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
  sectionTitle: { color: '#111827', fontWeight: '700', marginBottom: 8 },
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
  // Charts
  vChart: { paddingTop: 25 },
  vChartRow: { flexDirection: 'row', alignItems: 'flex-end' },
  yAxis: {
    width: 36,
    height: 160,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingRight: 6,
    paddingTop: 24,
  },
  yAxisLabel: { color: MUTED, fontSize: 10 },
  vPlot: { flex: 1, height: 160, position: 'relative', paddingTop: 24 },
  gridLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 24,
    bottom: 0,
    justifyContent: 'space-between',
  },
  gridLine: { height: 1, backgroundColor: BORDER },
  vBarWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 8,
    height: '100%',
  },
  vBarItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  vBar: {
    height: '100%',
    width: 30,
    borderRadius: 6,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'flex-end',
  },
  vBarFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  vBarLabel: { color: MUTED, fontSize: 10, marginTop: 6, textAlign: 'center' },
  vBarValue: { color: '#111827', fontWeight: '700', fontSize: 12 },
  vBarValueInside: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 2,
  },
  vValueBubble: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    color: '#111827',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  legendLabel: { color: MUTED, fontSize: 12 },
  hRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hLabel: { color: '#111827', flex: 1, marginRight: 8 },
  hValue: { color: GREEN, fontWeight: '700' },
  hBar: {
    height: 12,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  hBarFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 6,
  },

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
