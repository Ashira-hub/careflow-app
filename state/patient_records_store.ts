export type AppointmentEntry = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  notes?: string;
  createdAt: number;
};

export type PrescriptionEntry = {
  doctorName: string;
  subject: string;
  quantity: string;
  dosageStrength: string;
  description: string;
  submittedAt: number;
};

export type PatientRecord = {
  id: string; // simple generated id
  name: string; // patient name (keys the group)
  appointments: AppointmentEntry[];
  prescriptions: PrescriptionEntry[];
};

const records: PatientRecord[] = [];

function findOrCreatePatient(name: string): PatientRecord {
  let rec = records.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
  if (!rec) {
    rec = { id: `PR-${Date.now()}-${Math.floor(Math.random()*1000)}`, name: name.trim(), appointments: [], prescriptions: [] };
    records.unshift(rec);
  }
  return rec;
}

export function addAppointment(patientName: string, appt: Omit<AppointmentEntry, 'createdAt'>) {
  const rec = findOrCreatePatient(patientName);
  rec.appointments.unshift({ ...appt, createdAt: Date.now() });
}

export function addPrescription(patientName: string, entry: Omit<PrescriptionEntry, 'submittedAt'>) {
  const rec = findOrCreatePatient(patientName);
  rec.prescriptions.unshift({ ...entry, submittedAt: Date.now() });
}

export function getRecords(): PatientRecord[] {
  return records;
}

export function getLastVisitString(rec: PatientRecord): string {
  const latestAppt = rec.appointments[0]?.createdAt ?? 0;
  const latestRx = rec.prescriptions[0]?.submittedAt ?? 0;
  const ts = Math.max(latestAppt, latestRx);
  if (!ts) return '—';
  const d = new Date(ts);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}

// Backward-compat shims (if any old imports exist)
// Avoid using these in new code
export function addRecordShimDeprecated(patientName: string, summary: string) {
  addAppointment(patientName, { date: '', time: '', notes: summary });
}
