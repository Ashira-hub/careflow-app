/**
 * index.tsx — App Navigation Logic
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import types
import type { RootStackParamList } from './types';

// Screens
import LoginScreen from '../app/login';
import RegisterScreen from '../app/register';
import SplashScreen from '../app/splash_screen';

// Doctor Screens
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

// Patient Screens
import PatientDashboard from '../app/patient/patient_dashboard';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      <Stack.Screen
        name="DoctorPatientRecords"
        component={DoctorPatientRecords}
      />
      <Stack.Screen
        name="DoctorPatientRecordsDetails"
        component={DoctorPatientRecordsDetails}
      />
      <Stack.Screen name="DoctorReports" component={DoctorReports} />
      <Stack.Screen name="DoctorProfile" component={DoctorProfile} />
      <Stack.Screen name="DoctorEditProfile" component={DoctorEditProfile} />
      <Stack.Screen name="DoctorNotification" component={DoctorNotification} />
      <Stack.Screen
        name="DoctorRecentActivity"
        component={DoctorRecentActivity}
      />

      {/* Patient Screens */}
      <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
      <Stack.Screen
        name="PatientProfile"
        component={require('../app/patient/patient_profile').default}
      />
      <Stack.Screen
        name="BookAppointment"
        component={require('../app/patient/patient_appointment').default}
      />
      <Stack.Screen
        name="PatientPrescription"
        component={require('../app/patient/patient_prescription').default}
      />
      <Stack.Screen
        name="MedicalRecords"
        component={require('../app/patient/patient_records').default}
      />
      <Stack.Screen
        name="Appointments"
        component={require('../app/patient/patient_appointment').default}
      />
      <Stack.Screen name="AppointmentDetails" component={PatientDashboard} />
      <Stack.Screen name="MedicalRecordDetails" component={PatientDashboard} />
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
