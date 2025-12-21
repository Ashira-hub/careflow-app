import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar,
  Image,
  Alert,
  ToastAndroid,
} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initNotifications,
  scheduleAppointmentNotifications,
} from '../../utils/notifications';

const API_BASE = 'https://capstone-production-8af8.up.railway.app';

type Appointment = {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
};

type TabType = 'upcoming' | 'history';

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

const PatientAppointment = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [doctor, setDoctor] = useState('');
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showRemModal, setShowRemModal] = useState(false);
  const [remTarget, setRemTarget] = useState<{
    id?: string;
    date?: string;
    time?: string;
  } | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Appointment | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [resDateInput, setResDateInput] = useState('');
  const [resTimeInput, setResTimeInput] = useState('');
  const [showResDatePicker, setShowResDatePicker] = useState(false);
  const [showResTimePicker, setShowResTimePicker] = useState(false);

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

  const loadAppointments = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, { headers });
      if (!res.ok) return;
      const arr = await res.json();
      const myName = await getCurrentUserName();
      const myId = await getCurrentUserId();
      const list = Array.isArray(arr) ? arr : [];
      const nameMatches = (pRaw: string, meRaw: string) => {
        const p = pRaw.toLowerCase().trim();
        const me = meRaw.toLowerCase().trim();
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
      const mine = list.filter((a: any) => {
        const pid = a?.patientId ?? a?.patient_id;
        if (pid != null && myId != null) {
          return String(pid) === String(myId);
        }
        return nameMatches(String(a?.patient || ''), String(myName || ''));
      });
      const mapped: Appointment[] = mine.map((a: any) => ({
        id: String(
          a?.id ?? `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
        ),
        doctorName: String(a?.createdByName || a?.created_by_name || 'Doctor'),
        specialty: String(a?.specialty || ''),
        date: String(a?.date || ''),
        time: String(a?.time || ''),
        status: a?.done ? 'completed' : 'upcoming',
        notes: String(a?.notes || ''),
      }));
      setAppointments(mapped);
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, [getAuthHeaders, getCurrentUserName, getCurrentUserId]);

  useFocusEffect(
    React.useCallback(() => {
      loadAppointments();
      return () => {};
    }, [loadAppointments]),
  );

  React.useEffect(() => {
    initNotifications();
  }, []);

  React.useEffect(() => {
    if (route?.name === 'BookAppointment') {
      setIsModalVisible(true);
    }
  }, []);

  // Mock data - replace with actual data from your backend

  const handleAddAppointment = () => {
    setIsModalVisible(true);
  };

  const handleBookAppointment = () => {
    // Handle the appointment booking logic here
    console.log('Booking appointment with:', {
      doctor,
      date: selectedDate.toDateString(),
      time: selectedTime.toTimeString(),
      reason,
    });
    // Reset form and close modal
    setDoctor('');
    setReason('');
    setIsModalVisible(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setSelectedTime(selectedTime);
    }
  };

  const filteredAppointments = appointments.filter(
    appointment =>
      (activeTab === 'upcoming' && appointment.status === 'upcoming') ||
      (activeTab === 'history' && appointment.status === 'completed'),
  );

  const openReminder = (item: Appointment) => {
    setRemTarget({ id: item.id, date: item.date, time: item.time });
    setShowRemModal(true);
  };

  const onSetReminder = async (opts?: {
    near?: boolean;
    now?: boolean;
    customMinutes?: number;
  }) => {
    try {
      if (!remTarget?.date || !remTarget?.time) return setShowRemModal(false);
      const name = (await getCurrentUserName()) || 'You';
      await scheduleAppointmentNotifications(
        remTarget?.id ?? null,
        String(name),
        remTarget.date,
        remTarget.time,
        opts,
      );
    } catch {}
    setShowRemModal(false);
    setCustomMinutesInput('');
  };

  const openDetails = (item: Appointment) => {
    if (item.status !== 'upcoming') return;
    setDetailsTarget(item);
    setShowDetailsModal(true);
  };

  const cancelAppointment = async () => {
    try {
      const idStr = String(detailsTarget?.id || '');
      const idNum = parseInt(idStr, 10);
      if (!detailsTarget || !idStr || Number.isNaN(idNum)) return;
      Alert.alert(
        'Cancel Appointment',
        'Are you sure you want to cancel this appointment?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE}/api/appointments/${idNum}`, {
                  method: 'DELETE',
                  headers,
                });
                setShowDetailsModal(false);
                setDetailsTarget(null);
                loadAppointments();
                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    'Appointment cancelled',
                    ToastAndroid.SHORT,
                  );
                } else {
                  Alert.alert('Cancelled', 'Appointment cancelled');
                }
              } catch {}
            },
          },
        ],
      );
    } catch {}
  };

  const openReschedule = () => {
    if (!detailsTarget) return;
    setResDateInput(detailsTarget.date || '');
    setResTimeInput(detailsTarget.time || '');
    setShowResModal(true);
  };

  const saveReschedule = async () => {
    try {
      const idStr = String(detailsTarget?.id || '');
      const idNum = parseInt(idStr, 10);
      if (
        !detailsTarget ||
        !resDateInput ||
        !resTimeInput ||
        Number.isNaN(idNum)
      )
        return;
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/api/appointments/${idNum}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: resDateInput, time: resTimeInput }),
      });
      setShowResModal(false);
      setShowDetailsModal(false);
      setDetailsTarget(null);
      loadAppointments();
      if (Platform.OS === 'android') {
        ToastAndroid.show('Appointment rescheduled', ToastAndroid.SHORT);
      } else {
        Alert.alert('Rescheduled', 'Appointment rescheduled');
      }
    } catch {}
  };

  // Card actions that do not rely on detailsTarget state
  const cancelAppointmentFromCard = (item: Appointment) => {
    try {
      const idStr = String(item?.id || '');
      const idNum = parseInt(idStr, 10);
      if (!item || !idStr || Number.isNaN(idNum)) return;
      Alert.alert(
        'Cancel Appointment',
        'Are you sure you want to cancel this appointment?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE}/api/appointments/${idNum}`, {
                  method: 'DELETE',
                  headers,
                });
                loadAppointments();
                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    'Appointment cancelled',
                    ToastAndroid.SHORT,
                  );
                } else {
                  Alert.alert('Cancelled', 'Appointment cancelled');
                }
              } catch {}
            },
          },
        ],
      );
    } catch {}
  };

  const openRescheduleFromCard = (item: Appointment) => {
    if (!item) return;
    setDetailsTarget(item);
    setResDateInput(item.date || '');
    setResTimeInput(item.time || '');
    setShowResModal(true);
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={item.status === 'upcoming' ? () => openDetails(item) : undefined}
      style={styles.appointmentCard}
    >
      <View style={styles.appointmentHeader}>
        <Text style={styles.doctorName}>{item.doctorName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.status === 'upcoming' && (
            <TouchableOpacity
              onPress={() => openReminder(item)}
              style={{ marginRight: 8 }}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../assets/notification_icon.png')}
                style={{ width: 18, height: 18, tintColor: '#2563eb' }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          <View
            style={[
              styles.statusBadge,
              item.status === 'upcoming'
                ? styles.statusUpcoming
                : styles.statusCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.status === 'upcoming'
                  ? styles.statusUpcomingText
                  : styles.statusCompletedText,
              ]}
            >
              {item.status === 'upcoming' ? 'Upcoming' : 'Completed'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.specialty}>
        {item.specialty ? `${item.specialty} • ` : ''}
        Date: {item.date}
      </Text>
      <Text style={styles.specialty}>Time: {item.time}</Text>
      {item.status === 'upcoming' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => cancelAppointmentFromCard(item)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rescheduleButton}
            onPress={() => openRescheduleFromCard(item)}
          >
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Appointments</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'upcoming' && styles.activeTabText,
              ]}
            >
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'history' && styles.activeTabText,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appointment List */}
        <FlatList
          style={{ flex: 1 }}
          data={filteredAppointments}
          renderItem={renderAppointmentItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: (insets?.bottom || 0) + 100 },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={loadAppointments}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No {activeTab} appointments found
              </Text>
            </View>
          }
        />
      </View>

      {/* Book Appointment Modal */}
      <Modal
        visible={isModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book New Appointment</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Doctor's Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter doctor's name"
                value={doctor}
                onChangeText={setDoctor}
              />

              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>{selectedDate.toDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}

              <Text style={styles.label}>Time</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowTimePicker(true)}
              >
                <Text>
                  {selectedTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <Text style={styles.label}>Reason for Visit</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter reason for visit"
                multiline
                numberOfLines={4}
                value={reason}
                onChangeText={setReason}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={handleBookAppointment}
              >
                <Text style={styles.bookButtonText}>Book Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDetailsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Doctor</Text>
                  <Text style={styles.infoVal}>
                    {detailsTarget?.doctorName || '—'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Date</Text>
                  <Text style={styles.infoVal}>
                    {detailsTarget?.date || '—'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Time</Text>
                  <Text style={styles.infoVal}>
                    {detailsTarget?.time || '—'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Status</Text>
                  <Text style={styles.infoVal}>
                    {detailsTarget?.status || '—'}
                  </Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoKey}>Notes</Text>
                  <Text
                    style={[styles.infoVal, { flex: 1, textAlign: 'right' }]}
                    numberOfLines={3}
                  >
                    {detailsTarget?.notes || '—'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                {detailsTarget?.status === 'upcoming' && (
                  <>
                    <TouchableOpacity
                      style={[styles.dangerButton, { flex: 1 }]}
                      onPress={cancelAppointment}
                    >
                      <Text style={styles.dangerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <View style={{ width: 8 }} />
                    <TouchableOpacity
                      style={[styles.primaryButton, { flex: 1 }]}
                      onPress={openReschedule}
                    >
                      <Text style={styles.primaryButtonText}>Reschedule</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowResModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Appointment</Text>
              <TouchableOpacity onPress={() => setShowResModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>New Date</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowResDatePicker(true)}
              >
                <Text>{resDateInput || 'Select date'}</Text>
              </TouchableOpacity>
              {showResDatePicker && (
                <DateTimePicker
                  value={(() => {
                    const [y, m, d] = (resDateInput || '')
                      .split('-')
                      .map(x => parseInt(x, 10));
                    if (
                      !Number.isNaN(y) &&
                      !Number.isNaN(m) &&
                      !Number.isNaN(d)
                    ) {
                      return new Date(y, Math.max(0, m - 1), d);
                    }
                    return new Date();
                  })()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowResDatePicker(false);
                    if (selectedDate) {
                      const y = selectedDate.getFullYear();
                      const m = String(selectedDate.getMonth() + 1).padStart(
                        2,
                        '0',
                      );
                      const d = String(selectedDate.getDate()).padStart(2, '0');
                      setResDateInput(`${y}-${m}-${d}`);
                    }
                  }}
                />
              )}

              <Text style={styles.label}>New Time</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowResTimePicker(true)}
              >
                <Text>{resTimeInput || 'Select time'}</Text>
              </TouchableOpacity>
              {showResTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const now = new Date();
                    const [hh, mm] = (resTimeInput || '')
                      .split(':')
                      .map(x => parseInt(x, 10));
                    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
                      now.setHours(hh, mm, 0, 0);
                    }
                    return now;
                  })()}
                  mode="time"
                  display="default"
                  onChange={(event, selectedTime) => {
                    setShowResTimePicker(false);
                    if (selectedTime) {
                      const h = String(selectedTime.getHours()).padStart(
                        2,
                        '0',
                      );
                      const m = String(selectedTime.getMinutes()).padStart(
                        2,
                        '0',
                      );
                      setResTimeInput(`${h}:${m}`);
                    }
                  }}
                />
              )}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.bookButton, { backgroundColor: '#dc2626' }]}
                onPress={() => setShowResModal(false)}
              >
                <Text style={styles.bookButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={saveReschedule}
              >
                <Text style={styles.bookButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <TouchableOpacity onPress={() => setShowRemModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={[styles.bookButton, { backgroundColor: '#2563eb' }]}
                onPress={() => onSetReminder({ near: true, now: false })}
              >
                <Text style={styles.bookButtonText}>30 minutes before</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
              <TouchableOpacity
                style={[styles.bookButton, { backgroundColor: '#10B981' }]}
                onPress={() => onSetReminder({ near: false, now: true })}
              >
                <Text style={styles.bookButtonText}>At time</Text>
              </TouchableOpacity>
              <View style={{ height: 12 }} />
              <Text style={styles.label}>Custom minutes before</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 60"
                keyboardType="number-pad"
                value={customMinutesInput}
                onChangeText={setCustomMinutesInput}
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRemModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => {
                  const n = Number(customMinutesInput);
                  if (Number.isFinite(n) && n > 0)
                    onSetReminder({
                      near: false,
                      now: false,
                      customMinutes: Math.floor(n),
                    });
                }}
              >
                <Text style={styles.bookButtonText}>Set Custom</Text>
              </TouchableOpacity>
            </View>
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
          active={true}
          source={require('../../assets/appointment_icon.png')}
          onPress={() => {}}
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
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  activeTabText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusUpcoming: {
    backgroundColor: '#dbeafe',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusUpcomingText: {
    color: '#1d4ed8',
  },
  statusCompletedText: {
    color: '#15803d',
  },
  specialty: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  appointmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  rescheduleButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  rescheduleButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    fontSize: 24,
    color: '#64748b',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  label: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  dateTimeInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bookButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginLeft: 12,
  },
  bookButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Details Modal - Info Card
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoKey: {
    fontSize: 14,
    color: '#64748b',
  },
  infoVal: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginLeft: 12,
  },
  // Button variants for modal footer
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  neutralButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutralButtonText: {
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerButtonText: {
    color: '#dc2626',
    fontWeight: '600',
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
    height: 80, // Increased height to accommodate labels
    paddingBottom: 10, // Added bottom padding for better spacing
  },
  bottomItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8, // Increased vertical padding
    height: '100%', // Ensure it takes full height of parent
  },
  bottomImg: {
    width: 24,
    height: 24,
    marginBottom: 4, // Reset to positive margin for proper spacing
  },
  bottomLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default PatientAppointment;
