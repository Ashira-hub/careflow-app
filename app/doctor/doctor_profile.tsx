import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://capstone-production-8af8.up.railway.app/api/profile';

export default function DoctorProfile() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = useMemo(() => {
    const parts = (name || '').trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  const roleLabel = (r?: string) => {
    if (!r) return '';
    const key = String(r).toLowerCase();
    if (key === 'labstaff') return 'Lab Staff';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  const getUserId = React.useCallback(async (): Promise<string | null> => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return null;
      const sess = JSON.parse(raw);
      const user = sess?.user || sess;
      const id = user?.id || user?.user_id || user?.uid || null;
      return id ? String(id) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchProfileFromDatabase = React.useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        console.log('No user ID found in session');
        return;
      }

      // Try profile endpoint first, then fallback to users endpoint
      let response = await fetch(`${API_BASE}/api/profile/${userId}`);
      if (!response.ok) {
        // Fallback to users endpoint
        response = await fetch(`${API_BASE}/api/users/${userId}`);
        if (!response.ok) {
          console.log('Failed to fetch profile from database');
          return;
        }
      }

      const data = await response.json();

      // Update local state with database data
      setName(data?.name || '');
      setEmail(data?.email || '');
      setRole(roleLabel(data?.role));
      setPhone(data?.phone || '');
      setAddress(data?.address || '');
      setBirthdate(data?.birthdate || '');
      setGender(data?.gender || '');

      // Update AsyncStorage to keep it in sync
      const raw = await AsyncStorage.getItem('session');
      let sess: any = {};
      if (raw) {
        try {
          sess = JSON.parse(raw);
        } catch {
          sess = {};
        }
      }
      const user = sess?.user || {};
      const updatedUser = {
        ...user,
        id: user.id || userId,
        full_name: data?.name || user.full_name,
        email: data?.email || user.email,
        role: data?.role || user.role,
        phone: data?.phone || user.phone,
        address: data?.address || user.address,
        birthdate: data?.birthdate || user.birthdate,
        gender: data?.gender || user.gender,
      };
      const nextSession = sess?.user
        ? { ...sess, user: updatedUser }
        : updatedUser;
      await AsyncStorage.setItem('session', JSON.stringify(nextSession));
    } catch (error) {
      console.error('Error fetching profile from database:', error);
    }
  }, [getUserId]);

  const loadSession = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return;
      const sess = JSON.parse(raw);
      const user = sess?.user || sess;
      setName(user?.full_name || user?.fullName || user?.name || '');
      setEmail(user?.email || '');
      setRole(roleLabel(user?.role));
      setPhone(user?.phone || '');
      setAddress(user?.address || '');
      setBirthdate(user?.birthdate || '');
      setGender(user?.gender || '');
      setAvatarUri(user?.avatar_uri || user?.avatarUrl || undefined);
    } catch {}
  }, []);

  React.useEffect(() => {
    loadSession();
    fetchProfileFromDatabase();
  }, [loadSession, fetchProfileFromDatabase]);

  useFocusEffect(
    React.useCallback(() => {
      loadSession();
      fetchProfileFromDatabase();
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
    }, [loadSession, fetchProfileFromDatabase]),
  );

  const pickImage = () => {
    let pkg: any;
    try {
      // Dynamically require to avoid crash if package isn't installed
      pkg = require('react-native-image-picker');
    } catch {}

    const launchImageLibrary =
      pkg?.launchImageLibrary || pkg?.default?.launchImageLibrary;
    if (!launchImageLibrary) {
      Alert.alert(
        'Change Photo',
        'Image picker not installed. Please add react-native-image-picker to enable this.',
      );
      return;
    }

    try {
      launchImageLibrary(
        { mediaType: 'photo', selectionLimit: 1 },
        (res: any) => {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            Alert.alert(
              'Image Picker Error',
              String(res.errorMessage || res.errorCode),
            );
            return;
          }
          const uri = res?.assets?.[0]?.uri;
          if (uri) setAvatarUri(uri);
        },
      );
    } catch (e) {
      Alert.alert(
        'Change Photo',
        'Unable to open image library on this device.',
      );
    }
  };

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
            <View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() =>
                  navigation.navigate('DoctorNotification' as never)
                }
              >
                <Image
                  source={require('../../assets/notification_icon.png')}
                  style={styles.headerIconImg}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.notifBadgeWrap}>
                  <Text style={styles.notifBadgeText}>
                    {Math.min(99, unreadCount)}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => setShowProfileMenu(true)}
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImgSm}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/appicon.png')}
                    style={styles.avatarImgSm}
                    resizeMode="cover"
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={styles.screenTitle}>Profile</Text>

            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{name}</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('DoctorEditProfile')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.role}>{role}</Text>
              </View>
            </View>

            {/* Info (key-value rows) */}
            <View style={styles.infoCard}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Full Name</Text>
                <Text style={styles.kvValue} numberOfLines={2}>
                  : {name || '—'}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Role</Text>
                <Text style={styles.kvValue}>: {role || '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Email</Text>
                <Text style={styles.kvValue}>: {email || '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Phone</Text>
                <Text style={styles.kvValue}>: {phone || '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Birthdate</Text>
                <Text style={styles.kvValue}>: {birthdate || '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Gender</Text>
                <Text style={styles.kvValue}>: {gender || '—'}</Text>
              </View>
              <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.kvLabel}>Address</Text>
                <Text style={styles.kvValue} numberOfLines={2}>
                  : {address || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.logoutBtn}
                activeOpacity={0.9}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem('session');
                  } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
              >
                <Text style={styles.logoutText}>LOGOUT</Text>
              </TouchableOpacity>
            </View>
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
                  setShowProfileMenu(false); /* already on profile */
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await AsyncStorage.removeItem('session');
                  } catch {}
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
  avatarImgSm: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },

  screenTitle: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6FFF5',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: GREEN, fontWeight: '700', fontSize: 18 },
  avatarPen: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0EA37F',
  },
  avatarPenText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 14,
  },
  name: { color: '#111827', fontWeight: '800' },
  role: { color: MUTED, marginTop: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  editLink: { color: GREEN, fontWeight: '700' },

  formGroup: { marginTop: 8 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomColor: '#F3F4F6',
    borderBottomWidth: 1,
  },
  kvLabel: { width: 110, color: MUTED, fontWeight: '700' },
  kvValue: { flex: 1, color: '#111827', fontWeight: '600' },
  changePhotoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  changePhotoText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },
  editBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'center',
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  editText: { color: '#FFFFFF', fontWeight: '700' },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'center',
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  logoutText: { color: '#FFFFFF', fontWeight: '700' },

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
