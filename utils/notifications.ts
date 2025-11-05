/// <reference path="../types/notifee.d.ts" />
import notifee, { AndroidImportance, TimestampTrigger, TriggerType } from '@notifee/react-native';

export async function initNotifications() {
  try {
    await notifee.requestPermission();
  } catch {}
  try {
    await notifee.createChannel({
      id: 'doctor-reminders',
      name: 'Doctor Reminders',
      lights: true,
      vibration: true,
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
  } catch {}
}

function toKeyBase(patient: string, date: string, time: string) {
  const base = `${patient}|${date}|${time}`.replace(/\s+/g, ' ').trim();
  return base.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function scheduleAppointmentNotifications(
  apptId: string | number | null | undefined,
  patient: string,
  date: string,
  time: string,
  opts?: { near?: boolean; now?: boolean; customMinutes?: number }
) {
  const keyBase = (apptId != null ? `id_${apptId}` : toKeyBase(patient, date, time));
  const [hhmm, ap] = (time || '').split(' ');
  const [hhStr, mmStr] = (hhmm || '').split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const [y, m, d] = (date || '').split('-').map(Number);
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return;
  const h24 = (hh % 12) + (String(ap).toUpperCase() === 'PM' ? 12 : 0);
  const at = new Date(y, m - 1, d, h24, mm, 0, 0).getTime();
  const near = at - 30 * 60 * 1000;
  const nowTs = Date.now();

  const doNear = opts?.near ?? true;
  const doNow = opts?.now ?? true;
  const custom = (opts?.customMinutes && Number.isFinite(opts.customMinutes) && opts.customMinutes! > 0) ? Math.floor(opts.customMinutes!) : undefined;

  // Near (T - 30m)
  if (doNear && near > nowTs) {
    const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: near, alarmManager: { allowWhileIdle: true } };
    await notifee.createTriggerNotification(
      {
        id: `${keyBase}-near`,
        title: 'Appointment Starting Soon',
        body: `Appointment for ${patient} at ${time} is starting soon.`,
        android: { channelId: 'doctor-reminders', pressAction: { id: 'default' } },
      },
      trigger
    );
  }

  // At time (T)
  if (doNow && at > nowTs) {
    const triggerNow: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: at, alarmManager: { allowWhileIdle: true } };
    await notifee.createTriggerNotification(
      {
        id: `${keyBase}-now`,
        title: 'Appointment Reminder',
        body: `Appointment for ${patient} is now at ${time}.`,
        android: { channelId: 'doctor-reminders', pressAction: { id: 'default' } },
      },
      triggerNow
    );
  }

  // Custom minutes before (single notification)
  if (typeof custom === 'number') {
    const ts = at - custom * 60 * 1000;
    if (ts > nowTs) {
      const triggerCustom: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: ts, alarmManager: { allowWhileIdle: true } };
      await notifee.createTriggerNotification(
        {
          id: `${keyBase}-m${custom}`,
          title: 'Appointment Reminder',
          body: `Appointment for ${patient} is in ${custom} minute${custom === 1 ? '' : 's'} at ${time}.`,
          android: { channelId: 'doctor-reminders', pressAction: { id: 'default' } },
        },
        triggerCustom
      );
    }
  }
}

export async function cancelAppointmentNotifications(apptId: string | number | null | undefined, patient: string, date: string, time: string) {
  const keyBase = (apptId != null ? `id_${apptId}` : toKeyBase(patient, date, time));
  try { await notifee.cancelNotification(`${keyBase}-near`); } catch {}
  try { await notifee.cancelNotification(`${keyBase}-now`); } catch {}
}

export async function cancelAppointmentCustomNotification(apptId: string | number | null | undefined, patient: string, date: string, time: string, minutes: number) {
  const keyBase = (apptId != null ? `id_${apptId}` : toKeyBase(patient, date, time));
  try { await notifee.cancelNotification(`${keyBase}-m${Math.floor(minutes)}`); } catch {}
}

// Display an immediate local notification (for generic events)
export async function showLocalImmediateNotification(title: string, body: string) {
  try {
    await notifee.displayNotification({
      id: `immediate-${Date.now()}`,
      title,
      body,
      android: { channelId: 'doctor-reminders', pressAction: { id: 'default' } },
    });
  } catch {}
}
