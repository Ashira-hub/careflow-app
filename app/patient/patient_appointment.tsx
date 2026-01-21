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

const API_BASE = 'https://backend-careflow.vercel.app';

type Appointment = {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
};

type DoctorOption = {
  id: string | number;
  full_name: string;
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
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [doctor, setDoctor] = useState('');
  const [doctorUserId, setDoctorUserId] = useState<string | number | undefined>(
    undefined,
  );
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showRemModal, setShowRemModal] = useState(false);
  const [remTarget, setRemTarget] = useState<{
    id?: string;
    date?: string;
    time?: string;
  } | null>(null);
  const [customReminderTime, setCustomReminderTime] = useState<Date>(
    new Date(),
  );
  const [showCustomReminderPicker, setShowCustomReminderPicker] =
    useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Appointment | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [resTarget, setResTarget] = useState<Appointment | null>(null);
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
        setUserName(String(derivedName || 'Patient'));
        const rawRole = user?.role || user?.role_name || user?.roleName;
        const roleStr = String(rawRole || '').trim();
        const displayRole = roleStr
          ? roleStr.charAt(0).toUpperCase() + roleStr.slice(1)
          : 'Patient';
        setUserRole(displayRole);
      }
    } catch {}
  }, []);

  const nameMatches = React.useCallback((pRaw: string, meRaw: string) => {
    const p = String(pRaw || '')
      .toLowerCase()
      .trim();
    const me = String(meRaw || '')
      .toLowerCase()
      .trim();
    if (!p || !me) return false;
    if (p === me) return true;
    const meTokens = me.split(/\s+/).filter(Boolean);
    if (meTokens.length > 0 && meTokens.every(t => p.includes(t))) return true;
    const pTokens = p.split(/\s+/).filter(Boolean);
    if (pTokens.length > 0 && pTokens.every(t => me.includes(t))) return true;
    return false;
  }, []);

  const formatYmd = React.useCallback((d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const formatTime12h = React.useCallback((d: Date) => {
    const hours24 = d.getHours();
    const minutes = d.getMinutes();
    const ap = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const hh = String(hours12).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm} ${ap}`;
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
  }, [getAuthHeaders, getCurrentUserName, getCurrentUserId, nameMatches]);

  React.useEffect(() => {
    if (!isModalVisible) return;
    (async () => {
      setDoctorsLoading(true);
      try {
        const headers = await getAuthHeaders();

        const tryFetch = async (url: string) => {
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        };

        let data: any;
        try {
          data = await tryFetch(`${API_BASE}/api/doctors`);
        } catch {
          try {
            data = await tryFetch(`${API_BASE}/api/users?role=doctor`);
          } catch {
            try {
              data = await tryFetch(`${API_BASE}/api/users?role=Doctor`);
            } catch {
              data = await tryFetch(`${API_BASE}/api/users`);
            }
          }
        }

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.doctors)
          ? data.doctors
          : Array.isArray(data?.users)
          ? data.users
          : [];

        const toFullName = (u: any) => {
          const full =
            u?.full_name ||
            u?.fullName ||
            u?.name ||
            u?.username ||
            [u?.firstName, u?.lastName].filter(Boolean).join(' ');
          return String(full || '').trim();
        };
        const toId = (u: any) => u?.id ?? u?.user_id ?? u?.userId ?? u?.uid;

        const roleFiltered = list.filter((u: any) => {
          const r = String(u?.role || u?.role_name || u?.roleName || '')
            .toLowerCase()
            .trim();
          return r ? r === 'doctor' : true;
        });

        const source = roleFiltered.length > 0 ? roleFiltered : list;
        const options = source
          .map((u: any) => {
            const full_name = toFullName(u);
            const id = toId(u);
            const stableId =
              id != null && String(id).trim().length > 0 ? id : full_name;
            return {
              id: stableId,
              full_name,
            } as DoctorOption;
          })
          .filter((x: DoctorOption) =>
            Boolean(String(x.full_name || '').trim()),
          );

        const byId = new Map<string, DoctorOption>();
        for (const opt of options) {
          const key = String(opt.id);
          if (!byId.has(key)) byId.set(key, opt);
        }

        const finalOptions = Array.from(byId.values()).sort((a, b) =>
          String(a.full_name).localeCompare(String(b.full_name)),
        );

        setDoctors(finalOptions);
      } catch {
        setDoctors([]);
      } finally {
        setDoctorsLoading(false);
      }
    })();
  }, [getAuthHeaders, isModalVisible]);

  useFocusEffect(
    React.useCallback(() => {
      loadAppointments();
      loadUserData();
      return () => {};
    }, [loadAppointments, loadUserData]),
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

  const handleBookAppointment = async () => {
    try {
      const doc = String(doctor || '').trim();
      const docId = doctorUserId;
      const notes = String(reason || '').trim();
      if (!doc) {
        Alert.alert('Validation', "Please enter the doctor's name.");
        return;
      }
      if (!notes) {
        Alert.alert('Validation', 'Please enter the reason for visit.');
        return;
      }
      const date = formatYmd(selectedDate);
      const time = formatTime12h(selectedTime);
      const patientName = (await getCurrentUserName()) || 'Patient';
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patient: patientName,
          date,
          time,
          notes,
          done: false,
          createdByName: doc,
          created_by_name: doc,
          doctorName: doc,
          doctor_user_id: docId,
          doctorUserId: docId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Best-effort: notify the selected doctor via backend notifications endpoint (if supported)
      try {
        const msgBase = `New appointment request from ${patientName} (${date} ${time}).`;
        const message = notes ? `${msgBase} ${notes}` : msgBase;
        await fetch(`${API_BASE}/api/notifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: 'Appointment Request',
            message,
            toName: doc,
            recipientName: doc,
            doctorName: doc,
            user_id: docId,
            recipientId: docId,
          }),
        });
      } catch {}

      setDoctor('');
      setDoctorUserId(undefined);
      setReason('');
      setIsModalVisible(false);
      loadAppointments();
      if (Platform.OS === 'android') {
        ToastAndroid.show('Appointment booked', ToastAndroid.SHORT);
      } else {
        Alert.alert('Booked', 'Appointment booked');
      }
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Failed to book appointment: ${e?.message || 'Network error'}`,
      );
    }
  };

  const filteredAppointments = appointments.filter(
    appointment =>
      (activeTab === 'upcoming' && appointment.status === 'upcoming') ||
      (activeTab === 'history' && appointment.status === 'completed'),
  );

  const openReminder = (item: Appointment) => {
    setRemTarget({ id: item.id, date: item.date, time: item.time });
    try {
      const [y, m, d] = String(item.date || '')
        .split('-')
        .map(Number);
      const [hhmm, ap] = String(item.time || '').split(' ');
      const [hhStr, mmStr] = String(hhmm || '').split(':');
      const hh = Number(hhStr);
      const mm = Number(mmStr);
      if (
        Number.isFinite(y) &&
        Number.isFinite(m) &&
        Number.isFinite(d) &&
        Number.isFinite(hh) &&
        Number.isFinite(mm)
      ) {
        const h24 = (hh % 12) + (String(ap).toUpperCase() === 'PM' ? 12 : 0);
        const appt = new Date(y, m - 1, d, h24, mm, 0, 0);
        const suggested = new Date(appt.getTime() - 30 * 60 * 1000);
        setCustomReminderTime(suggested);
      }
    } catch {}
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
    setShowCustomReminderPicker(false);
  };

  const setCustomReminderFromSelectedTime = React.useCallback(async () => {
    try {
      if (!remTarget?.date || !remTarget?.time) return;
      const [y, m, d] = String(remTarget.date || '')
        .split('-')
        .map(Number);
      const [hhmm, ap] = String(remTarget.time || '').split(' ');
      const [hhStr, mmStr] = String(hhmm || '').split(':');
      const hh = Number(hhStr);
      const mm = Number(mmStr);
      if (
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d) ||
        !Number.isFinite(hh) ||
        !Number.isFinite(mm)
      ) {
        return;
      }
      const h24 = (hh % 12) + (String(ap).toUpperCase() === 'PM' ? 12 : 0);
      const appt = new Date(y, m - 1, d, h24, mm, 0, 0);
      const chosen = new Date(
        y,
        m - 1,
        d,
        customReminderTime.getHours(),
        customReminderTime.getMinutes(),
        0,
        0,
      );
      const nowTs = Date.now();
      if (chosen.getTime() <= nowTs) {
        Alert.alert('Invalid time', 'Please select a future reminder time.');
        return;
      }
      if (chosen.getTime() >= appt.getTime()) {
        Alert.alert(
          'Invalid time',
          'Reminder time must be before the appointment time.',
        );
        return;
      }
      const diffMinutes = Math.ceil(
        (appt.getTime() - chosen.getTime()) / 60000,
      );
      if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) {
        Alert.alert('Invalid time', 'Please select a valid reminder time.');
        return;
      }
      await onSetReminder({
        near: false,
        now: false,
        customMinutes: diffMinutes,
      });
    } catch {}
  }, [customReminderTime, onSetReminder, remTarget]);

  const openDetails = (item: Appointment) => {
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
      onPress={() => openDetails(item)}
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
                style={{ width: 18, height: 18, tintColor: '#111827' }}
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
          <Text style={styles.header}>Appointments</Text>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.8}
            onPress={handleAddAppointment}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
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
              <Text style={styles.modalTitle}>Request Appointment</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Doctor's Name</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                activeOpacity={0.8}
                onPress={() => setShowDoctorPicker(true)}
              >
                <View style={styles.doctorSelectRow}>
                  <Text style={styles.doctorSelectText}>
                    {doctor || 'Select doctor'}
                  </Text>
                  <Image
                    source={require('../../assets/dropdown.png')}
                    style={styles.doctorSelectIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>Description</Text>
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
                <Text style={styles.bookButtonText}>Request Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDoctorPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDoctorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Doctor</Text>
              <TouchableOpacity onPress={() => setShowDoctorPicker(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {doctorsLoading ? (
                <Text style={styles.scheduleHint}>Loading doctors...</Text>
              ) : doctors.length > 0 ? (
                <FlatList
                  data={doctors}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.doctorPickerItem}
                      activeOpacity={0.8}
                      onPress={() => {
                        setDoctor(String(item.full_name || ''));
                        setDoctorUserId(item.id);
                        setShowDoctorPicker(false);
                      }}
                    >
                      <Text style={styles.doctorPickerItemText}>
                        {String(item.full_name || '')}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.scheduleHint}>No doctors found.</Text>
              )}
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
                <View style={styles.rescheduleInputRow}>
                  <Text style={styles.rescheduleInputText}>
                    {resDateInput || 'Select date'}
                  </Text>
                  <Image
                    source={require('../../assets/appointment_icon.png')}
                    style={styles.rescheduleInputIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
              {showResDatePicker && (
                <DateTimePicker
                  value={(() => {
                    const [y, m, d] = (resDateInput || '')
                      .split('-')
                      .map((x: string) => parseInt(x, 10));
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
                <View style={styles.rescheduleInputRow}>
                  <Text style={styles.rescheduleInputText}>
                    {resTimeInput || 'Select time'}
                  </Text>
                  <Image
                    source={require('../../assets/time_icon.png')}
                    style={styles.rescheduleInputIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
              {showResTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const now = new Date();
                    const [hh, mm] = (resTimeInput || '')
                      .split(':')
                      .map((x: string) => parseInt(x, 10));
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
              <Text style={styles.modalTitle}>Custom Reminder</Text>
              <TouchableOpacity onPress={() => setShowRemModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Select reminder time</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowCustomReminderPicker(true)}
              >
                <View style={styles.customReminderTimeRow}>
                  <Text style={styles.customReminderTimeText}>
                    {formatTime12h(customReminderTime)}
                  </Text>
                  <Image
                    source={require('../../assets/time_icon.png')}
                    style={styles.customReminderTimeIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
              {showCustomReminderPicker && (
                <DateTimePicker
                  value={customReminderTime}
                  mode="time"
                  display="default"
                  onChange={(event, selectedTime) => {
                    setShowCustomReminderPicker(false);
                    if (selectedTime) {
                      setCustomReminderTime(selectedTime);
                    }
                  }}
                />
              )}
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
                onPress={setCustomReminderFromSelectedTime}
              >
                <Text style={styles.bookButtonText}>Set Reminder</Text>
              </TouchableOpacity>
            </View>
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
  headerBookButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  headerBookButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
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
    color: '#10B981',
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
    backgroundColor: '#F3F4F6',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusUpcomingText: {
    color: '#111827',
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
    backgroundColor: '#ECFDF5',
  },
  rescheduleButtonText: {
    color: '#10B981',
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
  customReminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customReminderTimeIcon: {
    width: 18,
    height: 18,
    tintColor: '#111827',
  },
  customReminderTimeText: {
    color: '#111827',
  },
  rescheduleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rescheduleInputText: {
    color: '#111827',
  },
  rescheduleInputIcon: {
    width: 18,
    height: 18,
    tintColor: '#111827',
  },
  doctorSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorSelectText: {
    color: '#111827',
    flex: 1,
    paddingRight: 12,
  },
  doctorSelectIcon: {
    width: 16,
    height: 16,
    tintColor: '#111827',
  },
  doctorPickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  doctorPickerItemText: {
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  scheduleCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  scheduleSubTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  scheduleHint: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
  },
  slotWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slotChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    marginRight: 8,
    marginBottom: 8,
  },
  slotChipBooked: {
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
  },
  slotChipActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  slotChipText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  slotChipTextBooked: {
    color: '#dc2626',
  },
  slotChipTextActive: {
    color: '#10B981',
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
  bookButton: {
    backgroundColor: '#10B981',
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
    backgroundColor: '#10B981',
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80, // Increased height to accommodate labels
  },
  bottomItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 0, // Increased vertical padding
    height: '100%', // Ensure it takes full height of parent
  },
  bottomImg: {
    width: 28,
    height: 28,
    marginBottom: 4, // Reset to positive margin for proper spacing
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

export default PatientAppointment;
