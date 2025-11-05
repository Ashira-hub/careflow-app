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
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function DoctorEditProfile() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';

  // Local editable state; hydrated from session
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return { 'Content-Type': 'application/json' } as Record<string, string>;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string, string>;
      return { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

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

  React.useEffect(() => { loadSession(); }, [loadSession]);
  useFocusEffect(React.useCallback(() => {
    loadSession();
    (async () => {
      try {
        const rawN = await AsyncStorage.getItem('doctor_notifications');
        const arrN = rawN ? JSON.parse(rawN) : [];
        const n = Array.isArray(arrN) ? arrN.filter((x: any) => !x?.read).length : 0;
        setUnreadCount(n);
      } catch { setUnreadCount(0); }
    })();
    return () => {};
  }, [loadSession]));

  const onSave = async () => {
    try {
      const headers = await getAuthHeaders();
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('Error', 'Missing user id in session. Please re-login.');
        return;
      }
      const roleValue = role.toLowerCase() === 'lab staff' ? 'labstaff' : role.toLowerCase();
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name, email, role: roleValue || 'user', phone, address, birthdate, gender, avatar_uri: avatarUri || null }),
      });
      if (!res.ok) {
        let msg = `Save failed (HTTP ${res.status})`;
        try { const data = await res.json(); if (data?.message) msg = data.message; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();

      // Read back from server to confirm persistence and get normalized values
      let latest = data;
      try {
        const headers2 = await getAuthHeaders();
        const res2 = await fetch(`${API_BASE}/api/users/${userId}`, { headers: headers2 });
        if (res2.ok) {
          latest = await res2.json();
        }
      } catch {}

      const raw = await AsyncStorage.getItem('session');
      let sess: any = {};
      if (raw) {
        try { sess = JSON.parse(raw); } catch { sess = {}; }
      }
      const user = sess?.user || {};
      const updatedUser = {
        ...user,
        id: user.id || userId,
        full_name: latest?.name ?? data?.name ?? name,
        email: latest?.email ?? data?.email ?? email,
        role: latest?.role ?? data?.role ?? roleValue,
        phone: latest?.phone ?? data?.phone ?? phone,
        address: latest?.address ?? data?.address ?? address,
        birthdate: latest?.birthdate ?? data?.birthdate ?? birthdate,
        gender: latest?.gender ?? data?.gender ?? gender,
        avatar_uri: latest?.avatar_uri ?? data?.avatar_uri ?? avatarUri ?? user.avatar_uri,
      };
      const nextSession = sess?.user ? { ...sess, user: updatedUser } : updatedUser;
      await AsyncStorage.setItem('session', JSON.stringify(nextSession));
      // Update local state to reflect server values immediately
      setName(updatedUser.full_name || name);
      setEmail(updatedUser.email || email);
      setPhone(updatedUser.phone || phone);
      setAddress(updatedUser.address || address);
      setBirthdate(updatedUser.birthdate || birthdate);
      setGender(updatedUser.gender || gender);
      setAvatarUri(updatedUser.avatar_uri || avatarUri);
      Alert.alert('Saved', 'Profile changes have been saved.');
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const item = { id: String(Date.now()), title: 'Updated profile', type: 'profile', timestamp: Date.now() };
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : [];
        await AsyncStorage.setItem('doctor_activity', JSON.stringify([item, ...updatedAct]));
      } catch {}
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save profile.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header (matches dashboard) */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('DoctorNotification')}>
                <Image source={require('../../assets/notification_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.notifBadgeWrap}>
                  <Text style={styles.notifBadgeText}>{Math.min(99, unreadCount)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('DoctorProfile')}>
              <Image source={require('../../assets/profile_icon.png')} style={styles.headerIconImg} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={styles.screenTitle}>Edit Profile</Text>

            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}> 
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
                <TouchableOpacity
                  style={styles.avatarPen}
                  onPress={() => {
                    let picker: any;
                    try { picker = require('react-native-image-picker'); } catch {}
                    const launch = picker?.launchImageLibrary || picker?.default?.launchImageLibrary;
                    if (!launch) {
                      Alert.alert('Change Photo', 'Image picker not installed. Please add react-native-image-picker to enable this.');
                      return;
                    }
                    try {
                      launch({ mediaType: 'photo', selectionLimit: 1 }, (res: any) => {
                        if (res?.didCancel) return;
                        if (res?.errorCode) {
                          Alert.alert('Image Picker Error', String(res.errorMessage || res.errorCode));
                          return;
                        }
                        const uri = res?.assets?.[0]?.uri;
                        if (uri) setAvatarUri(uri);
                      });
                    } catch (e) {
                      Alert.alert('Change Photo', 'Unable to open image library on this device.');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.avatarPenText}>✎</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.role}>{role}</Text>
              </View>
            </View>

            {/* Editable fields */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Role</Text>
              <TextInput value={role} editable={false} selectTextOnFocus={false} style={[styles.input, { color: '#6B7280', backgroundColor: '#F9FAFB' }]} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Birthdate</Text>
              <View style={styles.dateRow}>
                <TextInput value={birthdate} onChangeText={setBirthdate} style={[styles.input, styles.dateInput]} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
                <TouchableOpacity style={styles.dateBtn} onPress={async () => {
                  // Dynamically require the community datetimepicker if available
                  let Picker: any;
                  try {
                    Picker = require('@react-native-community/datetimepicker');
                  } catch {}
                  const DateTimePicker = Picker?.default || Picker;
                  if (!DateTimePicker) {
                    Alert.alert('Select Date', 'Date picker not installed. You can type the date as YYYY-MM-DD.');
                    return;
                  }
                  // Toggle state to render the picker inline
                  setShowDatePicker(true);
                }}>
                  <Image source={require('../../assets/appointment_icon.png')} style={styles.dateIcon} resizeMode="contain" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Gender</Text>
              <TextInput value={gender} onChangeText={setGender} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>

            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={onSave}>
              <Text style={styles.saveText}>SAVE</Text>
            </TouchableOpacity>
            
            {/* Date Picker: Android inline (native dialog), iOS inside Modal */}
            {showDatePicker && Platform.OS === 'android' && (() => {
              let Picker: any; try { Picker = require('@react-native-community/datetimepicker'); } catch {}
              const DateTimePicker = Picker?.default || Picker;
              if (!DateTimePicker) return null;
              let initialDate: Date; try { initialDate = birthdate ? new Date(birthdate) : new Date(); } catch { initialDate = new Date(); }
              return (
                <DateTimePicker
                  value={initialDate}
                  mode="date"
                  display="default"
                  onChange={(event: any, selectedDate?: Date) => {
                    if (event.type === 'set' && selectedDate) {
                      const y = selectedDate.getFullYear();
                      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const d = String(selectedDate.getDate()).padStart(2, '0');
                      setBirthdate(`${y}-${m}-${d}`);
                    }
                    setShowDatePicker(false);
                  }}
                />
              );
            })()}

            {Platform.OS === 'ios' && (
              <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerContainer}>
                    <View style={styles.datePickerHeader}>
                      <Text style={styles.datePickerTitle}>Select Birthdate</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.datePickerCloseText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {showDatePicker && (() => {
                      let Picker: any; try { Picker = require('@react-native-community/datetimepicker'); } catch {}
                      const DateTimePicker = Picker?.default || Picker;
                      if (!DateTimePicker) {
                        return (
                          <View style={styles.datePickerFallback}>
                            <Text style={styles.datePickerFallbackText}>
                              Date picker not available. Please enter date manually in YYYY-MM-DD format.
                            </Text>
                          </View>
                        );
                      }
                      let initialDate: Date; try { initialDate = birthdate ? new Date(birthdate) : new Date(); } catch { initialDate = new Date(); }
                      return (
                        <View style={styles.datePickerContent}>
                          <DateTimePicker
                            value={initialDate}
                            mode="date"
                            display="spinner"
                            onChange={(event: any, selectedDate?: Date) => {
                              if (selectedDate) {
                                const y = selectedDate.getFullYear();
                                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const d = String(selectedDate.getDate()).padStart(2, '0');
                                setBirthdate(`${y}-${m}-${d}`);
                              }
                            }}
                            style={styles.datePickerIOS}
                          />
                          <View style={styles.datePickerButtons}>
                            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(false)}>
                              <Text style={styles.datePickerButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.datePickerButton, styles.datePickerButtonPrimary]} onPress={() => setShowDatePicker(false)}>
                              <Text style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </Modal>
            )}
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('DoctorDashboard')} />
          <BottomItem label="Appointment" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('DoctorAppointment')} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('DoctorPrescription')} />
          <BottomItem label="P-Records" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('DoctorPatientRecords')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('DoctorReports')} />
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
  notifBadgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER },

  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12, position: 'relative' },
  avatarText: { color: GREEN, fontWeight: '700', fontSize: 18 },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarPen: { position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#0EA37F' },
  avatarPenText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, lineHeight: 14 },
  name: { color: '#111827', fontWeight: '800' },
  role: { color: MUTED, marginTop: 2 },

  formGroup: { marginTop: 8 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  dateRow: { position: 'relative', justifyContent: 'center' },
  dateInput: { paddingRight: 44 },
  dateBtn: { position: 'absolute', right: 8, height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
  dateIcon: { width: 22, height: 22, tintColor: GREEN },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },

  changePhotoBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: GREEN, borderRadius: 8, backgroundColor: '#FFFFFF' },
  changePhotoText: { color: GREEN, fontWeight: '700', fontSize: 12 },

  saveBtn: { marginTop: 16, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 28, minWidth: 180, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
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

  // Date Picker Modal Styles
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  datePickerCloseText: {
    fontSize: 24,
    fontWeight: '700',
    color: MUTED,
    lineHeight: 24,
  },
  datePickerContent: {
    alignItems: 'center',
  },
  datePickerIOS: {
    width: '100%',
    height: 200,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerButtonPrimary: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  datePickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  datePickerFallback: {
    padding: 20,
    alignItems: 'center',
  },
  datePickerFallbackText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
});

