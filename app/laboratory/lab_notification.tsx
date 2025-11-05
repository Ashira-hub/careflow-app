import React from 'react';
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
};

export default function LabNotification() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [selected, setSelected] = React.useState<NotificationItem | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('lab_notifications');
          const arr = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr)) setItems(arr);
          else setItems([]);
        } catch {
          setItems([]);
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
      })();
      return () => {};
    }, [])
  );

  const onOpenDetails = async (it: NotificationItem) => {
    setSelected(it);
    setShowDetails(true);
    try {
      const raw = await AsyncStorage.getItem('lab_notifications');
      const arr: NotificationItem[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(n => n.id === it.id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], read: true };
        await AsyncStorage.setItem('lab_notifications', JSON.stringify(arr));
        setItems(arr);
      }
    } catch {}
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onOpenDetails(item)}>
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {items.filter((n) => !n.read).length > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, items.filter((n) => !n.read).length)}</Text>
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

        {/* Details Modal */}
        <Modal visible={!!selected && showDetails} animationType="fade" transparent onRequestClose={() => setShowDetails(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notification Details</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              {!!selected && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.rowTitle}>{selected.title}</Text>
                  {!!selected.timestamp && <Text style={styles.rowTime}>{new Date(selected.timestamp).toLocaleString()}</Text>}
                  <Text style={styles.rowSub}>{selected.message}</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('LabDashboard' as never)} />
          <BottomItem label="Laboratory" source={require('../../assets/lab_icon.png')} onPress={() => navigation.navigate('LabLaboratory' as never)} />
          <BottomItem label="Lab Records" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('LabRecords' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('LabReports' as never)} />
        </View>

        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('LabProfile' as never); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={async () => {
                setShowProfileMenu(false);
                try { await AsyncStorage.removeItem('session'); } catch {}
                navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
              }}>
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
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

