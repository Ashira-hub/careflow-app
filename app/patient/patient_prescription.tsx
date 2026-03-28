import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
  quantity?: number;
  dosage?: string;
  instructions?: string;
  date: string; // created date
  doctor?: string;
  doctorId?: string | number;
  doctorSpecialty?: string;
  status?: 'pending' | 'completed' | 'cancelled'; // map from api status
};

type LabRecord = {
  id: string;
  testName: string;
  category?: string;
  date: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  price?: number;
  insurance?: number;
};

type DetailItem =
  | { kind: 'prescription'; data: Prescription }
  | { kind: 'laboratory'; data: LabRecord };

type ListRow = DetailItem;

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

  const getLabRequestChecks = (items: LabRecord[]) => {
    const names = (items || []).map(it =>
      String((it as any)?.testName || '').toUpperCase(),
    );
    const has = (re: RegExp) => names.some(n => re.test(n));
    return {
      cbc: has(/\bCBC\b|COMPLETE\s+BLOOD\s+COUNT/i),
      platelet: has(/PLATELET/i),
      urinalysis: has(/URINALYSIS|URINE/i),
      stool: has(/STOOL|FECAL/i),
      drug: has(/DRUG/i),
      chestXray: has(/CHEST.*X\s*-?RAY|X\s*-?RAY.*CHEST/i),
      fbs: has(/\bFBS\b|FASTING\s+BLOOD\s+SUGAR/i),
      lipid: has(/LIPID/i),
      hbsag: has(/HBASG|HBSAG|HBsAg/i),
    };
  };

  const normalizeMedicineName = (name: string) => {
    const raw = String(name == null ? '' : name).trim();
    if (!raw) return '';

    // Remove trailing dosage-form/type words (only at the end)
    const forms =
      '(tablet|tab|tablets|tabs|capsule|cap|capsules|caps|syrup|suspension|drop|drops|ointment|cream|gel|solution|spray|inhaler|patch|puff|nebulizer|lotion|shampoo|powder|sachet|ampoule|amp|vial|injection|injectable|inj)';

    const withoutParen = raw.replace(
      new RegExp(`\\s*\\(?\\b${forms}\\b\\)?\\s*$`, 'i'),
      '',
    );

    return String(withoutParen || raw).trim();
  };

  const getMedicineText = (rx: any) => {
    const v =
      rx?.medicine ??
      rx?.medicine_name ??
      rx?.medicineName ??
      rx?.medication ??
      rx?.drug ??
      rx?.drug_name ??
      rx?.name ??
      '';
    return normalizeMedicineName(String(v == null ? '' : v));
  };

  const getDoctorSpecialtyText = (rx: any) => {
    const v =
      rx?.doctorSpecialty ??
      rx?.doctor_specialty ??
      rx?.doctorSpeciality ??
      rx?.doctor_speciality_name ??
      rx?.specialty ??
      rx?.speciality ??
      rx?.doctor?.specialty ??
      rx?.doctor?.speciality ??
      '';
    return String(v == null ? '' : v).trim();
  };

  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('Patient');
  const [userAge, setUserAge] = useState('');
  const [userGender, setUserGender] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);

  const [list, setList] = useState<Prescription[]>([]);
  const [labList, setLabList] = useState<LabRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<{
    kind: 'prescription' | 'laboratory';
    data: Prescription[] | LabRecord[] | Prescription | LabRecord;
    isMultiple?: boolean;
  } | null>(null);

  const previewShotRef = React.useRef<any>(null);
  const viewShotModule = React.useMemo(() => {
    try {
      return require('react-native-view-shot');
    } catch {
      return null;
    }
  }, []);
  const ViewShotComponent: any =
    (viewShotModule as any)?.default ?? (viewShotModule as any)?.ViewShot;

  const resolveDefaultExport = React.useCallback((m: any) => {
    try {
      return (m as any)?.default ?? m;
    } catch {
      return m;
    }
  }, []);

  const PreviewShotWrapper = React.useCallback(
    ({ children }: { children: React.ReactNode }) => {
      if (ViewShotComponent) {
        return (
          <ViewShotComponent
            ref={previewShotRef}
            style={styles.previewContent}
            options={{ format: 'png', quality: 1, result: 'base64' }}
          >
            {children}
          </ViewShotComponent>
        );
      }
      return <View style={styles.previewContent}>{children}</View>;
    },
    [ViewShotComponent],
  );
  const [viewMode, setViewMode] = useState<'prescription' | 'laboratory'>(
    'prescription',
  );

  const loadUserData = React.useCallback(async () => {
    try {
      const session = await AsyncStorage.getItem('session');
      if (session) {
        const sess = JSON.parse(session);
        const user = sess?.user || sess;
        const derivedName =
          user?.full_name ||
          user?.fullName ||
          user?.name ||
          [user?.firstName, user?.lastName].filter(Boolean).join(' ');
        setUserName(derivedName || 'Patient');

        const gRaw = user?.gender || '';
        setUserGender(String(gRaw || '').trim());

        const dobRaw =
          user?.birthdate ||
          user?.dateOfBirth ||
          user?.dob ||
          user?.date_of_birth ||
          '';
        const computeAgeYears = (dob: string) => {
          const d = new Date(String(dob || ''));
          if (!dob || Number.isNaN(d.getTime())) return '';
          const today = new Date();
          let age = today.getFullYear() - d.getFullYear();
          const m = today.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
          return age >= 0 ? String(age) : '';
        };
        setUserAge(computeAgeYears(String(dobRaw || '')));

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

      const fmt = (s: string) => esc(s).replace(/\n/g, '<br/>');

      const first = (items || [])[0] as Prescription | undefined;
      const dateText = first?.date
        ? new Date(first.date).toLocaleDateString()
        : new Date().toLocaleDateString();
      const doctorText = first?.doctor ? `Dr. ${first.doctor}` : '';
      const doctorId = first?.doctorId;
      const ageText = String(userAge || '').trim();
      const sexText = String(userGender || '').trim();
      const rxIdRaw = first?.id != null ? String(first.id) : '';
      const rxDigits = rxIdRaw.match(/\d+/g)?.join('') || '';
      const rxNo = rxDigits || String(Date.now());
      const documentCode = `CAREFLOW.RX.${rxNo}`;
      const licLabelText =
        doctorId != null && String(doctorId).trim().length > 0
          ? `LIC.NO.${String(doctorId)}`
          : 'LIC. NO.';
      const specialtyText = String(
        (first as any)?.doctorSpecialty ||
          (first as any)?.doctor_specialty ||
          (first as any)?.specialty ||
          (first as any)?.speciality ||
          (first as any)?.doctor?.specialty ||
          (first as any)?.doctor?.speciality ||
          '',
      ).trim();

      const readMedText = (p: any) =>
        normalizeMedicineName(
          String(
            p?.medicine ??
              p?.medicine_name ??
              p?.medicineName ??
              p?.medication ??
              p?.drug ??
              p?.drug_name ??
              p?.name ??
              '',
          ).trim(),
        );

      const rxItems = (items || [])
        .map((p, idx) => {
          const qtyText =
            p.quantity != null && String(p.quantity).trim().length > 0
              ? String(p.quantity)
              : '';
          const doseText = String(p.dosage || '').trim();
          const instr = String(p.instructions || '').trim();
          const medText =
            readMedText(p) ||
            normalizeMedicineName(String((p as any)?.medicine || '').trim());
          return `
            <div class="medRow">
              <div class="medLine">
                <span class="medNo">${esc(String(idx + 1))}.</span>
                <span class="medName">${esc(String(medText || ''))}</span>
                <span class="medQty">${esc(String(qtyText || ''))}</span>
                <span class="medDose">${esc(String(doseText || ''))}</span>
                ${
                  instr
                    ? `<span class="medInstrInline">${fmt(instr)}</span>`
                    : ''
                }
              </div>
            </div>
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
              @page { margin: 16mm; }
              body { font-family: "Times New Roman", Times, serif; color: #111827; }
              .sheet { width: 100%; }
              .header { display: flex; align-items: stretch; border: 1px solid #111827; }
              .logoCell { width: 70px; border-right: 1px solid #111827; display: flex; align-items: center; justify-content: center; padding: 8px; }
              .logoCircle { width: 44px; height: 44px; border: 2px solid #111827; border-radius: 22px; }
              .titleCell { flex: 1; padding: 8px 10px; border-right: 1px solid #111827; }
              .school { font-size: 14px; font-weight: 700; letter-spacing: 0.2px; text-align: center; }
              .subject { font-size: 11px; margin-top: 2px; }
              .formTitle { font-size: 16px; font-weight: 800; text-align: center; margin-top: 4px; }
              .docCell { width: 170px; padding: 8px 10px; font-size: 10px; }
              .docRow { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .docLabel { font-weight: 700; }
              .info { margin-top: 14px; font-size: 12px; }
              .infoRow { display: flex; gap: 14px; margin-bottom: 8px; }
              .field { flex: 1; display: flex; gap: 8px; }
              .fieldLabel { min-width: 44px; }
              .line { flex: 1; border-bottom: 1px solid #111827; min-height: 14px; }
              .lineText { display: inline-block; padding-bottom: 2px; }
              .rxRow { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
              .rx { font-size: 72px; font-weight: 800; line-height: 0.9; padding-top: 2px; }
              .rxBody { width: 100%; min-height: 420px; padding-top: 0px; }
              .medRow { margin-bottom: 10px; }
              .medLine { font-size: 13px; display: flex; align-items: flex-end; gap: 8px; }
              .medNo { display: inline-block; width: 18px; }
              .medName { flex: 1; min-width: 160px; font-weight: 700; }
              .medQty { width: 44px; text-align: right; font-size: 12px; }
              .medDose { width: 86px; text-align: right; font-size: 12px; }
              .medInstrInline { flex: 1.3; font-size: 12px; margin-left: 10px; }
              .medMeta { margin-left: 8px; font-size: 12px; }
              .medInstr { margin-left: 18px; margin-top: 3px; font-size: 12px; }
              .sign { margin-top: 18px; display: flex; justify-content: flex-end; }
              .signBox { width: 260px; font-size: 11px; }
              .signName { text-align: right; font-weight: 800; text-decoration: underline; }
              .signSpec { text-align: right; font-weight: 700; margin-top: 2px; }
              .credRow { display: flex; justify-content: space-between; margin-top: 6px; }
              .credLabel { width: 60px; }
              .credLine { flex: 1; border-bottom: 1px solid #111827; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="header">
                <div class="logoCell"><div class="logoCircle"></div></div>
                <div class="titleCell">
                  <div class="school">Careflow</div>
                  <div class="subject">Subject</div>
                  <div class="formTitle">PRESCRIPTION FORM</div>
                </div>
                <div class="docCell">
                  <div class="docRow"><span class="docLabel">Document Code:</span><span>${esc(
                    documentCode,
                  )}</span></div>
                  <div class="docRow"><span class="docLabel">Rev.:</span><span>0</span></div>
                  <div class="docRow"><span class="docLabel">Effectivity Date:</span><span>14.02.2025</span></div>
                </div>
              </div>

              <div class="info">
                <div class="infoRow">
                  <div class="field">
                    <div class="fieldLabel">Name:</div>
                    <div class="line"><span class="lineText">${esc(
                      patient || '',
                    )}</span></div>
                  </div>
                </div>
                <div class="infoRow">
                  <div class="field">
                    <div class="fieldLabel">Age:</div>
                    <div class="line"><span class="lineText">${esc(
                      ageText,
                    )}</span></div>
                  </div>
                  <div class="field">
                    <div class="fieldLabel">Sex:</div>
                    <div class="line"><span class="lineText">${esc(
                      sexText,
                    )}</span></div>
                  </div>
                  <div class="field">
                    <div class="fieldLabel">Date:</div>
                    <div class="line"><span class="lineText">${esc(
                      String(dateText || ''),
                    )}</span></div>
                  </div>
                </div>
              </div>

              <div class="rxRow">
                <div class="rx">&#x211E;</div>
                <div class="rxBody">
                  ${rxItems || ''}
                </div>
              </div>

              <div class="sign">
                <div class="signBox">
                  <div class="signName">${esc(doctorText || '')}</div>
                  ${
                    specialtyText
                      ? `<div class="signSpec">${esc(specialtyText)}</div>`
                      : ''
                  }
                  <div class="credRow"><div class="credLabel">${esc(
                    licLabelText,
                  )}</div><div class="credLine"></div></div>
                  <div class="credRow"><div class="credLabel">PTR</div><div class="credLine"></div></div>
                  <div class="credRow"><div class="credLabel">S2</div><div class="credLine"></div></div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    },
    [userAge, userGender],
  );

  const buildLabReceiptHtmlNoPricing = React.useCallback(
    (items: LabRecord[], patient: string, receiptDate?: string) => {
      const esc = (s: string) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const ageText = String(userAge || '').trim();
      const sexText = String(userGender || '').trim();

      const first = (items || [])[0] as LabRecord | undefined;
      const labIdRaw = first?.id != null ? String(first.id) : '';
      const labDigits = labIdRaw.match(/\d+/g)?.join('') || '';
      const labNo = labDigits || String(Date.now());
      const documentCode = `CAREFLOW.CLINIC.LAB.R.${labNo}`;

      const selected = getLabRequestChecks(items);
      const list = [
        { key: 'cbc', label: 'CBC' },
        { key: 'platelet', label: 'PLATELET COUNT' },
        { key: 'urinalysis', label: 'URINALYSIS' },
        { key: 'stool', label: 'STOOL EXAM' },
        { key: 'drug', label: 'DRUG TEST' },
        { key: 'chestXray', label: 'CHEST XRAY PA' },
        { key: 'fbs', label: 'FBS' },
        { key: 'lipid', label: 'LIPID PROFILE' },
        { key: 'hbsag', label: 'HBASG' },
      ] as const;

      const rows = list
        .map(it => {
          const checked = Boolean((selected as any)?.[it.key]);
          return `
            <div class="chkRow">
              <span class="box">${checked ? '&#10003;' : ''}</span>
              <span class="chkText">${esc(it.label)}</span>
            </div>
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
              @page { margin: 16mm; }
              body { font-family: "Times New Roman", Times, serif; color: #111827; }
              .sheet { width: 100%; }
              .header { display: flex; align-items: stretch; border: 1px solid #111827; }
              .logoCell { width: 70px; border-right: 1px solid #111827; display: flex; align-items: center; justify-content: center; padding: 8px; }
              .logoCircle { width: 44px; height: 44px; border: 2px solid #111827; border-radius: 22px; }
              .titleCell { flex: 1; padding: 8px 10px; border-right: 1px solid #111827; }
              .school { font-size: 14px; font-weight: 700; letter-spacing: 0.2px; text-align: center; }
              .subject { font-size: 11px; margin-top: 2px; }
              .formTitle { font-size: 16px; font-weight: 800; text-align: center; margin-top: 4px; }
              .docCell { width: 170px; padding: 8px 10px; font-size: 10px; }
              .docRow { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .docLabel { font-weight: 700; }
              .info { margin-top: 14px; font-size: 12px; }
              .infoRow { display: flex; gap: 14px; margin-bottom: 8px; }
              .field { flex: 1; display: flex; gap: 8px; }
              .fieldLabel { min-width: 44px; }
              .line { flex: 1; border-bottom: 1px solid #111827; min-height: 14px; }
              .lineText { display: inline-block; padding-bottom: 2px; }
              .sectionTitle { margin-top: 18px; font-size: 12px; font-weight: 800; }
              .checks { margin-top: 10px; padding-left: 20px; }
              .chkRow { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
              .box { width: 18px; height: 18px; border: 1px solid #111827; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; }
              .chkText { font-size: 18px; font-weight: 900; letter-spacing: 0.3px; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="header">
                <div class="logoCell"><div class="logoCircle"></div></div>
                <div class="titleCell">
                  <div class="school">Careflow</div>
                  <div class="subject">Subject</div>
                  <div class="formTitle">LABORATORY REQUEST FORM</div>
                </div>
                <div class="docCell">
                  <div class="docRow"><span class="docLabel">Document Code:</span><span>${esc(
                    documentCode,
                  )}</span></div>
                  <div class="docRow"><span class="docLabel">Rev.:</span><span>0</span></div>
                  <div class="docRow"><span class="docLabel">Effectivity Date:</span><span>14.02.2025</span></div>
                </div>
              </div>

              <div class="info">
                <div class="infoRow">
                  <div class="field">
                    <div class="fieldLabel">Name:</div>
                    <div class="line"><span class="lineText">${esc(
                      patient || '',
                    )}</span></div>
                  </div>
                </div>
                <div class="infoRow">
                  <div class="field">
                    <div class="fieldLabel">Age:</div>
                    <div class="line"><span class="lineText">${esc(
                      ageText,
                    )}</span></div>
                  </div>
                  <div class="field">
                    <div class="fieldLabel">Sex:</div>
                    <div class="line"><span class="lineText">${esc(
                      sexText,
                    )}</span></div>
                  </div>
                </div>
              </div>

              <div class="sectionTitle">LABORATORY REQUEST</div>
              <div class="checks">
                ${rows || ''}
              </div>
            </div>
          </body>
        </html>
      `;
    },
    [userAge, userGender],
  );

  const buildLabReceiptHtml = React.useCallback(
    (items: LabRecord[], patient: string, receiptDate?: string) => {
      const esc = (s: string) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

      const dateText = receiptDate
        ? new Date(receiptDate).toLocaleString()
        : new Date().toLocaleString();

      const subtotal = (items || []).reduce((sum, it) => {
        const p = Number((it as any)?.price);
        return sum + (Number.isFinite(p) ? p : 0);
      }, 0);
      const insuranceCovered = (items || []).reduce((sum, it) => {
        const ins = Number((it as any)?.insurance);
        return sum + (Number.isFinite(ins) ? ins : 0);
      }, 0);
      const total = Math.max(0, subtotal - insuranceCovered);

      const rows = (items || [])
        .map(it => {
          const p = Number((it as any)?.price);
          const ins = Number((it as any)?.insurance);
          const price = Number.isFinite(p) ? p : 0;
          const insurance = Number.isFinite(ins) ? ins : 0;
          const pays = Math.max(0, price - insurance);
          return `
            <tr>
              <td style="border: 1px solid #111827; padding: 8px; font-size: 12px;">1</td>
              <td style="border: 1px solid #111827; padding: 8px; font-size: 12px;">${esc(
                String(it.testName || ''),
              )}</td>
              <td style="border: 1px solid #111827; padding: 8px; font-size: 12px; text-align: right;">${esc(
                money(price),
              )}</td>
              <td style="border: 1px solid #111827; padding: 8px; font-size: 12px; text-align: right;">${esc(
                money(insurance),
              )}</td>
              <td style="border: 1px solid #111827; padding: 8px; font-size: 12px; text-align: right;">${esc(
                money(pays),
              )}</td>
            </tr>
          `;
        })
        .join('');

      const receiptNo = items?.[0]?.id ? String(items[0].id) : '';

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial; padding: 16px; color: #111827; }
              .sheet { border: 2px solid #111827; padding: 12px; }
              .top { display: flex; justify-content: space-between; align-items: flex-start; }
              .lab { font-size: 64px; font-weight: 900; line-height: 1; }
              .right { text-align: right; }
              .name { font-weight: 800; }
              .sub { font-size: 12px; }
              .date { font-size: 12px; font-weight: 700; margin-top: 2px; }
              .line { margin: 10px 0 12px; border-top: 2px solid #111827; }
              table { width: 100%; border-collapse: collapse; }
              th { border: 1px solid #111827; padding: 8px; font-size: 12px; text-align: left; background: #F3F4F6; }
              .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
              .totalsBox { min-width: 240px; }
              .totLine { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
              .totLabel { font-weight: 700; }
              .totVal { font-weight: 800; }
              .totalBox { border: 1px solid #111827; padding: 10px; text-align: center; font-size: 18px; font-weight: 900; }
              .footer { margin-top: 12px; font-size: 12px; color: #6B7280; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="top">
                <div class="lab">Lab</div>
                <div class="right">
                  <div class="name">Central Diagnostics Laboratory</div>
                  <div class="sub">123 Health Ave, Uptown • TEL: (02) 555-0199</div>
                  <div class="date">Date: ${esc(dateText)}</div>
                </div>
              </div>
              <div class="line"></div>
              <table>
                <thead>
                  <tr>
                    <th style="width:14%">Qty</th>
                    <th style="width:36%">Test</th>
                    <th style="width:16%">Price</th>
                    <th style="width:17%">Insurance</th>
                    <th style="width:17%">Patient Pays</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || ''}
                </tbody>
              </table>

              <div class="totals">
                <div class="totalsBox">
                  <div class="totLine"><div class="totLabel">Subtotal:</div><div class="totVal">${esc(
                    money(subtotal),
                  )}</div></div>
                  <div class="totLine"><div class="totLabel">Insurance Covered:</div><div class="totVal">${esc(
                    money(insuranceCovered),
                  )}</div></div>
                  <div class="totalBox">Total: ${esc(money(total))}</div>
                </div>
              </div>

              <div class="footer">
                Receipt No: <b>${esc(receiptNo)}</b><br/>
                Patient: <b>${esc(patient || 'Patient')}</b>
              </div>
            </div>
          </body>
        </html>
      `;
    },
    [],
  );

  const tryPrintPreviewFromViewShot = React.useCallback(async () => {
    try {
      if (!ViewShotComponent) return false;

      const shot = previewShotRef.current;
      if (!shot || typeof shot.capture !== 'function') return false;

      const base64 = await shot.capture({
        format: 'png',
        quality: 1,
        result: 'base64',
      });

      if (!base64 || typeof base64 !== 'string') return false;

      let RNHTMLtoPDF: any;
      let RNPrint: any;
      try {
        RNHTMLtoPDF = resolveDefaultExport(require('react-native-html-to-pdf'));
      } catch {}
      try {
        RNPrint = resolveDefaultExport(require('react-native-print'));
      } catch {}

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              @page { margin: 12mm; }
              body { margin: 0; padding: 0; }
              .wrap { width: 100%; }
              img { width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <img src="data:image/png;base64,${base64}" />
            </div>
          </body>
        </html>
      `;

      if (RNHTMLtoPDF?.convert) {
        const fileName = `careflow_preview_${Date.now()}`;
        const pdf = await RNHTMLtoPDF.convert({
          html,
          fileName,
          base64: false,
        });
        const filePath = pdf?.filePath;
        if (filePath && RNPrint?.print) {
          await RNPrint.print({ filePath });
          return true;
        }
        if (filePath) return false;
      }

      if (RNPrint?.print) {
        await RNPrint.print({ html });
        return true;
      }

      Alert.alert(
        'Print',
        'Printing is unavailable in this build. Please rebuild the app so the native print/PDF modules can be loaded.',
      );

      return false;
    } catch {
      return false;
    }
  }, [ViewShotComponent]);

  const handlePrint = React.useCallback(async () => {
    if (!list || list.length === 0) {
      Alert.alert('Print', 'No prescriptions to print.');
      return;
    }
    // Show print preview modal for the entire prescription list
    setPrintPreviewData({ kind: 'prescription', data: list, isMultiple: true });
    setShowPrintPreview(true);
  }, [list]);

  const handleDownloadPdf = React.useCallback(async () => {
    try {
      if (!list || list.length === 0) {
        Alert.alert('Download', 'No prescriptions to download.');
        return;
      }

      let RNHTMLtoPDF: any;
      try {
        RNHTMLtoPDF = resolveDefaultExport(require('react-native-html-to-pdf'));
      } catch {
        // Fallback: Create a text representation of prescriptions
        const lines = (list || []).map((p, i) => {
          const d = new Date(p.date || '').toLocaleDateString();
          return `${i + 1}. ${p.medicine}${p.dosage ? ` (${p.dosage})` : ''}${
            p.instructions ? ` - ${p.instructions}` : ''
          }${p.doctor ? ` • Dr. ${p.doctor}` : ''} • ${d}${
            p.status ? ` • ${p.status}` : ''
          }`;
        });

        const patient = userName || 'Patient';
        const header = `PRESCRIPTION LIST FOR ${patient.toUpperCase()}\nGenerated: ${new Date().toLocaleString()}\n${'='.repeat(
          50,
        )}\n\n`;
        const message = header + lines.join('\n\n');

        await Share.share({
          message,
          title: `Prescriptions for ${patient}`,
        });
        return;
      }

      if (!RNHTMLtoPDF?.convert) {
        const patient = userName || 'Patient';
        const lines = (list || []).map((p, i) => {
          const d = new Date(p.date || '').toLocaleDateString();
          return `${i + 1}. ${p.medicine}${p.dosage ? ` (${p.dosage})` : ''}${
            p.instructions ? ` - ${p.instructions}` : ''
          }${p.doctor ? ` • Dr. ${p.doctor}` : ''} • ${d}${
            p.status ? ` • ${p.status}` : ''
          }`;
        });
        await Share.share({
          message: lines.join('\n'),
          title: `Prescriptions for ${patient}`,
        });
        return;
      }

      const patient = userName || 'Patient';
      const html = buildPrescriptionHtml(list, String(patient));
      const fileName = `prescriptions_${Date.now()}`;
      const pdf = await RNHTMLtoPDF.convert({ html, fileName, base64: false });
      const filePath = pdf?.filePath;
      if (!filePath) {
        Alert.alert('Download', 'Failed to generate PDF.');
        return;
      }

      // Share the PDF file
      const shareOptions =
        Platform.OS === 'ios'
          ? {
              url: `file://${filePath}`,
              message: `Prescriptions for ${patient}`,
            }
          : { url: filePath, message: `Prescriptions for ${patient}` };
      await Share.share(shareOptions);
    } catch {
      Alert.alert('Download', 'Failed to download PDF.');
    }
  }, [buildPrescriptionHtml, list, userName]);

  const buildSingleReceiptHtml = React.useCallback(
    (item: DetailItem, patient: string) => {
      const esc = (s: string) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const fmt = (s: string) => esc(s).replace(/\n/g, '<br/>');

      if (item.kind === 'prescription') {
        const p = item.data as Prescription;
        const dateText = p?.date
          ? new Date(p.date).toLocaleDateString()
          : new Date().toLocaleDateString();
        const doctorText = p?.doctor ? `Dr. ${p.doctor}` : '';
        const doctorId = p?.doctorId;
        const ageText = String(userAge || '').trim();
        const sexText = String(userGender || '').trim();
        const rxIdRaw = p?.id != null ? String(p.id) : '';
        const rxDigits = rxIdRaw.match(/\d+/g)?.join('') || '';
        const rxNo = rxDigits || String(Date.now());
        const documentCode = `CAREFLOW.RX.${rxNo}`;
        const licLabelText =
          doctorId != null && String(doctorId).trim().length > 0
            ? `LIC.NO.${String(doctorId)}`
            : 'LIC. NO.';
        const specialtyText = String(
          (p as any)?.doctorSpecialty ||
            (p as any)?.doctor_specialty ||
            (p as any)?.specialty ||
            (p as any)?.speciality ||
            (p as any)?.doctor?.specialty ||
            (p as any)?.doctor?.speciality ||
            '',
        ).trim();
        const qtyText =
          p?.quantity != null && String(p.quantity).trim().length > 0
            ? String(p.quantity)
            : '';
        const doseText = String(p?.dosage || '').trim();
        const instr = String(p?.instructions || '').trim();
        const medText =
          normalizeMedicineName(
            String(
              (p as any)?.medicine ??
                (p as any)?.medicine_name ??
                (p as any)?.medicineName ??
                (p as any)?.medication ??
                (p as any)?.drug ??
                (p as any)?.drug_name ??
                (p as any)?.name ??
                '',
            ).trim(),
          ) || normalizeMedicineName(String((p as any)?.medicine || '').trim());

        const rxItems = `
          <div class="medRow">
            <div class="medLine">
              <span class="medNo">1.</span>
              <span class="medName">${esc(String(medText || ''))}</span>
              <span class="medQty">${esc(String(qtyText || ''))}</span>
              <span class="medDose">${esc(String(doseText || ''))}</span>
              ${
                instr ? `<span class="medInstrInline">${fmt(instr)}</span>` : ''
              }
            </div>
          </div>
        `;

        return `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <style>
                @page { margin: 16mm; }
                body { font-family: "Times New Roman", Times, serif; color: #111827; }
                .sheet { width: 100%; }
                .header { display: flex; align-items: stretch; border: 1px solid #111827; }
                .logoCell { width: 70px; border-right: 1px solid #111827; display: flex; align-items: center; justify-content: center; padding: 8px; }
                .logoCircle { width: 44px; height: 44px; border: 2px solid #111827; border-radius: 22px; }
                .titleCell { flex: 1; padding: 8px 10px; border-right: 1px solid #111827; }
                .school { font-size: 14px; font-weight: 700; letter-spacing: 0.2px; text-align: center; }
                .subject { font-size: 11px; margin-top: 2px; }
                .formTitle { font-size: 16px; font-weight: 800; text-align: center; margin-top: 4px; }
                .docCell { width: 170px; padding: 8px 10px; font-size: 10px; }
                .docRow { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .docLabel { font-weight: 700; }
                .info { margin-top: 14px; font-size: 12px; }
                .infoRow { display: flex; gap: 14px; margin-bottom: 8px; }
                .field { flex: 1; display: flex; gap: 8px; }
                .fieldLabel { min-width: 44px; }
                .line { flex: 1; border-bottom: 1px solid #111827; min-height: 14px; }
                .lineText { display: inline-block; padding-bottom: 2px; }
                .rxRow { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
                .rx { font-size: 72px; font-weight: 800; line-height: 0.9; padding-top: 2px; }
                .rxBody { width: 100%; min-height: 420px; padding-top: 0px; }
                .medRow { margin-bottom: 10px; }
                .medLine { font-size: 13px; display: flex; align-items: flex-end; gap: 8px; }
                .medNo { display: inline-block; width: 18px; }
                .medName { flex: 1; min-width: 160px; font-weight: 700; }
                .medQty { width: 44px; text-align: right; font-size: 12px; }
                .medDose { width: 86px; text-align: right; font-size: 12px; }
                .medInstrInline { flex: 1.3; font-size: 12px; margin-left: 10px; }
                .medMeta { margin-left: 8px; font-size: 12px; }
                .medInstr { margin-left: 18px; margin-top: 3px; font-size: 12px; }
                .sign { margin-top: 18px; display: flex; justify-content: flex-end; }
                .signBox { width: 260px; font-size: 11px; }
                .signName { text-align: right; font-weight: 800; text-decoration: underline; }
                .signSpec { text-align: right; font-weight: 700; margin-top: 2px; }
                .credRow { display: flex; justify-content: space-between; margin-top: 6px; }
                .credLabel { width: 60px; }
                .credLine { flex: 1; border-bottom: 1px solid #111827; }
              </style>
            </head>
            <body>
              <div class="sheet">
                <div class="header">
                  <div class="logoCell"><div class="logoCircle"></div></div>
                  <div class="titleCell">
                    <div class="school">Careflow</div>
                    <div class="subject">Subject</div>
                    <div class="formTitle">PRESCRIPTION FORM</div>
                  </div>
                  <div class="docCell">
                    <div class="docRow"><span class="docLabel">Document Code:</span><span>${esc(
                      documentCode,
                    )}</span></div>
                    <div class="docRow"><span class="docLabel">Rev.:</span><span>0</span></div>
                    <div class="docRow"><span class="docLabel">Effectivity Date:</span><span>14.02.2025</span></div>
                  </div>
                </div>

                <div class="info">
                  <div class="infoRow">
                    <div class="field">
                      <div class="fieldLabel">Name:</div>
                      <div class="line"><span class="lineText">${esc(
                        patient || '',
                      )}</span></div>
                    </div>
                  </div>
                  <div class="infoRow">
                    <div class="field">
                      <div class="fieldLabel">Age:</div>
                      <div class="line"><span class="lineText">${esc(
                        ageText,
                      )}</span></div>
                    </div>
                    <div class="field">
                      <div class="fieldLabel">Sex:</div>
                      <div class="line"><span class="lineText">${esc(
                        sexText,
                      )}</span></div>
                    </div>
                    <div class="field">
                      <div class="fieldLabel">Date:</div>
                      <div class="line"><span class="lineText">${esc(
                        String(dateText || ''),
                      )}</span></div>
                    </div>
                  </div>
                </div>

                <div class="rxRow">
                  <div class="rx">&#x211E;</div>
                  <div class="rxBody">
                    ${rxItems}
                  </div>
                </div>

                <div class="sign">
                  <div class="signBox">
                    <div class="signName">${esc(doctorText || '')}</div>
                    ${
                      specialtyText
                        ? `<div class="signSpec">${esc(specialtyText)}</div>`
                        : ''
                    }
                    <div class="credRow"><div class="credLabel">${esc(
                      licLabelText,
                    )}</div><div class="credLine"></div></div>
                    <div class="credRow"><div class="credLabel">PTR</div><div class="credLine"></div></div>
                    <div class="credRow"><div class="credLabel">S2</div><div class="credLine"></div></div>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      }

      const labItem = item as { kind: 'laboratory'; data: LabRecord };
      const created = (labItem.data as any)?.date;
      return buildLabReceiptHtmlNoPricing(
        [labItem.data],
        String(patient || 'Patient'),
        String(created || ''),
      );
    },
    [userAge, userGender, buildLabReceiptHtmlNoPricing],
  );

  const printHtmlDoc = React.useCallback(
    async (html: string, fallbackMessage?: string) => {
      try {
        let RNHTMLtoPDF: any;
        let RNPrint: any;
        try {
          RNHTMLtoPDF = resolveDefaultExport(
            require('react-native-html-to-pdf'),
          );
        } catch {}
        try {
          RNPrint = resolveDefaultExport(require('react-native-print'));
        } catch {}

        if (RNHTMLtoPDF?.convert) {
          try {
            const fileName = `careflow_${Date.now()}`;
            const pdf = await RNHTMLtoPDF.convert({
              html,
              fileName,
              base64: false,
            });
            const filePath = pdf?.filePath;
            if (filePath) {
              if (RNPrint?.print) {
                await RNPrint.print({ filePath });
                return;
              }

              Alert.alert(
                'Print',
                'Printing is unavailable in this build. Please rebuild the app so the native print/PDF modules can be loaded.',
              );
              return;
            }
          } catch {}
        }

        if (RNPrint?.print) {
          await RNPrint.print({ html });
          return;
        }

        let ExpoPrint: any;
        try {
          ExpoPrint = resolveDefaultExport(require('expo-print'));
        } catch {}

        if (ExpoPrint?.printToFileAsync) {
          const pdf = await ExpoPrint.printToFileAsync({ html, base64: false });
          const uri = pdf?.uri;
          if (uri && ExpoPrint?.printAsync) {
            await ExpoPrint.printAsync({ uri });
            return;
          }
          if (uri) {
            Alert.alert(
              'Print',
              'Printing is unavailable in this build. Please rebuild the app so the native print/PDF modules can be loaded.',
            );
            return;
          }
        }

        if (ExpoPrint?.printAsync) {
          await ExpoPrint.printAsync({ html });
          return;
        }

        Alert.alert(
          'Print',
          'Printing is unavailable in this build. Please rebuild the app so the native print/PDF modules can be loaded.',
        );
      } catch {
        Alert.alert('Print', 'Failed to print.');
      }
    },
    [],
  );

  const handlePrintSelected = React.useCallback(async () => {
    try {
      if (!selected) return;
      const patient = userName || 'Patient';

      const html =
        selected.kind === 'laboratory'
          ? buildLabReceiptHtmlNoPricing(
              labList.filter(
                (r: any) =>
                  dateKey(r.date) === dateKey((selected.data as any).date),
              ),
              String(patient),
              String((selected.data as any).date || ''),
            )
          : buildSingleReceiptHtml(selected, String(patient));

      const msg =
        selected.kind === 'prescription'
          ? `Prescription: ${
              getMedicineText(selected.data) ||
              selected.data.medicine ||
              'Prescription'
            }${selected.data.dosage ? ` • ${selected.data.dosage}` : ''}${
              selected.data.instructions
                ? ` • ${selected.data.instructions}`
                : ''
            }`
          : `Laboratory: ${selected.data.testName}${
              selected.data.category ? ` • ${selected.data.category}` : ''
            }${selected.data.notes ? ` • ${selected.data.notes}` : ''}`;

      await printHtmlDoc(html, msg);
    } catch {
      Alert.alert('Print', 'Failed to print PDF.');
    }
  }, [
    buildLabReceiptHtmlNoPricing,
    buildSingleReceiptHtml,
    getMedicineText,
    labList,
    printHtmlDoc,
    selected,
    userName,
  ]);

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
          rawStatus === 'completed' ||
          rawStatus === 'dispensed' ||
          rawStatus === 'accepted'
            ? 'completed'
            : rawStatus === 'cancelled' || rawStatus === 'rejected'
            ? 'cancelled'
            : 'pending';

        const readMed = (v: any) => {
          if (v == null) return '';
          if (typeof v === 'string' || typeof v === 'number') return String(v);
          if (typeof v === 'object') {
            return String(
              v?.name ??
                v?.medicine ??
                v?.medicine_name ??
                v?.medicineName ??
                v?.title ??
                v?.subject ??
                '',
            );
          }
          return '';
        };

        const medicineText = String(
          readMed(r?.medicine) ||
            readMed(r?.medicine_name) ||
            readMed(r?.medicineName) ||
            readMed(r?.drug) ||
            readMed(r?.drug_name) ||
            readMed(r?.subject) ||
            '',
        ).trim();
        const specialtyText = String(
          r?.doctor_specialty ??
            r?.doctorSpecialty ??
            r?.specialty ??
            r?.speciality ??
            r?.doctor?.specialty ??
            r?.doctor?.speciality ??
            '',
        ).trim();
        return {
          id: String(r?.id || `${r?.patient_name || ''}-${date}`),
          medicine: medicineText || 'Prescription',
          quantity:
            r?.quantity != null && Number.isFinite(Number(r.quantity))
              ? Number(r.quantity)
              : undefined,
          dosage: r?.dosage_strength
            ? String(r.dosage_strength)
            : r?.dosage
            ? String(r.dosage)
            : undefined,
          instructions: r?.instruction
            ? String(r.instruction)
            : r?.instructions
            ? String(r.instructions)
            : r?.description
            ? String(r.description)
            : undefined,
          date,
          doctor: r?.doctor_name ? String(r.doctor_name) : undefined,
          doctorId:
            r?.doctor_id ??
            r?.doctorId ??
            r?.doctor_user_id ??
            r?.doctorUserId ??
            r?.doctor?.id ??
            r?.doctor?.userId ??
            r?.doctor?.user_id ??
            undefined,
          doctorSpecialty: specialtyText || undefined,
          status,
        } as Prescription;
      });

      // Sort newest first
      mapped.sort((a, b) => {
        const ta = Date.parse(a.date || '') || 0;
        const tb = Date.parse(b.date || '') || 0;
        return tb - ta;
      });
      setList(mapped.filter(p => p?.status === 'pending'));
    } catch {}
  }, [getAuthHeaders, getCurrentUserName]);

  const loadLabRecords = React.useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const myName = (await getCurrentUserName()) || '';
      const myId = await getCurrentUserId();

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

      const patientMatches = (r: any) => {
        const pid = r?.patientId ?? r?.patient_id ?? r?.patientID;
        const pname = r?.patient_name ?? r?.patientName ?? r?.patient;
        if (pid != null && myId != null) return String(pid) === String(myId);
        return nameMatches(String(pname || ''), String(myName || ''));
      };

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

      const data = await fetchFirstOk([
        '/api/lab-tests',
        '/api/lab_tests',
        '/api/lab-tests/all',
        '/api/lab_tests/all',
        '/api/lab-records',
      ]);
      const rows = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.rows)
        ? (data as any).rows
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray((data as any)?.results)
        ? (data as any).results
        : [];

      const mine = (rows || []).filter(patientMatches);

      const mapped: LabRecord[] = mine.map((r: any) => {
        const date = String(r?.date || r?.createdAt || r?.created_at || '');
        const rawStatus = String(r?.status || '').toLowerCase();
        const status: LabRecord['status'] =
          rawStatus === 'completed' || rawStatus === 'done'
            ? 'completed'
            : rawStatus === 'cancelled' || rawStatus === 'rejected'
            ? 'cancelled'
            : 'pending';
        return {
          id: String(r?.id || `${r?.patient || ''}-${date}`),
          testName: String(
            r?.test_name ||
              r?.testName ||
              r?.test ||
              r?.lab_test ||
              r?.labTest ||
              'Laboratory',
          ),
          category: r?.category ? String(r.category) : undefined,
          date,
          notes: r?.notes
            ? String(r.notes)
            : r?.description
            ? String(r.description)
            : r?.remarks
            ? String(r.remarks)
            : undefined,
          status,
          price:
            r?.price != null && Number.isFinite(Number(r.price))
              ? Number(r.price)
              : undefined,
          insurance:
            r?.insurance != null && Number.isFinite(Number(r.insurance))
              ? Number(r.insurance)
              : undefined,
        } as LabRecord;
      });

      mapped.sort((a, b) => {
        const ta = Date.parse(a.date || '') || 0;
        const tb = Date.parse(b.date || '') || 0;
        return tb - ta;
      });
      setLabList(mapped.filter(r => r?.status === 'pending'));
    } catch {}
  }, [getAuthHeaders, getCurrentUserId, getCurrentUserName]);

  useFocusEffect(
    React.useCallback(() => {
      loadPrescriptions();
      loadLabRecords();
      loadUserData();
      syncUnread();
      return () => {};
    }, [loadLabRecords, loadPrescriptions, loadUserData, syncUnread]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadPrescriptions(), loadLabRecords()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadLabRecords, loadPrescriptions]);

  const filtered: ListRow[] = React.useMemo(() => {
    const rxRows: ListRow[] = list.map(it => ({
      kind: 'prescription',
      data: it,
    }));
    const labRows: ListRow[] = labList.map(it => ({
      kind: 'laboratory',
      data: it,
    }));

    if (viewMode === 'prescription') return rxRows;
    return labRows;
  }, [labList, list, viewMode]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatMoney = (v: any) => {
    const n = Number(v);
    const num = Number.isFinite(n) ? n : 0;
    return `$${num.toFixed(2)}`;
  };

  const dateKey = (ds: string) => {
    const t = Date.parse(String(ds || ''));
    if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
    const s = String(ds || '').trim();
    if (!s) return '';
    return s.split('T')[0].split(' ')[0].slice(0, 10);
  };

  const getLatestLabGroup = React.useCallback(() => {
    if (!labList || labList.length === 0)
      return { items: [] as LabRecord[], k: '' };
    const k = dateKey(String(labList?.[0]?.date || ''));
    const items = k ? labList.filter(r => dateKey(r.date) === k) : labList;
    return { items, k };
  }, [labList]);

  const handlePrintLaboratory = React.useCallback(() => {
    if (!labList || labList.length === 0) {
      Alert.alert('Print', 'No laboratory records to print.');
      return;
    }
    const { items } = getLatestLabGroup();
    setPrintPreviewData({ kind: 'laboratory', data: items, isMultiple: true });
    setShowPrintPreview(true);
  }, [getLatestLabGroup, labList]);

  const handleDownloadLabPdf = React.useCallback(async () => {
    try {
      if (!labList || labList.length === 0) {
        Alert.alert('Download', 'No laboratory records to download.');
        return;
      }

      const { items } = getLatestLabGroup();
      const patient = userName || 'Patient';

      let RNHTMLtoPDF: any;
      try {
        RNHTMLtoPDF = resolveDefaultExport(require('react-native-html-to-pdf'));
      } catch {
        const lines = (items || []).map(
          (l, i) =>
            `${i + 1}. ${l.testName}${l.category ? ` (${l.category})` : ''}${
              l.notes ? ` - ${l.notes}` : ''
            }`,
        );
        await Share.share({
          message: lines.join('\n'),
          title: `Laboratory for ${patient}`,
        });
        return;
      }

      if (!RNHTMLtoPDF?.convert) {
        const lines = (items || []).map(
          (l, i) =>
            `${i + 1}. ${l.testName}${l.category ? ` (${l.category})` : ''}${
              l.notes ? ` - ${l.notes}` : ''
            }`,
        );
        await Share.share({
          message: lines.join('\n'),
          title: `Laboratory for ${patient}`,
        });
        return;
      }

      const html = buildLabReceiptHtmlNoPricing(
        items,
        String(patient),
        String(items?.[0]?.date || ''),
      );
      const fileName = `laboratory_${Date.now()}`;
      const pdf = await RNHTMLtoPDF.convert({ html, fileName, base64: false });
      const filePath = pdf?.filePath;
      if (!filePath) {
        Alert.alert('Download', 'Failed to generate PDF.');
        return;
      }

      const shareOptions =
        Platform.OS === 'ios'
          ? { url: `file://${filePath}`, message: `Laboratory for ${patient}` }
          : { url: filePath, message: `Laboratory for ${patient}` };
      await Share.share(shareOptions);
    } catch {
      Alert.alert('Download', 'Failed to download PDF.');
    }
  }, [buildLabReceiptHtmlNoPricing, getLatestLabGroup, labList, userName]);

  const statusBadgeStyle = (status?: Prescription['status']) => {
    if (status === 'completed')
      return [styles.statusBadge, styles.statusCompleted];
    if (status === 'pending') return [styles.statusBadge, styles.statusPending];
    if (status === 'cancelled')
      return [styles.statusBadge, styles.statusCancelled];
    return [styles.statusBadge, styles.statusPending];
  };

  const renderItem = ({ item }: { item: ListRow }) => {
    const status = item?.data?.status;
    if (item.kind === 'prescription') {
      const rx = item.data as Prescription;
      return (
        <TouchableOpacity
          style={styles.recordCard}
          activeOpacity={0.85}
          onPress={() => {
            setSelected(item);
            setShowModal(true);
          }}
        >
          <View style={styles.recordTopRow}>
            <View style={[styles.recordIconBox, styles.recordIconBoxRx]}>
              <Text style={styles.recordIconText}>💊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordTitle} numberOfLines={1}>
                {String(rx.medicine || 'Prescription')}
              </Text>
              {!!rx.dosage && (
                <Text style={styles.recordDose} numberOfLines={1}>
                  {String(rx.dosage)}
                </Text>
              )}
            </View>
            {!!status && (
              <View style={statusBadgeStyle(status)}>
                <Text style={styles.statusText}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.recordDivider} />

          <View style={styles.recordMetaBlock}>
            <Text style={styles.recordSectionLabel}>PRESCRIBED BY</Text>
            <Text style={styles.recordMetaValue} numberOfLines={1}>
              {rx.doctor ? `Dr. ${rx.doctor}` : '—'}
            </Text>
          </View>

          <View style={styles.recordMetaBlock}>
            <Text style={styles.recordSectionLabel}>PHARMACY</Text>
            <View style={styles.recordPharmacyRow}>
              <Text style={styles.recordPharmacyIcon}>📍</Text>
              <Text style={styles.recordMetaValue} numberOfLines={1}>
                {userName || '—'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const lab = item.data as LabRecord;
    return (
      <TouchableOpacity
        style={styles.recordCard}
        activeOpacity={0.85}
        onPress={() => {
          setSelected(item);
          setShowModal(true);
        }}
      >
        <View style={styles.recordTopRow}>
          <View style={[styles.recordIconBox, styles.recordIconBoxLab]}>
            <Text style={styles.recordIconText}>🧪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle} numberOfLines={1}>
              {String(lab.testName || 'Laboratory')}
            </Text>
            {!!lab.category && (
              <Text style={styles.recordSubtitle} numberOfLines={1}>
                {String(lab.category)}
              </Text>
            )}
          </View>
          {!!status && (
            <View style={statusBadgeStyle(status)}>
              <Text style={styles.statusText}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.recordDivider} />

        <Text style={styles.recordSectionLabel}>DATE</Text>
        <Text style={styles.recordMetaValue} numberOfLines={1}>
          {formatDate(lab.date)}
        </Text>

        <View style={{ height: 10 }} />

        <Text style={styles.recordSectionLabel}>NOTES</Text>
        <Text style={styles.recordSectionValue} numberOfLines={5}>
          {String(lab.notes || '—')}
        </Text>
      </TouchableOpacity>
    );
  };

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

        <View style={styles.tabsRow}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                viewMode === 'prescription'
                  ? styles.activeTab
                  : styles.inactiveTab,
              ]}
              onPress={() => setViewMode('prescription')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabText,
                  viewMode === 'prescription'
                    ? styles.activeTabText
                    : styles.inactiveTabText,
                ]}
              >
                Prescription
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                viewMode === 'laboratory'
                  ? styles.activeTab
                  : styles.inactiveTab,
              ]}
              onPress={() => setViewMode('laboratory')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabText,
                  viewMode === 'laboratory'
                    ? styles.activeTabText
                    : styles.inactiveTabText,
                ]}
              >
                Laboratory
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.kind}-${item.data.id}`}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: (insets?.bottom || 0) + 110 },
          ]}
          ListFooterComponent={
            viewMode === 'prescription' ? (
              <View style={[styles.actionsWrap, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  activeOpacity={0.85}
                  onPress={handlePrint}
                >
                  <Image
                    source={require('../../assets/print.png')}
                    style={styles.primaryActionIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.primaryActionText}>
                    Print Prescription
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  activeOpacity={0.85}
                  onPress={handleDownloadPdf}
                >
                  <Text style={styles.secondaryActionIcon}>↓</Text>
                  <Text style={styles.secondaryActionText}>Download PDF</Text>
                </TouchableOpacity>

                {(() => {
                  const baseDateStr = list?.[0]?.date;
                  const validText = baseDateStr
                    ? new Date(
                        new Date(baseDateStr).getTime() +
                          365 * 24 * 60 * 60 * 1000,
                      ).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';
                  return (
                    <View style={styles.noteCard}>
                      <Text style={styles.noteText}>
                        Note: Show these prescriptions to your pharmacy to
                        receive your medications.
                        {validText ? ` Valid until ${validText}.` : ''}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            ) : viewMode === 'laboratory' ? (
              <View style={[styles.actionsWrap, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  activeOpacity={0.85}
                  onPress={handlePrintLaboratory}
                >
                  <Image
                    source={require('../../assets/print.png')}
                    style={styles.primaryActionIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.primaryActionText}>Print Laboratory</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  activeOpacity={0.85}
                  onPress={handleDownloadLabPdf}
                >
                  <Text style={styles.secondaryActionIcon}>↓</Text>
                  <Text style={styles.secondaryActionText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {viewMode === 'prescription'
                  ? 'No prescriptions found'
                  : 'No laboratory records found'}
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={showPrintPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrintPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewCard}>
            <PreviewShotWrapper>
              {printPreviewData?.kind === 'laboratory' ? (
                <>
                  {(() => {
                    const d: any = printPreviewData?.data as any;
                    const items: LabRecord[] = Array.isArray(d)
                      ? d
                      : d
                      ? [d as LabRecord]
                      : [];
                    const first = items?.[0];
                    const labIdRaw = first?.id != null ? String(first.id) : '';
                    const labDigits = labIdRaw.match(/\d+/g)?.join('') || '';
                    const labNo = labDigits || String(Date.now());
                    const documentCode = `CAREFLOW.CLINIC.LAB.R.${labNo}`;
                    const selectedChecks = getLabRequestChecks(items);
                    const checkList = [
                      { key: 'cbc', label: 'CBC' },
                      { key: 'platelet', label: 'PLATELET COUNT' },
                      { key: 'urinalysis', label: 'URINALYSIS' },
                      { key: 'stool', label: 'STOOL EXAM' },
                      { key: 'drug', label: 'DRUG TEST' },
                      { key: 'chestXray', label: 'CHEST XRAY PA' },
                      { key: 'fbs', label: 'FBS' },
                      { key: 'lipid', label: 'LIPID PROFILE' },
                      { key: 'hbsag', label: 'HBASG' },
                    ] as const;

                    return (
                      <View style={styles.previewRxFormWrap}>
                        <View style={styles.previewRxHeader}>
                          <View style={styles.previewRxHeaderLogoCell}>
                            <Image
                              source={require('../../assets/appicon.png')}
                              style={styles.previewRxHeaderLogoImage}
                              resizeMode="contain"
                            />
                          </View>

                          <View style={styles.previewRxHeaderTitleCell}>
                            <Text
                              style={styles.previewRxHeaderSchool}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Careflow
                            </Text>
                            <Text
                              style={styles.previewRxHeaderSubject}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Subject
                            </Text>
                            <Text
                              style={styles.previewRxHeaderFormTitle}
                              numberOfLines={2}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                            >
                              LABORATORY REQUEST FORM
                            </Text>
                          </View>

                          <View style={styles.previewRxHeaderDocCell}>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Document Code:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                {documentCode}
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Rev.:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                0
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Effectivity Date:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                14.02.2025
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewRxInfo}>
                          <View style={styles.previewRxInfoRow}>
                            <Text style={styles.previewRxInfoLabel}>Name:</Text>
                            <View style={styles.previewRxInfoLine}>
                              <Text
                                style={styles.previewRxInfoLineText}
                                numberOfLines={1}
                              >
                                {userName || 'Patient'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.previewRxInfoRow2}>
                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Age:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userAge || '')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Sex:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userGender || '')}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.previewLabSectionTitle}>
                          LABORATORY REQUEST
                        </Text>

                        <View style={styles.previewLabChecks}>
                          {checkList.map(it => {
                            const checked = Boolean(
                              (selectedChecks as any)?.[it.key],
                            );
                            return (
                              <View
                                style={styles.previewLabChkRow}
                                key={it.key}
                              >
                                <View style={styles.previewLabChkBox}>
                                  <Text style={styles.previewLabChkMark}>
                                    {checked ? '✓' : ''}
                                  </Text>
                                </View>
                                <Text style={styles.previewLabChkText}>
                                  {it.label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}
                </>
              ) : printPreviewData?.kind === 'prescription' &&
                printPreviewData.isMultiple ? (
                <>
                  {(() => {
                    const items = (
                      (printPreviewData?.data as Prescription[]) || []
                    ).slice(0);
                    const first = items?.[0];
                    const dateStr = first?.date
                      ? new Date(first.date).toLocaleDateString()
                      : new Date().toLocaleDateString();
                    const rxIdRaw = first?.id != null ? String(first.id) : '';
                    const rxDigits = rxIdRaw.match(/\d+/g)?.join('') || '';
                    const rxNo = rxDigits || String(Date.now());
                    const documentCode = `CAREFLOW.RX.${rxNo}`;

                    return (
                      <View style={styles.previewRxFormWrap}>
                        <View style={styles.previewRxHeader}>
                          <View style={styles.previewRxHeaderLogoCell}>
                            <Image
                              source={require('../../assets/appicon.png')}
                              style={styles.previewRxHeaderLogoImage}
                              resizeMode="contain"
                            />
                          </View>

                          <View style={styles.previewRxHeaderTitleCell}>
                            <Text
                              style={styles.previewRxHeaderSchool}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Careflow
                            </Text>
                            <Text
                              style={styles.previewRxHeaderSubject}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Subject
                            </Text>
                            <Text
                              style={styles.previewRxHeaderFormTitle}
                              numberOfLines={2}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                            >
                              PRESCRIPTION FORM
                            </Text>
                          </View>

                          <View style={styles.previewRxHeaderDocCell}>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Document Code:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                {documentCode}
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Rev.:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                0
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Effectivity Date:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                14.02.2025
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewRxInfo}>
                          <View style={styles.previewRxInfoRow}>
                            <Text style={styles.previewRxInfoLabel}>Name:</Text>
                            <View style={styles.previewRxInfoLine}>
                              <Text
                                style={styles.previewRxInfoLineText}
                                numberOfLines={1}
                              >
                                {userName || 'Patient'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.previewRxInfoRow2}>
                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Age:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userAge || '')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Sex:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userGender || '')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Date:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {dateStr}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewRxBodyRow}>
                          <Text style={styles.previewRxSymbol}>Rx</Text>
                          <ScrollView
                            style={styles.previewRxBody}
                            contentContainerStyle={{
                              paddingTop: 6,
                              paddingBottom: 6,
                            }}
                            showsVerticalScrollIndicator={false}
                          >
                            {items.map((rx, idx) => {
                              const qtyText =
                                rx?.quantity != null &&
                                String(rx.quantity).trim().length > 0
                                  ? String(rx.quantity)
                                  : '';
                              const doseText = String(rx?.dosage || '').trim();
                              const insText = String(
                                rx?.instructions || '',
                              ).trim();

                              return (
                                <View
                                  key={`${rx?.id ?? idx}-${idx}`}
                                  style={styles.previewRxMedRow}
                                >
                                  <View style={styles.previewRxMedLineRow}>
                                    <Text style={styles.previewRxMedNo}>
                                      {idx + 1}.
                                    </Text>
                                    <Text
                                      style={styles.previewRxMedName}
                                      numberOfLines={1}
                                    >
                                      {getMedicineText(rx) ||
                                        String(rx?.medicine || '')}
                                    </Text>
                                    <Text
                                      style={styles.previewRxMedQty}
                                      numberOfLines={1}
                                    >
                                      {qtyText}
                                    </Text>
                                    <Text
                                      style={styles.previewRxMedDose}
                                      numberOfLines={1}
                                    >
                                      {doseText}
                                    </Text>
                                    {!!insText && (
                                      <Text
                                        style={styles.previewRxMedInstrInline}
                                        numberOfLines={1}
                                      >
                                        {insText}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </View>
                    );
                  })()}
                </>
              ) : printPreviewData ? (
                <>
                  {(() => {
                    const rx = printPreviewData?.data as Prescription;
                    const dateStr = rx?.date
                      ? new Date(rx.date).toLocaleDateString()
                      : new Date().toLocaleDateString();
                    const rxIdRaw = rx?.id != null ? String(rx.id) : '';
                    const rxDigits = rxIdRaw.match(/\d+/g)?.join('') || '';
                    const rxNo = rxDigits || String(Date.now());
                    const documentCode = `CAREFLOW.RX.${rxNo}`;
                    const qtyText =
                      rx?.quantity != null &&
                      String(rx.quantity).trim().length > 0
                        ? String(rx.quantity)
                        : '';
                    const doseText = String(rx?.dosage || '').trim();
                    const insText = String(rx?.instructions || '').trim();

                    return (
                      <View style={styles.previewRxFormWrap}>
                        <View style={styles.previewRxHeader}>
                          <View style={styles.previewRxHeaderLogoCell}>
                            <Image
                              source={require('../../assets/appicon.png')}
                              style={styles.previewRxHeaderLogoImage}
                              resizeMode="contain"
                            />
                          </View>

                          <View style={styles.previewRxHeaderTitleCell}>
                            <Text
                              style={styles.previewRxHeaderSchool}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Careflow
                            </Text>
                            <Text
                              style={styles.previewRxHeaderSubject}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              Subject
                            </Text>
                            <Text
                              style={styles.previewRxHeaderFormTitle}
                              numberOfLines={2}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                            >
                              PRESCRIPTION FORM
                            </Text>
                          </View>

                          <View style={styles.previewRxHeaderDocCell}>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Document Code:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                {documentCode}
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Rev.:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                0
                              </Text>
                            </View>
                            <View style={styles.previewRxHeaderDocRow}>
                              <Text style={styles.previewRxHeaderDocLabel}>
                                Effectivity Date:
                              </Text>
                              <Text style={styles.previewRxHeaderDocValue}>
                                14.02.2025
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewRxInfo}>
                          <View style={styles.previewRxInfoRow}>
                            <Text style={styles.previewRxInfoLabel}>Name:</Text>
                            <View style={styles.previewRxInfoLine}>
                              <Text
                                style={styles.previewRxInfoLineText}
                                numberOfLines={1}
                              >
                                {userName || 'Patient'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.previewRxInfoRow2}>
                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Age:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userAge || '')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Sex:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {String(userGender || '')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.previewRxInfoField}>
                              <Text style={styles.previewRxInfoLabel}>
                                Date:
                              </Text>
                              <View style={styles.previewRxInfoLine}>
                                <Text style={styles.previewRxInfoLineText}>
                                  {dateStr}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewRxBodyRow}>
                          <Text style={styles.previewRxSymbol}>Rx</Text>
                          <View
                            style={[styles.previewRxBody, { paddingTop: 6 }]}
                          >
                            <View style={styles.previewRxMedRow}>
                              <View style={styles.previewRxMedLineRow}>
                                <Text style={styles.previewRxMedNo}>1.</Text>
                                <Text
                                  style={styles.previewRxMedName}
                                  numberOfLines={1}
                                >
                                  {getMedicineText(rx) ||
                                    String(rx?.medicine || '')}
                                </Text>
                                <Text
                                  style={styles.previewRxMedQty}
                                  numberOfLines={1}
                                >
                                  {qtyText}
                                </Text>
                                <Text
                                  style={styles.previewRxMedDose}
                                  numberOfLines={1}
                                >
                                  {doseText}
                                </Text>
                                {!!insText && (
                                  <Text
                                    style={styles.previewRxMedInstrInline}
                                    numberOfLines={1}
                                  >
                                    {insText}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </>
              ) : null}
            </PreviewShotWrapper>

            <View style={styles.previewActionsCol}>
              {printPreviewData?.kind === 'prescription'
                ? (() => {
                    const d: any = printPreviewData?.data as any;
                    const first = Array.isArray(d) ? d?.[0] : d;
                    const doctorText = first?.doctor
                      ? `Dr. ${first.doctor}`
                      : '';
                    const licText =
                      first?.doctorId != null &&
                      String(first.doctorId).trim().length > 0
                        ? `LIC.NO.${String(first.doctorId)}`
                        : 'LIC. NO.';

                    if (!doctorText && !licText) return null;

                    return (
                      <View style={styles.previewRxSignRow}>
                        <View style={styles.previewRxSignBox}>
                          <Text style={styles.previewRxSignName}>
                            {doctorText}
                          </Text>
                          {!!getDoctorSpecialtyText(first) && (
                            <Text style={styles.previewRxSignSpec}>
                              {getDoctorSpecialtyText(first)}
                            </Text>
                          )}
                          <View style={styles.previewRxSignMetaRow}>
                            <Text style={styles.previewRxSignMetaLabel}>
                              {licText}
                            </Text>
                            <View style={styles.previewRxSignMetaLine} />
                          </View>
                          <View style={styles.previewRxSignMetaRow}>
                            <Text style={styles.previewRxSignMetaLabel}>
                              PTR
                            </Text>
                            <View style={styles.previewRxSignMetaLine} />
                          </View>
                          <View style={styles.previewRxSignMetaRow}>
                            <Text style={styles.previewRxSignMetaLabel}>
                              S2
                            </Text>
                            <View style={styles.previewRxSignMetaLine} />
                          </View>
                        </View>
                      </View>
                    );
                  })()
                : null}

              <TouchableOpacity
                style={[styles.modalPrintButton, styles.previewActionBtn]}
                onPress={async () => {
                  const shotPrinted = await tryPrintPreviewFromViewShot();
                  if (shotPrinted) {
                    setShowPrintPreview(false);
                    return;
                  }
                  if (printPreviewData?.isMultiple) {
                    if (printPreviewData.kind === 'laboratory') {
                      const d: any = printPreviewData?.data as any;
                      const items: LabRecord[] = Array.isArray(d)
                        ? d
                        : d
                        ? [d as LabRecord]
                        : [];
                      const patient = userName || 'Patient';
                      const html = buildLabReceiptHtmlNoPricing(
                        items,
                        String(patient),
                        String(items?.[0]?.date || ''),
                      );
                      const lines = (items || []).map(
                        (l, i) =>
                          `${i + 1}. ${l.testName}${
                            l.category ? ` (${l.category})` : ''
                          }`,
                      );
                      const fallbackMessage = lines.join('\n');
                      await printHtmlDoc(html, fallbackMessage);
                      setShowPrintPreview(false);
                      return;
                    }
                    if (!list || list.length === 0) {
                      Alert.alert('Print', 'No prescriptions to print.');
                      return;
                    }

                    const patient = userName || 'Patient';
                    const html = buildPrescriptionHtml(list, String(patient));
                    const lines = (list || []).map((p, i) => {
                      const d = new Date(p.date || '').toLocaleDateString();
                      return `${i + 1}. ${p.medicine}${
                        p.dosage ? ` (${p.dosage})` : ''
                      }${p.instructions ? ` - ${p.instructions}` : ''}${
                        p.doctor ? ` • Dr. ${p.doctor}` : ''
                      } • ${d}${p.status ? ` • ${p.status}` : ''}`;
                    });
                    const fallbackMessage = lines.join('\n');
                    await printHtmlDoc(html, fallbackMessage);
                  } else {
                    // Print single item
                    await handlePrintSelected();
                  }
                  setShowPrintPreview(false);
                }}
              >
                <Text style={styles.modalPrintText}>Print</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCloseButton, styles.previewActionBtn]}
                onPress={() => setShowPrintPreview(false)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              <Text style={{ fontSize: 22, marginRight: 8 }}>
                {selected?.kind === 'laboratory' ? '🧪' : '💊'}
              </Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selected?.kind === 'laboratory'
                  ? selected?.data.testName || 'Laboratory'
                  : selected?.data.medicine || 'Prescription'}
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Patient</Text>
                <Text style={styles.modalValue}>{userName || 'Patient'}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Date</Text>
                <Text style={styles.modalValue}>
                  {selected ? formatDate(selected.data.date) : ''}
                </Text>
              </View>

              {selected?.kind === 'prescription' && !!selected?.data.doctor && (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Doctor</Text>
                  <Text style={styles.modalValue}>{selected?.data.doctor}</Text>
                </View>
              )}

              {selected?.kind === 'prescription' && !!selected?.data.dosage && (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Dosage</Text>
                  <Text style={styles.modalValue}>{selected?.data.dosage}</Text>
                </View>
              )}

              {selected?.kind === 'prescription' &&
                !!selected?.data.instructions && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Instructions</Text>
                    <Text
                      style={[
                        styles.modalValue,
                        { flex: 1, textAlign: 'right' },
                      ]}
                      numberOfLines={4}
                    >
                      {selected?.data.instructions}
                    </Text>
                  </View>
                )}

              {selected?.kind === 'laboratory' && (
                <>
                  {!!selected?.data.category && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Category</Text>
                      <Text style={styles.modalValue}>
                        {selected?.data.category}
                      </Text>
                    </View>
                  )}
                  {!!selected?.data.notes && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Notes</Text>
                      <Text
                        style={[
                          styles.modalValue,
                          { flex: 1, textAlign: 'right' },
                        ]}
                        numberOfLines={4}
                      >
                        {selected?.data.notes}
                      </Text>
                    </View>
                  )}
                </>
              )}

              <View style={[styles.modalRow, { alignItems: 'center' }]}>
                <Text style={styles.modalLabel}>Status</Text>
                {selected?.data.status ? (
                  <View style={statusBadgeStyle(selected.data.status)}>
                    <Text style={styles.statusText}>
                      {selected.data.status.charAt(0).toUpperCase() +
                        selected.data.status.slice(1)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.modalValue}>N/A</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalPrintButton}
                onPress={() => {
                  if (!selected) return;
                  setShowModal(false);
                  setPrintPreviewData({
                    kind: selected.kind,
                    data: selected.data,
                    isMultiple: false,
                  });
                  setShowPrintPreview(true);
                }}
              >
                <Text style={styles.modalPrintText}>
                  {selected?.kind === 'laboratory'
                    ? 'Print Laboratory'
                    : 'Print'}
                </Text>
              </TouchableOpacity>
              <View style={{ width: 10 }} />
              {selected?.kind === 'laboratory' ? (
                <>
                  <TouchableOpacity
                    style={[styles.modalCloseButton, { flex: 1 }]}
                    onPress={async () => {
                      if (!selected) return;
                      const patient = userName || 'Patient';
                      const items = labList.filter(
                        r =>
                          dateKey(r.date) ===
                          dateKey(String((selected.data as any).date || '')),
                      );
                      const html = buildLabReceiptHtmlNoPricing(
                        items,
                        String(patient),
                        String((selected.data as any).date || ''),
                      );

                      let RNHTMLtoPDF: any;
                      try {
                        RNHTMLtoPDF = resolveDefaultExport(
                          require('react-native-html-to-pdf'),
                        );
                      } catch {
                        const lines = (items || []).map(
                          (l, i) =>
                            `${i + 1}. ${l.testName}${
                              l.category ? ` (${l.category})` : ''
                            }`,
                        );
                        await Share.share({
                          message: lines.join('\n'),
                          title: `Laboratory for ${patient}`,
                        });
                        return;
                      }

                      if (!RNHTMLtoPDF?.convert) {
                        const lines = (items || []).map(
                          (l, i) =>
                            `${i + 1}. ${l.testName}${
                              l.category ? ` (${l.category})` : ''
                            }`,
                        );
                        await Share.share({
                          message: lines.join('\n'),
                          title: `Laboratory for ${patient}`,
                        });
                        return;
                      }

                      const fileName = `laboratory_${Date.now()}`;
                      const pdf = await RNHTMLtoPDF.convert({
                        html,
                        fileName,
                        base64: false,
                      });
                      const filePath = pdf?.filePath;
                      if (!filePath) {
                        Alert.alert('Download', 'Failed to generate PDF.');
                        return;
                      }

                      const shareOptions =
                        Platform.OS === 'ios'
                          ? {
                              url: `file://${filePath}`,
                              message: `Laboratory for ${patient}`,
                            }
                          : {
                              url: filePath,
                              message: `Laboratory for ${patient}`,
                            };
                      await Share.share(shareOptions);
                    }}
                  >
                    <Text style={styles.modalCloseText}>Download PDF</Text>
                  </TouchableOpacity>
                  <View style={{ width: 10 }} />
                  <TouchableOpacity
                    style={[styles.modalCloseButton, { flex: 1 }]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.modalCloseButton, { flex: 1 }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              )}
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
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
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
  tabsRow: {
    marginBottom: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  inactiveTab: {
    backgroundColor: '#E5E7EB',
  },
  activeTab: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },
  inactiveTabText: {
    color: '#6B7280',
  },
  activeTabText: {
    color: '#10B981',
  },
  actionsWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryActionIcon: {
    width: 18,
    height: 18,
    tintColor: '#FFFFFF',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryActionBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryActionIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  secondaryActionText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
  },
  noteCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  noteText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    padding: 0,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recordIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordIconBoxRx: {
    backgroundColor: '#FEF3C7',
  },
  recordIconBoxLab: {
    backgroundColor: '#DBEAFE',
  },
  recordIconText: {
    fontSize: 22,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  recordSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  recordDose: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  recordDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 14,
    marginBottom: 14,
  },
  recordSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  recordSectionValue: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  recordTwoColRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  recordTwoColItem: {
    flex: 1,
  },
  recordTwoColValue: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  recordMetaBlock: {
    marginTop: 14,
  },
  recordMetaValue: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  recordPharmacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  recordPharmacyIcon: {
    fontSize: 14,
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
  previewCard: {
    width: '100%',
    maxWidth: 720,
    minHeight: 720,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#111827',
    justifyContent: 'space-between',
  },
  previewRxFormWrap: {
    width: '100%',
  },
  previewRxHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#111827',
  },
  previewRxHeaderLogoCell: {
    width: 56,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#111827',
  },
  previewRxHeaderLogoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#111827',
  },
  previewRxHeaderLogoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  previewRxHeaderTitleCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRxHeaderSchool: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 13,
    includeFontPadding: false,
  },
  previewRxHeaderSubject: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    includeFontPadding: false,
  },
  previewRxHeaderFormTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
  },
  previewRxHeaderDocCell: {
    width: 140,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  previewRxHeaderDocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewRxHeaderDocLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#111827',
    marginRight: 6,
    flexShrink: 1,
    includeFontPadding: false,
  },
  previewRxHeaderDocValue: {
    fontSize: 8,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    flexShrink: 0,
    includeFontPadding: false,
  },
  previewRxInfo: {
    marginTop: 12,
  },
  previewRxInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  previewRxInfoRow2: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  previewRxInfoField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  previewRxInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  previewRxInfoLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    minHeight: 16,
    justifyContent: 'flex-end',
  },
  previewRxInfoLineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    paddingBottom: 1,
  },
  previewRxBodyRow: {
    flexDirection: 'column',
    marginTop: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  previewRxSymbol: {
    fontSize: 54,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 54,
  },
  previewRxBody: {
    flex: 1,
    maxHeight: 380,
    minHeight: 260,
  },
  previewRxMedRow: {
    marginBottom: 10,
  },
  previewRxMedLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  previewRxMedNo: {
    width: 18,
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 18,
  },
  previewRxMedName: {
    flex: 1,
    minWidth: 160,
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 18,
  },
  previewRxMedQty: {
    width: 44,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },
  previewRxMedInstrInline: {
    flex: 1.3,
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  previewRxMedDose: {
    width: 86,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },
  previewRxSignRow: {
    width: '100%',
    marginTop: 18,
    alignItems: 'flex-end',
  },
  previewRxSignBox: {
    width: 240,
  },
  previewRxSignName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
  previewRxSignSpec: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    marginTop: 2,
  },
  previewRxSignMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    gap: 10,
  },
  previewRxSignMetaLabel: {
    width: 60,
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  previewRxSignMetaLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    minHeight: 14,
  },
  previewLabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewLabText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 64,
  },
  previewLabRightCol: {
    flex: 1,
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  previewLabNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
  },
  previewLabSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    marginTop: 2,
  },
  previewLabSectionTitle: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
  },
  previewLabChecks: {
    marginTop: 10,
    paddingLeft: 20,
  },
  previewLabChkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabChkBox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  previewLabChkMark: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginTop: -1,
  },
  previewLabChkText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.3,
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewRxText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 56,
  },
  previewDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
    textAlign: 'right',
    maxWidth: 220,
  },
  previewLine: {
    height: 2,
    backgroundColor: '#111827',
    marginTop: 10,
    marginBottom: 12,
  },
  previewTable: {
    borderWidth: 1,
    borderColor: '#111827',
  },
  previewTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
  },
  previewTableRow: {
    flexDirection: 'row',
  },
  previewTh: {
    borderRightWidth: 1,
    borderRightColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  previewTd: {
    borderRightWidth: 1,
    borderRightColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  previewMetaText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  previewNotesBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 10,
    minHeight: 90,
  },
  previewNotesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  previewNotesText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 18,
  },
  previewTotalsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  previewTotalsCol: {
    minWidth: 220,
  },
  previewTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  previewTotalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  previewTotalBox: {
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  previewTotalBoxText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  previewFooterRow: {
    marginTop: 12,
  },
  previewFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
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
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  previewActionsCol: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  previewContent: {
    width: '100%',
    flex: 1,
  },
  previewActionBtn: {
    width: '100%',
    flex: 0,
  },
  modalPrintButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrintText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  modalCloseButton: {
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
