/**
 * splash.tsx — App Splash Screen
 * Displays the logo and a "Get Started" button to go to Login.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  React.useEffect(() => {
    const bootstrap = async () => {
      try {
        const raw = await AsyncStorage.getItem('session');
        if (!raw) return;
        const session = JSON.parse(raw || '{}');
        const role = (session?.role || '').toLowerCase();
        switch (role) {
          case 'admin':
            navigation.replace('AdminDashboard' as any);
            return;
          case 'doctor':
            navigation.replace('DoctorDashboard' as any);
            return;
          case 'nurse':
            navigation.replace('NurseDashboard' as any);
            return;
          case 'pharmacist':
            navigation.replace('PharmacyDashboard' as any);
            return;
          case 'supervisor':
            navigation.replace('SupervisorDashboard' as any);
            return;
          case 'labstaff':
            navigation.replace('LabDashboard' as any);
            return;
          default:
            return;
        }
      } catch {}
    };
    bootstrap();
  }, [navigation]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* App Logo */}
      <Image
        source={require('../assets/applogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* App Title (optional) */}
      <Text style={styles.title}>Welcome to CareFlow</Text>
      <Text style={styles.subtitle}>Simplify patient care and workflow</Text>

      {/* Get Started Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.button}
        onPress={() => navigation.replace('Login')}
      >
        <Text style={styles.buttonText}>GET STARTED</Text>
      </TouchableOpacity>
    </View>
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
  logo: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    top: -80,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    top: -80,
    color: '#6B7280',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 48,
    // top: -90,
    bottom: -120,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
