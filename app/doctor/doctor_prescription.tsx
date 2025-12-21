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

const LAB_TEST_OPTIONS = [
  'Complete Blood Count (CBC)',
  'Urinalysis',
  'Fasting Blood Sugar',
  'Lipid Profile',
  'Liver Function Test',
  'Kidney Function Test',
  'Thyroid Panel',
  'Electrolyte Panel',
  'HbA1c',
];

export default function DoctorPrescription() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [patient, setPatient] = useState('');
  const [subject, setSubject] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dosage, setDosage] = useState('');
  const [medicines, setMedicines] = useState<
    { subject: string; quantity: string; dosage: string; expanded: boolean }[]
  >([]);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'medicine' | 'lab'>('medicine');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMedSubject, setAddMedSubject] = useState('');
  const [addMedQuantity, setAddMedQuantity] = useState('');
  const [addMedDosage, setAddMedDosage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editMedSubject, setEditMedSubject] = useState('');
  const [editMedQuantity, setEditMedQuantity] = useState('');
  const [editMedDosage, setEditMedDosage] = useState('');
  const [inventoryOptions, setInventoryOptions] = useState<string[]>([]);
  const [showAddMedPicker, setShowAddMedPicker] = useState(false);
  const [showEditMedPicker, setShowEditMedPicker] = useState(false);
  const [labTests, setLabTests] = useState<
    { subject: string; expanded: boolean }[]
  >([]);
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [addLabSubject, setAddLabSubject] = useState('');
  const [showEditLabModal, setShowEditLabModal] = useState(false);
  const [editLabIndex, setEditLabIndex] = useState<number | null>(null);
  const [editLabSubject, setEditLabSubject] = useState('');
  const [showAddLabPicker, setShowAddLabPicker] = useState(false);
  const [showEditLabPicker, setShowEditLabPicker] = useState(false);
  const isValid =
    mode === 'medicine'
      ? [name, patient, description].every(v => v.trim().length > 0) &&
        medicines.length > 0 &&
        medicines.every(
          m =>
            m.subject.trim().length > 0 &&
            m.quantity.trim().length > 0 &&
            m.dosage.trim().length > 0,
        )
      : [name, patient].every(v => v.trim().length > 0) &&
        labTests.length > 0 &&
        labTests.every(t => t.subject.trim().length > 0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [patients, setPatients] = useState<string[]>([]);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<
        string,
        string
      >;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      const userId = sess?.user?.id || sess?.id;
      const withAuth = token
        ? { ...base, Authorization: `Bearer ${token}` }
        : base;
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
      const n =
        sess?.user?.full_name ||
        sess?.user?.fullName ||
        sess?.user?.name ||
        sess?.full_name ||
        sess?.name ||
        '';
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
              .filter(Boolean),
          ),
        );
        setPatients(names);
      }
    } catch {}
  }, [API_BASE, getAuthHeaders, patient]);

  const loadInventoryMedicines = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/inventory`, { headers });
      if (!res.ok) {
        setInventoryOptions([]);
        return;
      }
      const data = await res.json();
      let rows: any[] = [];
      if (Array.isArray(data)) {
        rows = data as any[];
      } else if (data && typeof data === 'object') {
        const obj: any = data;
        const candidates = [
          obj.items,
          obj.data,
          obj.rows,
          obj.results,
          obj.inventory,
          obj.records,
        ];
        for (const c of candidates) {
          if (Array.isArray(c) && c.length) {
            rows = c;
            break;
          }
        }
        if (!rows.length) {
          // As a last resort, scan object values for the first non-empty array
          const firstArray = Object.values(obj).find(
            v => Array.isArray(v) && (v as any[]).length,
          );
          rows = (firstArray as any[]) || [];
        }
      }
      const makeLabels = (arr: any[]) =>
        (arr || [])
          .map(row => {
            const generic = String(
              (row && (row.generic_name ?? row.genericName)) || '',
            ).trim();
            const brand = String(
              (row && (row.brand_name ?? row.brandName)) || '',
            ).trim();
            const dosage = String(
              (row && (row.dosage_type ?? row.dosageType)) || '',
            ).trim();
            const strength = String(row?.strength || '').trim();
            const unit = String(row?.unit || '').trim();
            const namePart = brand || generic;
            if (!namePart) return '';
            const strengthPart =
              strength && unit ? `${strength}${unit}` : strength;
            const extra = [
              generic && brand ? `(${generic})` : '',
              dosage,
              strengthPart,
            ]
              .filter(Boolean)
              .join(' ')
              .trim();
            return [namePart, extra].filter(Boolean).join(' ').trim();
          })
          .filter(Boolean);

      let labels = makeLabels(rows);
      if (!labels.length) {
        const fallbacks = [
          'http://10.0.2.2:5000',
          'http://localhost:5000',
          'http://127.0.0.1:5000',
        ];
        for (const base of fallbacks) {
          try {
            const r = await fetch(`${base}/api/inventory`, { headers });
            if (!r.ok) continue;
            const d2 = await r.json();
            const rows2 = Array.isArray(d2)
              ? d2
              : Array.isArray((d2 as any)?.items)
              ? (d2 as any).items
              : Array.isArray((d2 as any)?.data)
              ? (d2 as any).data
              : [];
            labels = makeLabels(rows2);
            if (labels.length) break;
          } catch {}
        }
      }
      setInventoryOptions(Array.from(new Set(labels)));
    } catch {
      setInventoryOptions([]);
    }
  }, [API_BASE, getAuthHeaders]);

  React.useEffect(() => {
    loadDoctorName();
  }, [loadDoctorName]);
  React.useEffect(() => {
    loadInventoryMedicines();
  }, [loadInventoryMedicines]);
  useFocusEffect(
    React.useCallback(() => {
      loadPatientsFromAppointments();
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('doctor_notifications');
          const arr = raw ? JSON.parse(raw) : [];
          const count = Array.isArray(arr)
            ? arr.filter((n: any) => n && n.read === false).length
            : 0;
          setUnreadCount(count);
        } catch {
          setUnreadCount(0);
        }
        // Load avatar from session
        try {
          const rawS = await AsyncStorage.getItem('session');
          const sess = rawS ? JSON.parse(rawS) : null;
          const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
          setAvatarUri(uri || undefined);
        } catch {}
      })();
      return () => {};
    }, [loadPatientsFromAppointments]),
  );

  const onSubmit = async () => {
    if (mode === 'lab') {
      if (
        !name ||
        !patient ||
        labTests.length === 0 ||
        !labTests.every(t => t.subject.trim().length > 0)
      ) {
        Alert.alert('Validation', 'Please fill out all required fields.');
        return;
      }
      try {
        const rawLab = await AsyncStorage.getItem('lab_orders');
        const arrLab = rawLab ? JSON.parse(rawLab) : [];
        const nowTs = Date.now();
        const orders = labTests.map((t, i) => ({
          id: String(nowTs + i),
          patient,
          test: t.subject,
          notes: description,
          doctor: name,
          status: 'new',
          timestamp: Date.now(),
        }));
        const nextLab = [...orders, ...(Array.isArray(arrLab) ? arrLab : [])];
        await AsyncStorage.setItem('lab_orders', JSON.stringify(nextLab));
      } catch {}
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const nowTs2 = Date.now();
        const items = labTests.map((t, i) => ({
          id: String(nowTs2 + i),
          title: `Lab order submitted: ${patient} • ${t.subject}`,
          type: 'lab',
          timestamp: Date.now(),
        }));
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : [];
        await AsyncStorage.setItem(
          'doctor_activity',
          JSON.stringify([...items, ...updatedAct]),
        );
      } catch {}
      Alert.alert('Submitted', 'Laboratory order has been submitted.');
      setPatient('');
      setDescription('');
      setLabTests([]);
      return;
    }

    if (!name || !patient || !description) {
      Alert.alert('Validation', 'Please fill out all fields.');
      return;
    }
    if (
      medicines.length === 0 ||
      !medicines.every(
        m =>
          m.subject.trim().length > 0 &&
          m.quantity.trim().length > 0 &&
          m.dosage.trim().length > 0,
      )
    ) {
      Alert.alert('Validation', 'Please complete all medicine fields.');
      return;
    }

    try {
      const headers = await getAuthHeaders();

      for (const m of medicines) {
        const res = await fetch(`${API_BASE}/api/prescription`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            patient_name: patient,
            doctor_name: name,
            medicine: m.subject,
            quantity: Number(m.quantity),
            dosage_strength: m.dosage,
            description,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to save prescription');
        }

        const savedPrescription = await res.json();

        try {
          addPrescription(patient, {
            doctorName: name,
            subject: m.subject,
            quantity: m.quantity,
            dosageStrength: m.dosage,
            description,
          });
        } catch {}

        try {
          const raw = await AsyncStorage.getItem('prescriptions');
          const arr = raw ? JSON.parse(raw) : [];
          const item = {
            id: String(savedPrescription.id || Date.now()),
            patient,
            medicine: m.subject,
            quantity: Number(m.quantity),
            dosage: m.dosage,
            notes: description,
            status: 'new',
          };
          const next = [item, ...(Array.isArray(arr) ? arr : [])];
          await AsyncStorage.setItem('prescriptions', JSON.stringify(next));
        } catch {}

        try {
          const rawN = await AsyncStorage.getItem('pharmacy_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const summary = `${m.subject}${m.dosage ? ` • ${m.dosage}` : ''}${
            m.quantity ? ` • Qty: ${m.quantity}` : ''
          }${patient ? ` • Patient: ${patient}` : ''}`.trim();
          const notif = {
            id: `PRX-${savedPrescription.id || Date.now()}`,
            title: 'New Prescription Submitted',
            message: summary || 'A new prescription was submitted.',
            timestamp: Date.now(),
            read: false,
            status: 'pending',
          };
          const nextN = [notif, ...(Array.isArray(arrN) ? arrN : [])];
          await AsyncStorage.setItem(
            'pharmacy_notifications',
            JSON.stringify(nextN),
          );
        } catch {}

        try {
          await fetch(`${API_BASE}/api/patient-records`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              patient,
              doctor: name,
              medicine: m.subject,
              dosage: m.dosage,
              notes: description,
              date: null,
              time: null,
            }),
          });
        } catch {}

        try {
          const rawAct = await AsyncStorage.getItem('doctor_activity');
          const arrAct = rawAct ? JSON.parse(rawAct) : [];
          const item = {
            id: String(Date.now()),
            title: `Prescription submitted: ${patient} • ${m.subject}`,
            type: 'prescription',
            timestamp: Date.now(),
          };
          const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : [];
          await AsyncStorage.setItem(
            'doctor_activity',
            JSON.stringify([item, ...updatedAct]),
          );
        } catch {}
      }

      Alert.alert('Submitted', 'Prescription has been submitted and saved.');

      setPatient('');
      setMedicines([]);
      setDescription('');
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Failed to submit prescription: ${e?.message || 'Network error'}`,
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
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('DoctorNotification' as never)}
            >
              <View style={{ position: 'relative' }}>
                <Image
                  source={require('../../assets/notification_icon.png')}
                  style={styles.headerIconImg}
                  resizeMode="contain"
                />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -6,
                      minWidth: 14,
                      height: 14,
                      paddingHorizontal: 3,
                      borderRadius: 7,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 9,
                        fontWeight: '700',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => setShowProfileMenu(true)}
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../../assets/appicon.png')}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>
              {mode === 'medicine' ? 'Prescription' : 'Laboratory'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            Fill out the form below to submit a new prescription.
          </Text>

          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                mode === 'medicine' && styles.modeBtnActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setMode('medicine')}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  mode === 'medicine' && styles.modeBtnTextActive,
                ]}
              >
                Prescription
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'lab' && styles.modeBtnActive]}
              activeOpacity={0.85}
              onPress={() => setMode('lab')}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  mode === 'lab' && styles.modeBtnTextActive,
                ]}
              >
                Laboratory
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {mode === 'medicine' ? 'Prescription Form' : 'Laboratory Form'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                Doctor Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                placeholder="Doctor name"
                value={name}
                editable={false}
                style={[styles.input, { backgroundColor: '#F3F4F6' }]}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                Patient Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  placeholder={
                    patients.length ? 'Select a patient' : 'No appointments yet'
                  }
                  value={patient}
                  editable={false}
                  style={[
                    styles.input,
                    { paddingRight: 40, backgroundColor: '#F3F4F6' },
                  ]}
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  style={styles.iconOverlay}
                  onPress={() => setShowPatientPicker(v => !v)}
                >
                  <Image
                    source={require('../../assets/dropdown.png')}
                    style={styles.inlineIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
              {showPatientPicker && (
                <View style={styles.inlineDropdown}>
                  {patients.length === 0 ? (
                    <Text
                      style={{
                        color: MUTED,
                        textAlign: 'center',
                        paddingVertical: 8,
                      }}
                    >
                      No appointments yet.
                    </Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.optionItem}
                        onPress={() => {
                          setPatient('');
                          setShowPatientPicker(false);
                        }}
                      >
                        <Text style={[styles.optionText, { color: MUTED }]}>
                          ---|---
                        </Text>
                      </TouchableOpacity>
                      {patients.map(p => (
                        <TouchableOpacity
                          key={p}
                          style={styles.optionItem}
                          onPress={() => {
                            setPatient(p);
                            setShowPatientPicker(false);
                          }}
                        >
                          <Text style={styles.optionText}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>

            {mode === 'medicine' ? (
              <>
                <View style={[styles.formGroup, styles.addRow]}>
                  <Text style={styles.inputLabel}>Medicines</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.addBtn}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {medicines.map((m, idx) => (
                  <View key={`med-${idx}`} style={styles.accordionCard}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.accordionHeader}
                      onPress={() =>
                        setMedicines(prev => {
                          const copy = prev.slice();
                          copy[idx] = {
                            ...copy[idx],
                            expanded: !copy[idx].expanded,
                          };
                          return copy;
                        })
                      }
                    >
                      <View style={styles.accordionLeft}>
                        <Text style={styles.accordionTitle} numberOfLines={1}>
                          {m.subject && m.subject.trim().length > 0
                            ? m.subject
                            : 'Medicine name'}
                        </Text>
                      </View>
                      <Image
                        source={require('../../assets/dropdown.png')}
                        style={[
                          styles.inlineIcon,
                          m.expanded && { transform: [{ rotate: '180deg' }] },
                        ]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    {m.expanded && (
                      <>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsLabel}>Medicine</Text>
                          <Text style={styles.detailsValue}>{m.subject}</Text>
                        </View>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsLabel}>
                            Quantity Prescribed
                          </Text>
                          <Text style={styles.detailsValue}>{m.quantity}</Text>
                        </View>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsLabel}>
                            Dosage Strength
                          </Text>
                          <Text style={styles.detailsValue}>{m.dosage}</Text>
                        </View>

                        <View style={styles.itemActions}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.itemBtn}
                            onPress={() => {
                              setEditIndex(idx);
                              setEditMedSubject(m.subject);
                              setEditMedQuantity(m.quantity);
                              setEditMedDosage(m.dosage);
                              setShowEditModal(true);
                            }}
                          >
                            <Text style={styles.itemBtnText}>Update</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[styles.itemBtn, styles.itemBtnDanger]}
                            onPress={() =>
                              Alert.alert(
                                'Remove Medicine',
                                'Are you sure you want to remove this medicine?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () =>
                                      setMedicines(prev =>
                                        prev.filter((_, i) => i !== idx),
                                      ),
                                  },
                                ],
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.itemBtnText,
                                styles.itemBtnTextDanger,
                              ]}
                            >
                              Remove
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ))}

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Description <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    placeholder="Provide details"
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.input, styles.textArea]}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              </>
            ) : (
              <>
                <View style={[styles.formGroup, styles.addRow]}>
                  <Text style={styles.inputLabel}>Lab Tests</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.addBtn}
                    onPress={() => setShowAddLabModal(true)}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {labTests.map((t, idx) => (
                  <View key={`lab-${idx}`} style={styles.accordionCard}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.accordionHeader}
                      onPress={() =>
                        setLabTests(prev => {
                          const copy = prev.slice();
                          copy[idx] = {
                            ...copy[idx],
                            expanded: !copy[idx].expanded,
                          };
                          return copy;
                        })
                      }
                    >
                      <View style={styles.accordionLeft}>
                        <Text style={styles.accordionTitle} numberOfLines={1}>
                          {t.subject && t.subject.trim().length > 0
                            ? t.subject
                            : 'Lab test'}
                        </Text>
                      </View>
                      <Image
                        source={require('../../assets/dropdown.png')}
                        style={[
                          styles.inlineIcon,
                          t.expanded && { transform: [{ rotate: '180deg' }] },
                        ]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    {t.expanded && (
                      <>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsLabel}>Lab Test</Text>
                          <Text style={styles.detailsValue}>{t.subject}</Text>
                        </View>

                        <View style={styles.itemActions}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.itemBtn}
                            onPress={() => {
                              setEditLabIndex(idx);
                              setEditLabSubject(t.subject);
                              setShowEditLabModal(true);
                            }}
                          >
                            <Text style={styles.itemBtnText}>Update</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[styles.itemBtn, styles.itemBtnDanger]}
                            onPress={() =>
                              Alert.alert(
                                'Remove Lab Test',
                                'Are you sure you want to remove this lab test?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () =>
                                      setLabTests(prev =>
                                        prev.filter((_, i) => i !== idx),
                                      ),
                                  },
                                ],
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.itemBtnText,
                                styles.itemBtnTextDanger,
                              ]}
                            >
                              Remove
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ))}

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Notes / Instructions</Text>
                  <TextInput
                    placeholder="Provide details for the laboratory"
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.input, styles.textArea]}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
              onPress={onSubmit}
              activeOpacity={0.9}
              disabled={!isValid}
            >
              <Text style={styles.submitText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {showAddModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Medicine</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Medicine <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Select or type medicine"
                    value={addMedSubject}
                    onChangeText={text => {
                      setAddMedSubject(text);
                      setShowAddMedPicker(true);
                    }}
                    onFocus={() => setShowAddMedPicker(true)}
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => setShowAddMedPicker(v => !v)}
                  >
                    <Image
                      source={require('../../assets/dropdown.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {showAddMedPicker && (
                  <View style={styles.inlineDropdown}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        setAddMedSubject('');
                        setShowAddMedPicker(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: MUTED }]}>
                        ---|---
                      </Text>
                    </TouchableOpacity>
                    {inventoryOptions
                      .filter(opt =>
                        opt.toLowerCase().includes(addMedSubject.toLowerCase()),
                      )
                      .map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.optionItem}
                          onPress={() => {
                            setAddMedSubject(opt);
                            setShowAddMedPicker(false);
                          }}
                        >
                          <Text style={styles.optionText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Quantity Prescribed <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  placeholder="Enter quantity"
                  value={addMedQuantity}
                  onChangeText={setAddMedQuantity}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Dosage Strength <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  placeholder="e.g., 500mg"
                  value={addMedDosage}
                  onChangeText={setAddMedDosage}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalBtn}
                  onPress={() => {
                    setShowAddModal(false);
                    setAddMedSubject('');
                    setAddMedQuantity('');
                    setAddMedDosage('');
                    setShowAddMedPicker(false);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => {
                    if (
                      !addMedSubject.trim() ||
                      !addMedQuantity.trim() ||
                      !addMedDosage.trim()
                    ) {
                      Alert.alert('Validation', 'Please fill out all fields.');
                      return;
                    }
                    setMedicines(prev => [
                      ...prev,
                      {
                        subject: addMedSubject.trim(),
                        quantity: addMedQuantity.trim(),
                        dosage: addMedDosage.trim(),
                        expanded: false,
                      },
                    ]);
                    setShowAddModal(false);
                    setAddMedSubject('');
                    setAddMedQuantity('');
                    setAddMedDosage('');
                    setShowAddMedPicker(false);
                  }}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showEditModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Update Medicine</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Medicine <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Select or type medicine"
                    value={editMedSubject}
                    onChangeText={text => {
                      setEditMedSubject(text);
                      setShowEditMedPicker(true);
                    }}
                    onFocus={() => setShowEditMedPicker(true)}
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => setShowEditMedPicker(v => !v)}
                  >
                    <Image
                      source={require('../../assets/dropdown.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {showEditMedPicker && (
                  <View style={styles.inlineDropdown}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        setEditMedSubject('');
                        setShowEditMedPicker(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: MUTED }]}>
                        ---|---
                      </Text>
                    </TouchableOpacity>
                    {inventoryOptions
                      .filter(opt =>
                        opt
                          .toLowerCase()
                          .includes(editMedSubject.toLowerCase()),
                      )
                      .map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.optionItem}
                          onPress={() => {
                            setEditMedSubject(opt);
                            setShowEditMedPicker(false);
                          }}
                        >
                          <Text style={styles.optionText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Quantity Prescribed <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  placeholder="Enter quantity"
                  value={editMedQuantity}
                  onChangeText={setEditMedQuantity}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Dosage Strength <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  placeholder="e.g., 500mg"
                  value={editMedDosage}
                  onChangeText={setEditMedDosage}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalBtn}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditIndex(null);
                    setShowEditMedPicker(false);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => {
                    if (
                      !editMedSubject.trim() ||
                      !editMedQuantity.trim() ||
                      !editMedDosage.trim()
                    ) {
                      Alert.alert('Validation', 'Please fill out all fields.');
                      return;
                    }
                    if (editIndex === null) return;
                    setMedicines(prev => {
                      const copy = prev.slice();
                      copy[editIndex] = {
                        ...copy[editIndex],
                        subject: editMedSubject.trim(),
                        quantity: editMedQuantity.trim(),
                        dosage: editMedDosage.trim(),
                        expanded: false,
                      };
                      return copy;
                    });
                    setShowEditModal(false);
                    setEditIndex(null);
                    setShowEditMedPicker(false);
                  }}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
                  >
                    Update
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showAddLabModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Lab Test</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Lab Test <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Select or type lab test"
                    value={addLabSubject}
                    onChangeText={text => {
                      setAddLabSubject(text);
                      setShowAddLabPicker(true);
                    }}
                    onFocus={() => setShowAddLabPicker(true)}
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => setShowAddLabPicker(v => !v)}
                  >
                    <Image
                      source={require('../../assets/dropdown.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {showAddLabPicker && (
                  <View style={styles.inlineDropdown}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        setAddLabSubject('');
                        setShowAddLabPicker(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: MUTED }]}>
                        ---|---
                      </Text>
                    </TouchableOpacity>
                    {LAB_TEST_OPTIONS.filter(opt =>
                      opt.toLowerCase().includes(addLabSubject.toLowerCase()),
                    ).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={styles.optionItem}
                        onPress={() => {
                          setAddLabSubject(opt);
                          setShowAddLabPicker(false);
                        }}
                      >
                        <Text style={styles.optionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalBtn}
                  onPress={() => {
                    setShowAddLabModal(false);
                    setAddLabSubject('');
                    setShowAddLabPicker(false);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => {
                    if (!addLabSubject.trim()) {
                      Alert.alert('Validation', 'Please fill out all fields.');
                      return;
                    }
                    setLabTests(prev => [
                      ...prev,
                      { subject: addLabSubject.trim(), expanded: false },
                    ]);
                    setShowAddLabModal(false);
                    setAddLabSubject('');
                    setShowAddLabPicker(false);
                  }}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showEditLabModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Update Lab Test</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Lab Test <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Select or type lab test"
                    value={editLabSubject}
                    onChangeText={text => {
                      setEditLabSubject(text);
                      setShowEditLabPicker(true);
                    }}
                    onFocus={() => setShowEditLabPicker(true)}
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => setShowEditLabPicker(v => !v)}
                  >
                    <Image
                      source={require('../../assets/dropdown.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {showEditLabPicker && (
                  <View style={styles.inlineDropdown}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        setEditLabSubject('');
                        setShowEditLabPicker(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: MUTED }]}>
                        ---|---
                      </Text>
                    </TouchableOpacity>
                    {LAB_TEST_OPTIONS.filter(opt =>
                      opt.toLowerCase().includes(editLabSubject.toLowerCase()),
                    ).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={styles.optionItem}
                        onPress={() => {
                          setEditLabSubject(opt);
                          setShowEditLabPicker(false);
                        }}
                      >
                        <Text style={styles.optionText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalBtn}
                  onPress={() => {
                    setShowEditLabModal(false);
                    setEditLabIndex(null);
                    setShowEditLabPicker(false);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => {
                    if (!editLabSubject.trim()) {
                      Alert.alert('Validation', 'Please fill out all fields.');
                      return;
                    }
                    if (editLabIndex === null) return;
                    setLabTests(prev => {
                      const copy = prev.slice();
                      copy[editLabIndex] = {
                        ...copy[editLabIndex],
                        subject: editLabSubject.trim(),
                        expanded: false,
                      };
                      return copy;
                    });
                    setShowEditLabModal(false);
                    setEditLabIndex(null);
                    setShowEditLabPicker(false);
                  }}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnTextPrimary]}
                  >
                    Update
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Inline dropdown rendered above; no modal */}

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
            active
            source={require('../../assets/prescription_icon.png')}
            onPress={() => {}}
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
                  setShowProfileMenu(false);
                  navigation.navigate('DoctorProfile');
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileMenu(false);
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
      activeOpacity={0.8}
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
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GREEN,
  },
  avatarImg: { width: '100%', height: '100%' },

  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { padding: 16, paddingBottom: 120 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: { color: GREEN, fontWeight: '700', fontSize: 16 },
  subtitle: { color: MUTED, marginTop: 4, fontSize: 12 },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 999,
    padding: 4,
    alignSelf: 'center',
    marginTop: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: GREEN,
  },
  modeBtnText: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 12,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },

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
  formTitle: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },

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
  iconOverlay: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
  },
  inlineIcon: { width: 16, height: 16, tintColor: GREEN },

  submitBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'center',
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#86E3C3' },
  submitText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: GREEN,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'center',
    paddingHorizontal: 20,
    minWidth: 180,
    alignItems: 'center',
  },
  secondaryBtnDisabled: { borderColor: '#A7F3D0' },
  secondaryText: { color: GREEN, fontWeight: '700' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: GREEN, fontWeight: '700' },
  removeLink: { color: '#EF4444', fontWeight: '700', alignSelf: 'flex-end' },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailsLabel: { color: MUTED, fontWeight: '700', width: 150 },
  detailsValue: { color: '#111827', flex: 1, textAlign: 'right' },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  itemBtn: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
  },
  itemBtnDanger: { borderColor: '#EF4444' },
  itemBtnText: { color: GREEN, fontWeight: '700' },
  itemBtnTextDanger: { color: '#EF4444', fontWeight: '700' },
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionTitle: { color: '#111827', fontWeight: '700' },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  accordionSubject: { color: '#111827', flexShrink: 1 },
  accordionSummary: {
    color: MUTED,
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'right',
    fontSize: 12,
  },
  chevron: { color: GREEN, fontWeight: '700' },

  // Add Medicine Modal styles
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
  },
  modalTitle: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalBtn: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 10,
    backgroundColor: '#FFFFFF',
  },
  modalBtnPrimary: {
    backgroundColor: GREEN,
  },
  modalBtnText: { color: GREEN, fontWeight: '700' },
  modalBtnTextPrimary: { color: '#FFFFFF' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomItem: { alignItems: 'center', justifyContent: 'center' },
  bottomImg: { width: 26, height: 26, marginBottom: 4 },
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
  optionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  optionText: { color: '#111827' },
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
