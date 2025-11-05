import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const API_BASE = 'https://capstone-production-8af8.up.railway.app';

export default function PharmacyAddMedicine() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [category, setCategory] = useState('');
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [dosageType, setDosageType] = useState('');
  const [strength, setStrength] = useState('');
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stock, setStock] = useState<string>('0');
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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());

  const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const formatYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

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

  const onAdd = async () => {
    if (submitting) return;
    const g = genericName.trim();
    if (!g) {
      Alert.alert('Validation', 'Please enter a generic name.');
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          category: category.trim() || null,
          brandName: brandName.trim() || null,
          genericName: g,
          dosageType: dosageType.trim() || null,
          strength: strength.trim() || null,
          unit: unit.trim() || null,
          expirationDate: expirationDate || null,
          stock: Math.max(0, parseInt(stock || '0', 10) || 0),
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to add inventory');
      }
      const created = await res.json();
      Alert.alert('Added', `Saved to inventory: ${created.genericName}${created.brandName ? ` (${created.brandName})` : ''}`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save inventory');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
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

        <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Add Medicine</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn2}>
              <Text style={styles.backText2}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Generic Name</Text>
            <TextInput value={genericName} onChangeText={setGenericName} style={styles.input} placeholder="e.g. Paracetamol" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Brand Name</Text>
            <TextInput value={brandName} onChangeText={setBrandName} style={styles.input} placeholder="e.g. Biogesic" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TextInput value={category} onChangeText={setCategory} style={styles.input} placeholder="e.g. Analgesic" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Dosage Type</Text>
            <TextInput value={dosageType} onChangeText={setDosageType} style={styles.input} placeholder="e.g. Tablet" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.row2}>
            <View style={[styles.formGroup, styles.col]}>
              <Text style={styles.inputLabel}>Strength</Text>
              <TextInput value={strength} onChangeText={setStrength} style={styles.input} placeholder="e.g. 500" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={[styles.formGroup, styles.col]}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput value={unit} onChangeText={setUnit} style={styles.input} placeholder="e.g. mg" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Stock</Text>
            <TextInput value={stock} onChangeText={setStock} keyboardType="number-pad" style={styles.input} placeholder="0" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Expiration Date</Text>
            <View style={styles.inputWithIcon}>
              <TouchableOpacity style={[styles.input, { paddingRight: 42, justifyContent: 'center' }]} activeOpacity={0.8} onPress={() => setShowExpiryPicker(true)}>
                <Text style={{ color: expirationDate ? '#111827' : '#9CA3AF' }}>{expirationDate || 'YYYY-MM-DD'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconOverlay} onPress={() => setShowExpiryPicker(true)}>
                <Image source={require('../../assets/appointment_icon.png')} style={styles.inlineIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Notes..."
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.9} onPress={onAdd}>
            <Text style={styles.addText}>ADD</Text>
          </TouchableOpacity>
        </ScrollView>
        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('PharmacyDashboard' as never)} />
          <BottomItem label="Inventory" source={require('../../assets/inventory_icon.png')} onPress={() => {}} />
          <BottomItem label="Prescription" source={require('../../assets/prescription_icon.png')} onPress={() => navigation.navigate('PharmacyPrescription' as never)} />
          <BottomItem label="Medicine" source={require('../../assets/medicine_icon.png')} onPress={() => navigation.navigate('PharmacyMedicine' as never)} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('PharmacyReports' as never)} />
        </View>
        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 42, right: 16 }]}> 
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
        {/* Expiration Date Picker (native) */}
        {showExpiryPicker && (() => {
          let Picker: any;
          try { Picker = require('@react-native-community/datetimepicker'); } catch {}
          const DateTimePicker = Picker?.default || Picker;
          if (!DateTimePicker) return null; // gracefully no-op if package not installed
          let initialDate: Date;
          try { initialDate = expirationDate ? new Date(expirationDate) : new Date(); } catch { initialDate = new Date(); }
          const minDate = new Date();
          minDate.setHours(0,0,0,0);
          return (
            <DateTimePicker
              value={initialDate}
              mode="date"
              display="default"
              minimumDate={minDate}
              onChange={(event: any, selected?: Date) => {
                setShowExpiryPicker(false);
                if (selected) {
                  const y = selected.getFullYear();
                  const m = String(selected.getMonth() + 1).padStart(2, '0');
                  const d = String(selected.getDate()).padStart(2, '0');
                  setExpirationDate(`${y}-${m}-${d}`);
                }
              }}
            />
          );
        })()}
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
  container: { flex: 1, top: -6},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  headerLogo: { width: 40, height: 40 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  headerIconImg: { width: 20, height: 20, tintColor: GREEN },
  avatarBtn: { padding: 4 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: GREEN },
  avatarImg: { width: '100%', height: '100%' },
  divider: { height: 1, backgroundColor: BORDER },
  body: { paddingHorizontal: 16, paddingTop: 6 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 140 },
  title: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  backRow: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  backBtn2: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  backText2: { color: GREEN, fontWeight: '700' },
  formGroup: { marginTop: 8 },
  inputLabel: { color: MUTED, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  inputWithIcon: { position: 'relative' },
  iconOverlay: { position: 'absolute', right: 10, top: 6, bottom: 6, width: 28, alignItems: 'center', justifyContent: 'center' },
  inlineIcon: { width: 18, height: 18, tintColor: GREEN },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  addBtn: { marginTop: 10, backgroundColor: GREEN, paddingVertical: 10, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 24, minWidth: 160, alignItems: 'center' },
  addText: { color: '#FFFFFF', fontWeight: '700' },
  // Expiry calendar modal (styled like doctor prescription inputs/buttons)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  calendarCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calTitle: { fontSize: 16, fontWeight: '700', color: GREEN },
  calNavBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREEN },
  calNavText: { color: GREEN, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  weekText: { width: '13.5%', textAlign: 'center', color: MUTED, fontSize: 12 },
  daysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { width: '13.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: GREEN, backgroundColor: '#FFFFFF' },
  dayCellDisabled: { opacity: 0.35 },
  dayCellSelected: { borderColor: GREEN, backgroundColor: GREEN },
  dayText: { color: '#111827', fontWeight: '700' },
  // Dropdown styles
  dropdownOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // Bottom bar styles
  bottomBar: { position: 'absolute', left: 0, right: 0, top: 670, bottom: 40, height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 22, height: 22, marginBottom: 4 },
  bottomLabel: { fontSize: 10, color: MUTED },
  dropdownCard: { position: 'absolute', width: 180, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: BORDER },
});

