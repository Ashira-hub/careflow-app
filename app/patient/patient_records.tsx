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
      return (
        sess?.user?.full_name ||
        sess?.user?.fullName ||
        sess?.user?.name ||
        sess?.full_name ||
        sess?.name
      );
    } catch {
      return undefined;
    }
  }, []);

  const loadRecords = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const myName = (await getCurrentUserName()) || '';
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

      const [resPR, resLab] = await Promise.all([
        fetch(`${API_BASE}/api/patient-records/all`, { headers }),
        fetch(`${API_BASE}/api/lab-records`, { headers }),
      ]);

      const prRows = resPR.ok ? await resPR.json() : [];
      const labRows = resLab.ok ? await resLab.json() : [];
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
      const mineLab = (Array.isArray(labRows) ? labRows : []).filter((r: any) =>
        nameMatches(String(r?.patient || ''), String(myName || '')),
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
        };
      });

      const mappedLab: MedicalRecord[] = mineLab.map((r: any) => {
        const title = r?.test_name
          ? `Lab Result - ${String(r.test_name)}`
          : 'Lab Result';
        const date = String(r?.date || r?.createdAt || '');
        const statRaw = String(r?.status || '').toLowerCase();
        const status: 'pending' | 'completed' | 'cancelled' | undefined =
          statRaw === 'completed'
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
            rawStatus === 'accepted'
              ? 'completed'
              : rawStatus === 'pending'
              ? 'pending'
              : rawStatus === 'cancelled' || rawStatus === 'rejected'
              ? 'cancelled'
              : undefined;
          return {
            id: `RX-${String(r?.id || `${r?.patient_name || ''}-${date}`)}`,
            title: r?.medicine
              ? `Prescription - ${String(r.medicine)}`
              : 'Prescription',
            type: 'prescription',
            date,
            doctor: r?.doctor_name ? String(r.doctor_name) : undefined,
            status,
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
      return () => {};
    }, [loadRecords, loadUserData]),
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
    >
      <View style={styles.recordIcon}>
        {item.type === 'consultation' ? (
          <Image
            source={require('../../assets/records.png')}
            style={styles.recordIconImg}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.recordIconText}>{getRecordIcon(item.type)}</Text>
        )}
      </View>
      <View style={styles.recordDetails}>
        <Text style={styles.recordTitle}>{item.title}</Text>
        <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
        {item.doctor && <Text style={styles.recordDoctor}>{item.doctor}</Text>}
      </View>
      {item.status && (
        <View
          style={[
            styles.statusBadge,
            item.status === 'completed' && styles.statusCompleted,
            item.status === 'pending' && styles.statusPending,
            item.status === 'cancelled' && styles.statusCancelled,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
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
                {String(userName || 'P')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.topProfileTextCol}>
              <Text style={styles.topProfileName} numberOfLines={1}>
                {String(userName || 'Patient')}
              </Text>
              <Text style={styles.topProfileRole} numberOfLines={1}>
                {String(userRole || 'Patient')}
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
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Medical Records</Text>
        </View>

        {/* Search Bar + Filter Dropdown */}
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { flex: 1, margin: 0 }]}>
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
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.filterButtonText}>
              {getFilterLabel(activeFilter)} ▾
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Dropdown Modal */}
        <Modal
          visible={filterMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.filterMenuOverlay}
            activeOpacity={1}
            onPress={() => setFilterMenuVisible(false)}
          >
            <View style={styles.filterMenuContainer}>
              {(
                [
                  { label: 'All', value: 'all' },
                  { label: 'Prescriptions', value: 'prescriptions' },
                  { label: 'Lab Results', value: 'lab_results' },
                  { label: 'Consultations', value: 'consultations' },
                  { label: 'Other', value: 'other' },
                ] as { label: string; value: RecordType }[]
              ).map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.filterMenuItem}
                  onPress={() => {
                    setActiveFilter(opt.value);
                    setFilterMenuVisible(false);
                  }}
                >
                  <Text style={styles.filterMenuItemText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              {selectedRecord?.type === 'consultation' ? (
                <Image
                  source={require('../../assets/records.png')}
                  style={styles.modalIconImg}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.modalIcon}>
                  {selectedRecord ? getRecordIcon(selectedRecord.type) : ''}
                </Text>
              )}
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selectedRecord?.title || ''}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Type</Text>
              <Text style={styles.modalValue}>
                {selectedRecord ? getTypeLabel(selectedRecord.type) : ''}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Date</Text>
              <Text style={styles.modalValue}>
                {selectedRecord ? formatDate(selectedRecord.date) : ''}
              </Text>
            </View>

            {selectedRecord?.doctor ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Doctor</Text>
                <Text style={styles.modalValue}>{selectedRecord.doctor}</Text>
              </View>
            ) : null}

            <View style={[styles.modalRow, { alignItems: 'center' }]}>
              <Text style={styles.modalLabel}>Status</Text>
              {selectedRecord?.status ? (
                <View
                  style={[
                    styles.statusBadge,
                    selectedRecord.status === 'completed' &&
                      styles.statusCompleted,
                    selectedRecord.status === 'pending' && styles.statusPending,
                    selectedRecord.status === 'cancelled' &&
                      styles.statusCancelled,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {selectedRecord.status.charAt(0).toUpperCase() +
                      selectedRecord.status.slice(1)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.modalValue}>N/A</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#fff',
  },
  headerContainer: {
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
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
  // Search + Dropdown Row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  filterButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 140,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  activeFilterTab: {
    backgroundColor: '#10B981',
  },
  filterText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  // Dropdown Menu Styles
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.0)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  filterMenuContainer: {
    marginTop: 140,
    marginRight: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    minWidth: 140,
  },
  filterMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterMenuItemText: {
    fontSize: 14,
    color: '#111827',
  },
  recordsList: {
    padding: 16,
    paddingBottom: 80, // Space for bottom navigation
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recordIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recordIconText: {
    fontSize: 20,
  },
  recordIconImg: {
    width: 22,
    height: 22,
    tintColor: '#10B981',
  },
  recordDetails: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  recordDoctor: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
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
    fontWeight: '500',
    color: '#065F46', // Default to completed color
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
