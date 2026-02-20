import React, { useMemo, useState } from 'react';
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
  status: 'pending' | 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
};

type ScheduleSlot = {
  id: string;
  doctorName: string;
  doctorUserId?: string | number;
  date: string;
  time: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
};

type DoctorOption = {
  id: string | number;
  name: string;
  full_name?: string;
  specialty?: string;
};

type TabType = 'upcoming' | 'history';
type UpcomingFilter = 'upcoming' | 'pending';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [upcomingFilter, setUpcomingFilter] =
    useState<UpcomingFilter>('upcoming');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [doctor, setDoctor] = useState('');
  const [doctorUserId, setDoctorUserId] = useState<string | number | undefined>(
    undefined,
  );
  const [specialization, setSpecialization] = useState('');
  const [showSpecializationPicker, setShowSpecializationPicker] =
    useState(false);
  const [scheduleDay, setScheduleDay] = useState('');
  const [showScheduleDayPicker, setShowScheduleDayPicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);
  const [bookedSlotKeys, setBookedSlotKeys] = useState<string[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleSlot | null>(
    null,
  );
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = React.useRef<any>(null);
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

  const specializationOptions = useMemo(
    () => [
      'General Medicine',
      'Family Medicine',
      'Pediatrics',
      'Internal Medicine',
      'Obstetrics and Gynecology',
      'Cardiology',
      'Dermatology',
      'Neurology',
      'Orthopedics',
      'Ophthalmology',
      'ENT',
      'Psychiatry',
      'Radiology',
      'Anesthesiology',
      'Emergency Medicine',
      'Surgery',
      'Urology',
      'Nephrology',
      'Pulmonology',
      'Gastroenterology',
    ],
    [],
  );

  const scheduleDayOptions = useMemo(() => {
    const uniq = new Set<string>();
    for (const s of scheduleSlots || []) {
      const d = String((s as any)?.date || '').trim();
      if (d) uniq.add(d);
    }
    return Array.from(uniq).sort((a, b) => String(a).localeCompare(String(b)));
  }, [scheduleSlots]);

  const [scheduleCalendarCurrent, setScheduleCalendarCurrent] = useState<Date>(
    new Date(),
  );

  const scheduleAvailableDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const d of scheduleDayOptions || []) {
      const key = String(d || '').trim();
      if (key) s.add(key);
    }
    return s;
  }, [scheduleDayOptions]);

  const scheduleCalYear = scheduleCalendarCurrent.getFullYear();
  const scheduleCalMonth = scheduleCalendarCurrent.getMonth();

  const scheduleCalMonthNames = useMemo(
    () => [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    [],
  );

  const scheduleCalMonthMatrix = useMemo(() => {
    const first = new Date(scheduleCalYear, scheduleCalMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(
      scheduleCalYear,
      scheduleCalMonth + 1,
      0,
    ).getDate();
    const weeks: Array<Array<number | null>> = [];
    let cur = 1;
    for (let r = 0; r < 6; r++) {
      const row: Array<number | null> = [];
      for (let c = 0; c < 7; c++) {
        if (r === 0 && c < startDow) {
          row.push(null);
        } else if (cur > daysInMonth) {
          row.push(null);
        } else {
          row.push(cur);
          cur++;
        }
      }
      weeks.push(row);
      if (cur > daysInMonth) break;
    }
    return weeks;
  }, [scheduleCalMonth, scheduleCalYear]);

  const scheduleCalIsPastYmd = React.useCallback((ymd: string) => {
    try {
      const [y, m, d] = String(ymd || '')
        .split('-')
        .map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
        return false;
      const dt = new Date(y, (m || 1) - 1, d || 1);
      const now = new Date();
      const startToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      return dt < startToday;
    } catch {
      return false;
    }
  }, []);

  const minutesToTime12 = React.useCallback((mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const hh = String(h12).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm} ${ap}`;
  }, []);

  const time12ToMinutes = React.useCallback((t: string) => {
    const raw = String(t || '').trim();
    if (!raw) return null;
    const parts = raw.split(' ');
    const hhmm = parts[0] || '';
    const ap = String(parts[1] || '').toUpperCase();
    const [hhStr, mmStr] = hhmm.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const base = hh % 12;
    const h24 = base + (ap === 'PM' ? 12 : 0);
    return h24 * 60 + mm;
  }, []);

  const minutesToTimeCompact = React.useCallback((mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h24 >= 12 ? 'pm' : 'am';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mm = String(m).padStart(2, '0');
    return `${h12}:${mm}${ap}`;
  }, []);

  const getTimeRangeLabel = React.useCallback(
    (startTime: string) => {
      const startMins = time12ToMinutes(startTime);
      if (startMins == null) return String(startTime || '');
      const endMins = startMins + 30;
      return `${minutesToTimeCompact(startMins)} - ${minutesToTimeCompact(
        endMins,
      )}`;
    },
    [minutesToTimeCompact, time12ToMinutes],
  );

  const availableScheduleTimeOptions = useMemo(() => {
    const date = String(scheduleDay || '').trim();
    if (!date) return [];

    const uniq = new Set<string>();
    for (const s of scheduleSlots || []) {
      if (String((s as any)?.date || '').trim() !== date) continue;
      const t = String((s as any)?.start_time || (s as any)?.time || '').trim();
      if (t) uniq.add(t);
    }
    const out = Array.from(uniq);
    out.sort((a, b) => {
      const am = time12ToMinutes(String(a || '').trim());
      const bm = time12ToMinutes(String(b || '').trim());
      if (am == null && bm == null) return 0;
      if (am == null) return 1;
      if (bm == null) return -1;
      return am - bm;
    });
    return out;
  }, [scheduleDay, scheduleSlots, time12ToMinutes]);

  const filteredDoctors = useMemo(() => {
    const spec = String(specialization || '')
      .trim()
      .toLowerCase();
    const list = Array.isArray(doctors) ? doctors : [];
    if (!spec) return list;
    return list.filter(
      d =>
        String(d?.specialty || '')
          .trim()
          .toLowerCase() === spec,
    );
  }, [doctors, specialization]);

  const bookedSlotSet = useMemo(() => {
    const s = new Set<string>();
    for (const k of bookedSlotKeys || []) {
      const key = String(k || '').trim();
      if (key) s.add(key);
    }
    return s;
  }, [bookedSlotKeys]);

  const loadAppointments = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) setRefreshing(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/appointments`, { headers });
        if (!res.ok) {
          if (!silent) {
            Alert.alert(
              'Error',
              `Failed to load appointments (HTTP ${res.status}).`,
            );
          }
          return;
        }
        const arr = await res.json();
        const myName = await getCurrentUserName();
        const myId = await getCurrentUserId();
        const list = Array.isArray(arr) ? arr : [];
        const mine = list.filter((a: any) => {
          const pid =
            a?.patientId ?? a?.patient_id ?? a?.patientID ?? a?.patientIdNumber;
          if (pid != null && myId != null) {
            return String(pid) === String(myId);
          }

          const patientName =
            a?.patient ??
            a?.patient_name ??
            a?.patientName ??
            a?.patient_full_name ??
            a?.patientFullName;
          return nameMatches(String(patientName || ''), String(myName || ''));
        });
        const mapped: Appointment[] = mine.map((a: any) => ({
          id: String(
            a?.id ?? `${a?.patient || ''}-${a?.date || ''}-${a?.time || ''}`,
          ),
          doctorName: String(
            a?.createdByName || a?.created_by_name || a?.doctorName || 'Doctor',
          ),
          specialty: String(a?.specialty || ''),
          date: String(a?.date || ''),
          time: String(a?.time || ''),
          status: a?.done
            ? 'completed'
            : String(a?.status || '').toLowerCase() === 'accepted'
            ? 'upcoming'
            : 'pending',
          notes: String(a?.notes || ''),
        }));
        setAppointments(mapped);
      } catch {
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [getAuthHeaders, getCurrentUserName, getCurrentUserId, nameMatches],
  );

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
        const toSpecialty = (u: any) =>
          String(u?.specialty || u?.specialization || '').trim();

        const roleFiltered = list.filter((u: any) => {
          const r = String(u?.role || u?.role_name || u?.roleName || '')
            .toLowerCase()
            .trim();
          return r ? r === 'doctor' : true;
        });

        const source = roleFiltered.length > 0 ? roleFiltered : list;
        const options: DoctorOption[] = source
          .map((u: any) => {
            const full_name = toFullName(u);
            const id = toId(u);
            const specialty = toSpecialty(u);
            const stableId =
              id != null && String(id).trim().length > 0 ? id : full_name;
            return {
              id: stableId,
              name: full_name,
              full_name,
              specialty,
            };
          })
          .filter((x: DoctorOption) => Boolean(String(x.name || '').trim()));

        const byId = new Map<string, DoctorOption>();
        for (const opt of options) {
          const key = String(opt.id);
          if (!byId.has(key)) byId.set(key, opt);
        }

        let finalOptions = Array.from(byId.values()).sort((a, b) =>
          String(a.name).localeCompare(String(b.name)),
        );

        // Backfill doctor specialties if the list endpoint didn't include it
        try {
          const needIds = finalOptions
            .filter(o => !String(o?.specialty || '').trim())
            .map(o => o?.id)
            .filter((id: any) => id != null && String(id).trim().length > 0);

          if (needIds.length > 0) {
            const details = await Promise.allSettled(
              needIds.map((id: any) => tryFetch(`${API_BASE}/api/users/${id}`)),
            );

            const byIdDetails = new Map<string, any>();
            for (let i = 0; i < needIds.length; i++) {
              const r = details[i];
              if (r.status === 'fulfilled') {
                byIdDetails.set(String(needIds[i]), r.value);
              }
            }

            finalOptions = finalOptions.map(o => {
              const det = byIdDetails.get(String(o.id));
              const spec = String(det?.specialty || '').trim();
              return spec ? { ...o, specialty: spec } : o;
            });
          }
        } catch {}

        setDoctors(finalOptions);
      } catch {
        setDoctors([]);
      } finally {
        setDoctorsLoading(false);
      }
    })();
  }, [getAuthHeaders, isModalVisible]);

  const loadDoctorSchedules = React.useCallback(async () => {
    try {
      const docName = String(doctor || '').trim();
      const docId = doctorUserId;
      if (!docName && docId == null) {
        setScheduleSlots([]);
        setSelectedSchedule(null);
        return;
      }
      setScheduleLoading(true);
      const headers = await getAuthHeaders();
      const qs =
        docId != null && String(docId).trim().length > 0
          ? `doctor_user_id=${encodeURIComponent(String(docId))}`
          : `doctor_name=${encodeURIComponent(String(docName))}`;
      const res = await fetch(
        `${API_BASE}/api/schedule-slots?${qs}&available=1`,
        { headers },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      const list = Array.isArray(arr) ? arr : [];

      const now = new Date();
      const startToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const slots: ScheduleSlot[] = list
        .filter((a: any) => {
          const booked = Boolean(a?.is_booked);
          const status = String(a?.status || '')
            .toLowerCase()
            .trim();
          if (booked) return false;
          if (status && status !== 'available' && status !== 'schedule')
            return false;
          return true;
        })
        .map((a: any) => {
          const id = String(a?.id ?? `${a?.date || ''}-${a?.time || ''}`);
          const date = String(a?.date || '');
          const start_time = String(a?.start_time || a?.startTime || '').trim();
          const end_time = String(a?.end_time || a?.endTime || '').trim();
          const time =
            start_time || String(a?.time || '').trim() || String(a?.time || '');
          const doctorName = String(a?.doctor_name || a?.doctorName || docName);
          const aDocId = a?.doctor_user_id ?? a?.doctorUserId;
          return {
            id,
            doctorName: doctorName || docName,
            doctorUserId: aDocId ?? docId,
            date,
            time,
            start_time: start_time || undefined,
            end_time: end_time || undefined,
            notes: String(a?.notes || '').trim() || undefined,
          } as ScheduleSlot;
        })
        .filter((s: ScheduleSlot) => {
          try {
            const [y, m, d] = String(s.date || '')
              .split('-')
              .map(Number);
            if (
              !Number.isFinite(y) ||
              !Number.isFinite(m) ||
              !Number.isFinite(d)
            )
              return true;
            const dt = new Date(y, (m || 1) - 1, d || 1);
            return dt >= startToday;
          } catch {
            return true;
          }
        })
        .sort((a: ScheduleSlot, b: ScheduleSlot) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
        );

      setScheduleSlots(slots);

      setSelectedSchedule(prev => {
        if (!prev) return null;
        const keep = slots.find(s => String(s.id) === String(prev.id));
        return keep || null;
      });
    } catch {
      setScheduleSlots([]);
      setSelectedSchedule(null);
    } finally {
      setScheduleLoading(false);
    }
  }, [doctor, doctorUserId, getAuthHeaders, nameMatches]);

  React.useEffect(() => {
    if (!isModalVisible) return;
    loadDoctorSchedules();
  }, [doctor, doctorUserId, isModalVisible, loadDoctorSchedules]);

  React.useEffect(() => {
    if (!isModalVisible) return;
    const docName = String(doctor || '').trim();
    const docId = doctorUserId;
    if (!docName && docId == null) {
      setBookedSlotKeys([]);
      return;
    }

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/appointments`, { headers });
        if (!res.ok) return;
        const arr = await res.json();
        const list = Array.isArray(arr) ? arr : [];

        const isRealBookedAppointment = (a: any) => {
          if (Boolean(a?.done)) return false;

          const status = String(a?.status || '')
            .toLowerCase()
            .trim();
          // Only treat these as blocking a slot for booking
          if (status !== 'pending' && status !== 'accepted') return false;

          const isScheduleFlag =
            a?.is_schedule === true || a?.isSchedule === true;
          if (isScheduleFlag) return false;

          const patient = String(a?.patient || '')
            .trim()
            .toLowerCase();
          if (!patient) return false;
          if (patient === 'available slot' || patient === 'available')
            return false;

          return true;
        };

        const matchesDoctor = (a: any) => {
          const aDocId = a?.doctor_user_id ?? a?.doctorUserId;
          if (docId != null && aDocId != null) {
            return String(aDocId) === String(docId);
          }
          const createdBy = String(
            a?.createdByName || a?.created_by_name || '',
          );
          if (docName && createdBy) return nameMatches(createdBy, docName);
          return false;
        };

        const keys: string[] = [];
        for (const a of list) {
          if (!matchesDoctor(a)) continue;
          if (!isRealBookedAppointment(a)) continue;
          const date = String(a?.date || '').trim();
          const time = String(a?.time || '').trim();
          if (!date || !time) continue;
          keys.push(`${date}|${time}`);
        }

        setBookedSlotKeys(Array.from(new Set(keys)));
      } catch {
        setBookedSlotKeys([]);
      }
    })();
  }, [doctor, doctorUserId, getAuthHeaders, isModalVisible, nameMatches]);

  React.useEffect(() => {
    if (!isModalVisible) return;
    const docName = String(doctor || '').trim();
    const docId = doctorUserId;
    if (!docName && docId == null) {
      setScheduleDay('');
      setScheduleTime('');
      setSelectedSchedule(null);
      return;
    }

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const qs =
          docId != null && String(docId).trim().length > 0
            ? `doctor_user_id=${encodeURIComponent(String(docId))}`
            : `doctor_name=${encodeURIComponent(String(docName))}`;
        const res = await fetch(
          `${API_BASE}/api/schedule-slots?${qs}&available=1`,
          { headers },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.json();
        const list = Array.isArray(arr) ? arr : [];

        const now = new Date();
        const startToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

        const slots: ScheduleSlot[] = list
          .filter((a: any) => {
            const booked = Boolean(a?.is_booked);
            const status = String(a?.status || '')
              .toLowerCase()
              .trim();
            if (booked) return false;
            if (status && status !== 'available' && status !== 'schedule')
              return false;
            return true;
          })
          .map((a: any) => {
            const id = String(a?.id ?? `${a?.date || ''}-${a?.time || ''}`);
            const date = String(a?.date || '');
            const start_time = String(
              a?.start_time || a?.startTime || '',
            ).trim();
            const end_time = String(a?.end_time || a?.endTime || '').trim();
            const time =
              start_time ||
              String(a?.time || '').trim() ||
              String(a?.time || '');
            const doctorName = String(
              a?.doctor_name || a?.doctorName || docName,
            );
            const aDocId = a?.doctor_user_id ?? a?.doctorUserId;
            return {
              id,
              doctorName: doctorName || docName,
              doctorUserId: aDocId ?? docId,
              date,
              time,
              start_time: start_time || undefined,
              end_time: end_time || undefined,
              notes: String(a?.notes || '').trim() || undefined,
            } as ScheduleSlot;
          })
          .filter((s: ScheduleSlot) => {
            try {
              const [y, m, d] = String(s.date || '')
                .split('-')
                .map(Number);
              if (
                !Number.isFinite(y) ||
                !Number.isFinite(m) ||
                !Number.isFinite(d)
              )
                return true;
              const dt = new Date(y, (m || 1) - 1, d || 1);
              return dt >= startToday;
            } catch {
              return true;
            }
          })
          .sort((a: ScheduleSlot, b: ScheduleSlot) =>
            `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
          );

        setScheduleSlots(slots);

        setSelectedSchedule(prev => {
          if (!prev) return null;
          const keep = slots.find(s => String(s.id) === String(prev.id));
          return keep || null;
        });
      } catch {
        setScheduleSlots([]);
        setSelectedSchedule(null);
      }
    })();
  }, [doctor, doctorUserId, getAuthHeaders, isModalVisible]);

  React.useEffect(() => {
    if (selectedSchedule) return;
    const cur = String(scheduleTime || '').trim();
    if (!cur) return;
    if (!(availableScheduleTimeOptions || []).includes(cur)) {
      setScheduleTime('');
    }
  }, [availableScheduleTimeOptions, scheduleTime, selectedSchedule]);

  React.useEffect(() => {
    if (selectedSchedule) return;
    const date = String(scheduleDay || '').trim();
    const time = String(scheduleTime || '').trim();
    if (!date || !time) return;
    const slot = (scheduleSlots || []).find(s => {
      const d = String((s as any)?.date || '').trim();
      const t = String((s as any)?.start_time || (s as any)?.time || '').trim();
      return d === date && t === time;
    });
    if (slot) setSelectedSchedule(slot);
  }, [scheduleDay, scheduleSlots, scheduleTime, selectedSchedule]);

  useFocusEffect(
    React.useCallback(() => {
      loadAppointments();
      loadUserData();
      syncUnread();
      try {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      } catch {}
      refreshTimerRef.current = setInterval(() => {
        try {
          loadAppointments({ silent: true });
          syncUnread();
        } catch {}
      }, 8000);
      return () => {
        try {
          if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
        } catch {}
      };
    }, [loadAppointments, loadUserData, syncUnread]),
  );

  React.useEffect(() => {
    initNotifications();
  }, []);

  React.useEffect(() => {
    if (route?.name === 'BookAppointment') {
      setSelectedSchedule(null);
      setScheduleSlots([]);
      setIsModalVisible(true);
    }
  }, []);

  // Mock data - replace with actual data from your backend

  const handleAddAppointment = () => {
    setSelectedSchedule(null);
    setScheduleSlots([]);
    setSpecialization('');
    setScheduleDay('');
    setScheduleTime('');
    setDoctor('');
    setDoctorUserId(undefined);
    setIsModalVisible(true);
  };

  const handleBookAppointment = async () => {
    try {
      const doc = String(doctor || '').trim();
      const docId = doctorUserId;
      const notes = String(reason || '').trim();
      const spec = String(specialization || '').trim();
      const day = String(scheduleDay || '').trim();
      const tm = String(scheduleTime || '').trim();
      if (!doc) {
        Alert.alert('Validation', "Please enter the doctor's name.");
        return;
      }
      if (!spec) {
        Alert.alert('Validation', 'Please select a specialization.');
        return;
      }
      if (!selectedSchedule) {
        Alert.alert('Validation', 'Please select an available schedule slot.');
        return;
      }
      if (!notes) {
        Alert.alert('Validation', 'Please enter the reason for visit.');
        return;
      }

      const date = String(selectedSchedule?.date || '').trim();
      const time = String(
        selectedSchedule?.start_time || selectedSchedule?.time || '',
      ).trim();
      if (!date || !time) {
        Alert.alert('Validation', 'Selected schedule slot is invalid.');
        return;
      }

      const slotKey = `${date}|${time}`;
      if (bookedSlotSet.has(slotKey)) {
        Alert.alert(
          'Not available',
          'This time slot is already requested/booked. Please select another available time.',
        );
        return;
      }

      const patientName = (await getCurrentUserName()) || 'Patient';
      const patientId = await getCurrentUserId();
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patient: patientName,
          patient_id: patientId,
          patientId,
          date,
          time,
          specialty: spec,
          notes,
          done: false,
          status: 'pending',
          createdByName: doc,
          created_by_name: doc,
          doctorName: doc,
          doctor_user_id: docId,
          doctorUserId: docId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let createdAppointment: any = null;
      try {
        createdAppointment = await res.json();
      } catch {
        createdAppointment = null;
      }

      // Mark schedule slot as booked (best-effort)
      try {
        if (selectedSchedule?.id) {
          await fetch(
            `${API_BASE}/api/schedule-slots/${encodeURIComponent(
              String(selectedSchedule.id),
            )}/book`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                appointmentId: createdAppointment?.id ?? null,
              }),
            },
          );
        }
      } catch {}

      // Best-effort: notify the selected doctor via backend notifications endpoint (if supported)
      try {
        const title = 'Appointment Request';
        const message = `New appointment request from ${patientName} for ${date} ${time}. Reason: ${notes}`;
        const payload: any = {
          title,
          message,
          body: message,
          recipientId: docId,
          recipient_id: docId,
          toId: docId,
          to_id: docId,
          recipientName: doc,
          recipient_name: doc,
          toName: doc,
          to_name: doc,
        };

        await fetch(`${API_BASE}/api/notifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      } catch {}

      setDoctor('');
      setDoctorUserId(undefined);
      setScheduleSlots([]);
      setSelectedSchedule(null);
      setReason('');
      setSpecialization('');
      setScheduleDay('');
      setScheduleTime('');
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

  const filteredAppointments = useMemo(() => {
    const base = (appointments || []).filter(appointment => {
      return (
        (activeTab === 'upcoming' && appointment.status === upcomingFilter) ||
        (activeTab === 'history' && appointment.status === 'completed')
      );
    });

    const toTs = (a: Appointment) => {
      try {
        const [y, m, d] = String(a?.date || '')
          .split('-')
          .map(Number);
        const mins = time12ToMinutes(String(a?.time || ''));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
          return null;
        if (mins == null) return null;
        return (
          new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime() +
          mins * 60 * 1000
        );
      } catch {
        return null;
      }
    };

    if (activeTab === 'upcoming') {
      // latest first
      return [...base].sort((a, b) => {
        const ta = toTs(a);
        const tb = toTs(b);
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return tb - ta;
      });
    }

    // history: most recent completed first
    return [...base].sort((a, b) => {
      const ta = toTs(a);
      const tb = toTs(b);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb - ta;
    });
  }, [activeTab, appointments, time12ToMinutes, upcomingFilter]);

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
      <View style={styles.cardTopRow}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>
            {String(item.doctorName || 'D')
              .trim()
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardTitleCol}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {String(item.doctorName || '').trim()}
            {String(item.specialty || '').trim()
              ? `: ${String(item.specialty || '').trim()}`
              : ''}
          </Text>
        </View>
        <View style={styles.cardRightCol}>
          {item.status === 'upcoming' && (
            <TouchableOpacity
              onPress={() => openReminder(item)}
              style={styles.reminderIconBtn}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../assets/notification_icon.png')}
                style={styles.reminderIconImg}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          <View
            style={[
              styles.statusPill,
              item.status === 'pending'
                ? styles.statusPillPending
                : item.status === 'upcoming'
                ? styles.statusPillUpcoming
                : styles.statusPillCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                item.status === 'pending'
                  ? styles.statusPillPendingText
                  : item.status === 'upcoming'
                  ? styles.statusPillUpcomingText
                  : styles.statusPillCompletedText,
              ]}
            >
              {item.status === 'pending'
                ? 'Pending'
                : item.status === 'upcoming'
                ? 'Upcoming'
                : 'Completed'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeItem}>
          <Text style={styles.dateTimeIcon}>📅</Text>
          <Text style={styles.dateTimeLabel}>Date:</Text>
          <Text style={styles.dateTimeValue}>{item.date}</Text>
        </View>
        <View style={styles.dateTimeItem}>
          <Text style={styles.dateTimeIcon}>🕒</Text>
          <Text style={styles.dateTimeLabel}>Time:</Text>
          <Text style={styles.dateTimeValue}>
            {getTimeRangeLabel(String(item.time || ''))}
          </Text>
        </View>
      </View>

      {item.status === 'upcoming' && (
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.cardCancelBtn}
            onPress={() => cancelAppointmentFromCard(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardRescheduleBtn}
            onPress={() => openRescheduleFromCard(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardRescheduleText}>Reschedule</Text>
          </TouchableOpacity>
        </View>
      )}
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

        {/* Tabs */}
        <View style={styles.tabsRow}>
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
                Appointments
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

          <TouchableOpacity
            style={styles.tabAddButton}
            activeOpacity={0.8}
            onPress={handleAddAppointment}
          >
            <Text style={styles.tabAddButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'upcoming' && (
          <View style={styles.apptFilterRow}>
            <TouchableOpacity
              style={[
                styles.apptFilterPill,
                upcomingFilter === 'upcoming' && styles.apptFilterPillActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setUpcomingFilter('upcoming')}
            >
              <Text
                style={[
                  styles.apptFilterText,
                  upcomingFilter === 'upcoming' && styles.apptFilterTextActive,
                ]}
              >
                Upcoming
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.apptFilterPill,
                upcomingFilter === 'pending' && styles.apptFilterPillActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setUpcomingFilter('pending')}
            >
              <Text
                style={[
                  styles.apptFilterText,
                  upcomingFilter === 'pending' && styles.apptFilterTextActive,
                ]}
              >
                Pending
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
                No {activeTab === 'upcoming' ? 'appointments' : 'history'}{' '}
                appointments found
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
              <Text style={styles.label}>Specialization</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                activeOpacity={0.8}
                onPress={() => setShowSpecializationPicker(true)}
              >
                <View style={styles.doctorSelectRow}>
                  <Text style={styles.doctorSelectText}>
                    {specialization || 'Select specialization'}
                  </Text>
                  <Image
                    source={require('../../assets/dropdown.png')}
                    style={styles.doctorSelectIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>Doctor's Name</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                activeOpacity={0.8}
                onPress={() => {
                  if (!String(specialization || '').trim()) {
                    Alert.alert(
                      'Validation',
                      'Please select a specialization first.',
                    );
                    return;
                  }
                  setShowDoctorPicker(true);
                }}
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

              <Text style={styles.label}>Schedule</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                activeOpacity={0.8}
                onPress={() => {
                  if (!String(doctor || '').trim() && doctorUserId == null) {
                    Alert.alert('Validation', 'Please select a doctor first.');
                    return;
                  }
                  setShowScheduleDayPicker(true);
                }}
              >
                <View style={styles.doctorSelectRow}>
                  <Text style={styles.doctorSelectText}>
                    {String(scheduleDay || '').trim()
                      ? String(scheduleDay)
                      : 'Select date'}
                  </Text>
                  <Image
                    source={require('../../assets/appointment_icon.png')}
                    style={styles.doctorSelectIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>Time</Text>
              <TouchableOpacity
                style={styles.dateTimeInput}
                activeOpacity={0.8}
                onPress={() => {
                  if (!String(doctor || '').trim() && doctorUserId == null) {
                    Alert.alert('Validation', 'Please select a doctor first.');
                    return;
                  }
                  if (!String(scheduleDay || '').trim()) {
                    Alert.alert('Validation', 'Please select a date first.');
                    return;
                  }
                  setShowScheduleTimePicker(true);
                }}
              >
                <View style={styles.doctorSelectRow}>
                  <Text style={styles.doctorSelectText}>
                    {String(scheduleTime || '').trim()
                      ? String(scheduleTime)
                      : 'Select time'}
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
        visible={showSpecializationPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSpecializationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.specializationModalContent, { maxHeight: '70%' }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Specialization</Text>
              <TouchableOpacity
                onPress={() => setShowSpecializationPicker(false)}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.specializationModalBody}>
              <FlatList
                data={specializationOptions}
                keyExtractor={item => String(item)}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 24 }}
                ListFooterComponent={<View style={{ height: 24 }} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.doctorPickerItem}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSpecialization(String(item));
                      setDoctor('');
                      setDoctorUserId(undefined);
                      setSelectedSchedule(null);
                      setScheduleSlots([]);
                      setShowSpecializationPicker(false);
                    }}
                  >
                    <Text
                      style={styles.doctorPickerItemText}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {String(item)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScheduleDayPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowScheduleDayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowScheduleDayPicker(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {scheduleLoading ? (
                <Text style={styles.scheduleHint}>Loading schedules...</Text>
              ) : (
                <View>
                  <View style={styles.calMonthRow}>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() =>
                        setScheduleCalendarCurrent(
                          new Date(scheduleCalYear, scheduleCalMonth - 1, 1),
                        )
                      }
                    >
                      <Text style={styles.calNavText}>{'<'}</Text>
                    </TouchableOpacity>
                    <View style={styles.calMonthTitleWrap}>
                      <Text style={styles.calMonthText}>
                        {scheduleCalMonthNames[scheduleCalMonth]}
                      </Text>
                      <Text style={styles.calYearText}>{scheduleCalYear}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() =>
                        setScheduleCalendarCurrent(
                          new Date(scheduleCalYear, scheduleCalMonth + 1, 1),
                        )
                      }
                    >
                      <Text style={styles.calNavText}>{'>'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.calWeekHeader}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      w => (
                        <Text key={w} style={styles.calWeekText}>
                          {w}
                        </Text>
                      ),
                    )}
                  </View>

                  <View style={styles.calDaysGrid}>
                    {scheduleCalMonthMatrix.map((week, rIdx) => (
                      <View key={rIdx} style={styles.calWeekRow}>
                        {week.map((d, cIdx) => {
                          const key = `${rIdx}-${cIdx}`;
                          if (d == null) {
                            return (
                              <View
                                key={key}
                                style={[
                                  styles.calDayCell,
                                  styles.calDayCellEmpty,
                                ]}
                              />
                            );
                          }

                          const ymd = formatYmd(
                            new Date(scheduleCalYear, scheduleCalMonth, d),
                          );
                          const isPast = scheduleCalIsPastYmd(ymd);
                          const hasSlots = scheduleAvailableDateSet.has(ymd);
                          const isSelected =
                            String(scheduleDay || '').trim() === ymd;
                          const disabled = isPast;

                          return (
                            <TouchableOpacity
                              key={key}
                              style={[
                                styles.calDayCell,
                                disabled && styles.calDayCellDisabled,
                                isSelected && styles.calDayCellSelected,
                              ]}
                              activeOpacity={0.8}
                              disabled={disabled}
                              onPress={() => {
                                setScheduleDay(ymd);
                                setScheduleTime('');
                                setSelectedSchedule(null);
                                setShowScheduleDayPicker(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.calDayText,
                                  disabled && styles.calDayTextDisabled,
                                  isSelected && styles.calDayTextSelected,
                                ]}
                              >
                                {String(d)}
                              </Text>
                              {hasSlots && <View style={styles.calDot} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScheduleTimePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowScheduleTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity
                onPress={() => setShowScheduleTimePicker(false)}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {availableScheduleTimeOptions.length > 0 ? (
                <FlatList
                  data={availableScheduleTimeOptions}
                  keyExtractor={item => String(item)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.schedulePickerItem}
                      activeOpacity={0.8}
                      onPress={() => {
                        const tt = String(item);
                        setScheduleTime(tt);
                        try {
                          const d = String(scheduleDay || '').trim();
                          const slot = (scheduleSlots || []).find(s => {
                            const sd = String((s as any)?.date || '').trim();
                            const st = String(
                              (s as any)?.start_time || (s as any)?.time || '',
                            ).trim();
                            return sd === d && st === tt;
                          });
                          setSelectedSchedule(slot || null);
                        } catch {}
                        setShowScheduleTimePicker(false);
                      }}
                    >
                      <Text style={styles.schedulePickerItemText}>
                        {String(item)}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.scheduleHint}>No schedules yet.</Text>
              )}
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
              ) : filteredDoctors.length > 0 ? (
                <FlatList
                  data={filteredDoctors}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.doctorPickerItem}
                      activeOpacity={0.8}
                      onPress={() => {
                        setDoctor(String(item.full_name || item.name || ''));
                        setDoctorUserId(item.id);
                        setSelectedSchedule(null);
                        setScheduleSlots([]);
                        setShowDoctorPicker(false);
                      }}
                    >
                      <Text style={styles.doctorPickerItemText}>
                        {String(item.full_name || item.name || '')}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.scheduleHint}>
                  No doctors found for this specialization.
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSchedulePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSchedulePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Schedule</Text>
              <TouchableOpacity onPress={() => setShowSchedulePicker(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {scheduleLoading ? (
                <Text style={styles.scheduleHint}>Loading schedules...</Text>
              ) : scheduleSlots.length > 0 ? (
                <FlatList
                  data={scheduleSlots}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.schedulePickerItem}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedSchedule(item);
                        try {
                          const [yy, mm, dd] = String(item?.date || '')
                            .split('-')
                            .map(Number);
                          if (
                            Number.isFinite(yy) &&
                            Number.isFinite(mm) &&
                            Number.isFinite(dd)
                          ) {
                            const dt = new Date(yy, (mm || 1) - 1, dd || 1);
                            const dow = dt.getDay();
                            const names = [
                              'Sunday',
                              'Monday',
                              'Tuesday',
                              'Wednesday',
                              'Thursday',
                              'Friday',
                              'Saturday',
                            ];
                            const nm = String(names[dow] || 'Monday');
                            setScheduleDay(nm);
                          }
                        } catch {}

                        try {
                          const tt = String(
                            item?.start_time || item?.time || '',
                          ).trim();
                          if (tt) setScheduleTime(tt);
                        } catch {}
                        setShowSchedulePicker(false);
                      }}
                    >
                      <Text style={styles.schedulePickerItemText}>
                        {item.date} •{' '}
                        {String(item.start_time || '').trim() &&
                        String(item.end_time || '').trim()
                          ? `${String(item.start_time)} - ${String(
                              item.end_time,
                            )}`
                          : String(item.time)}
                      </Text>
                      {!!item.notes && (
                        <Text
                          style={styles.schedulePickerItemSubText}
                          numberOfLines={2}
                        >
                          {item.notes}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.scheduleHint}>No schedules available.</Text>
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
                    {detailsTarget?.status === 'pending'
                      ? 'Pending'
                      : detailsTarget?.status === 'upcoming'
                      ? 'Upcoming'
                      : detailsTarget?.status === 'completed'
                      ? 'Completed'
                      : detailsTarget?.status || '—'}
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
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    marginHorizontal: -16,
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  topDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 0,
    marginHorizontal: -16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
    marginTop: -2,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  apptFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  apptFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  apptFilterPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  apptFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  apptFilterTextActive: {
    color: '#FFFFFF',
  },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    marginBottom: 0,
    backgroundColor: 'transparent',
    borderRadius: 14,
    gap: 12,
  },
  tabAddButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabAddButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
    marginTop: -2,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  activeTab: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardAvatarText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '800',
  },
  cardTitleCol: { flex: 1 },
  cardRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  reminderIconBtn: {
    padding: 6,
    borderRadius: 16,
    marginBottom: 6,
  },
  reminderIconImg: { width: 18, height: 18, tintColor: '#9CA3AF' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillUpcoming: { backgroundColor: '#ECFDF5' },
  statusPillUpcomingText: { color: '#10B981' },
  statusPillPending: { backgroundColor: '#FEF3C7' },
  statusPillPendingText: { color: '#92400E' },
  statusPillCompleted: { backgroundColor: '#F3F4F6' },
  statusPillCompletedText: { color: '#111827' },
  dateTimeRow: {
    marginTop: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateTimeIcon: { marginRight: 8, fontSize: 14 },
  dateTimeLabel: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  dateTimeValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  cardCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  cardCancelText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  cardRescheduleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  cardRescheduleText: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  statusPending: {
    backgroundColor: '#FEF3C7',
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
  statusPendingText: {
    color: '#92400E',
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
  specializationModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    minHeight: 260,
    overflow: 'hidden',
  },
  specializationModalBody: {
    flex: 1,
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
    minHeight: 48,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'center',
  },
  doctorPickerItemText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 18,
    flexShrink: 1,
  },
  schedulePickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  schedulePickerItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  schedulePickerItemSubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
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
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  calNavText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  calMonthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calMonthText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  calYearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  calWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calWeekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  calDaysGrid: {
    width: '100%',
  },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calDayCell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calDayCellEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  calDayCellDisabled: {
    opacity: 0.35,
  },
  calDayCellSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  calDayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  calDayTextDisabled: {
    color: '#9CA3AF',
  },
  calDayTextSelected: {
    color: '#10B981',
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: 8,
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
