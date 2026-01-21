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
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
type Prescription = {
  id: string;
  medicine: string;
  dosage?: string;
  instructions?: string;
  date: string; // created date
  doctor?: string;
  status?: 'pending' | 'completed' | 'cancelled'; // map from api status
};

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

const API_BASE = 'https://backend-careflow.vercel.app';

const PatientPrescription = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [list, setList] = useState<Prescription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  const buildPrescriptionHtml = React.useCallback(
    (items: Prescription[], patient: string) => {
      const esc = (s: string) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const rows = (items || [])
        .map(p => {
          const date = p.date ? new Date(p.date).toLocaleDateString() : '';
          return `
            <tr>
              <td>${esc(p.medicine)}</td>
              <td>${esc(p.dosage || '')}</td>
              <td>${esc(p.instructions || '')}</td>
              <td>${esc(p.doctor ? `Dr. ${p.doctor}` : '')}</td>
              <td>${esc(date)}</td>
              <td>${esc(p.status || '')}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial; padding: 16px; color: #111827; }
              h1 { font-size: 18px; margin: 0 0 4px; }
              .meta { font-size: 12px; color: #6B7280; margin-bottom: 12px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #E5E7EB; padding: 8px; font-size: 12px; vertical-align: top; }
              th { background: #F9FAFB; text-align: left; }
            </style>
          </head>
          <body>
            <h1>Prescription List</h1>
            <div class="meta">Patient: ${esc(
              patient || 'Patient',
            )} • Generated: ${esc(new Date().toLocaleString())}</div>
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Instructions</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="6">No prescriptions</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `;
    },
    [],
  );

  const handlePrint = React.useCallback(async () => {
    try {
      if (!list || list.length === 0) {
        Alert.alert('Print', 'No prescriptions to print.');
        return;
      }

      let RNHTMLtoPDF: any;
      let RNPrint: any;
      try {
        RNHTMLtoPDF = require('react-native-html-to-pdf');
        RNPrint = require('react-native-print');
      } catch {
        const lines = (list || []).map((p, i) => {
          const d = new Date(p.date || '').toLocaleDateString();
          return `${i + 1}. ${p.medicine}${p.dosage ? ` (${p.dosage})` : ''}${
            p.instructions ? ` - ${p.instructions}` : ''
          }${p.doctor ? ` • Dr. ${p.doctor}` : ''} • ${d}${
            p.status ? ` • ${p.status}` : ''
          }`;
        });
        const message = lines.join('\n');
        Alert.alert(
          'Missing PDF/Print library',
          'To print a PDF, install react-native-html-to-pdf and react-native-print. For now, sharing text instead.',
        );
        await Share.share({ message });
        return;
      }

      const patient = userName || 'Patient';
      const html = buildPrescriptionHtml(list, String(patient));
      const fileName = `prescriptions_${Date.now()}`;

      const pdf = await RNHTMLtoPDF.convert({
        html,
        fileName,
        base64: false,
      });

      const filePath = pdf?.filePath;
      if (!filePath) {
        Alert.alert('Print', 'Failed to generate PDF.');
        return;
      }

      await RNPrint.print({ filePath });
      if (Platform.OS === 'android') {
        // Android print dialog opens; nothing else needed.
      }
    } catch {
      Alert.alert('Print', 'Failed to print PDF.');
    }
  }, [buildPrescriptionHtml, list, userName]);

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

  const loadPrescriptions = React.useCallback(async () => {
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

      const res = await fetch(`${API_BASE}/api/prescriptions`, { headers });
      const rows = res.ok ? await res.json() : [];
      const mine = (Array.isArray(rows) ? rows : []).filter((r: any) =>
        nameMatches(String(r?.patient_name || ''), String(myName || '')),
      );

      const mapped: Prescription[] = mine.map((r: any) => {
        const date = String(r?.created_at || r?.createdAt || '');
        const rawStatus = String(r?.status || '').toLowerCase();
        const status: Prescription['status'] =
          rawStatus === 'accepted'
            ? 'completed'
            : rawStatus === 'pending'
            ? 'pending'
            : rawStatus === 'cancelled' || rawStatus === 'rejected'
            ? 'cancelled'
            : undefined;
        return {
          id: String(r?.id || `${r?.patient_name || ''}-${date}`),
          medicine: String(r?.medicine || 'Prescription'),
          dosage: r?.dosage ? String(r.dosage) : undefined,
          instructions: r?.instructions ? String(r.instructions) : undefined,
          date,
          doctor: r?.doctor_name ? String(r.doctor_name) : undefined,
          status,
        } as Prescription;
      });

      // Sort newest first
      mapped.sort((a, b) => {
        const ta = Date.parse(a.date || '') || 0;
        const tb = Date.parse(b.date || '') || 0;
        return tb - ta;
      });
      setList(mapped);
    } catch {}
  }, [getAuthHeaders, getCurrentUserName]);

  useFocusEffect(
    React.useCallback(() => {
      loadPrescriptions();
      loadUserData();
      return () => {};
    }, [loadPrescriptions, loadUserData]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPrescriptions();
    } finally {
      setRefreshing(false);
    }
  }, [loadPrescriptions]);

  const filtered = list.filter(item =>
    item.medicine.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const statusBadgeStyle = (status?: Prescription['status']) => {
    if (status === 'completed')
      return [styles.statusBadge, styles.statusCompleted];
    if (status === 'pending') return [styles.statusBadge, styles.statusPending];
    if (status === 'cancelled')
      return [styles.statusBadge, styles.statusCancelled];
    return [styles.statusBadge, styles.statusPending];
  };

  const renderItem = ({ item }: { item: Prescription }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        setSelected(item);
        setShowModal(true);
      }}
    >
      <View style={styles.iconCircle}>
        <Text style={{ fontSize: 18 }}>💊</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.medicine}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {item.dosage || item.instructions || '—'}
        </Text>
        <Text style={styles.cardMeta}>
          {formatDate(item.date)}
          {item.doctor ? ` • ${item.doctor}` : ''}
        </Text>
      </View>
      {!!item.status && (
        <View style={statusBadgeStyle(item.status)}>
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
          <Text style={styles.header}>My Prescriptions</Text>
        </View>

        {/* Search + Print */}
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { flex: 1, margin: 0 }]}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search medicine..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Image
              source={require('../../assets/search_icon.png')}
              style={styles.searchIcon}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity
            style={styles.printButton}
            onPress={handlePrint}
            activeOpacity={0.7}
          >
            <Image
              source={require('../../assets/print.png')}
              style={styles.printIcon}
              resizeMode="contain"
            />
            <Text style={styles.printButtonText}>Print</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No prescriptions found</Text>
            </View>
          }
        />
      </View>

      {/* Details Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 22, marginRight: 8 }}>💊</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selected?.medicine || 'Prescription'}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Date</Text>
              <Text style={styles.modalValue}>
                {selected ? formatDate(selected.date) : ''}
              </Text>
            </View>
            {!!selected?.doctor && (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Doctor</Text>
                <Text style={styles.modalValue}>{selected?.doctor}</Text>
              </View>
            )}
            {!!selected?.dosage && (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Dosage</Text>
                <Text style={styles.modalValue}>{selected?.dosage}</Text>
              </View>
            )}
            {!!selected?.instructions && (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Instructions</Text>
                <Text
                  style={[styles.modalValue, { flex: 1, textAlign: 'right' }]}
                  numberOfLines={3}
                >
                  {selected?.instructions}
                </Text>
              </View>
            )}
            <View style={[styles.modalRow, { alignItems: 'center' }]}>
              <Text style={styles.modalLabel}>Status</Text>
              {selected?.status ? (
                <View style={statusBadgeStyle(selected.status)}>
                  <Text style={styles.statusText}>
                    {selected.status.charAt(0).toUpperCase() +
                      selected.status.slice(1)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.modalValue}>N/A</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
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
          active={true}
          source={require('../../assets/prescription_icon.png')}
          onPress={() => {}}
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
  // Search + Print Row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  printButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
  },
  printButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  printIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    tintColor: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
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
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
    color: '#065F46',
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
  // Modal
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

export default PatientPrescription;
