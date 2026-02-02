import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  DoctorDashboard: undefined;
  PatientDashboard: undefined;
  UserDashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const rm = await AsyncStorage.getItem('remember_me');
        const em = await AsyncStorage.getItem('remember_email');
        const pw = await AsyncStorage.getItem('remember_password');
        if (rm === '1') {
          setRemember(true);
          if (typeof em === 'string') setEmail(em);
          if (typeof pw === 'string') setPassword(pw);
        }
      } catch {}
    })();
  }, []);

  const API_URL = 'https://backend-careflow.vercel.app/api/login'; // your backend IP

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const role = data.user.role.toLowerCase();
        const token =
          data?.token ||
          data?.accessToken ||
          data?.access_token ||
          data?.user?.token ||
          data?.user?.accessToken ||
          data?.user?.access_token;
        try {
          await AsyncStorage.setItem(
            'session',
            JSON.stringify({
              role,
              token,
              accessToken: token,
              user: data.user,
            }),
          );
        } catch (e) {
          // ignore storage errors
        }
        // Set a role-agnostic welcome banner message for the next screen
        try {
          const u = (data?.user || {}) as any;
          const displayName = (u.full_name ||
            u.name ||
            u.email ||
            'user') as string;
          await AsyncStorage.setItem(
            'welcome_pending_message',
            `Welcome back, ${displayName}!`,
          );
        } catch {}
        try {
          if (remember) {
            await AsyncStorage.setItem('remember_me', '1');
            await AsyncStorage.setItem('remember_email', email);
            await AsyncStorage.setItem('remember_password', password);
          } else {
            await AsyncStorage.removeItem('remember_me');
            await AsyncStorage.removeItem('remember_email');
            await AsyncStorage.removeItem('remember_password');
          }
        } catch {}

        switch (role) {
          case 'doctor':
            navigation.replace('DoctorDashboard');
            break;
          case 'patient':
            navigation.replace('PatientDashboard');
            break;
          default:
            navigation.replace('UserDashboard');
        }
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not connect to the server.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Image
            source={require('../assets/applogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Login to your Account</Text>
          <Text style={styles.subtitle}>
            Welcome back, please enter your details
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="example@gmail.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Image
                  source={
                    showPassword
                      ? require('../assets/hidepass.png')
                      : require('../assets/showpass.png')
                  }
                  style={styles.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Pressable
            style={styles.rememberRow}
            onPress={() => setRemember(!remember)}
          >
            <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
              {remember && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </Pressable>

          <TouchableOpacity
            style={styles.loginBtn}
            activeOpacity={0.9}
            onPress={handleLogin}
          >
            <Text style={styles.loginText}>LOGIN</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don’t have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const GREEN = '#10B981';
const BORDER = '#34D399';
const TEXT = '#111827';

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    top: -30,
    fontWeight: '700',
    color: TEXT,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    top: -30,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 24,
  },
  fieldBlock: {
    width: '100%',
    top: -30,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: TEXT,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: TEXT,
    backgroundColor: '#FFFFFF',
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 8,
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    width: 22,
    height: 22,
    tintColor: '#10B981',
  },
  rememberRow: {
    top: -30,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '700',
  },
  rememberText: {
    color: '#6B7280',
    fontSize: 13,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: GREEN,
    borderRadius: 28,
    paddingVertical: 14,
    top: -30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    top: -30,
    marginTop: 16,
  },
  footerText: {
    color: '#6B7280',
  },
  footerLink: {
    color: GREEN,
    fontWeight: '700',
  },
});
