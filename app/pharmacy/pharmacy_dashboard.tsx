import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, Modal, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

export default function PharmacyDashboard() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [showActivity, setShowActivity] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [activityData, setActivityData] = React.useState<Array<{ id: string; title: string; time?: string; timestamp?: number; type?: string }>>([]);
  const [invCount, setInvCount] = React.useState(0);
  const [rxCount, setRxCount] = React.useState(0);
  const [medCount, setMedCount] = React.useState(0);
  const [reportCount, setReportCount] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [welcomeMsg, setWelcomeMsg] = React.useState<string>('');
  const [hasInventoryNotification, setHasInventoryNotification] = React.useState(false);
  const [hasPrescriptionNotification, setHasPrescriptionNotification] = React.useState(false);
  const [hasMedicineNotification, setHasMedicineNotification] = React.useState(false);
  const [hasReportNotification, setHasReportNotification] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('pharmacy_activity');
          const arr = raw ? JSON.parse(raw) : [];
          setActivityData(Array.isArray(arr) ? arr : []);
        } catch { setActivityData([]); }
        // counts
        // Inventory and Medicine: from backend inventory endpoint
        try {
          const resp = await fetch(`${API_BASE}/api/inventory`);
          if (resp.ok) {
            const rows = await resp.json();
            const count = Array.isArray(rows) ? rows.length : 0;
            setInvCount(count);
            setMedCount(count);
          } else {
            setInvCount(0);
            setMedCount(0);
          }
        } catch { setInvCount(0); setMedCount(0); }
        // Prescriptions: from local AsyncStorage key used by screens
        try {
          const rawRx = await AsyncStorage.getItem('prescriptions');
          const rxs = rawRx ? JSON.parse(rawRx) : [];
          setRxCount(Array.isArray(rxs) ? rxs.length : 0);
          // Reports: dispensed this month (by dispensedAt if present, else createdAt)
          const now = new Date();
          const m = now.getMonth();
          const y = now.getFullYear();
          const dispensedThisMonth = Array.isArray(rxs)
            ? rxs.filter((r: any) => {
                if (r?.status !== 'dispensed') return false;
                try {
                  const t = r?.dispensedAt ?? r?.createdAt ?? Date.now();
                  const d = new Date(t);
                  return d.getMonth() === m && d.getFullYear() === y;
                } catch { return false; }
              }).length
            : 0;
          setReportCount(dispensedThisMonth);
        } catch { setRxCount(0); setReportCount(0); }
        // Load avatar image from persisted storage keyed by user id
        try {
          const rawSession = await AsyncStorage.getItem('session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            if (uid) {
              const stored = await AsyncStorage.getItem(`avatar_${uid}`);
              setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
            } else {
              setAvatarUri(user?.avatar_uri || user?.avatarUrl || undefined);
            }
          }
        } catch {}
        
        // Unread notifications count
        try {
          const rawNoti = await AsyncStorage.getItem('pharmacy_notifications');
          const arrNoti = rawNoti ? JSON.parse(rawNoti) : [];
          const unread = Array.isArray(arrNoti) ? arrNoti.filter((n: any) => n && n.read === false).length : 0;
          setUnreadCount(unread);
        } catch { setUnreadCount(0); }

        // Set notification badges based on counts and conditions (simple heuristics)
        setHasInventoryNotification(invCount > 0 && invCount < 10); // Low inventory warning
        setHasPrescriptionNotification(rxCount > 0); // New prescriptions
        setHasMedicineNotification(medCount > 0); // New medicines
        setHasReportNotification(reportCount > 0); // New reports
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

  const logActivity = React.useCallback(async (type: 'inventory' | 'prescription' | 'medicine' | 'reports' | 'notification', title: string) => {
    try {
      const raw = await AsyncStorage.getItem('pharmacy_activity');
      const arr = raw ? JSON.parse(raw) : [];
      const entry = { id: `${type}-${Date.now()}`, title, timestamp: Date.now(), type };
      const next = [entry, ...(Array.isArray(arr) ? arr : [])].slice(0, 50);
      await AsyncStorage.setItem('pharmacy_activity', JSON.stringify(next));
      setActivityData(next);
    } catch {}
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={async () => { await logActivity('notification', 'Viewed Notifications'); navigation.navigate('PharmacyNotification' as never); }}>
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

        {showWelcome && (
          <View style={[styles.welcomeBanner, { top: insets.top + 48 }]}> 
            <Text style={styles.welcomeText}>{welcomeMsg || 'Welcome back!'}</Text>
            <TouchableOpacity onPress={() => setShowWelcome(false)}>
              <Text style={styles.welcomeClose}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Pharmacy Dashboard</Text>
          <View style={styles.sectionDivider} />

          <View style={styles.grid}>
            <DashboardCard
              title="Inventory"
              icon={<Image source={require('../../assets/inventory_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              tag="Items"
              count={invCount}
              // hasNotification={hasInventoryNotification}
              // onPress={async () => { await logActivity('inventory', 'Viewed Inventory'); navigation.navigate('PharmacyInventory' as never); }}
            />
            <DashboardCard
              title="Prescription"
              icon={<Image source={require('../../assets/prescription_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              tag="Total"
              count={rxCount}
              // hasNotification={hasPrescriptionNotification}
              // onPress={async () => { await logActivity('prescription', 'Viewed Prescriptions'); navigation.navigate('PharmacyPrescription' as never); }}
            />
            <DashboardCard
              title="Medicine"
              icon={<Image source={require('../../assets/medicine_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              tag="Drugs"
              count={medCount}
              // hasNotification={hasMedicineNotification}
              // onPress={async () => { await logActivity('medicine', 'Viewed Medicine'); navigation.navigate('PharmacyMedicine' as never); }}
            />
            <DashboardCard
              title="Reports"
              icon={<Image source={require('../../assets/reports_icon.png')} style={styles.cardImg} resizeMode="contain" />}
              tag="Entries"
              count={reportCount}
              // hasNotification={hasReportNotification}
              // onPress={async () => { await logActivity('reports', 'Viewed Reports'); navigation.navigate('PharmacyReports' as never); }}
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
              {activityData.slice(0, 5).map((item, idx) => {
                const icon = item.type === 'inventory'
                  ? require('../../assets/inventory_icon.png')
                  : item.type === 'prescription'
                  ? require('../../assets/prescription_icon.png')
                  : item.type === 'medicine'
                  ? require('../../assets/medicine_icon.png')
                  : require('../../assets/reports_icon.png');
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
          <BottomItem label="Home" active source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={async () => { await logActivity('inventory', 'Viewed Inventory'); navigation.navigate('PharmacyInventory' as never); }} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={async () => { await logActivity('prescription', 'Viewed Prescriptions'); navigation.navigate('PharmacyPrescription' as never); }} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={async () => { await logActivity('medicine', 'Viewed Medicine'); navigation.navigate('PharmacyMedicine' as never); }} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={async () => { await logActivity('reports', 'Viewed Reports'); navigation.navigate('PharmacyReports' as never); }} />
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
                  const icon = item.type === 'inventory'
                    ? require('../../assets/inventory_icon.png')
                    : item.type === 'prescription'
                    ? require('../../assets/prescription_icon.png')
                    : item.type === 'medicine'
                    ? require('../../assets/medicine_icon.png')
                    : require('../../assets/reports_icon.png');
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
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('PharmacyProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={async () => { setShowProfileMenu(false); try { await AsyncStorage.multiRemove(['session','pharmacy_activity']); } catch {} navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function DashboardCard({ title, icon, count, tag, hasNotification, onPress }: { title: string; icon: React.ReactNode; count?: number; tag?: string; hasNotification?: boolean; onPress?: () => void }) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.card} {...(onPress ? { activeOpacity: 0.85, onPress } : {})}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.cardIconWrap}>
          {icon}
          {hasNotification && <View style={styles.dotBadge} />}
        </View>
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
    </Wrapper>
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
  safe: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  container: { 
    flex: 1,
    top: -35,
    
   },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 8 
  },
  headerLogo: { 
    width: 40, 
    height: 40 
  },
  headerIcons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  iconBtn: { padding: 8 },
  headerIconImg: { 
    width: 20, 
    height: 20, 
    tintColor: GREEN 
  },
  welcomeBanner: { position: 'absolute', left: 16, right: 16, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  welcomeText: { color: GREEN, fontWeight: '700' },
  welcomeClose: { color: GREEN, fontWeight: '800', fontSize: 18, lineHeight: 18, paddingLeft: 8 },
  avatarBtn: { padding: 4 },
  avatarCircle: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: GREEN 
  },
  avatarImg: { 
    width: '100%', 
    height: '100%' 
  },
  divider: { 
    height: 1, 
    backgroundColor: BORDER 
  },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingBottom: 90 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: GREEN, 
    marginTop: 12 
  },
  sectionDivider: { 
    height: 1, 
    backgroundColor: BORDER, 
    marginTop: 8, 
    marginBottom: 12 
  },

  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    rowGap: 12 
  },
  card: { 
    width: '48%', 
    backgroundColor: CARD_BG, 
    borderRadius: 14, 
    padding: 12 
  },
  cardTopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  cardTitle: { 
    color: GREEN, 
    fontWeight: '700' 
  },
  cardIconWrap: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative'
  },
  cardImg: { 
    width: 18, 
    height: 18, 
    tintColor: GREEN 
  },
  dotBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF'
  },
  cardText: { 
    color: MUTED, 
    fontSize: 12 
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 },
  badgeCount: { alignSelf: 'flex-start', backgroundColor: '#E6FFF5', borderColor: GREEN, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, height: 22, alignItems: 'center', justifyContent: 'center' },
  badgeCountText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  tagPill: { backgroundColor: '#E6FFF5', borderColor: GREEN, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, height: 20, alignItems: 'center', justifyContent: 'center' },
  tagText: { color: GREEN, fontWeight: '700', fontSize: 10 },

  activityCard: { 
    marginTop: 16, 
    backgroundColor: CARD_BG, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#F3F4F6', 
    padding: 12 
  },
  activityHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  activityTitle: { 
    color: GREEN, 
    fontWeight: '700' 
  },
  viewAll: { color: MUTED },
  activityBody: { paddingTop: 8 },
  activityItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#EEF2F7', 
    gap: 10 
  },
  activityLeft: { 
    width: 36, 
    height: 36, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: GREEN, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  activityIcon: { 
    width: 18, 
    height: 18,
    tintColor: GREEN 
  },
  activityItemTitle: { 
    color: '#111827', 
    fontWeight: '700', 
    fontSize: 13 
  },
  activityItemSub: { 
    color: MUTED, 
    fontSize: 11, 
    marginTop: 2 
  },

  bottomBar: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: -39, 
    height: 64, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: BORDER, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center' 
  },
  bottomItem: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  bottomImg: { 
    width: 22, 
    height: 22, 
    marginBottom: 4 
  },
  bottomLabel: { fontSize: 10, color: MUTED },

  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16 
  },
  modalCard: { 
    width: '100%', 
    maxHeight: '80%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16 },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  modalTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827' 
  },
  closeBtn: { 
    padding: 6, 
    borderRadius: 14 
  },
  closeText: { 
    fontSize: 24, 
    color: MUTED, 
    lineHeight: 24 
  },
  // Profile menu styles
  menuOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end', padding: 16 },
  menuCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 70, borderWidth: 1, borderColor: BORDER },
  menuItem: { paddingVertical: 12, alignItems: 'center' },
  menuText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  menuCancel: { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  menuCancelText: { color: MUTED, fontWeight: '700' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
});

