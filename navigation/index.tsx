/**
 * index.tsx — App Navigation Logic
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import LoginScreen from '../app/login';
import RegisterScreen from '../app/register';
import DoctorDashboard from '../app/doctor/doctor_dashboard';
import DoctorAppointment from '../app/doctor/doctor_appointment';
import DoctorPrescription from '../app/doctor/doctor_prescription';
import DoctorRecentActivity from '../app/doctor/doctor_recent_activity';
import DoctorPatientRecords from '../app/doctor/doctor_patient_records';
import DoctorPatientRecordsDetails from '../app/doctor/doctor_patient_records_details';
import DoctorReports from '../app/doctor/doctor_reports';
import DoctorProfile from '../app/doctor/doctor_profile';
import DoctorEditProfile from '../app/doctor/doctor_edit_profile';
import DoctorNotification from '../app/doctor/doctor_notification';
import PharmacyDashboard from '../app/pharmacy/pharmacy_dashboard';
import PharmacyProfile from '../app/pharmacy/pharmacy_profile';
import PharmacyEditProfile from '../app/pharmacy/pharmacy_edit_profile';
import PharmacyInventory from '../app/pharmacy/pharmacy_inventory';
import PharmacyAddMedicine from '../app/pharmacy/pharmacy_add_medicine';
import PharmacyPrescription from '../app/pharmacy/pharmacy_prescription';
import PharmacyPrescriptionDetails from '../app/pharmacy/pharmacy_prescription_details';
import PharmacyPrescriptionAccepted from '../app/pharmacy/pharmacy_prescription_accepted';
import PharmacyMedicine from '../app/pharmacy/pharmacy_medicine';
import PharmacyMedicineDetails from '../app/pharmacy/pharmacy_medicine_details';
import PharmacyReports from '../app/pharmacy/pharmacy_reports';
import PharmacyNotification from '../app/pharmacy/pharmacy_notification';
import NurseDashboard from '../app/nurse/nurse_dashboard';
import NurseSchedule from '../app/nurse/nurse_schedule';
import NurseProfile from '../app/nurse/nurse_profile';
import NurseEditProfile from '../app/nurse/nurse_edit_profile';
import NurseRequest from '../app/nurse/nurse_request';
import NursePrescription from '../app/nurse/nurse_prescription';
import NursePrescriptionDetails from '../app/nurse/nurse_prescription_details';
import NurseReports from '../app/nurse/nurse_reports';
import NurseNotification from '../app/nurse/nurse_notification';
import NurseNotifDetails from '../app/nurse/nurse_notif_details';
import LabDashboard from '../app/laboratory/lab_dashboard';
import LabLaboratory from '../app/laboratory/lab_laboratory';
import LabRecords from '../app/laboratory/lab_records';
import LabReports from '../app/laboratory/lab_reports';
import LabNotification from '../app/laboratory/lab_notification';
import LabProfile from '../app/laboratory/lab_profile';
import LabEditProfile from '../app/laboratory/lab_edit_profile';
import SupervisorDashboard from '../app/supervisor/supervisor_dashboard';
import SupervisorSchedule from '../app/supervisor/supervisor_schedule';
import SupervisorList from '../app/supervisor/supervisor_list';
import SupervisorReports from '../app/supervisor/supervisor_reports';
import SupervisorNotification from '../app/supervisor/supervisor_notification';
import SupervisorNotificationDetails from '../app/supervisor/supervisor_notification_details';
import SupervisorProfile from '../app/supervisor/supervisor_profile';
import SupervisorEditProfile from '../app/supervisor/supervisor_edit_profile';
import SplashScreen from '../app/splash_screen';
import AdminDashboard from '../app/admin/admin_dashboard';
import AdminManageUsers from '../app/admin/admin_manage_users';
import AdminReports from '../app/admin/admin_reports';
import AdminSettings from '../app/admin/admin_settings';
import AdminProfile from '../app/admin/admin_profile';
import AdminEditProfile from '../app/admin/admin_edit_profile';
import AdminNotification from '../app/admin/admin_notification';

// Future roles
// import NurseDashboard from './app/nurse/nurse_dashboard';
// import PharmacistDashboard from './app/pharmacist/pharmacist_dashboard';
// import SupervisorDashboard from './app/supervisor/supervisor_dashboard';
// import LabStaffDashboard from './app/lab/labstaff_dashboard';

const Stack = createNativeStackNavigator<any>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="Splash" component={SplashScreen as any} />
      <Stack.Screen name="Login" component={LoginScreen as any} />
      <Stack.Screen name="Register" component={RegisterScreen as any} />
      <Stack.Screen name="DoctorDashboard" component={DoctorDashboard} />
      <Stack.Screen name="DoctorAppointment" component={DoctorAppointment} />
      <Stack.Screen name="DoctorPrescription" component={DoctorPrescription} />
      <Stack.Screen name="DoctorPatientRecords" component={DoctorPatientRecords} />
      <Stack.Screen name="DoctorPatientRecordsDetails" component={DoctorPatientRecordsDetails} />
      <Stack.Screen name="DoctorReports" component={DoctorReports} />
      <Stack.Screen name="DoctorProfile" component={DoctorProfile} />
      <Stack.Screen name="DoctorEditProfile" component={DoctorEditProfile} />
      <Stack.Screen name="DoctorNotification" component={DoctorNotification} />
      <Stack.Screen name="DoctorRecentActivity" component={DoctorRecentActivity} />
      <Stack.Screen name="PharmacyDashboard" component={PharmacyDashboard} />
      <Stack.Screen name="PharmacyProfile" component={PharmacyProfile} />
      <Stack.Screen name="PharmacyEditProfile" component={PharmacyEditProfile} />
      <Stack.Screen name="PharmacyInventory" component={PharmacyInventory} />
      <Stack.Screen name="PharmacyAddMedicine" component={PharmacyAddMedicine} />
      <Stack.Screen name="PharmacyPrescription" component={PharmacyPrescription} />
      <Stack.Screen name="PharmacyPrescriptionDetails" component={PharmacyPrescriptionDetails} />
      <Stack.Screen name="PharmacyPrescriptionAccepted" component={PharmacyPrescriptionAccepted} />
      <Stack.Screen name="PharmacyMedicine" component={PharmacyMedicine} />
      <Stack.Screen name="PharmacyMedicineDetails" component={PharmacyMedicineDetails} />
      <Stack.Screen name="PharmacyReports" component={PharmacyReports} />
      <Stack.Screen name="PharmacyNotification" component={PharmacyNotification} />
      <Stack.Screen name="NurseDashboard" component={NurseDashboard} />
      <Stack.Screen name="NurseSchedule" component={NurseSchedule} />
      <Stack.Screen name="NurseProfile" component={NurseProfile} />
      <Stack.Screen name="NurseEditProfile" component={NurseEditProfile} />
      <Stack.Screen name="NurseRequest" component={NurseRequest} />
      <Stack.Screen name="NursePrescription" component={NursePrescription} />
      <Stack.Screen name="NursePrescriptionDetails" component={NursePrescriptionDetails} />
      <Stack.Screen name="NurseReports" component={NurseReports} />
      <Stack.Screen name="NurseNotification" component={NurseNotification} />
      <Stack.Screen name="NurseNotifDetails" component={NurseNotifDetails} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="AdminManageUsers" component={AdminManageUsers} />
      <Stack.Screen name="AdminReports" component={AdminReports} />
      <Stack.Screen name="AdminSettings" component={AdminSettings} />
      <Stack.Screen name="AdminProfile" component={AdminProfile} />
      <Stack.Screen name="AdminEditProfile" component={AdminEditProfile} />
      <Stack.Screen name="AdminNotification" component={AdminNotification} />
      <Stack.Screen name="LabDashboard" component={LabDashboard} />
      <Stack.Screen name="LabLaboratory" component={LabLaboratory} />
      <Stack.Screen name="LabRecords" component={LabRecords} />
      <Stack.Screen name="LabReports" component={LabReports} />
      <Stack.Screen name="LabNotification" component={LabNotification} />
      <Stack.Screen name="LabProfile" component={LabProfile} />
      <Stack.Screen name="LabEditProfile" component={LabEditProfile} />
      <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard} />
      <Stack.Screen name="SupervisorSchedule" component={SupervisorSchedule} />
      <Stack.Screen name="SupervisorList" component={SupervisorList} />
      <Stack.Screen name="SupervisorReports" component={SupervisorReports} />
      <Stack.Screen name="SupervisorProfile" component={SupervisorProfile} />
      <Stack.Screen name="SupervisorEditProfile" component={SupervisorEditProfile} />
      <Stack.Screen name="SupervisorNotification" component={SupervisorNotification} />
      <Stack.Screen name="SupervisorNotificationDetails" component={SupervisorNotificationDetails} />
      {/* Uncomment when these dashboards are ready */}
      {/* <Stack.Screen name="NurseDashboard" component={NurseDashboard} /> */}
      {/* <Stack.Screen name="PharmacistDashboard" component={PharmacistDashboard} /> */}
      {/* <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard} /> */}
      {/* <Stack.Screen name="LabStaffDashboard" component={LabStaffDashboard} /> */}
    </Stack.Navigator>
  );
}


/* 🎨 Styles */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoImage: {
    width: 240,
    height: 140,
    marginBottom: 48,
  },
  ctaButton: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
