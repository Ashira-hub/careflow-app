import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  FlatList,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RecordType =
  | 'all'
  | 'prescriptions'
  | 'lab_results'
  | 'consultations'
  | 'other';

interface MedicalRecord {
  id: string;
  title: string;
  type: 'prescription' | 'lab_result' | 'consultation' | 'other';
  date: string;
  doctor?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  notes?: string;
}

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

const PatientRecords = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RecordType>('all');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  const API_BASE = 'https://backend-careflow.vercel.app';
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

  const loadUserData = React.useCallback(async () => {
    try {
      const session = await AsyncStorage.getItem('session');
      if (session) {
        const { user } = JSON.parse(session);
        const derivedName =
          user?.full_name ||
          user?.fullName ||
          user?.name ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ');
        setUserName(derivedName || 'Patient');
        const rawRole = user?.role || user?.role_name || user?.roleName;
        const roleStr = String(rawRole || '').trim();
        const displayRole = roleStr
          ? roleStr.charAt(0).toUpperCase() + roleStr.slice(1)
          : 'Patient';
        setUserRole(displayRole);
      }
    } catch {}
  }, []);

  const getCurrentUserName = React.useCallback(async (): Promise<
    string | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      const u = sess?.user || {};
      return (
        u?.full_name ||
        u?.fullName ||
        u?.name ||
        [u?.firstName, u?.lastName].filter(Boolean).join(' ') ||
        sess?.full_name ||
        sess?.name ||
        [sess?.firstName, sess?.lastName].filter(Boolean).join(' ') ||
        undefined
      );
    } catch {
      return undefined;
    }
  }, []);

  const loadRecords = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const myName = (await getCurrentUserName()) || '';

      const fetchFirstOk = async (paths: string[]) => {
        for (const p of paths) {
          try {
            const res = await fetch(`${API_BASE}${p}`, { headers });
            if (!res.ok) continue;
            const data = await res.json().catch(() => null);
            return data;
          } catch {}
        }
        return null;
      };

      const normalizeRows = (data: any): any[] => {
        return Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.results)
          ? data.results
          : [];
      };

      const buildLabNotes = (r: any): string | undefined => {
        const formatValue = (v: any) => {
          if (v == null) return '';
          if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
          if (typeof v === 'string') return v.trim();
          if (typeof v === 'boolean') return v ? 'Yes' : 'No';
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        };

        const normalizeLabel = (k: string) => {
          const key = String(k || '').trim();
          if (!key) return '';
          const upper = key.toUpperCase();
          const map: Record<string, string> = {
            WBC: 'WBC',
            RBC: 'RBC',
            HGB: 'HGB',
            HEMOGLOBIN: 'HGB',
            HCT: 'HCT',
            HEMATOCRIT: 'HCT',
            PLT: 'PLT',
            PLATELET: 'PLT',
            PLATELETS: 'PLT',
            MCV: 'MCV',
            MCH: 'MCH',
            MCHC: 'MCHC',
            RDW: 'RDW',
            NEUTROPHILS: 'Neutrophils',
            LYMPHOCYTES: 'Lymphocytes',
            MONOCYTES: 'Monocytes',
            EOSINOPHILS: 'Eosinophils',
            BASOPHILS: 'Basophils',
          };
          if (map[upper]) return map[upper];
          return key
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, c => c.toUpperCase());
        };

        const addKV = (
          out: Array<{ label: string; value: string }>,
          labelRaw: string,
          valueRaw: any,
          unitRaw?: any,
        ) => {
          const label = normalizeLabel(labelRaw);
          const value = formatValue(valueRaw);
          const unit = formatValue(unitRaw);
          if (!label || !value) return;
          out.push({ label, value: unit ? `${value} ${unit}` : value });
        };

        const structured: Array<{ label: string; value: string }> = [];

        const maybeCollectFromObject = (obj: any) => {
          if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
          const keys = [
            'wbc',
            'rbc',
            'hgb',
            'hemoglobin',
            'hct',
            'hematocrit',
            'plt',
            'platelet',
            'platelets',
            'mcv',
            'mch',
            'mchc',
            'rdw',
            'neutrophils',
            'lymphocytes',
            'monocytes',
            'eosinophils',
            'basophils',
          ];
          for (const k of keys) {
            const v = (obj as any)?.[k];
            const unit =
              (obj as any)?.[`${k}_unit`] ?? (obj as any)?.[`${k}Unit`];
            addKV(structured, k, v, unit);
          }
        };

        const maybeCollectFromArray = (arr: any[]) => {
          for (const it of arr) {
            if (!it) continue;
            const name = it?.name ?? it?.test ?? it?.label ?? it?.parameter;
            const value = it?.value ?? it?.result ?? it?.count;
            const unit = it?.unit ?? it?.units;
            if (name != null && value != null) {
              addKV(structured, String(name), value, unit);
            }
          }
        };

        maybeCollectFromObject(r);
        maybeCollectFromObject(r?.cbc);
        maybeCollectFromObject(r?.results);
        maybeCollectFromObject(r?.values);
        maybeCollectFromObject(r?.measurements);
        if (Array.isArray(r?.results)) maybeCollectFromArray(r.results);
        if (Array.isArray(r?.values)) maybeCollectFromArray(r.values);

        const notesRaw =
          r?.notes || r?.remarks || r?.description || r?.comment || r?.comments;
        const resultRaw = r?.result || r?.findings || r?.outcome;
        let notes = notesRaw != null ? String(notesRaw) : '';
        let result = resultRaw != null ? String(resultRaw) : '';

        if (!structured.length && typeof resultRaw === 'string') {
          const s = resultRaw.trim();
          if (
            (s.startsWith('{') && s.endsWith('}')) ||
            (s.startsWith('[') && s.endsWith(']'))
          ) {
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) maybeCollectFromArray(parsed);
              else maybeCollectFromObject(parsed);
            } catch {}
          }
        }

        const structuredText = structured.length
          ? structured
              .reduce((acc: Array<{ label: string; value: string }>, cur) => {
                const exists = acc.some(
                  it =>
                    it.label.toLowerCase() === cur.label.toLowerCase() &&
                    it.value.toLowerCase() === cur.value.toLowerCase(),
                );
                if (!exists) acc.push(cur);
                return acc;
              }, [])
              .map(it => `${it.label}: ${it.value}`)
              .join('\n')
          : '';

        if (structuredText) {
          const combined = [structuredText, result, notes]
            .map(v => String(v || '').trim())
            .filter(Boolean)
            .join('\n');
          return combined.trim() ? combined : undefined;
        }

        notes = notes.trim();
        result = result.trim();
        if (result && notes) {
          const normNotes = notes.trim();
          const normResult = result.trim();
          if (normNotes && normResult && normNotes !== normResult) {
            return `${normResult}\n${normNotes}`;
          }
          return normResult || normNotes;
        }
        return (result || notes).trim() ? String(result || notes) : undefined;
      };
      const nameMatches = (pRaw: string, meRaw: string) => {
        const p = String(pRaw || '')
          .toLowerCase()
          .trim();
        const me = String(meRaw || '')
          .toLowerCase()
          .trim();
        if (!p || !me) return false;
        if (p === me) return true;
        const meTokens = me.split(/\s+/).filter(Boolean);
        if (meTokens.length > 0 && meTokens.every(t => p.includes(t)))
          return true;
        const pTokens = p.split(/\s+/).filter(Boolean);
        if (pTokens.length > 0 && pTokens.every(t => me.includes(t)))
          return true;
        return false;
      };

      const [resPR, labData] = await Promise.all([
        fetch(`${API_BASE}/api/patient-records/all`, { headers }),
        fetchFirstOk([
          '/api/lab-tests',
          '/api/lab_tests',
          '/api/lab-tests/all',
          '/api/lab_tests/all',
          '/api/lab-records',
        ]),
      ]);

      const prRows = resPR.ok ? await resPR.json() : [];
      const labRows = normalizeRows(labData);
      // Also fetch prescriptions so completed (accepted) ones appear in records
      let rxRows: any[] = [];
      try {
        const resRx = await fetch(`${API_BASE}/api/prescriptions`, { headers });
        rxRows = resRx.ok ? await resRx.json() : [];
      } catch {}

      // Fetch appointments so completed ones also appear in records
      let apptRows: any[] = [];
      try {
        const resAppt = await fetch(`${API_BASE}/api/appointments`, {
          headers,
        });
        apptRows = resAppt.ok ? await resAppt.json() : [];
      } catch {}

      const minePR = (Array.isArray(prRows) ? prRows : []).filter((r: any) =>
        nameMatches(String(r?.patient || ''), String(myName || '')),
      );
      const mineLab = (Array.isArray(labRows) ? labRows : []).filter(
        (r: any) => {
          const pname =
            r?.patient ||
            r?.patient_name ||
            r?.patientName ||
            r?.patient_fullname;
          return nameMatches(String(pname || ''), String(myName || ''));
        },
      );
      const mineRx = (Array.isArray(rxRows) ? rxRows : []).filter((r: any) =>
        nameMatches(String(r?.patient_name || ''), String(myName || '')),
      );
      const mineAppt = (Array.isArray(apptRows) ? apptRows : []).filter(
        (a: any) =>
          nameMatches(String(a?.patient || ''), String(myName || '')) &&
          Boolean(a?.done),
      );

      const mappedPR: MedicalRecord[] = minePR.map((r: any) => {
        const hasMedicine = !!r?.medicine;
        const type: MedicalRecord['type'] = hasMedicine
          ? 'prescription'
          : 'consultation';
        const title = hasMedicine
          ? `Prescription - ${String(r?.medicine || '')}`
          : 'Consultation';
        const date = String(r?.date || r?.created_at || '');
        const doctor = r?.doctor ? String(r.doctor) : undefined;
        return {
          id: String(r?.id || `${r?.patient || ''}-${date}`),
          title,
          type,
          date,
          doctor,
          status: 'completed',
          notes:
            r?.instructions || r?.instruction || r?.notes || r?.remarks
              ? String(
                  r?.instructions || r?.instruction || r?.notes || r?.remarks,
                )
              : undefined,
        };
      });

      const mappedLab: MedicalRecord[] = mineLab.map((r: any) => {
        const testName =
          r?.test_name || r?.testName || r?.test || r?.lab_test || r?.labTest;
        const title = testName
          ? `Lab Result - ${String(testName)}`
          : 'Lab Result';
        const date = String(r?.date || r?.createdAt || r?.created_at || '');
        const statRaw = String(r?.status || '').toLowerCase();
        const status: 'pending' | 'completed' | 'cancelled' | undefined =
          statRaw === 'completed' || statRaw === 'done'
            ? 'completed'
            : statRaw === 'pending'
            ? 'pending'
            : statRaw === 'cancelled'
            ? 'cancelled'
            : undefined;
        return {
          id: `LAB-${String(r?.id || `${r?.patient || ''}-${date}`)}`,
          title,
          type: 'lab_result',
          date,
          doctor: undefined,
          status,
          notes: buildLabNotes(r),
        };
      });

      // Map prescriptions (treat 'accepted' as completed)
      const mappedRx: MedicalRecord[] = mineRx
        // If you only want accepted/completed prescriptions, filter here
        // .filter((r: any) => String(r?.status || '').toLowerCase() === 'accepted')
        .map((r: any) => {
          const date = String(r?.created_at || r?.createdAt || '');
          const rawStatus = String(r?.status || '').toLowerCase();
          const status: 'pending' | 'completed' | 'cancelled' | undefined =
            rawStatus === 'accepted' ||
            rawStatus === 'dispensed' ||
            rawStatus === 'completed'
              ? 'completed'
              : rawStatus === 'pending'
              ? 'pending'
              : rawStatus === 'cancelled' || rawStatus === 'rejected'
              ? 'cancelled'
              : 'pending';
          return {
            id: `RX-${String(r?.id || `${r?.patient_name || ''}-${date}`)}`,
            title: r?.medicine
              ? `Prescription - ${String(r.medicine)}`
              : 'Prescription',
            type: 'prescription',
            date,
            doctor: r?.doctor_name ? String(r.doctor_name) : undefined,
            status,
            notes:
              r?.instructions || r?.instruction || r?.notes || r?.remarks
                ? String(
                    r?.instructions || r?.instruction || r?.notes || r?.remarks,
                  )
                : undefined,
          } as MedicalRecord;
        });

      // Map completed appointments as consultations
      const mappedAppt: MedicalRecord[] = mineAppt.map((a: any) => {
        const date = String(a?.date || '');
        const doctor = a?.createdByName || a?.created_by_name;
        return {
          id: `APT-${String(
            a?.id || `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
          )}`,
          title: 'Consultation',
          type: 'consultation',
          date,
          doctor: doctor ? String(doctor) : undefined,
          status: 'completed',
          notes:
            a?.notes || a?.reason || a?.complaint
              ? String(a?.notes || a?.reason || a?.complaint)
              : undefined,
        } as MedicalRecord;
      });

      const combined = [...mappedPR, ...mappedLab, ...mappedRx, ...mappedAppt];
      combined.sort((a, b) => {
        const ta = Date.parse(a.date || '') || 0;
        const tb = Date.parse(b.date || '') || 0;
        return tb - ta;
      });
      setRecords(combined);
    } catch {}
  }, [API_BASE, getAuthHeaders, getCurrentUserName]);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
      loadUserData();
      syncUnread();
      return () => {};
    }, [loadRecords, loadUserData, syncUnread]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRecords();
    } finally {
      setRefreshing(false);
    }
  }, [loadRecords]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const mapFilter = (f: RecordType): string | null => {
      if (f === 'lab_results') return 'lab_result';
      if (f === 'prescriptions') return 'prescription';
      if (f === 'consultations') return 'consultation';
      if (f === 'other') return 'other';
      return null;
    };
    const fType = mapFilter(activeFilter);
    const matchesFilter = !fType || record.type === fType;
    return matchesSearch && matchesFilter;
  });

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return '💊';
      case 'lab_result':
        return '🔬';
      case 'consultation':
        return '📋';
      default:
        return '📄';
    }
  };

  const getRecordIconSource = (type: string) => {
    switch (type) {
      case 'prescription':
        return require('../../assets/medicine_emoji.png');
      case 'consultation':
        return require('../../assets/consultation_emoji.png');
      default:
        return undefined;
    }
  };

  const getTypeLabel = (type: MedicalRecord['type']) => {
    switch (type) {
      case 'prescription':
        return 'Prescription';
      case 'lab_result':
        return 'Lab Result';
      case 'consultation':
        return 'Consultation';
      default:
        return 'Other';
    }
  };

  const getFilterLabel = (f: RecordType): string => {
    switch (f) {
      case 'prescriptions':
        return 'Prescriptions';
      case 'lab_results':
        return 'Lab Results';
      case 'consultations':
        return 'Consultations';
      case 'other':
        return 'Other';
      default:
        return 'All';
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const renderRecordItem = ({ item }: { item: MedicalRecord }) => (
    <TouchableOpacity
      style={styles.recordCard}
      onPress={() => {
        setSelectedRecord(item);
        setIsModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.recordIconContainer}>
        <View
          style={[
            styles.recordIcon,
            item.type === 'prescription' && styles.prescriptionIcon,
            item.type === 'lab_result' && styles.labIcon,
            item.type === 'consultation' && styles.consultationIcon,
          ]}
        >
          <Text style={styles.recordIconText}>
            {item.type === 'prescription'
              ? '💊'
              : item.type === 'lab_result'
              ? '🔬'
              : item.type === 'consultation'
              ? '📋'
              : '📄'}
          </Text>
        </View>
      </View>

      <View style={styles.recordContent}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        <View style={styles.recordDetails}>
          <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
          {item.doctor && (
            <Text style={styles.recordDoctor}>Dr. {item.doctor}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <Image
            source={require('../../assets/appicon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('PatientNotification')}
              activeOpacity={0.8}
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
              style={styles.headerProfileBtn}
              onPress={() => setShowProfileMenu(true)}
              activeOpacity={0.85}
            >
              <View style={styles.headerProfileAvatar}>
                <Text style={styles.headerProfileAvatarText}>
                  {String(userName || 'P')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerProfileTextCol}>
                <Text style={styles.headerProfileName} numberOfLines={1}>
                  {String(userName || 'Patient')}
                </Text>
                <Text style={styles.headerProfileRole} numberOfLines={1}>
                  {String(userRole || 'Patient')}
                </Text>
              </View>
              <Image
                source={require('../../assets/dropdown.png')}
                style={styles.headerProfileChevron}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { margin: 0 }]}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search records..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <Image
              source={require('../../assets/search_icon.png')}
              style={styles.searchIcon}
            />
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContainer}
          >
            {(
              [
                'all',
                'prescriptions',
                'lab_results',
                'consultations',
              ] as RecordType[]
            ).map(filter => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  activeFilter === filter && styles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.filterText,
                    activeFilter === filter && styles.activeFilterText,
                  ]}
                >
                  {getFilterLabel(filter)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Records List */}
        <FlatList
          data={filteredRecords}
          renderItem={renderRecordItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.recordsList}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No records found</Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            <View style={styles.detailsTopAccent} />

            <View style={styles.detailsHeaderRow}>
              <Text style={styles.detailsHeaderTitle}>
                {selectedRecord ? getTypeLabel(selectedRecord.type) : ''}
              </Text>
            </View>

            <View style={styles.detailsDivider} />

            <View style={styles.detailsRow}>
              <View style={styles.detailsIconBox}>
                <Text style={styles.detailsIconText}>
                  {selectedRecord?.type === 'prescription'
                    ? '💊'
                    : selectedRecord?.type === 'lab_result'
                    ? '🔬'
                    : selectedRecord?.type === 'consultation'
                    ? '📋'
                    : '📄'}
                </Text>
              </View>
              <View style={styles.detailsTextCol}>
                <Text style={styles.detailsLabel}>
                  {selectedRecord?.type === 'prescription'
                    ? 'Medicine'
                    : selectedRecord?.type === 'lab_result'
                    ? 'Test'
                    : 'Record'}
                </Text>
                <Text style={styles.detailsValue} numberOfLines={2}>
                  {selectedRecord
                    ? String(selectedRecord.title || '')
                        .replace(/^Prescription\s*-\s*/i, '')
                        .replace(/^Lab Result\s*-\s*/i, '')
                        .replace(/^Consultation\s*-\s*/i, '')
                    : ''}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailsIconBox}>
                <Text style={styles.detailsIconText}>📅</Text>
              </View>
              <View style={styles.detailsTextCol}>
                <Text style={styles.detailsLabel}>Date</Text>
                <Text style={styles.detailsValue}>
                  {selectedRecord ? formatDate(selectedRecord.date) : ''}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailsIconBox}>
                <Text style={styles.detailsIconText}>👤</Text>
              </View>
              <View style={styles.detailsTextCol}>
                <Text style={styles.detailsLabel}>Doctor</Text>
                <Text style={styles.detailsValue}>
                  {selectedRecord?.doctor ? String(selectedRecord.doctor) : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.detailsDivider} />

            <Text style={styles.detailsSectionTitle}>
              {selectedRecord?.type === 'lab_result'
                ? 'Result / Notes'
                : 'Instructions'}
            </Text>
            <View style={styles.detailsInstructionsBox}>
              <Text style={styles.detailsInstructionsText}>
                {selectedRecord?.notes
                  ? String(selectedRecord.notes)
                  : selectedRecord?.type === 'lab_result'
                  ? 'No result available.'
                  : 'No instructions available.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.detailsCloseButton}
              onPress={() => setIsModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.detailsCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          active={true}
          source={require('../../assets/patient_records_icon.png')}
          onPress={() => {}}
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
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#111827',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#9CA3AF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImg: { width: 20, height: 20, tintColor: '#111827' },
  headerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerProfileTextCol: {
    marginLeft: 10,
    marginRight: 8,
    maxWidth: 140,
  },
  headerProfileName: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 14,
  },
  headerProfileRole: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  headerProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#111827',
    opacity: 0.9,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 8,
  },
  filterScrollWrap: {
    paddingVertical: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
  },
  activeFilterTab: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  recordsList: {
    padding: 0,
    paddingBottom: 80, // Space for bottom navigation
  },
  recordCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  recordIconContainer: {
    marginRight: 16,
  },
  recordIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prescriptionIcon: {
    backgroundColor: '#ECFDF5',
  },
  labIcon: {
    backgroundColor: '#FEF3C7',
  },
  consultationIcon: {
    backgroundColor: '#DBEAFE',
  },
  recordIconText: {
    fontSize: 24,
  },
  recordContent: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  recordDetails: {
    gap: 4,
  },
  recordDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  recordDoctor: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusCompleted: {
    backgroundColor: '#ECFDF5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  statusCompletedText: {
    color: '#065F46',
  },
  statusPendingText: {
    color: '#92400E',
  },
  statusCancelledText: {
    color: '#991B1B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailsModalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  detailsTopAccent: {
    height: 8,
    backgroundColor: '#10B981',
  },
  detailsHeaderRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 18,
  },
  detailsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailsIconText: {
    fontSize: 18,
  },
  detailsTextCol: {
    flex: 1,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailsValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailsSectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 18,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  detailsInstructionsBox: {
    marginHorizontal: 18,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  detailsInstructionsText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1F2937',
  },
  detailsCloseButton: {
    marginTop: 16,
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailsCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  modalIconImg: {
    width: 22,
    height: 22,
    marginRight: 8,
    tintColor: '#10B981',
  },
  modalEmojiImg: {
    width: 22,
    height: 22,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PatientRecords;
