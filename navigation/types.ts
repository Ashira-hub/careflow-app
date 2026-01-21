// Define the parameter lists for each screen
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;

  // Doctor Screens
  DoctorDashboard: undefined;
  DoctorAppointment: undefined;
  DoctorPrescription: undefined;
  DoctorPatientRecords: undefined;
  DoctorPatientRecordsDetails: { recordId: string };
  DoctorReports: undefined;
  DoctorProfile: undefined;
  DoctorEditProfile: undefined;
  DoctorNotification: undefined;
  DoctorRecentActivity: undefined;

  // Patient Screens
  PatientDashboard: undefined;
  PatientProfile: undefined;
  PatientNotification: undefined;
  BookAppointment: undefined;
  MedicalRecords: undefined;
  PatientPrescription: undefined;
  Appointments: undefined;
  AppointmentDetails: { appointmentId: string };
  MedicalRecordDetails: { recordId: string };

  // Add other screen params here as needed
};

// Re-export the navigation prop types for screens
export type NavigationProps<T extends keyof RootStackParamList> = {
  navigation: {
    navigate: (screen: T, params?: RootStackParamList[T]) => void;
    goBack: () => void;
  };
  route: {
    params: RootStackParamList[T];
  };
};
