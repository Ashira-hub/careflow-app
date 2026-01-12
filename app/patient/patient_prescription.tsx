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
  Platform,
  StatusBar,
  Modal,
  Share,
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

  const [searchQuery, setSearchQuery] = useState('');
  const [list, setList] = useState<Prescription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [showModal, setShowModal] = useState(false);
  const handlePrint = React.useCallback(async () => {
    try {
      const lines = (list || []).map((p, i) => {
        const d = new Date(p.date || '').toLocaleDateString();
        return `${i + 1}. ${p.medicine}${p.dosage ? ` (${p.dosage})` : ''}${
          p.instructions ? ` - ${p.instructions}` : ''
        }${p.doctor ? ` • Dr. ${p.doctor}` : ''} • ${d}${
          p.status ? ` • ${p.status}` : ''
        }`;
      });
      const message = lines.join('\n') || 'No prescriptions to print.';
      await Share.share({ message });
    } catch {}
  }, [list]);

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
      return () => {};
    }, [loadPrescriptions]),
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

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
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
    paddingVertical: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    height: '100%',
  },
  bottomImg: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  bottomLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
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
