import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp?: number;
  read?: boolean;
  status?: 'accepted' | 'rejected' | 'pending' | 'acknowledged' | 'dispensed';
};

export default function PharmacyNotification() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('pharmacy_notifications');
          const arr = raw ? JSON.parse(raw) : [];
          setItems(Array.isArray(arr) ? arr : []);
        } catch { setItems([]); }
        // Load avatar for header profile icon
        try {
          const rawSession = await AsyncStorage.getItem('session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            const user = sess?.user || sess;
            const uid = user?.id || user?.user_id || user?.uid;
            const stored = uid ? await AsyncStorage.getItem(`avatar_${uid}`) : undefined;
            setAvatarUri(stored || user?.avatar_uri || user?.avatarUrl || undefined);
          }
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const markAsRead = async (id: string) => {
    try {
      const next = items.map(n => (n.id === id ? { ...n, read: true } : n));
      setItems(next);
      await AsyncStorage.setItem('pharmacy_notifications', JSON.stringify(next));
    } catch {}
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={async () => {
        if (!item.read) {
          try { await markAsRead(item.id); } catch {}
        }
        setDetailItem(item);
        setShowDetail(true);
      }}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Image source={require('../../assets/notification_icon.png')} style={styles.rowIcon} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub} numberOfLines={2}>{item.message}</Text>
          {!!item.timestamp && (
            <Text style={styles.rowTime}>{new Date(item.timestamp).toLocaleString()}</Text>
          )}
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const unread = items.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PharmacyNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unread > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unread)}</Text>
                </View>
              )}
            </View>
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

        <View style={styles.body}>
          <Text style={styles.title}>Notifications</Text>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={() => (
              <View style={{ paddingVertical: 18 }}>
                <Text style={{ color: MUTED, textAlign: 'center' }}>No notifications yet.</Text>
              </View>
            )}
            renderItem={renderItem}
          />
        </View>

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
                  <Text style={styles.detailTime}>{new Date(detailItem.timestamp!).toLocaleString()}</Text>
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
                  <TouchableOpacity style={styles.markBtn} onPress={async () => { await markAsRead(detailItem.id!); }}>
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

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('PharmacyProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard')} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => navigation.navigate('PharmacyInventory')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription')} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports')} />
        </View>
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

  // Modal styles (aligned with doctor)
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

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
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
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
})
;
