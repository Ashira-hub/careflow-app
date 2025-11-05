import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type LabReport = {
  id: string;
  title: string;
  patient: string;
  type: 'PDF' | 'Image' | 'Text';
  generatedOn: string;
  summary?: string;
};

export default function LabReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [selected, setSelected] = React.useState<LabReport | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [month, setMonth] = React.useState<number>(new Date().getMonth());
  const [year, setYear] = React.useState<number>(new Date().getFullYear());

  const [reports, setReports] = React.useState<LabReport[]>([]);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Load reports from lab_results persisted by lab_laboratory
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('lab_results');
          const arr = raw ? JSON.parse(raw) : [];
          const mapped: LabReport[] = Array.isArray(arr)
            ? arr.map((it: any) => ({
                id: String(it.id),
                title: String(it.name || ''),
                patient: String(it.patient || ''),
                type: (it.category === 'Imaging') ? 'Image' : (it.category === 'Chemistry' ? 'PDF' : 'Text'),
                generatedOn: String(it.requestedOn || ''),
                summary: it.notes ? String(it.notes) : undefined,
              }))
            : [];
          setReports(mapped);
        } catch {
          setReports([]);
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
        // Load unread lab notifications count
        try {
          const rawN = await AsyncStorage.getItem('lab_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
          setUnreadCount(n);
        } catch { setUnreadCount(0); }
        // Log recent activity: Viewed Reports
        try {
          const rawA = await AsyncStorage.getItem('lab_activity');
          const arrA = rawA ? JSON.parse(rawA) : [];
          const entry = { id: String(Date.now()), title: 'Viewed Reports', timestamp: Date.now(), type: 'reports' };
          const next = [entry, ...(Array.isArray(arrA) ? arrA : [])].slice(0, 50);
          await AsyncStorage.setItem('lab_activity', JSON.stringify(next));
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const visibleReports = React.useMemo(() => {
    const mm = String(month + 1).padStart(2, '0');
    const yy = String(year);
    return reports.filter(r => String(r.generatedOn || '').startsWith(`${yy}-${mm}-`));
  }, [reports, month, year]);

  const metrics = React.useMemo(() => {
    const tests = visibleReports.length;
    const patients = Array.from(new Set(visibleReports.map(r => r.patient.trim()))).length;
    return { tests, patients };
  }, [visibleReports]);

  const openDetails = (rec: LabReport) => { setSelected(rec); setShowDetails(true); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('LabNotification' as never)}>
              <View style={{ position: 'relative' }}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', right: -6, top: -6, minWidth: 14, height: 14, paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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

        {/* Scroll content to mirror doctor_reports layout */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Title and Month Filter */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Reports</Text>
            <View style={styles.monthWrap}>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => {
                  setMonth((m) => {
                    if (m === 0) { setYear((y) => y - 1); return 11; }
                    return m - 1;
                  });
                }}
              >
                <Text style={styles.monthText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthName(month)} {year}</Text>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => {
                  setMonth((m) => {
                    if (m === 11) { setYear((y) => y + 1); return 0; }
                    return m + 1;
                  });
                }}
              >
                <Text style={styles.monthText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.cardsRow}>
            <SummaryCard label="Tests" value={metrics.tests} tint="#D1FAE5" />
            <SummaryCard label="Total Patient" value={metrics.patients} tint="#FDE68A" />
          </View>

          {/* Recent Reports */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            {visibleReports.length === 0 ? (
              <Text style={styles.empty}>No reports generated yet.</Text>
            ) : (
              visibleReports.map((item) => (
                <TouchableOpacity key={item.id} style={styles.row} activeOpacity={0.9} onPress={() => openDetails(item)}>
                  <View style={styles.rowLeft}>
                    <Image source={require('../../assets/reports_icon.png')} style={styles.rowIcon} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.meta}>{item.patient} • {item.type}</Text>
                    <Text style={styles.meta}>Generated: {item.generatedOn}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Details Modal */}
        <Modal
          visible={!!selected && showDetails}
          animationType="fade"
          transparent
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setShowDetails(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Details</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              {!!selected && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.name}>Title: <Text style={{ fontWeight: '400' }}>{selected.title}</Text></Text>
                  <Text style={styles.name}>Patient: <Text style={{ fontWeight: '400' }}>{selected.patient}</Text></Text>
                  <Text style={styles.name}>Type: <Text style={{ fontWeight: '400' }}>{selected.type}</Text></Text>
                  <Text style={styles.name}>Generated: <Text style={{ fontWeight: '400' }}>{selected.generatedOn}</Text></Text>
                  {!!selected.summary && <Text style={styles.name}>Summary: <Text style={{ fontWeight: '400' }}>{selected.summary}</Text></Text>}
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Profile Dropdown */}
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
                  navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('LabDashboard' as never)} />
          <BottomItem label="Laboratory" source={require('../../assets/lab_icon.png')} onPress={() => navigation.navigate('LabLaboratory' as never)} />
          <BottomItem label="Lab Records" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('LabRecords' as never)} />
          <BottomItem label="Reports" active source={require('../../assets/reports_icon.png')} onPress={() => {}} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={[styles.card, { backgroundColor: CARD_BG, borderColor: '#F3F4F6' }]}> 
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color: GREEN }]}>{value}</Text>
      <View style={[styles.cardBar, { backgroundColor: tint }]} />
    </View>
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

function monthName(m: number) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][((m % 12) + 12) % 12];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  scrollContent: { padding: 16, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBtn: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  monthText: { color: GREEN, fontWeight: '700' },
  monthLabel: { color: '#111827', fontWeight: '700' },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14 },
  cardLabel: { color: MUTED },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  cardBar: { height: 6, borderRadius: 4, marginTop: 10 },

  sectionCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginTop: 16 },
  sectionTitle: { color: GREEN, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  rowLeft: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginRight: 12 },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  name: { color: '#111827', fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2 },
  empty: { color: MUTED, fontStyle: 'italic' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

