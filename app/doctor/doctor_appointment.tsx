import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { addAppointment } from '../../state/patient_records_store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DoctorTopNav from './DoctorTopNav';
import {
  scheduleAppointmentNotifications,
  cancelAppointmentNotifications,
} from '../../utils/notifications';
import { addAppointment as addPatientRecordAppointment } from '../../state/patient_records_store';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';
const API_BASE = 'https://backend-careflow.vercel.app';

export default function DoctorAppointment() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Calendar state
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth(); // 0-11
  const monthNames = [
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
  ];

  // Build a 6x7 matrix for the month view
  const monthMatrix = useMemo(() => {
    // First day of month weekday (0 Sun - 6 Sat)
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = 42; // 6 rows * 7 days
    const matrix: Array<number | null> = Array(cells).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      matrix[startWeekday + (d - 1)] = d;
    }
    // Chunk into 6 rows of 7
    const rows: Array<Array<number | null>> = [];
    for (let i = 0; i < cells; i += 7) rows.push(matrix.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const today = new Date();
  const isToday = (d: number | null) =>
    d !== null &&
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();
  const todayStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );
  const isPastCalendarDate = (d: number | null) => {
    if (d === null) return true;
    const cand = new Date(year, month, d);
    return cand < todayStart;
  };

  const confirmDone = (idx: number) => {
    const a = appointments[idx];
    Alert.alert('Mark as done', 'Are you sure this is done?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        style: 'default',
        onPress: async () => {
          const a = appointments[idx];
          try {
            const headers = await getAuthHeaders();
            if (a?.id != null) {
              const res = await fetch(`${API_BASE}/api/appointments/${a.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ done: true }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              await res.json();
            } else {
              // No id yet, just proceed
            }
            // Record to patient records store
            try {
              if (a?.patient) {
                addPatientRecordAppointment(String(a.patient), {
                  date: String(a.date || ''),
                  time: String(a.time || ''),
                  notes: a?.notes,
                });
              }
            } catch {}
            // Persist record to backend (merge into latest to avoid duplicates)
            try {
              if (a?.patient) {
                const headers2 = await getAuthHeaders();
                // Try to derive doctor name
                let doctorName: string | undefined = (a as any)
                  ?.created_by_name;
                if (!doctorName) {
                  try {
                    const raw = await AsyncStorage.getItem('session');
                    if (raw) {
                      const sess = JSON.parse(raw);
                      doctorName =
                        sess?.user?.full_name ||
                        sess?.user?.fullName ||
                        sess?.user?.name ||
                        undefined;
                    }
                  } catch {}
                }
                await fetch(`${API_BASE}/api/patient-records/latest`, {
                  method: 'PUT',
                  headers: headers2,
                  body: JSON.stringify({
                    patient: a.patient,
                    date: a.date,
                    time: a.time,
                    notes: a.notes,
                    doctor: doctorName,
                    medicine: (a as any)?.medicine || null,
                    dosage: (a as any)?.dosage || null,
                  }),
                });
              }
            } catch {}
            // Remove from local list after marking done
            setAppointments(prev => prev.filter((_, i) => i !== idx));
            try {
              setShowDetail(false);
            } catch {}
            // Log activity: appointment done
            try {
              const rawAct = await AsyncStorage.getItem('doctor_activity');
              const arrAct = rawAct ? JSON.parse(rawAct) : [];
              const item = {
                id: String(Date.now()),
                title: `Appointment done: ${a?.patient || ''}`,
                type: 'appointment',
                timestamp: Date.now(),
              };
              const updatedAct = Array.isArray(arrAct)
                ? arrAct.slice(0, 99)
                : []; // Keep only latest 100
              await AsyncStorage.setItem(
                'doctor_activity',
                JSON.stringify([item, ...updatedAct]),
              );
            } catch {}
          } catch (e: any) {
            Alert.alert(
              'Error',
              `Failed to mark done: ${e?.message || 'Network error'}`,
            );
          }
        },
      },
    ]);
  };

  const openDetail = (idx: number) => {
    const a = appointments[idx];
    setDetailIndex(idx);
    setDPatient(a.patient);
    setDDate(a.date);
    setDTime(a.time);
    setDNotes(a.notes || '');
    setShowDetail(true);
  };

  const onUpdateDetail = async () => {
    if (detailIndex === null) return setShowDetail(false);
    if (!dPatient)
      return Alert.alert('Validation', 'Please enter a patient name.');
    if (!dDate) return Alert.alert('Validation', 'Please select a date.');
    if (!dTime) return Alert.alert('Validation', 'Please select a time.');

    const dt = parseYmd(dDate);
    if (!dt) return Alert.alert('Validation', 'Invalid date format.');
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dt < start)
      return Alert.alert('Invalid date', 'Please pick today or a future date.');
    if (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    ) {
      const [hhmm, ap] = dTime.split(' ');
      const [hh, mm] = (hhmm || '').split(':').map(v => Number(v));
      if (isFinite(hh) && isFinite(mm)) {
        const sel24 = (hh % 12) + (ap?.toUpperCase() === 'PM' ? 12 : 0);
        const selMinutes = sel24 * 60 + mm;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (selMinutes <= nowMinutes)
          return Alert.alert('Invalid time', 'Please select a future time.');
      }
    }

    try {
      const headers = await getAuthHeaders();
      const cur = appointments[detailIndex];
      // cancel existing scheduled notifications for old values
      try {
        await cancelAppointmentNotifications(
          cur?.id ?? null,
          cur.patient,
          cur.date,
          cur.time,
        );
      } catch {}
      if (cur?.id != null) {
        const res = await fetch(`${API_BASE}/api/appointments/${cur.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            patient: dPatient,
            date: dDate,
            time: dTime,
            notes: dNotes,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const updated = await res.json();
        setAppointments(prev =>
          prev.map((item, i) =>
            i === detailIndex
              ? {
                  id: updated.id,
                  patient: updated.patient,
                  date: updated.date,
                  time: updated.time,
                  notes: updated.notes,
                  done: updated.done,
                }
              : item,
          ),
        );
        // schedule notifications for updated appointment
        try {
          await scheduleAppointmentNotifications(
            updated?.id ?? null,
            updated.patient,
            updated.date,
            updated.time,
          );
        } catch {}
      } else {
        setAppointments(prev =>
          prev.map((item, i) =>
            i === detailIndex
              ? {
                  ...item,
                  patient: dPatient,
                  date: dDate,
                  time: dTime,
                  notes: dNotes,
                }
              : item,
          ),
        );
        // schedule notifications for updated appointment (no id yet)
        try {
          await scheduleAppointmentNotifications(null, dPatient, dDate, dTime);
        } catch {}
      }
      setShowDetail(false);
      // Log activity: appointment updated
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const item = {
          id: String(Date.now()),
          title: `Appointment updated: ${dPatient}`,
          type: 'appointment',
          timestamp: Date.now(),
        };
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : []; // Keep only latest 100
        await AsyncStorage.setItem(
          'doctor_activity',
          JSON.stringify([item, ...updatedAct]),
        );
      } catch {}
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Failed to update: ${e?.message || 'Network error'}`,
      );
    }
  };

  const onDeleteDetail = async () => {
    if (detailIndex === null) return setShowDetail(false);
    const cur = appointments[detailIndex];
    try {
      if (cur?.id != null) {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/appointments/${cur.id}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok && res.status !== 204)
          throw new Error(`HTTP ${res.status}`);
      }
      // cancel notifications for this appointment
      try {
        await cancelAppointmentNotifications(
          cur?.id ?? null,
          cur.patient,
          cur.date,
          cur.time,
        );
      } catch {}
      setAppointments(prev => prev.filter((_, i) => i !== detailIndex));
      // Log activity: appointment deleted
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const item = {
          id: String(Date.now()),
          title: `Appointment deleted: ${cur?.patient || ''}`,
          type: 'appointment',
          timestamp: Date.now(),
        };
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : []; // Keep only latest 100
        await AsyncStorage.setItem(
          'doctor_activity',
          JSON.stringify([item, ...updatedAct]),
        );
      } catch {}
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Failed to delete: ${e?.message || 'Network error'}`,
      );
    } finally {
      setShowDetail(false);
    }
  };

  const confirmDelete = (idx: number) => {
    Alert.alert(
      'Delete Appointment',
      'Are you sure you want to delete this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const a = appointments[idx];
            try {
              if (a?.id != null) {
                const headers = await getAuthHeaders();
                const res = await fetch(
                  `${API_BASE}/api/appointments/${a.id}`,
                  { method: 'DELETE', headers },
                );
                if (!res.ok && res.status !== 204)
                  throw new Error(`HTTP ${res.status}`);
              }
              setAppointments(prev => prev.filter((_, i) => i !== idx));
            } catch (e: any) {
              Alert.alert(
                'Error',
                `Failed to delete: ${e?.message || 'Network error'}`,
              );
            }
          },
        },
      ],
    );
  };

  // Modal state for new appointment
  const [showNew, setShowNew] = useState(false);
  const [newEntryType, setNewEntryType] = useState<'appointment' | 'schedule'>(
    'appointment',
  );
  const [patient, setPatient] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tpHour, setTpHour] = useState<number>(
    new Date().getHours() % 12 || 12,
  );
  const [tpMinute, setTpMinute] = useState<number>(
    new Date().getMinutes() - (new Date().getMinutes() % 5),
  );
  const [tpPeriod, setTpPeriod] = useState<'AM' | 'PM'>(
    new Date().getHours() >= 12 ? 'PM' : 'AM',
  );
  const [appointments, setAppointments] = useState<
    Array<{
      id?: number;
      patient: string;
      date: string;
      time: string;
      notes?: string;
      done?: boolean;
    }>
  >([]);
  const [pickerTarget, setPickerTarget] = useState<'new' | 'detail'>('new');
  const [timePickerField, setTimePickerField] = useState<'start' | 'end'>(
    'start',
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [reminderBannerMsg, setReminderBannerMsg] = useState<string>('');
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<{
    id?: number;
    patient: string;
    date: string;
    time: string;
    notes?: string;
    done?: boolean;
  } | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('');

  // Detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [dPatient, setDPatient] = useState('');
  const [dDate, setDDate] = useState('');
  const [dTime, setDTime] = useState('');
  const [dNotes, setDNotes] = useState('');

  const [showAllList, setShowAllList] = useState(false);

  const monthAbbr = (m: number) =>
    [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ][m] || '';
  const parseYmd = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const formatYmd = (dt: Date) =>
    `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  const minutesToTime12 = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${pad2(h12)}:${pad2(m)} ${period}`;
  };

  const time12ToMinutes = (t: string) => {
    try {
      const raw = String(t || '').trim();
      if (!raw) return null;
      const [hhmm, apRaw] = raw.split(' ');
      const [hhStr, mmStr] = String(hhmm || '').split(':');
      const hh = Number(hhStr);
      const mm = Number(mmStr);
      if (!isFinite(hh) || !isFinite(mm)) return null;
      const ap = String(apRaw || '').toUpperCase();
      const h24 = (hh % 12) + (ap === 'PM' ? 12 : 0);
      return h24 * 60 + mm;
    } catch {
      return null;
    }
  };

  const minutesToTimeCompact = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h24 >= 12 ? 'pm' : 'am';
    const h12 = h24 % 12 || 12;
    return `${h12}:${pad2(m)}${ap}`;
  };

  const getTimeRangeLabel = (startTime: string) => {
    const startMins = time12ToMinutes(startTime);
    if (startMins == null) return String(startTime || '');
    const endMins = startMins + 30;
    return `${minutesToTimeCompact(startMins)} - ${minutesToTimeCompact(
      endMins,
    )}`;
  };

  const resetForm = () => {
    setNewEntryType('appointment');
    setPatient('');
    setDate('');
    setTime('');
    setEndTime('');
    setNotes('');
  };

  const validateFutureDateTime = React.useCallback(
    (ymd: string, tm: string): string | null => {
      if (!ymd) return 'Please select a date.';
      if (!tm) return 'Please select a time.';
      const dt = parseYmd(ymd);
      if (!dt) return 'Invalid date format.';
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dt < start) return 'Please pick today or a future date.';
      if (
        dt.getFullYear() === now.getFullYear() &&
        dt.getMonth() === now.getMonth() &&
        dt.getDate() === now.getDate()
      ) {
        const [hhmm, ap] = String(tm || '').split(' ');
        const [hh, mm] = (hhmm || '').split(':').map(v => Number(v));
        if (isFinite(hh) && isFinite(mm)) {
          const sel24 = (hh % 12) + (ap?.toUpperCase() === 'PM' ? 12 : 0);
          const selMinutes = sel24 * 60 + mm;
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (selMinutes <= nowMinutes) return 'Please select a future time.';
        }
      }
      return null;
    },
    [],
  );

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      const base = { 'Content-Type': 'application/json' } as Record<
        string,
        string
      >;
      if (!raw) return base;
      const sess = JSON.parse(raw);
      const token =
        sess?.token ||
        sess?.accessToken ||
        sess?.access_token ||
        sess?.user?.token ||
        sess?.user?.accessToken ||
        sess?.user?.access_token;
      const userId = sess?.user?.id || sess?.id || sess?.user_id;
      const withAuth = token
        ? { ...base, Authorization: `Bearer ${token}` }
        : base;
      return userId ? { ...withAuth, 'X-User-Id': String(userId) } : withAuth;
    } catch {
      return { 'Content-Type': 'application/json' };
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

  const getCurrentUserSpecialty = React.useCallback(async (): Promise<
    string | undefined
  > => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return undefined;
      const sess = JSON.parse(raw);
      const v = sess?.user?.specialty ?? sess?.specialty;
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const loadAppointments = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/appointments`, { headers });
      if (!res.ok) return;
      const arr = await res.json();
      if (Array.isArray(arr)) {
        setAppointments(
          arr
            .filter((a: any) => !a.done)
            .filter((a: any) => {
              const patient = String(a?.patient || '')
                .trim()
                .toLowerCase();
              const status = String(a?.status || '')
                .trim()
                .toLowerCase();
              const isSchedule =
                a?.is_schedule === true || a?.isSchedule === true;
              if (isSchedule) return false;
              if (status === 'available' || status === 'schedule') return false;
              if (!patient) return false;
              if (patient === 'available slot' || patient === 'available')
                return false;
              return true;
            })
            .filter((a: any) => {
              const d = String(a?.date || '').trim();
              const t = String(a?.time || '').trim();
              // Hide past date/time appointments
              return validateFutureDateTime(d, t) == null;
            })
            .map((a: any) => ({
              id: a.id,
              patient: a.patient,
              date: a.date,
              time: a.time,
              notes: a.notes,
              done: a.done,
            })),
        );
      }
    } catch {}
  }, [getAuthHeaders, validateFutureDateTime]);

  const visibleAppointments = React.useMemo(() => {
    const parseDt = (ymd: string, tm: string): Date | null => {
      try {
        const [y, m, d] = String(ymd || '')
          .split('-')
          .map(Number);
        const [hhmm, ap] = String(tm || '').split(' ');
        const [hhStr, mmStr] = String(hhmm || '').split(':');
        const hh = Number(hhStr);
        const mm = Number(mmStr);
        if (!y || !m || !d || !isFinite(hh) || !isFinite(mm)) return null;
        const h24 = (hh % 12) + (String(ap).toUpperCase() === 'PM' ? 12 : 0);
        return new Date(y, m - 1, d, h24, mm, 0, 0);
      } catch {
        return null;
      }
    };

    const now = Date.now();
    const withIdx = (appointments || [])
      .map((a, idx) => ({ a, idx }))
      .map(x => ({
        ...x,
        dt: parseDt(String(x.a.date || ''), String(x.a.time || '')),
      }))
      .filter(x => {
        const patient = String(x.a?.patient || '')
          .trim()
          .toLowerCase();
        if (!patient) return false;
        if (patient === 'available slot' || patient === 'available')
          return false;
        return Boolean(x.dt && x.dt.getTime() > now);
      });

    withIdx.sort((x, y) => (x.dt!.getTime() || 0) - (y.dt!.getTime() || 0));
    const total = withIdx.length;
    const sliced = showAllList ? withIdx : withIdx.slice(0, 10);
    return { list: sliced, total };
  }, [appointments, showAllList]);

  const bookedDateSet = React.useMemo(() => {
    const s = new Set<string>();
    for (const a of appointments || []) {
      const d = String((a as any)?.date || '').trim();
      if (d) s.add(d);
    }
    return s;
  }, [appointments]);

  const parseApptDateTime = React.useCallback(
    (ymd: string, tm: string): Date | null => {
      try {
        const [y, m, d] = ymd.split('-').map(Number);
        const [hhmm, ap] = (tm || '').split(' ');
        const [hhStr, mmStr] = (hhmm || '').split(':');
        const hh = Number(hhStr);
        const mm = Number(mmStr);
        if (!y || !m || !d || !isFinite(hh) || !isFinite(mm)) return null;
        const h24 = (hh % 12) + (String(ap).toUpperCase() === 'PM' ? 12 : 0);
        const dt = new Date(y, m - 1, d, h24, mm, 0, 0);
        return dt;
      } catch {
        return null;
      }
    },
    [],
  );

  const setReminderForAppointment = React.useCallback(
    async (
      a: {
        id?: number;
        patient: string;
        date: string;
        time: string;
        notes?: string;
        done?: boolean;
      },
      opts?: { near?: boolean; now?: boolean; customMinutes?: number },
    ) => {
      const when = parseApptDateTime(a.date, a.time);
      if (!when) {
        Alert.alert('Reminder', 'Cannot parse appointment date/time.');
        return;
      }
      const ts = when.getTime();
      const r1 = {
        id: `rem-${ts}-tomorrow-${a.id ?? ''}`,
        apptId: a.id ?? null,
        patient: a.patient,
        time: a.time,
        kind: 'tomorrow',
        ts: ts - 24 * 60 * 60 * 1000,
        fired: false,
      };
      const r2 = {
        id: `rem-${ts}-near-${a.id ?? ''}`,
        apptId: a.id ?? null,
        patient: a.patient,
        time: a.time,
        kind: 'near',
        ts: ts - 30 * 60 * 1000,
        fired: false,
      };
      const custom =
        opts?.customMinutes &&
        Number.isFinite(opts.customMinutes) &&
        opts.customMinutes! > 0
          ? {
              id: `rem-${ts}-m${Math.floor(opts!.customMinutes!)}-${
                a.id ?? ''
              }`,
              apptId: a.id ?? null,
              patient: a.patient,
              time: a.time,
              kind: 'custom',
              minutes: Math.floor(opts!.customMinutes!),
              ts: ts - Math.floor(opts!.customMinutes!) * 60 * 1000,
              fired: false,
            }
          : null;
      try {
        const raw = await AsyncStorage.getItem('doctor_reminders');
        const parsed = raw ? JSON.parse(raw) : [];
        const arr: any[] = Array.isArray(parsed) ? parsed : [];
        // Deduplicate by id
        const byId = new Map(arr.map((x: any) => [x.id, x]));
        // Only set 'tomorrow' reminder if appointment day is after today
        const wantNear = opts?.near ?? true;
        const wantNow = opts?.now ?? true;
        try {
          const now = new Date();
          const todayMid = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          ).getTime();
          const apptMid = new Date(
            when.getFullYear(),
            when.getMonth(),
            when.getDate(),
          ).getTime();
          if (wantNear && apptMid > todayMid) {
            byId.set(r1.id, r1);
          }
        } catch {
          if (wantNear) byId.set(r1.id, r1);
        }
        if (wantNow) byId.set(r2.id, r2);
        if (custom && custom.ts > Date.now()) byId.set(custom.id, custom);
        const next = Array.from(byId.values());
        await AsyncStorage.setItem('doctor_reminders', JSON.stringify(next));
        // Schedule OS-level local notifications (near and at time)
        try {
          await scheduleAppointmentNotifications(
            a?.id ?? null,
            a.patient,
            a.date,
            a.time,
            { near: wantNear, now: wantNow, customMinutes: custom?.minutes },
          );
        } catch {}
        // Show on-screen banner
        if (custom?.minutes) {
          setReminderBannerMsg(
            `Reminder set ${custom.minutes} min before for ${a.patient} at ${a.time}.`,
          );
        } else {
          setReminderBannerMsg(`Reminder set for ${a.patient} at ${a.time}.`);
        }
        setShowReminderBanner(true);
        setTimeout(() => setShowReminderBanner(false), 4000);
      } catch {
        Alert.alert('Reminder', 'Failed to set reminder.');
      }
    },
    [parseApptDateTime],
  );

  const checkDueReminders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('doctor_reminders');
      const parsed = raw ? JSON.parse(raw) : [];
      const rems: any[] = Array.isArray(parsed) ? parsed : [];
      const now = Date.now();
      const due = rems.filter(
        (r: any) => !r.fired && typeof r.ts === 'number' && r.ts <= now,
      );
      if (due.length === 0) return;
      // Load current notifications
      const rawN = await AsyncStorage.getItem('doctor_notifications');
      const parsedN = rawN ? JSON.parse(rawN) : [];
      const cur: any[] = Array.isArray(parsedN) ? parsedN : [];
      const toAdd = due.map((r: any) => {
        let title =
          r.kind === 'tomorrow'
            ? 'Appointment Reminder'
            : 'Appointment Starting Soon';
        let message: string;
        if (r.kind === 'tomorrow') {
          // Reconstruct appointment datetime to verify if it's actually today
          try {
            const appt = new Date((r.ts || 0) + 24 * 60 * 60 * 1000);
            const nowD = new Date();
            const sameDay =
              appt.getFullYear() === nowD.getFullYear() &&
              appt.getMonth() === nowD.getMonth() &&
              appt.getDate() === nowD.getDate();
            if (sameDay) {
              title = 'Appointment Reminder';
              message = `Appointment for ${r.patient} is today at ${r.time}.`;
            } else {
              message = `Appointment for ${r.patient} is tomorrow at ${r.time}.`;
            }
          } catch {
            message = `Appointment for ${r.patient} is tomorrow at ${r.time}.`;
          }
        } else if (r.kind === 'custom') {
          title = 'Appointment Reminder';
          const mins = Number(r?.minutes);
          if (Number.isFinite(mins) && mins > 0) {
            message = `Appointment for ${r.patient} is in ${mins} minute${
              mins === 1 ? '' : 's'
            } at ${r.time}.`;
          } else {
            message = `Appointment for ${r.patient} at ${r.time} is starting soon.`;
          }
        } else {
          message = `Appointment for ${r.patient} at ${r.time} is starting soon.`;
        }
        return {
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          title,
          message,
          timestamp: Date.now(),
          read: false,
        };
      });
      const nextNotifs = [...toAdd, ...cur];
      await AsyncStorage.setItem(
        'doctor_notifications',
        JSON.stringify(nextNotifs),
      );
      // Mark reminders as fired
      const updated = rems.map((r: any) => ({
        ...r,
        fired: r.fired || due.some((d: any) => d.id === r.id),
      }));
      await AsyncStorage.setItem('doctor_reminders', JSON.stringify(updated));
      // Show on-screen reminder popup for the first due reminder
      const first = due[0];
      if (first) {
        const message =
          first.kind === 'tomorrow'
            ? `Appointment for ${first.patient} is tomorrow at ${first.time}.`
            : `Appointment for ${first.patient} at ${first.time} is starting soon.`;
        setReminderBannerMsg(message);
        setShowReminderBanner(true);
        setTimeout(() => setShowReminderBanner(false), 4000);
      }
    } catch {}
  }, []);

  const onSaveNew = async () => {
    const isSchedule = newEntryType === 'schedule';
    const pn = isSchedule ? 'Available Slot' : String(patient || '').trim();
    if (!isSchedule && !pn)
      return Alert.alert('Validation', 'Please enter a patient name.');

    const d = String(date || '').trim();
    const t = String(time || '').trim();
    const err = validateFutureDateTime(d, t);
    if (err) return Alert.alert('Validation', err);
    if (isSchedule) {
      const et = String(endTime || '').trim();
      if (!et) return Alert.alert('Validation', 'Please select an end time.');
      try {
        const sm = time12ToMinutes(t);
        const em = time12ToMinutes(et);
        if (sm != null && em != null && em <= sm) {
          return Alert.alert(
            'Validation',
            'End time must be later than start time.',
          );
        }
      } catch {}
    }

    try {
      const headers = await getAuthHeaders();
      const createdByName = await getCurrentUserName();
      const createdById = await getCurrentUserId();
      const specialty = await getCurrentUserSpecialty();

      const res = isSchedule
        ? await fetch(`${API_BASE}/api/schedule-slots`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              date: d,
              time: t,
              start_time: t,
              startTime: t,
              end_time: String(endTime || '').trim(),
              endTime: String(endTime || '').trim(),
              specialty,
              notes,
              doctorName: createdByName,
              doctor_name: createdByName,
              doctor_user_id: createdById,
              doctorUserId: createdById,
              createdByName,
              created_by_name: createdByName,
            }),
          })
        : await fetch(`${API_BASE}/api/appointments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              patient: pn,
              date: d,
              time: t,
              specialty,
              notes,
              done: false,
              status: isSchedule ? 'available' : undefined,
              is_schedule: isSchedule ? true : undefined,
              isSchedule: isSchedule ? true : undefined,
              createdByName,
              created_by_name: createdByName,
              doctor_user_id: createdById,
              doctorUserId: createdById,
            }),
          });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();

      if (!isSchedule && created) {
        setAppointments(prev => [
          {
            id: created.id,
            patient: created.patient,
            date: created.date,
            time: created.time,
            notes: created.notes,
            done: created.done,
          },
          ...prev,
        ]);
      } else {
        try {
          await loadAppointments();
        } catch {}
      }
      setShowNew(false);
      resetForm();
      // Log activity: appointment created
      try {
        const rawAct = await AsyncStorage.getItem('doctor_activity');
        const arrAct = rawAct ? JSON.parse(rawAct) : [];
        const firstCreated = created;
        const item = {
          id: String(Date.now()),
          title: isSchedule
            ? `New schedule slot: ${d} ${t}`
            : `New appointment: ${firstCreated?.patient || patient}`,
          type: 'appointment',
          timestamp: Date.now(),
        };
        const updatedAct = Array.isArray(arrAct) ? arrAct.slice(0, 99) : []; // Keep only latest 100
        await AsyncStorage.setItem(
          'doctor_activity',
          JSON.stringify([item, ...updatedAct]),
        );
      } catch {}
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Failed to save appointment: ${e?.message || 'Network error'}`,
      );
    }
  };

  // Load existing appointments on mount
  React.useEffect(() => {
    (async () => {
      try {
        await loadAppointments();
      } catch {}
    })();
  }, [loadAppointments]);

  // Also check reminders whenever this screen regains focus
  useFocusEffect(
    React.useCallback(() => {
      try {
        loadAppointments();
      } catch {}
      checkDueReminders();
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
      })();
      return () => {};
    }, [checkDueReminders, loadAppointments]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAppointments();
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
    } finally {
      setRefreshing(false);
    }
  }, [loadAppointments]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <DoctorTopNav
          unreadCount={unreadCount}
          onPressNotifications={() =>
            navigation.navigate('DoctorNotification' as never)
          }
          onPressProfile={() => setShowProfileMenu(true)}
        />

        {showReminderBanner && (
          <View style={[styles.reminderBanner, { top: insets.top + 48 }]}>
            <Text style={styles.reminderText}>
              {reminderBannerMsg || 'Appointment reminder'}
            </Text>
            <TouchableOpacity onPress={() => setShowReminderBanner(false)}>
              <Text style={styles.reminderClose}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Appointment</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowNew(true);
              }}
            >
              <Text style={styles.plus}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Block (static mock) */}
          <View style={styles.calendarBlock}>
            <View style={styles.monthRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrent(new Date(year, month - 1, 1))}
              >
                <Text style={styles.navText}>{'<'}</Text>
              </TouchableOpacity>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={styles.monthText}>{monthNames[month]}</Text>
                <Text style={styles.yearText}>{year}</Text>
              </View>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrent(new Date(year, month + 1, 1))}
              >
                <Text style={styles.navText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={styles.weekText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {monthMatrix.map((week, rIdx) => (
                <View key={rIdx} style={styles.weekRow}>
                  {week.map((d, cIdx) => (
                    <View
                      key={`${rIdx}-${cIdx}`}
                      style={[
                        styles.dayCell,
                        d === null && styles.dayCellEmpty,
                        isToday(d) && styles.dayCellToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          d === null && styles.dayTextEmpty,
                          isToday(d) && styles.dayTextToday,
                        ]}
                      >
                        {d ?? ''}
                      </Text>
                      {(() => {
                        if (d === null) return null;
                        try {
                          const ymd = formatYmd(new Date(year, month, d));
                          if (!bookedDateSet.has(ymd)) return null;
                          return <View style={styles.dayDot} />;
                        } catch {
                          return null;
                        }
                      })()}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* Appointment List Card */}
          <View style={styles.listCard}>
            <View
              style={[
                styles.listHeader,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <Text style={styles.listTitle}>Appointment List</Text>
              {visibleAppointments.total > 10 && (
                <TouchableOpacity
                  onPress={() => setShowAllList(v => !v)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.viewAllText}>
                    {showAllList ? 'Show Less' : 'View All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {visibleAppointments.total === 0 ? (
              <Text
                style={[
                  styles.itemDesc,
                  { textAlign: 'center', paddingVertical: 12 },
                ]}
              >
                No appointments yet.
              </Text>
            ) : (
              visibleAppointments.list.map(({ a, idx }) => {
                const parsed = parseYmd(a.date);
                const mon = parsed ? monthAbbr(parsed.getMonth()) : '';
                const day = parsed ? String(parsed.getDate()) : '';
                const yr = parsed ? String(parsed.getFullYear()) : '';
                return (
                  <TouchableOpacity
                    key={`${a.id ?? ''}-${a.date}-${a.time}-${idx}`}
                    style={styles.listItem}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dateCol}>
                      <Text style={styles.dateMon}>{mon}</Text>
                      <Text style={styles.dateDay}>{day}</Text>
                      <Text style={styles.dateYear}>{yr}</Text>
                    </View>
                    <View style={styles.itemDescWrap}>
                      <Text style={styles.itemPatient} numberOfLines={1}>
                        {a.patient}
                      </Text>
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {getTimeRangeLabel(a.time)}
                        {a.notes ? ` • ${a.notes}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <TouchableOpacity
                        style={styles.viewBtn}
                        activeOpacity={0.85}
                        onPress={() => openDetail(idx)}
                      >
                        <Text style={styles.viewBtnText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setReminderTarget(a);
                          setShowReminderPicker(true);
                        }}
                      >
                        <Image
                          source={require('../../assets/notification_icon.png')}
                          style={styles.reminderIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(idx)}>
                        <Image
                          source={require('../../assets/delete_icon.png')}
                          style={styles.deleteIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <BottomItem
            label="Home"
            source={require('../../assets/home_icon.png')}
            onPress={() => navigation.navigate('DoctorDashboard')}
          />
          <BottomItem
            label="Appointment"
            active
            source={require('../../assets/appointment_icon.png')}
            onPress={() => navigation.navigate('DoctorAppointment')}
          />
          <BottomItem
            label="Prescription"
            source={require('../../assets/prescription_icon.png')}
            onPress={() => navigation.navigate('DoctorPrescription')}
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

      {/* Reminder Picker Modal */}
      <Modal
        visible={showReminderPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowReminderPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowReminderPicker(false)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10 }}>
              {/* Custom minutes input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Set your reminder</Text>
                <TextInput
                  placeholder="e.g. 15"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={customMinutesInput}
                  onChangeText={setCustomMinutesInput}
                  style={styles.input}
                />
              </View>
              <View style={[styles.modalActions, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => setShowReminderPicker(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.saveBtn]}
                  onPress={async () => {
                    const mins = parseInt(customMinutesInput, 10);
                    if (!Number.isFinite(mins) || mins <= 0) {
                      Alert.alert(
                        'Reminder',
                        'Enter a valid number of minutes.',
                      );
                      return;
                    }
                    if (reminderTarget)
                      await setReminderForAppointment(reminderTarget, {
                        near: false,
                        now: false,
                        customMinutes: mins,
                      });
                    setCustomMinutesInput('');
                    setShowReminderPicker(false);
                  }}
                >
                  <Text style={styles.saveText}>Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Appointment Modal */}
      <Modal
        visible={showNew}
        animationType="fade"
        transparent
        onRequestClose={() => setShowNew(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingTop: insets.top / 2 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {newEntryType === 'schedule'
                  ? 'New Schedule Slot'
                  : 'New Appointment'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowNew(false);
                  resetForm();
                }}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.entryTypeRow}>
              <TouchableOpacity
                style={[
                  styles.entryTypeBtn,
                  newEntryType === 'appointment' && styles.entryTypeBtnActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setNewEntryType('appointment')}
              >
                <Text
                  style={[
                    styles.entryTypeText,
                    newEntryType === 'appointment' &&
                      styles.entryTypeTextActive,
                  ]}
                >
                  Appointment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.entryTypeBtn,
                  newEntryType === 'schedule' && styles.entryTypeBtnActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setNewEntryType('schedule')}
              >
                <Text
                  style={[
                    styles.entryTypeText,
                    newEntryType === 'schedule' && styles.entryTypeTextActive,
                  ]}
                >
                  Schedule Slot
                </Text>
              </TouchableOpacity>
            </View>

            {newEntryType === 'appointment' && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Patient</Text>
                <TextInput
                  placeholder="Enter patient name"
                  placeholderTextColor="#9CA3AF"
                  value={patient}
                  onChangeText={setPatient}
                  style={styles.input}
                />
              </View>
            )}

            {newEntryType === 'schedule' ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      placeholder="Date"
                      placeholderTextColor="#9CA3AF"
                      value={date}
                      onChangeText={setDate}
                      style={[styles.input, { paddingRight: 40 }]}
                    />
                    <TouchableOpacity
                      style={styles.iconOverlay}
                      onPress={() => {
                        setPickerTarget('new');
                        setShowDatePicker(true);
                      }}
                    >
                      <Image
                        source={require('../../assets/appointment_icon.png')}
                        style={styles.inlineIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.row2}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <View style={styles.inputWithIcon}>
                      <TextInput
                        placeholder="Start Time"
                        placeholderTextColor="#9CA3AF"
                        value={time}
                        onChangeText={setTime}
                        editable={false}
                        style={[styles.input, { paddingRight: 40 }]}
                      />
                      <TouchableOpacity
                        style={styles.iconOverlay}
                        onPress={() => {
                          setPickerTarget('new');
                          setTimePickerField('start');
                          setShowTimePicker(true);
                        }}
                      >
                        <Image
                          source={require('../../assets/time_icon.png')}
                          style={styles.inlineIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <View style={styles.inputWithIcon}>
                      <TextInput
                        placeholder="End Time"
                        placeholderTextColor="#9CA3AF"
                        value={endTime}
                        onChangeText={setEndTime}
                        editable={false}
                        style={[styles.input, { paddingRight: 40 }]}
                      />
                      <TouchableOpacity
                        style={styles.iconOverlay}
                        onPress={() => {
                          setPickerTarget('new');
                          setTimePickerField('end');
                          setShowTimePicker(true);
                        }}
                      >
                        <Image
                          source={require('../../assets/time_icon.png')}
                          style={styles.inlineIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.row2}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      placeholder="Date"
                      placeholderTextColor="#9CA3AF"
                      value={date}
                      onChangeText={setDate}
                      style={[styles.input, { paddingRight: 40 }]}
                    />
                    <TouchableOpacity
                      style={styles.iconOverlay}
                      onPress={() => {
                        setPickerTarget('new');
                        setShowDatePicker(true);
                      }}
                    >
                      <Image
                        source={require('../../assets/appointment_icon.png')}
                        style={styles.inlineIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Time</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      placeholder="Time"
                      placeholderTextColor="#9CA3AF"
                      value={time ? getTimeRangeLabel(time) : time}
                      onChangeText={setTime}
                      editable={false}
                      style={[styles.input, { paddingRight: 40 }]}
                    />
                    <TouchableOpacity
                      style={styles.iconOverlay}
                      onPress={() => {
                        setPickerTarget('new');
                        setTimePickerField('start');
                        setShowTimePicker(true);
                      }}
                    >
                      <Image
                        source={require('../../assets/time_icon.png')}
                        style={styles.inlineIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                placeholder="Optional notes"
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowNew(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={onSaveNew}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrent(new Date(year, month - 1, 1))}
              >
                <Text style={styles.navText}>{'<'}</Text>
              </TouchableOpacity>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={styles.monthText}>{monthNames[month]}</Text>
                <Text style={styles.yearText}>{year}</Text>
              </View>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrent(new Date(year, month + 1, 1))}
              >
                <Text style={styles.navText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={styles.weekText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {monthMatrix.map((week, rIdx) => (
                <View key={rIdx} style={styles.weekRow}>
                  {week.map((d, cIdx) => (
                    <TouchableOpacity
                      key={`${rIdx}-${cIdx}`}
                      style={[
                        styles.dayCell,
                        d === null && styles.dayCellEmpty,
                        isToday(d) && styles.dayCellToday,
                        isPastCalendarDate(d) && styles.dayCellDisabled,
                      ]}
                      disabled={d === null || isPastCalendarDate(d)}
                      onPress={() => {
                        if (d) {
                          const selected = new Date(year, month, d);
                          const mm = String(month + 1).padStart(2, '0');
                          const dd = String(d).padStart(2, '0');
                          if (pickerTarget === 'new') {
                            setDate(`${year}-${mm}-${dd}`);
                          } else {
                            setDDate(`${year}-${mm}-${dd}`);
                          }
                          setShowDatePicker(false);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          d === null && styles.dayTextEmpty,
                          isToday(d) && styles.dayTextToday,
                          isPastCalendarDate(d) && styles.dayTextDisabled,
                        ]}
                      >
                        {d ?? ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.inputLabel}>Hour</Text>
                <View style={styles.timeRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.timePill,
                        tpHour === h && styles.timePillActive,
                      ]}
                      onPress={() => setTpHour(h)}
                    >
                      <Text
                        style={[
                          styles.timePillText,
                          tpHour === h && styles.timePillTextActive,
                        ]}
                      >
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.inputLabel}>Minute</Text>
                <View style={styles.timeRow}>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.timePill,
                        tpMinute === m && styles.timePillActive,
                      ]}
                      onPress={() => setTpMinute(m)}
                    >
                      <Text
                        style={[
                          styles.timePillText,
                          tpMinute === m && styles.timePillTextActive,
                        ]}
                      >
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 10,
              }}
            >
              {(['AM', 'PM'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.timePill,
                    { marginHorizontal: 6 },
                    tpPeriod === p && styles.timePillActive,
                  ]}
                  onPress={() => setTpPeriod(p)}
                >
                  <Text
                    style={[
                      styles.timePillText,
                      tpPeriod === p && styles.timePillTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={() => {
                  const hh = String(tpHour).padStart(2, '0');
                  const mm = String(tpMinute).padStart(2, '0');
                  // If selected date is today, block past times
                  const selIsToday = (() => {
                    const targetDate = pickerTarget === 'new' ? date : dDate;
                    if (!targetDate) return false;
                    const [y, m, d] = targetDate.split('-').map(Number);
                    const dt = new Date(y, (m || 1) - 1, d || 1);
                    return (
                      dt.getFullYear() === today.getFullYear() &&
                      dt.getMonth() === today.getMonth() &&
                      dt.getDate() === today.getDate()
                    );
                  })();
                  if (selIsToday) {
                    const sel24 = (tpHour % 12) + (tpPeriod === 'PM' ? 12 : 0);
                    const selMinutes = sel24 * 60 + tpMinute;
                    const nowMinutes =
                      today.getHours() * 60 + today.getMinutes();
                    if (selMinutes <= nowMinutes) {
                      Alert.alert(
                        'Invalid time',
                        'Please select a future time.',
                      );
                      return;
                    }
                  }
                  if (pickerTarget === 'new') {
                    if (
                      newEntryType === 'schedule' &&
                      timePickerField === 'end'
                    )
                      setEndTime(`${hh}:${mm} ${tpPeriod}`);
                    else setTime(`${hh}:${mm} ${tpPeriod}`);
                  } else {
                    setDTime(`${hh}:${mm} ${tpPeriod}`);
                  }
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Appointment Detail Modal */}
      <Modal
        visible={showDetail}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowDetail(false)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Patient</Text>
              <TextInput
                placeholder="Enter patient name"
                placeholderTextColor="#9CA3AF"
                value={dPatient}
                onChangeText={setDPatient}
                style={styles.input}
              />
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Date"
                    placeholderTextColor="#9CA3AF"
                    value={dDate}
                    onChangeText={setDDate}
                    style={[styles.input, { paddingRight: 40 }]}
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => {
                      setPickerTarget('detail');
                      setShowDatePicker(true);
                    }}
                  >
                    <Image
                      source={require('../../assets/appointment_icon.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Time</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    placeholder="Time"
                    placeholderTextColor="#9CA3AF"
                    value={dTime ? getTimeRangeLabel(dTime) : dTime}
                    onChangeText={setDTime}
                    editable={false}
                    style={[styles.input, { paddingRight: 40 }]}
                  />
                  <TouchableOpacity
                    style={styles.iconOverlay}
                    onPress={() => {
                      setPickerTarget('detail');
                      setShowTimePicker(true);
                    }}
                  >
                    <Image
                      source={require('../../assets/time_icon.png')}
                      style={styles.inlineIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                placeholder="Optional notes"
                placeholderTextColor="#9CA3AF"
                value={dNotes}
                onChangeText={setDNotes}
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                multiline
              />
            </View>

            <View style={[styles.modalActions, { alignItems: 'center' }]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={() => {
                  if (detailIndex !== null) confirmDone(detailIndex);
                }}
              >
                <Text style={styles.saveText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={onUpdateDetail}
              >
                <Text style={styles.saveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 90 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  screenTitle: { color: '#000000', fontWeight: '700', fontSize: 16 },
  plus: { color: GREEN, fontSize: 22, fontWeight: '700' },

  calendarBlock: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthText: { fontSize: 18, color: '#111827' },
  yearText: { fontSize: 18, color: '#111827' },
  navBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  navText: { fontSize: 16, color: '#000000', fontWeight: '700' },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
  },
  daysGrid: { flexDirection: 'column' },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 36,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  dayCellEmpty: { backgroundColor: '#F9FAFB' },
  dayCellToday: { borderColor: GREEN, borderWidth: 1.5, borderRadius: 6 },
  dayText: { color: '#111827', fontSize: 12 },
  dayTextEmpty: { color: MUTED },
  dayTextToday: { color: GREEN, fontWeight: '700' },
  dayCellDisabled: { backgroundColor: '#F3F4F6' },
  dayTextDisabled: { color: '#D1D5DB' },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    position: 'absolute',
    top: 4,
    right: 4,
  },

  listCard: {
    marginTop: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 12,
  },
  listHeader: { alignItems: 'center', marginBottom: 8 },
  listTitle: { color: '#000000', fontWeight: '700' },
  viewAllText: { color: GREEN, fontWeight: '800' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: GREEN },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
  },
  dateCol: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F7F0',
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateMon: { color: '#111827', fontWeight: '700', fontSize: 10 },
  dateDay: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 18,
  },
  dateYear: { color: '#111827', fontWeight: '700', fontSize: 10 },
  itemDescWrap: { flex: 1, paddingHorizontal: 12 },
  itemPatient: { color: '#111827', fontWeight: '800', marginBottom: 2 },
  itemDesc: { color: MUTED, fontSize: 12 },
  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
  },
  viewBtnText: { color: GREEN, fontWeight: '800' },
  reminderIcon: { width: 20, height: 20, tintColor: GREEN },
  deleteIcon: { width: 20, height: 20, tintColor: '#EF4444', marginLeft: 12 },
  listRowEmpty: {
    height: 42,
    borderTopWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#EAF6F1',
    borderRadius: 6,
    marginTop: 6,
  },

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
  // Reminder banner styles
  reminderBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  reminderText: { color: GREEN, fontWeight: '700' },
  reminderClose: {
    color: GREEN,
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 18,
    paddingLeft: 8,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 6, borderRadius: 14 },
  closeText: { fontSize: 24, color: MUTED, lineHeight: 24 },
  entryTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  entryTypeBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTypeBtnActive: {
    borderColor: GREEN,
    backgroundColor: '#ECFDF5',
  },
  entryTypeText: { color: '#111827', fontWeight: '700' },
  entryTypeTextActive: { color: GREEN },
  formGroup: { marginTop: 10 },
  inputLabel: { color: '#374151', marginBottom: 6, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputWithIcon: { position: 'relative' },
  iconOverlay: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  inlineIcon: { width: 18, height: 18, tintColor: GREEN },
  row2: { flexDirection: 'row', marginTop: 10 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 10,
  },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  saveBtn: { backgroundColor: GREEN },
  cancelText: { color: '#111827', fontWeight: '600' },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  timePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  timePillActive: { borderColor: GREEN, backgroundColor: '#E6FFF5' },
  timePillText: { color: '#111827' },
  timePillTextActive: { color: GREEN, fontWeight: '700' },
});
