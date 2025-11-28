import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../navigation/types';

// Types
type Appointment = {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

type MedicalRecord = {
  id: string;
  title: string;
  date: string;
  type: 'prescription' | 'lab_result' | 'consultation';
};

type PatientDashboardNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

const PatientDashboard = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PatientDashboardNavigationProp>();
  const [userName, setUserName] = useState('');
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >([]);
  const [recentRecords, setRecentRecords] = useState<MedicalRecord[]>([]);

  useEffect(() => {
    loadUserData();
    loadAppointments();
    loadMedicalRecords();
  }, []);

  const loadUserData = async () => {
    try {
      const session = await AsyncStorage.getItem('session');
      if (session) {
        const { user } = JSON.parse(session);
        setUserName(user?.fullName || 'Patient');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadAppointments = async () => {
    // Mock data - replace with actual API call
    const mockAppointments: Appointment[] = [
      {
        id: '1',
        doctor: 'Dr. Sarah Johnson',
        specialty: 'Cardiology',
        date: '2023-12-15',
        time: '10:30 AM',
        status: 'upcoming',
      },
      {
        id: '2',
        doctor: 'Dr. Michael Chen',
        specialty: 'General Medicine',
        date: '2023-12-20',
        time: '02:15 PM',
        status: 'upcoming',
      },
    ];
    setUpcomingAppointments(mockAppointments);
  };

  const loadMedicalRecords = async () => {
    // Mock data - replace with actual API call
    const mockRecords: MedicalRecord[] = [
      {
        id: '1',
        title: 'Blood Test Results',
        date: '2023-11-20',
        type: 'lab_result',
      },
      {
        id: '2',
        title: 'Prescription - Amoxicillin',
        date: '2023-11-15',
        type: 'prescription',
      },
      {
        id: '3',
        title: 'Annual Checkup',
        date: '2023-10-05',
        type: 'consultation',
      },
    ];
    setRecentRecords(mockRecords);
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    const handleAppointmentPress = () => {
      navigation.navigate('AppointmentDetails', { appointmentId: item.id });
    };

    return (
      <View style={styles.appointmentCard}>
        <View style={styles.appointmentInfoContainer}>
          <Text style={styles.doctorName}>{item.doctor}</Text>
          <Text style={styles.specialty}>{item.specialty}</Text>
          <View style={styles.timeContainer}>
            <Text style={styles.dateTime}>
              {item.date} • {item.time}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            >
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={handleAppointmentPress}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRecordItem = ({ item }: { item: MedicalRecord }) => {
    const handleRecordPress = () => {
      navigation.navigate('MedicalRecordDetails', { recordId: item.id });
    };

    return (
      <TouchableOpacity
        style={styles.recordItemContainer}
        onPress={handleRecordPress}
      >
        <View style={styles.recordIcon}>
          <Text style={styles.recordIconText}>{getRecordIcon(item.type)}</Text>
        </View>
        <View style={styles.recordDetails}>
          <Text style={styles.recordTitle}>{item.title}</Text>
          <Text style={styles.recordDate}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#10B981'; // green
      case 'completed':
        return '#6B7280'; // gray
      case 'cancelled':
        return '#EF4444'; // red
      default:
        return '#6B7280';
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return '💊';
      case 'lab_result':
        return '🔬';
      case 'consultation':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('PatientProfile')}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('BookAppointment')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.actionIconText, { color: '#3B82F6' }]}>
                  📅
                </Text>
              </View>
              <Text style={styles.actionText}>Book Appointment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('MedicalRecords')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.actionIconText, { color: '#10B981' }]}>
                  📋
                </Text>
              </View>
              <Text style={styles.actionText}>My Records</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Appointments')}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingAppointments.length > 0 ? (
            <FlatList
              data={upcomingAppointments}
              renderItem={renderAppointmentItem}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appointmentList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No upcoming appointments
              </Text>
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => navigation.navigate('BookAppointment')}
              >
                <Text style={styles.bookNowText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Medical Records */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Medical Records</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MedicalRecords')}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentRecords.length > 0 ? (
            <View style={styles.recordsList}>
              {recentRecords.slice(0, 3).map(record => (
                <View key={record.id} style={styles.recordItemContainer}>
                  <View style={styles.recordIcon}>
                    <Text style={styles.recordIconText}>
                      {getRecordIcon(record.type)}
                    </Text>
                  </View>
                  <View style={styles.recordDetails}>
                    <Text style={styles.recordTitle}>{record.title}</Text>
                    <Text style={styles.recordDate}>{record.date}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewRecordButton}
                    onPress={() =>
                      navigation.navigate('MedicalRecordDetails', {
                        recordId: record.id,
                      })
                    }
                  >
                    <Text style={styles.viewRecordText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No medical records found
              </Text>
            </View>
          )}
        </View>

        {/* Emergency Section */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyContent}>
            <View>
              <Text style={styles.emergencyTitle}>Medical Emergency?</Text>
              <Text style={styles.emergencyText}>
                Call emergency services immediately
              </Text>
            </View>
            <TouchableOpacity style={styles.emergencyButton}>
              <Text style={styles.emergencyButtonText}>Call 911</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAll: {
    color: '#10B981',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  appointmentList: {
    paddingVertical: 8,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: 280,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentInfoContainer: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateTime: {
    fontSize: 14,
    color: '#4B5563',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  viewButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#10B981',
    fontWeight: '500',
  },
  recordsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderBottomColor: '#F3F4F6',
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordIconText: {
    fontSize: 18,
  },
  recordDetails: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewRecordButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },
  viewRecordText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  bookNowButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emergencySection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  emergencyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B91C1C',
    marginBottom: 4,
  },
  emergencyText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emergencyButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default PatientDashboard;
