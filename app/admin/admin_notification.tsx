import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type NotificationItem = { id: string; title: string; message: string; timestamp?: number; read?: boolean };

export default function AdminNotification() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [detailItem, setDetailItem] = React.useState<NotificationItem | null>(null);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [darkMode, setDarkMode] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<string, string>;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id;
      const withAuth = token ? { ...base, Authorization: `Bearer ${token}` } : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          try { const rawDM = await AsyncStorage.getItem('admin_dark_mode'); if (rawDM != null) setDarkMode(rawDM === '1'); } catch {}
          try {
            const rawS = await AsyncStorage.getItem('session');
            const sess = rawS ? JSON.parse(rawS) : null;
            const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
            if (av) setAvatarUri(String(av)); else {
              const rawC = await AsyncStorage.getItem('admin_profile_cache');
              const cache = rawC ? JSON.parse(rawC) : null;
              setAvatarUri(cache?.avatar_uri || undefined);
            }
          } catch {}
          const raw = await AsyncStorage.getItem('admin_notifications');
          const localArr: any[] = raw ? JSON.parse(raw) : [];
          try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/api/notifications`, { headers });
            if (res.ok) {
              const serverArr = await res.json();
              const mapped = Array.isArray(serverArr)
                ? serverArr.map((n: any) => ({
                    id: String(n.id),
                    title: String(n.title || 'Notification'),
                    message: String(n.message || ''),
                    timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
                    read: Boolean(n.read) === true,
                  }))
                : [];
              const byId: Record<string, any> = {};
              for (const it of localArr) { if (it?.id) byId[String(it.id)] = it; }
              for (const it of mapped) { byId[it.id] = { ...byId[it.id], ...it }; }
              const merged = Object.values(byId)
                .filter(Boolean)
                .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
              await AsyncStorage.setItem('admin_notifications', JSON.stringify(merged));
              setItems(merged as NotificationItem[]);
            } else {
              setItems(Array.isArray(localArr) ? localArr : []);
            }
          } catch {
            setItems(Array.isArray(localArr) ? localArr : []);
          }
        } catch { setItems([]); }
      })();
      return () => {};
    }, [getAuthHeaders])
  );

  const unread = items.filter(n => !n.read).length;
  const openDetail = (it: NotificationItem) => { setDetailItem(it); setShowDetail(true); };
  const markAsRead = async (id: string) => {
    try {
      const next = items.map((n) => (n.id === id ? { ...n, read: true } : n));
      setItems(next);
      await AsyncStorage.setItem('admin_notifications', JSON.stringify(next));
      try {
        const headers = await getAuthHeaders();
        await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT', headers });
      } catch {}
    } catch {}
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={async () => {
        if (!item.read) { try { await markAsRead(item.id); } catch {} }
        openDetail(item);
      }}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Image source={require('../../assets/notification_icon.png')} style={styles.rowIcon} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub} numberOfLines={2}>{item.message}</Text>
          {!!item.timestamp && (<Text style={styles.rowTime}>{new Date(item.timestamp).toLocaleString()}</Text>)}
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, darkMode && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.container, darkMode && { backgroundColor: '#0B1220' }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn}>
                <Image source={require('../../assets/notification_icon.png')} style={[styles.headerIconImg, darkMode && { tintColor: '#9CA3AF' }]} resizeMode="contain" />
              </TouchableOpacity>
              {unread > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unread)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileMenu(true)}>
              <View style={[styles.avatarCircle, darkMode && { borderColor: '#374151' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        {/* List */}
        <View style={styles.body}>
          <Text style={[styles.title, darkMode && { color: '#22C55E' }]}>Notifications</Text>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={() => (
              <View style={{ paddingVertical: 18 }}><Text style={{ color: darkMode ? '#9CA3AF' : MUTED, textAlign: 'center' }}>No notifications yet.</Text></View>
            )}
            renderItem={renderItem}
          />
        </View>

        {/* Bottom Bar */}
        <View style={[styles.bottomBar, darkMode && { backgroundColor: '#111827', borderTopColor: '#1F2937' }]}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <BottomItem label="Users" source={require('../../assets/profile_icon.png')} onPress={() => navigation.navigate('AdminManageUsers' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('AdminReports' as never)} />
          <BottomItem label="Settings" source={require('../../assets/settings_icon.png')} onPress={() => navigation.navigate('AdminSettings' as never)} />
        </View>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('AdminProfile' as never); }}>
                <Text style={[styles.dropdownText, darkMode && { color: '#E5E7EB' }]}>Profile</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, darkMode && { backgroundColor: '#1F2937' }]} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }); }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Details Modal */}
        <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.detailIconWrap}>
                  <Image source={require('../../assets/notification_icon.png')} style={styles.detailIcon} resizeMode="contain" />
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetail(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detailHeaderBlock}>
                <Text style={styles.detailTitle}>{detailItem?.title || ''}</Text>
                {!!detailItem?.timestamp && (
                  <Text style={styles.detailTime}>{new Date(detailItem.timestamp).toLocaleString()}</Text>
                )}
              </View>
              <View style={styles.detailPanel}>
                <Text style={styles.panelLabel}>Details</Text>
                <View style={styles.panelBody}>
                  <Text style={styles.detailBody}>{detailItem?.message || ''}</Text>
                </View>
              </View>
              <View style={styles.detailActions}>
                {!detailItem?.read && detailItem?.id && (
                  <TouchableOpacity style={styles.markBtn} onPress={async () => { await markAsRead(detailItem.id); }}>
                    <Text style={styles.markBtnText}>Mark as Read</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.okBtn} onPress={() => setShowDetail(false)}>
                  <Text style={styles.okBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
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
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },

  card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rowIcon: { width: 18, height: 18, tintColor: GREEN },
  rowTitle: { color: '#111827', fontWeight: '700' },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  rowTime: { color: MUTED, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 560, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  detailIconWrap: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6FFF5' },
  detailIcon: { width: 22, height: 22, tintColor: GREEN },
  detailHeaderBlock: { marginTop: 10, marginBottom: 8 },
  detailTitle: { color: '#111827', fontWeight: '800', fontSize: 16 },
  detailTime: { color: MUTED, fontSize: 12, marginTop: 2 },
  detailPanel: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, backgroundColor: CARD_BG, padding: 12, marginTop: 6, maxHeight: 260 },
  panelLabel: { color: MUTED, fontSize: 12, marginBottom: 6 },
  panelBody: { },
  detailBody: { color: '#111827' },
  detailActions: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  markBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#F3F4F6', borderRadius: 10, borderWidth: 1, borderColor: BORDER },
  markBtnText: { color: '#111827', fontWeight: '700' },
  okBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: GREEN, borderRadius: 10 },
  okBtnText: { color: '#FFFFFF', fontWeight: '700' },

  // Bottom bar
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 45, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },

  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

