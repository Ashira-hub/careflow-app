import React from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function PharmacyMedicineDetails() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item = route.params?.item;
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);

  // Load avatar on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
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
      })();
      return () => {};
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PharmacyNotification' as never)}>
              <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
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

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Medicine Details</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Generic Name</Text>
              <Text style={styles.value}>{item?.generic ?? '-'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.label}>Brand</Text>
              <Text style={styles.value}>{item?.brand ?? '-'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{item?.category ?? '-'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.label}>Dosage Type</Text>
              <Text style={styles.value}>{item?.dosageType ?? '-'}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.label}>Strength</Text>
              <Text style={styles.value}>{item?.strength ? `${item.strength}${item.unit ? item.unit : ''}` : '-'}</Text>
            </View>
            
            <View style={[styles.detailRow, styles.lastRow]}>
              <Text style={styles.label}>Stocks</Text>
              <Text style={styles.value}>{item?.stock ?? '-'}</Text>
            </View>
          </View>
        </ScrollView>
        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard' as never)} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => navigation.navigate('PharmacyInventory' as never)} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription' as never)} />
          <BottomItem label="Medicine" active source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports' as never)} />
        </View>

        {/* Profile Menu */}
        {showProfileMenu && (
          <View style={styles.menuOverlay}>
            <View style={styles.menuCard}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('PharmacyProfile'); }}>
                <Text style={styles.menuText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
                <Text style={[styles.menuText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuCancel} onPress={() => setShowProfileMenu(false)}>
                <Text style={styles.menuCancelText}>Cancel</Text>
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
  container: { flex: 1, top: -35 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 90 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  backText: { color: GREEN, fontWeight: '700' },
  detailsCard: { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  lastRow: { borderBottomWidth: 0 },
  label: { color: MUTED, fontWeight: '700', flex: 1 },
  value: { color: '#111827', fontWeight: '700', flex: 1, textAlign: 'right' },
  // Profile menu styles
  menuOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end', padding: 16 },
  menuCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 70, borderWidth: 1, borderColor: BORDER },
  menuItem: { paddingVertical: 12, alignItems: 'center' },
  menuText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
  menuCancel: { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  menuCancelText: { color: MUTED, fontWeight: '700' },
  // Bottom bar styles
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: -39, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
});

