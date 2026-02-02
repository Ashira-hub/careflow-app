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
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [topUserGender, setTopUserGender] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
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
    gender: '',
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

  const syncUnread = React.useCallback(async () => {
    try {
      const rawLocal = await AsyncStorage.getItem('patient_notifications');
      const localArr: any[] = rawLocal ? JSON.parse(rawLocal) : [];
      const byId: Record<string, any> = {};
      if (Array.isArray(localArr)) {
        for (const it of localArr) {
          if (it?.id) byId[String(it.id)] = it;
        }
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/notifications`, { headers });
        if (res.ok) {
          const rows = await res.json();
          const mapped = Array.isArray(rows)
            ? rows.map((n: any) => ({
                id: String(n?.id),
                title: String(n?.title || 'Notification'),
                message: String(n?.message || ''),
                timestamp: n?.created_at
                  ? new Date(n.created_at).getTime()
                  : Date.now(),
                read: Boolean(n?.read) === true,
              }))
            : [];
          for (const it of mapped) {
            if (it?.id) byId[String(it.id)] = { ...byId[String(it.id)], ...it };
          }
        }
      } catch {}

      const merged = Object.values(byId)
        .filter(Boolean)
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      try {
        await AsyncStorage.setItem(
          'patient_notifications',
          JSON.stringify(merged),
        );
      } catch {}
      setUnreadCount(merged.filter((n: any) => n && n.read === false).length);
    } catch {
      setUnreadCount(0);
    }
  }, [getAuthHeaders]);

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

  const profileFromSession = React.useCallback((sess: any, fallback?: any) => {
    const u = sess?.user || {};
    const name = String(
      u?.full_name || u?.fullName || u?.name || fallback?.name || '',
    ).trim();
    return {
      name,
      gender: String(u?.gender || fallback?.gender || '').trim(),
      email: String(u?.email || fallback?.email || '').trim(),
      phone: String(u?.phone || fallback?.phone || '').trim(),
      address: String(u?.address || fallback?.address || '').trim(),
      dateOfBirth: String(u?.birthdate || fallback?.dateOfBirth || '').trim(),
      bloodType: String(u?.blood_type || fallback?.bloodType || '').trim(),
      height: String(u?.height || fallback?.height || '').trim(),
      weight: String(u?.weight || fallback?.weight || '').trim(),
      allergies: String(u?.allergies || fallback?.allergies || '').trim(),
      conditions: String(
        u?.medical_history || fallback?.conditions || '',
      ).trim(),
      medications: String(u?.medications || fallback?.medications || '').trim(),
    };
  }, []);

  const getProfileCacheKey = React.useCallback((userId: string | number) => {
    return `profile_cache:${String(userId)}`;
  }, []);

  const readProfileCache = React.useCallback(
    async (userId: string | number) => {
      try {
        const raw = await AsyncStorage.getItem(getProfileCacheKey(userId));
        const obj = raw ? JSON.parse(raw) : null;
        return obj && typeof obj === 'object' ? obj : null;
      } catch {
        return null;
      }
    },
    [getProfileCacheKey],
  );

  const writeProfileCache = React.useCallback(
    async (userId: string | number, profile: any) => {
      try {
        await AsyncStorage.setItem(
          getProfileCacheKey(userId),
          JSON.stringify(profile || {}),
        );
      } catch {}
    },
    [getProfileCacheKey],
  );

  const handleSave = async () => {
    const optimistic = {
      ...userData,
      ...formData,
      medications: String(formData?.medications || userData?.medications || ''),
    };

    try {
      setUserData(optimistic as any);
      setFormData(optimistic as any);
      try {
        const raw = await AsyncStorage.getItem('session');
        if (raw) {
          const sess = JSON.parse(raw);
          const uid = sess?.user?.id ?? sess?.id;
          sess.user = {
            ...(sess.user || {}),
            id: sess?.user?.id,
            full_name: optimistic.name,
            fullName: optimistic.name,
            name: optimistic.name,
            email: optimistic.email,
            phone: optimistic.phone,
            address: optimistic.address,
            birthdate: optimistic.dateOfBirth,
            gender: optimistic.gender,
            avatar_uri: avatarUri,
            blood_type: optimistic.bloodType,
            height: optimistic.height,
            weight: optimistic.weight,
            allergies: optimistic.allergies,
            medical_history: optimistic.conditions,
            medications: optimistic.medications,
          };
          await AsyncStorage.setItem('session', JSON.stringify(sess));
          try {
            if (uid != null) await writeProfileCache(uid, optimistic);
          } catch {}
        }
      } catch {}
    } catch {}
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
          gender: (formData as any).gender || undefined,
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
              gender: String(row?.gender || (formData as any).gender || ''),
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
              medications: optimistic.medications,
            };
            setUserData(next as any);
            setFormData(next as any);
            setAvatarUri(row?.avatar_uri || avatarUri || undefined);
            // Sync session
            try {
              const raw = await AsyncStorage.getItem('session');
              if (raw) {
                const sess = JSON.parse(raw);
                const uid = sess?.user?.id ?? sess?.id;
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
                  gender: row?.gender ?? next.gender ?? sess?.user?.gender,
                  avatar_uri: row?.avatar_uri ?? avatarUri,
                  blood_type: row?.blood_type ?? next.bloodType,
                  height: row?.height ?? next.height,
                  weight: row?.weight ?? next.weight,
                  allergies: row?.allergies ?? next.allergies,
                  medical_history: row?.medical_history ?? next.conditions,
                  medications: optimistic.medications,
                };
                await AsyncStorage.setItem('session', JSON.stringify(sess));
                try {
                  if (uid != null) await writeProfileCache(uid, next);
                } catch {}
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

  const refreshProfile = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const userId = await getCurrentUserId();
      if (userId == null) return;

      const res = await fetch(`${API_BASE}/api/users/${userId}`, { headers });
      if (!res.ok) return;
      const row = await res.json().catch(() => ({}));

      const next = {
        name: String(row?.full_name || userData.name || ''),
        gender: String(row?.gender || (userData as any).gender || ''),
        email: String(row?.email || userData.email || ''),
        phone: String(row?.phone || userData.phone || ''),
        address: String(row?.address || userData.address || ''),
        dateOfBirth: String(row?.birthdate || userData.dateOfBirth || ''),
        bloodType: String(row?.blood_type || userData.bloodType || ''),
        height: String(row?.height || userData.height || ''),
        weight: String(row?.weight || userData.weight || ''),
        allergies: String(row?.allergies || userData.allergies || ''),
        conditions: String(row?.medical_history || userData.conditions || ''),
        medications: String(userData.medications || ''),
      };

      setUserData(next as any);
      setFormData(next as any);
      setAvatarUri(row?.avatar_uri || avatarUri || undefined);

      // Update session + cache (best-effort)
      try {
        const raw = await AsyncStorage.getItem('session');
        if (raw) {
          const sess = JSON.parse(raw);
          sess.user = {
            ...(sess.user || {}),
            id: sess?.user?.id,
            full_name: next.name,
            fullName: next.name,
            name: next.name,
            email: next.email,
            phone: next.phone,
            address: next.address,
            birthdate: next.dateOfBirth,
            gender: row?.gender ?? next.gender ?? sess?.user?.gender,
            avatar_uri: row?.avatar_uri ?? avatarUri,
            blood_type: next.bloodType,
            height: next.height,
            weight: next.weight,
            allergies: next.allergies,
            medical_history: next.conditions,
            medications: next.medications,
          };
          await AsyncStorage.setItem('session', JSON.stringify(sess));
        }
      } catch {}
      try {
        await writeProfileCache(userId, next);
      } catch {}
    } catch {}
  }, [
    avatarUri,
    getAuthHeaders,
    getCurrentUserId,
    userData,
    writeProfileCache,
  ]);

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
        const u = sess?.user || {};
        setTopUserGender(String(u?.gender || sess?.gender || '').trim());
        const uid = sess?.user?.id ?? sess?.id;
        const cached = uid != null ? await readProfileCache(uid) : null;
        setUserData(prev => {
          const fallback = { ...(prev || {}), ...(cached || {}) };
          const next = profileFromSession(sess, fallback);
          setFormData(next as any);
          return next as any;
        });
      } catch {}
    })();
  }, [profileFromSession, readProfileCache]);

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
          setTopUserGender(String(u?.gender || sess?.gender || '').trim());
          const uri = sess?.user?.avatar_uri || sess?.avatar_uri || undefined;
          setAvatarUri(uri || undefined);
          const uid = sess?.user?.id ?? sess?.id;
          const cached = uid != null ? await readProfileCache(uid) : null;
          setUserData(prev => {
            const fallback = { ...(prev || {}), ...(cached || {}) };
            const next = profileFromSession(sess, fallback);
            setFormData(next as any);
            return next as any;
          });
        } catch {}
      })();
      syncUnread();
      return () => {};
    }, [profileFromSession, readProfileCache, syncUnread]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      try {
        await syncUnread();
      } catch {}
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, syncUnread]);

  const iconForField = React.useCallback((fieldName: string) => {
    switch (fieldName) {
      case 'email':
        return require('../../assets/email.png');
      case 'phone':
        return require('../../assets/phone.png');
      case 'address':
        return require('../../assets/address.png');
      case 'dateOfBirth':
        return require('../../assets/birth.png');
      case 'bloodType':
        return require('../../assets/blood.png');
      case 'height':
        return require('../../assets/height.png');
      case 'weight':
        return require('../../assets/weight.png');
      case 'allergies':
        return require('../../assets/allergies.png');
      case 'conditions':
        return require('../../assets/condition.png');
      case 'medications':
        return require('../../assets/condition.png');
      default:
        return require('../../assets/profile_icon.png');
    }
  }, []);

  const renderField = (label: string, value: string, fieldName: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Image
          source={iconForField(fieldName)}
          style={styles.infoIcon}
          resizeMode="contain"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.infoInput}
            value={formData[fieldName as keyof typeof formData]}
            onChangeText={text => handleChange(fieldName, text)}
            placeholder={`Enter ${label}`}
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text
            style={[
              styles.infoValue,
              !String(value || '').trim() && styles.infoValueEmpty,
            ]}
          >
            {String(value || '').trim() ? value : 'Not provided'}
          </Text>
        )}
      </View>
    </View>
  );

  const renderInfoTableRow = React.useCallback(
    (
      label: string,
      value: string,
      fieldName?: keyof typeof formData,
      editable?: boolean,
      inputType?: 'text' | 'select',
      onPressSelect?: () => void,
    ) => {
      const valTrim = String(value || '').trim();
      const showValue = valTrim ? valTrim : 'Not provided';
      const showEmpty = !valTrim;
      const canEdit = Boolean(isEditing && editable && fieldName);

      return (
        <View style={styles.infoTableRow}>
          <View style={styles.infoTableLabelCell}>
            <Text style={styles.infoTableLabelText}>{label}:</Text>
          </View>
          <View style={styles.infoTableValueCell}>
            {canEdit ? (
              inputType === 'select' ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.infoTableSelect}
                  onPress={onPressSelect}
                >
                  <Text
                    style={[
                      styles.infoTableSelectText,
                      showEmpty && styles.infoValueEmpty,
                    ]}
                  >
                    {showValue}
                  </Text>
                  <Text style={styles.infoTableSelectChevron}>▾</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={styles.infoTableInput}
                  value={String(
                    formData[fieldName as keyof typeof formData] || '',
                  )}
                  onChangeText={text => handleChange(String(fieldName), text)}
                  placeholder={label}
                  placeholderTextColor="#9CA3AF"
                />
              )
            ) : (
              <Text
                style={[
                  styles.infoTableValueText,
                  showEmpty && styles.infoValueEmpty,
                ]}
                numberOfLines={2}
              >
                {showValue}
              </Text>
            )}
          </View>
        </View>
      );
    },
    [formData, handleChange, isEditing],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: (insets.top || 0) + 24 },
            compact && { paddingHorizontal: 16, paddingBottom: 18 },
          ]}
        >
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
                  {String(userData.name || 'P')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.avatarEditBtn}
              activeOpacity={0.85}
              onPress={() => {
                setIsEditing(true);
                setShowPhotoEditor(true);
              }}
            >
              <Text style={styles.avatarEditIcon}>✎</Text>
            </TouchableOpacity>
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
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.heroBtn, styles.heroBtnLight]}
                  onPress={() => {
                    setFormData({ ...userData });
                    setIsEditing(true);
                  }}
                >
                  <Text style={[styles.heroBtnText, styles.heroBtnTextLight]}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroBtn, styles.heroBtnDark]}
                  onPress={async () => {
                    try {
                      await AsyncStorage.removeItem('session');
                    } catch {}
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  }}
                >
                  <View style={styles.heroBtnRow}>
                    <Image
                      source={require('../../assets/logout.png')}
                      style={styles.heroBtnIcon}
                      resizeMode="contain"
                    />
                    <Text style={[styles.heroBtnText, { color: '#FFFFFF' }]}>
                      Logout
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.heroBtn, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Text style={[styles.heroBtnText, { color: '#FFFFFF' }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heroBtn, styles.heroBtnLight]}
                  onPress={() => setIsEditing(false)}
                >
                  <Text style={[styles.heroBtnText, styles.heroBtnTextLight]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View
          style={[
            styles.sheet,
            { paddingBottom: 24 + Math.max(0, (insets.bottom || 0) + 96) },
          ]}
        >
          {/* Personal Information */}
          <View
            style={[
              styles.section,
              compact && { padding: 12, marginHorizontal: 12 },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Image
                source={require('../../assets/profile_icon.png')}
                style={styles.sectionTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            <View style={styles.infoTable}>
              {renderInfoTableRow(
                'Full Name',
                String((isEditing ? formData.name : userData.name) || ''),
              )}
              {renderInfoTableRow('Role', String(topUserRole || 'Patient'))}
              {renderInfoTableRow(
                'Email',
                String(userData.email || ''),
                'email',
                true,
              )}
              {renderInfoTableRow(
                'Phone',
                String(userData.phone || ''),
                'phone',
                true,
              )}
              {renderInfoTableRow(
                'Birth Date',
                String(
                  isEditing ? formData.dateOfBirth : userData.dateOfBirth || '',
                ),
                'dateOfBirth',
                true,
                'select',
                () => setShowBirthdatePicker(true),
              )}
              {renderInfoTableRow(
                'Gender',
                String(
                  isEditing
                    ? (formData as any).gender
                    : (userData as any).gender || topUserGender || '',
                ),
                'gender' as any,
                true,
                'select',
                () => setShowGenderPicker(true),
              )}
              {renderInfoTableRow(
                'Address',
                String(userData.address || ''),
                'address',
                true,
              )}
            </View>
          </View>

          {/* Emergency Contacts */}
          <View
            style={[
              styles.section,
              compact && { padding: 12, marginHorizontal: 12 },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Image
                  source={require('../../assets/records.png')}
                  style={styles.sectionTitleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.sectionTitle}>Emergency Contacts</Text>
              </View>
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
                    onChangeText={t =>
                      setNewContact({ ...newContact, name: t })
                    }
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
                    onChangeText={t =>
                      setNewContact({ ...newContact, phone: t })
                    }
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
        </View>
      </ScrollView>

      <Modal
        visible={showGenderPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowGenderPicker(false)}
          />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Gender</Text>
            {['Male', 'Female', 'Other'].map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.pickerItem}
                onPress={() => {
                  handleChange('gender', opt);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={styles.pickerItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {showBirthdatePicker && (
        <View style={styles.datePickerWrap}>
          <DateTimePicker
            value={(() => {
              const raw = String(formData.dateOfBirth || '').trim();
              const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (m) {
                const y = Number(m[1]);
                const mo = Number(m[2]) - 1;
                const d = Number(m[3]);
                const dt = new Date(y, mo, d);
                return isNaN(dt.getTime()) ? new Date() : dt;
              }
              return new Date();
            })()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event: any, selected?: Date) => {
              const type = event?.type;
              if (type === 'dismissed') {
                setShowBirthdatePicker(false);
                return;
              }
              if (selected) {
                const y = selected.getFullYear();
                const m = String(selected.getMonth() + 1).padStart(2, '0');
                const d = String(selected.getDate()).padStart(2, '0');
                handleChange('dateOfBirth', `${y}-${m}-${d}`);
              }
              if (Platform.OS !== 'ios') setShowBirthdatePicker(false);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.datePickerDone}
              onPress={() => setShowBirthdatePicker(false)}
            >
              <Text style={styles.datePickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingBottom: 80, // Space for bottom navigation
  },
  contentContainer: {
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 22,
    backgroundColor: BRAND,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarText: {
    color: BRAND,
    fontSize: 34,
    fontWeight: '900',
  },
  avatarEditBtn: {
    position: 'absolute',
    right: -4,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: {
    color: BRAND,
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
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
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  heroBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroBtnLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroBtnDark: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  heroBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  heroBtnTextLight: {
    color: '#0F766E',
  },
  heroBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBtnIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFFFFF',
  },

  sheet: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    minHeight: 420,
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
    marginHorizontal: 0,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitleIcon: {
    width: 18,
    height: 18,
    tintColor: BRAND,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  infoTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 54,
  },
  infoTableLabelCell: {
    width: '42%',
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  infoTableValueCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  infoTableLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  infoTableValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  infoTableInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  infoTableSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  infoTableSelectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingRight: 10,
  },
  infoTableSelectChevron: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '900',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },
  pickerItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  datePickerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 10,
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    marginRight: 14,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  datePickerDoneText: {
    color: BRAND,
    fontWeight: '900',
    fontSize: 14,
  },
  addButton: {
    color: BRAND,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoIcon: {
    width: 18,
    height: 18,
    tintColor: BRAND,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoValue: {
    marginTop: 3,
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
  },
  infoValueEmpty: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  infoInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
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
