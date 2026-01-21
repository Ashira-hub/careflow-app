import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND = '#10B981';
const API_BASE = 'https://backend-careflow.vercel.app';

// Bottom Navigation Item Component
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
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Image
        source={source}
        style={[
          styles.bottomImg,
          { tintColor: active ? '#10B981' : '#9CA3AF' },
        ]}
        resizeMode="contain"
      />
      <Text style={[styles.bottomLabel, active && { color: '#10B981' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const PatientProfile = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [topUserName, setTopUserName] = useState('');
  const [topUserRole, setTopUserRole] = useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    relation: '',
    phone: '',
  });
  const [contacts, setContacts] = useState<
    { name: string; relation: string; phone: string }[]
  >([]);

  // Mock user data - replace with actual data from your backend
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bloodType: '',
    height: '',
    weight: '',
    allergies: '',
    conditions: '',
    medications: '',
  });

  const [formData, setFormData] = useState({ ...userData });

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
      return { 'Content-Type': 'application/json' } as Record<string, string>;
    }
  }, []);

  const getCurrentUserId = React.useCallback(async (): Promise<
    string | number | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      return sess?.user?.id ?? sess?.id ?? undefined;
    } catch {
      return undefined;
    }
  }, []);

  const handleSave = async () => {
    try {
      const headers = await getAuthHeaders();
      const userId = await getCurrentUserId();
      if (userId != null) {
        const body = {
          full_name: formData.name || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          birthdate: formData.dateOfBirth || undefined,
          blood_type: formData.bloodType || undefined,
          height: formData.height || undefined,
          weight: formData.weight || undefined,
          allergies: formData.allergies || undefined,
          medical_history: formData.conditions || undefined,
          avatar_uri: avatarUri || undefined,
        } as any;
        try {
          const res = await fetch(`${API_BASE}/api/users/${userId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
          });
          if (res.ok) {
            let row: any = {};
            try {
              const text = await res.text();
              row = text ? JSON.parse(text) : {};
            } catch {}
            const next = {
              name: String(row?.full_name || formData.name || ''),
              email: String(row?.email || formData.email || ''),
              phone: String(row?.phone || formData.phone || ''),
              address: String(row?.address || formData.address || ''),
              dateOfBirth: String(row?.birthdate || formData.dateOfBirth || ''),
              bloodType: String(row?.blood_type || formData.bloodType || ''),
              height: String(row?.height || formData.height || ''),
              weight: String(row?.weight || formData.weight || ''),
              allergies: String(row?.allergies || formData.allergies || ''),
              conditions: String(
                row?.medical_history || formData.conditions || '',
              ),
              medications: formData.medications,
            };
            setUserData(next as any);
            setFormData(next as any);
            setAvatarUri(row?.avatar_uri || avatarUri || undefined);
            // Sync session
            try {
              const raw = await AsyncStorage.getItem('session');
              if (raw) {
                const sess = JSON.parse(raw);
                sess.user = {
                  ...(sess.user || {}),
                  id: sess?.user?.id,
                  full_name: row?.full_name ?? next.name,
                  fullName: row?.full_name ?? next.name,
                  name: row?.full_name ?? next.name,
                  email: row?.email ?? next.email,
                  phone: row?.phone ?? next.phone,
                  address: row?.address ?? next.address,
                  birthdate: row?.birthdate ?? next.dateOfBirth,
                  gender: row?.gender ?? sess?.user?.gender,
                  avatar_uri: row?.avatar_uri ?? avatarUri,
                  blood_type: row?.blood_type ?? next.bloodType,
                  height: row?.height ?? next.height,
                  weight: row?.weight ?? next.weight,
                  allergies: row?.allergies ?? next.allergies,
                  medical_history: row?.medical_history ?? next.conditions,
                };
                await AsyncStorage.setItem('session', JSON.stringify(sess));
              }
            } catch {}
          }
        } catch {}
      }
      setIsEditing(false);
    } catch {}
  };

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('session');
        const sess = raw ? JSON.parse(raw) : null;
        const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
        setAvatarUri(uri || undefined);
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('session');
        if (!raw) return;
        const sess = JSON.parse(raw);
        const next = {
          name:
            sess?.user?.full_name ||
            sess?.user?.fullName ||
            sess?.user?.name ||
            userData.name,
          email: sess?.user?.email || userData.email,
          phone: sess?.user?.phone || userData.phone,
          address: sess?.user?.address || userData.address,
          dateOfBirth: sess?.user?.birthdate || userData.dateOfBirth,
          bloodType: sess?.user?.blood_type || userData.bloodType,
          height: sess?.user?.height || userData.height,
          weight: sess?.user?.weight || userData.weight,
          allergies: sess?.user?.allergies || userData.allergies,
          conditions: sess?.user?.medical_history || userData.conditions,
          medications: userData.medications,
        };
        setUserData(next as any);
        setFormData(next as any);
      } catch {}
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('session');
          if (!raw) return;
          const sess = JSON.parse(raw);
          const u = sess?.user || {};
          const derivedName =
            u?.full_name ||
            u?.fullName ||
            u?.name ||
            [u?.firstName, u?.lastName].filter(Boolean).join(' ');
          setTopUserName(String(derivedName || 'Patient'));
          const rawRole = u?.role || u?.role_name || u?.roleName;
          const roleStr = String(rawRole || '').trim();
          const displayRole = roleStr
            ? roleStr.charAt(0).toUpperCase() + roleStr.slice(1)
            : 'Patient';
          setTopUserRole(displayRole);
          const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
          setAvatarUri(uri || undefined);
          const next = {
            name:
              sess?.user?.full_name ||
              sess?.user?.fullName ||
              sess?.user?.name ||
              userData.name,
            email: sess?.user?.email || userData.email,
            phone: sess?.user?.phone || userData.phone,
            address: sess?.user?.address || userData.address,
            dateOfBirth: sess?.user?.birthdate || userData.dateOfBirth,
            bloodType: sess?.user?.blood_type || userData.bloodType,
            height: sess?.user?.height || userData.height,
            weight: sess?.user?.weight || userData.weight,
            allergies: sess?.user?.allergies || userData.allergies,
            conditions: sess?.user?.medical_history || userData.conditions,
            medications: userData.medications,
          };
          setUserData(next as any);
          setFormData(next as any);
        } catch {}
      })();
      return () => {};
    }, []),
  );

  const renderField = (label: string, value: string, fieldName: string) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {isEditing ? (
        <TextInput
          style={styles.input}
          value={formData[fieldName as keyof typeof formData]}
          onChangeText={text => handleChange(fieldName, text)}
        />
      ) : (
        <Text style={styles.fieldValue}>{value}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topHeader, { paddingTop: insets.top }]}>
        <Image
          source={require('../../assets/appicon.png')}
          style={styles.topHeaderLogo}
          resizeMode="contain"
        />
        <View style={styles.topHeaderIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('PatientNotification')}
          >
            <View style={{ position: 'relative' }}>
              <Image
                source={require('../../assets/notification_icon.png')}
                style={styles.topHeaderIconImg}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topProfileBtn}
            onPress={() => setShowProfileMenu(true)}
            activeOpacity={0.8}
          >
            <View style={styles.topProfileAvatar}>
              <Text style={styles.topProfileAvatarText}>
                {String(topUserName || 'P')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.topProfileTextCol}>
              <Text style={styles.topProfileName} numberOfLines={1}>
                {String(topUserName || 'Patient')}
              </Text>
              <Text style={styles.topProfileRole} numberOfLines={1}>
                {String(topUserRole || 'Patient')}
              </Text>
            </View>
            <Image
              source={require('../../assets/dropdown.png')}
              style={styles.topProfileChevron}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.topDivider} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {/* Header */}
        <View style={[styles.header, compact && { padding: 16 }]}>
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatar,
                compact && { width: 64, height: 64, borderRadius: 32 },
              ]}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: compact ? 32 : 40,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {userData.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          {isEditing && showPhotoEditor && (
            <View
              style={[
                styles.photoEditorRow,
                compact && { paddingHorizontal: 12 },
              ]}
            >
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Paste image URL"
                value={photoUrlInput}
                onChangeText={setPhotoUrlInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={async () => {
                  const url = (photoUrlInput || '').trim();
                  setAvatarUri(url || undefined);
                  setShowPhotoEditor(false);
                  try {
                    const raw = await AsyncStorage.getItem('session');
                    if (raw) {
                      const sess = JSON.parse(raw);
                      if (url) {
                        if (sess.user) sess.user.avatar_uri = url;
                        sess.avatar_uri = url;
                      } else {
                        if (sess.user) delete sess.user.avatar_uri;
                        delete sess.avatar_uri;
                      }
                      await AsyncStorage.setItem(
                        'session',
                        JSON.stringify(sess),
                      );
                    }
                  } catch {}
                }}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {isEditing ? (
            <TextInput
              style={[
                styles.userName,
                styles.nameInput,
                compact && { fontSize: 20 },
              ]}
              value={formData.name}
              onChangeText={text => handleChange('name', text)}
              underlineColorAndroid="transparent"
            />
          ) : (
            <Text style={[styles.userName, compact && { fontSize: 20 }]}>
              {userData.name}
            </Text>
          )}
          <Text style={[styles.userEmail, compact && { fontSize: 12 }]}>
            {userData.email}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => {
                  setFormData({ ...userData });
                  setIsEditing(true);
                }}
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={async () => {
                  try {
                    await AsyncStorage.removeItem('session');
                  } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }}
              >
                <Text style={[styles.buttonText, { color: '#EF4444' }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Save Changes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Personal Information */}
        <View
          style={[
            styles.section,
            compact && { padding: 12, marginHorizontal: 12 },
          ]}
        >
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
            Personal Information
          </Text>
          {renderField('Email', userData.email, 'email')}
          {renderField('Phone', userData.phone, 'phone')}
          {renderField('Address', userData.address, 'address')}
          {renderField('Date of Birth', userData.dateOfBirth, 'dateOfBirth')}
        </View>

        {/* Medical Information */}
        <View
          style={[
            styles.section,
            compact && { padding: 12, marginHorizontal: 12 },
          ]}
        >
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
            Medical Information
          </Text>
          {renderField('Blood Type', userData.bloodType, 'bloodType')}
          {renderField('Height', userData.height, 'height')}
          {renderField('Weight', userData.weight, 'weight')}
          {renderField('Allergies', userData.allergies, 'allergies')}
          {renderField('Medical Conditions', userData.conditions, 'conditions')}
          {renderField(
            'Current Medications',
            userData.medications,
            'medications',
          )}
        </View>

        {/* Emergency Contacts */}
        <View
          style={[
            styles.section,
            compact && { padding: 12, marginHorizontal: 12 },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddContact(true);
                setNewContact({ name: '', relation: '', phone: '' });
              }}
            >
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {contacts.map((c, idx) => (
            <View key={`${c.name}-${idx}`} style={styles.emergencyContact}>
              <Text style={styles.contactName}>
                {c.name}
                {c.relation ? ` (${c.relation})` : ''}
              </Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
            </View>
          ))}
          {showAddContact && (
            <View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.name}
                  onChangeText={t => setNewContact({ ...newContact, name: t })}
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Relationship</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.relation}
                  onChangeText={t =>
                    setNewContact({ ...newContact, relation: t })
                  }
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={newContact.phone}
                  onChangeText={t => setNewContact({ ...newContact, phone: t })}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  marginTop: 4,
                }}
              >
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => {
                    setContacts(prev => [...prev, newContact]);
                    setShowAddContact(false);
                    setNewContact({ name: '', relation: '', phone: '' });
                  }}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                    Save
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowAddContact(false);
                    setNewContact({ name: '', relation: '', phone: '' });
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {showProfileMenu && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowProfileMenu(false)}
          />
          <View
            style={[
              styles.dropdownCard,
              { top: (insets.top || 0) + 60, right: 16 },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowProfileMenu(false);
                navigation.navigate('PatientProfile');
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
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                } as any);
              }}
            >
              <Text style={[styles.dropdownText, { color: '#EF4444' }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Navigation */}
      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(0, (insets.bottom || 0) - 8) },
        ]}
      >
        <BottomItem
          label="Home"
          active={false}
          source={require('../../assets/home_icon.png')}
          onPress={() => navigation.navigate('PatientDashboard')}
        />
        <BottomItem
          label="Appointments"
          active={false}
          source={require('../../assets/appointment_icon.png')}
          onPress={() => navigation.navigate('Appointments')}
        />
        <BottomItem
          label="Prescription"
          active={false}
          source={require('../../assets/prescription_icon.png')}
          onPress={() => navigation.navigate('PatientPrescription')}
        />
        <BottomItem
          label="Records"
          active={false}
          source={require('../../assets/patient_records_icon.png')}
          onPress={() => navigation.navigate('MedicalRecords')}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { padding: 8 },
  topHeaderIconImg: { width: 20, height: 20, tintColor: '#10B981' },
  topProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  topProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  topProfileTextCol: {
    marginLeft: 12,
    marginRight: 10,
    maxWidth: 160,
  },
  topProfileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  topProfileRole: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  topProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#111827',
  },
  topDivider: { height: 1, backgroundColor: '#E5E7EB' },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingBottom: 80, // Space for bottom navigation
  },
  contentContainer: {
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: BRAND,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0EA5A4',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  editAvatarButton: {
    position: 'absolute',
    right: -6,
    bottom: 10,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  editAvatarText: {
    color: BRAND,
    fontSize: 10,
    fontWeight: '600',
  },
  changePhotoLink: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 120,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  addButton: {
    color: BRAND,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  nameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 0,
    borderWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 0,
  },
  emergencyContact: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingText: {
    fontSize: 14,
    color: '#111827',
  },
  settingValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggleButton: {
    width: 40,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#9CA3AF',
  },
  photoEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
  },
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
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#111827', fontWeight: '700' },
  menuDivider: { height: 1, backgroundColor: '#E5E7EB' },
  // Bottom Navigation Styles
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  bottomItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  bottomImg: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },
  bottomLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 2,
  },
});

export default PatientProfile;
