import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { addPrescription } from '../../state/patient_records_store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

export default function DoctorPrescription() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [patient, setPatient] = useState('');
  const [subject, setSubject] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dosage, setDosage] = useState('');
  const [description, setDescription] = useState('');
  const isValid = [name, patient, subject, quantity, dosage, description].every((v) => v.trim().length > 0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [patients, setPatients] = useState<string[]>([]);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

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
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  const loadDoctorName = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return;
      const sess = JSON.parse(raw);
      const n = sess?.user?.full_name || sess?.user?.fullName || sess?.user?.name || sess?.full_name || sess?.name || '';
      setName(n);
    } catch {}
  }, []);

  const loadPatientsFromAppointments = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, { headers });
      if (!res.ok) return;
      const arr = await res.json();
      if (Array.isArray(arr)) {
        const names = Array.from(
          new Set(
            arr
              .filter((a: any) => !a?.done)
              .map((a: any) => String(a.patient || '').trim())
              .filter(Boolean)
          )
        );
        setPatients(names);
      }
    } catch {}
  }, [API_BASE, getAuthHeaders, patient]);

  React.useEffect(() => { loadDoctorName(); }, [loadDoctorName]);
  useFocusEffect(React.useCallback(() => {
    loadPatientsFromAppointments();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('doctor_notifications');
        const arr = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(arr) ? arr.filter((n: any) => n && n.read === false).length : 0;
        setUnreadCount(count);
      } catch { setUnreadCount(0); }
      // Load avatar from session
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
        setAvatarUri(uri || undefined);
      } catch {}
    })();
    return () => {};
  }, [loadPatientsFromAppointments]));

  const onSubmit = async () => {
    if (!name || !patient || !subject || !quantity || !dosage || !description) {
      Alert.alert('Validation', 'Please fill out all fields.');
      return;
    }
    
    try {
      // Save to backend PostgreSQL prescription table
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/prescription`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patient_name: patient,
          doctor_name: name,
          medicine: subject,
          quantity: Number(quantity),
          dosage_strength: dosage,
          description,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save prescription');
      }
      
      const savedPrescription = await res.json();
      console.log('Prescription saved:', savedPrescription);
      
      // Also save to AsyncStorage for offline access
      try {
        addPrescription(patient, {
          doctorName: name,
          subject,
          quantity,
          dosageStrength: dosage,
          description,
        });
      } catch {}
      
      // Persist to AsyncStorage for pharmacy to consume
      try {
        const raw = await AsyncStorage.getItem('prescriptions');
        const arr = raw ? JSON.parse(raw) : [];
        const item = {
          id: String(savedPrescription.id || Date.now()),
          patient,
          medicine: subject,
          quantity: Number(quantity),
          dosage,
          notes: description,
          status: 'new',
        };
        const next = [item, ...Array.isArray(arr) ? arr : []];
        await AsyncStorage.setItem('prescriptions', JSON.stringify(next));
      } catch {}
      // Also push a Pharmacy notification entry (their screen reads 'pharmacy_notifications')
      try {
        const rawN = await AsyncStorage.getItem('pharmacy_notifications');
        const arrN = rawN ? JSON.parse(rawN) : [];
        const summary = `${subject}${dosage ? ` • ${dosage}` : ''}${quantity ? ` • Qty: ${quantity}` : ''}${patient ? ` • Patient: ${patient}` : ''}`.trim();
        const notif = {
          id: `PRX-${savedPrescription.id || Date.now()}`,
          title: 'New Prescription Submitted',
          message: summary || 'A new prescription was submitted.',
          timestamp: Date.now(),
          read: false,
          status: 'pending',
        };
        const nextN = [notif, ...Array.isArray(arrN) ? arrN : []];
        await AsyncStorage.setItem('pharmacy_notifications', JSON.stringify(nextN));
      } catch {}
      
      // Persist to backend patient_records (doctor, medicine, dosage)
      try {
        await fetch(`${API_BASE}/api/patient-records`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            patient,
            doctor: name,
            medicine: subject,
            dosage,
            notes: description,
            date: null,
            time: null,
          }),
        });
      } catch {}
      
      // Log activity: prescription submitted
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const item = { id: String(Date.now()), title: `Prescription submitted: ${patient} • ${subject}` , type: 'prescription', timestamp: Date.now() };
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : []; // Keep only latest 100
        await AsyncStorage.setItem('doctor_activity', JSON.stringify([item, ...updatedAct]));
      } catch {}
      
      Alert.alert('Submitted', 'Prescription has been submitted and saved to database.');
      
      // Do not clear doctor name; keep it. Clear rest.
      setPatient('');
      setSubject('');
      setQuantity('');
      setDosage('');
      setDescription('');
    } catch (e: any) {
      Alert.alert('Error', `Failed to submit prescription: ${e?.message || 'Network error'}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('DoctorNotification' as never)}>
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

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Prescription</Text>
          </View>
          <Text style={styles.subtitle}>Fill out the form below to submit a new prescription.</Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Prescription Form</Text>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Doctor Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                placeholder="Doctor name"
                value={name}
                editable={false}
                style={[styles.input, { backgroundColor: '#F3F4F6' }]}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Patient Name <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  placeholder={patients.length ? 'Select a patient' : 'No appointments yet'}
                  value={patient}
                  editable={false}
                  style={[styles.input, { paddingRight: 40, backgroundColor: '#F3F4F6' }]}
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowPatientPicker((v) => !v)}>
                  <Image source={require('../../assets/dropdown.png')} style={styles.inlineIcon} resizeMode="contain" />
                </TouchableOpacity>
              </View>
              {showPatientPicker && (
                <View style={styles.inlineDropdown}>
                  {patients.length === 0 ? (
                    <Text style={{ color: MUTED, textAlign: 'center', paddingVertical: 8 }}>No appointments yet.</Text>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.optionItem} onPress={() => { setPatient(''); setShowPatientPicker(false); }}>
                        <Text style={[styles.optionText, { color: MUTED }]}>---|---</Text>
                      </TouchableOpacity>
                      {patients.map((p) => (
                        <TouchableOpacity key={p} style={styles.optionItem} onPress={() => { setPatient(p); setShowPatientPicker(false); }}>
                          <Text style={styles.optionText}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Medicine <Text style={styles.required}>*</Text></Text>
              <TextInput
                placeholder="Enter medicine"
                value={subject}
                onChangeText={setSubject}
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Quantity Prescribed <Text style={styles.required}>*</Text></Text>
              <TextInput
                placeholder="Enter quantity"
                value={quantity}
                onChangeText={setQuantity}
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Dosage Strength <Text style={styles.required}>*</Text></Text>
              <TextInput
                placeholder="e.g., 500mg"
                value={dosage}
                onChangeText={setDosage}
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}> 
              <Text style={styles.inputLabel}>Description <Text style={styles.required}>*</Text></Text>
              <TextInput
                placeholder="Provide details"
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.textArea]}
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            <TouchableOpacity style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]} onPress={onSubmit} activeOpacity={0.9} disabled={!isValid}>
              <Text style={styles.submitText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Inline dropdown rendered above; no modal */}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('DoctorDashboard')} />
          <BottomItem label="Appointment" source={require('../../assets/appointment_icon.png')} onPress={() => navigation.navigate('DoctorAppointment')} />
          <BottomItem label="Prescription" active source={require('../../assets/prescription_icon.png')} onPress={() => {}} />
          <BottomItem label="P-Records" source={require('../../assets/patient_records_icon.png')} onPress={() => navigation.navigate('DoctorPatientRecords')} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('DoctorReports')} />
        </View>
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('DoctorProfile'); }}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}>
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
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },

  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { padding: 16, paddingBottom: 120 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
  subtitle: { color: MUTED, marginTop: 4, fontSize: 12 },

  formCard: {
    marginTop: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formTitle: { color: GREEN, fontWeight: '700', fontSize: 16, textAlign: 'center', marginBottom: 10 },

  formGroup: { marginTop: 10 },
  inputLabel: { color: '#374151', marginBottom: 6, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 40,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: { height: 120, textAlignVertical: 'top', paddingTop: 10 },
  required: { color: '#EF4444' },
  inputWithIcon: { position: 'relative' },
  iconOverlay: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', width: 28 },
  inlineIcon: { width: 16, height: 16, tintColor: GREEN },

  submitBtn: { marginTop: 16, backgroundColor: GREEN, paddingVertical: 12, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 28, minWidth: 180, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#86E3C3' },
  submitText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: { marginTop: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN, paddingVertical: 10, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 20, minWidth: 180, alignItems: 'center' },
  secondaryBtnDisabled: { borderColor: '#A7F3D0' },
  secondaryText: { color: GREEN, fontWeight: '700' },

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
  // Inline dropdown styles
  inlineDropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  optionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  optionText: { color: '#111827' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

