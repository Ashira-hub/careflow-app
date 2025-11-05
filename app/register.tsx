import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const roles = useMemo(() => ['Nurse', 'Doctor', 'Pharmacist', 'Supervisor', 'Lab Staff'], []);

  const API_URL = 'https://capstone-production-8af8.up.railway.app/api/register'; // update to your backend IP if needed

  const toRoleValue = (label: string | null) => {
    if (!label) return null;
    const key = label.toLowerCase().trim();
    if (key === 'lab staff') return 'labstaff';
    return key; // nurse, doctor, pharmacist, supervisor
  };

  const handleRegister = async () => {
  if (!fullName || !role || !email || !password || !confirmPassword) {
    Alert.alert('Validation', 'Please fill out all fields.');
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, role: toRoleValue(role), email, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      Alert.alert('Success', 'Registration successful! Please login.');
      navigation.replace('Login');
    } else {
      console.log("Server response:", data);
      Alert.alert('Error', data.message || 'Registration failed');
    }
  } catch (err) {
    console.error("Network error:", err);
    Alert.alert('Network Error', 'Unable to connect to the server.');
  }
};

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Image
            source={require('../assets/applogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>Register now to get started with an account</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Role</Text>
            <Pressable style={[styles.input, styles.select]} onPress={() => setRoleOpen(!roleOpen)}>
              <Text style={[styles.selectText, { color: role ? TEXT : '#9CA3AF' }]}>
                {role ?? 'Select your role'}
              </Text>
              <Image
                source={require('../assets/dropdown.png')}
                style={styles.selectIcon}
                resizeMode="contain"
              />
            </Pressable>
            {roleOpen && (
              <View style={styles.selectMenu}>
                {roles.map((r) => (
                  <Pressable
                    key={r}
                    style={styles.selectItem}
                    onPress={() => {
                      setRole(r);
                      setRoleOpen(false);
                    }}
                  >
                    <Text style={styles.selectItemText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

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
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Image
                  source={showPassword ? require('../assets/hidepass.png') : require('../assets/showpass.png')}
                  style={styles.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                <Image
                  source={showConfirm ? require('../assets/hidepass.png') : require('../assets/showpass.png')}
                  style={styles.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.registerBtn} activeOpacity={0.9} onPress={handleRegister}>
            <Text style={styles.registerText}>REGISTER</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Login</Text>
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
    fontWeight: '700',
    top: -30,
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
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 15,
  },
  selectIcon: {
    width: 18,
    height: 18,
    tintColor: '#10B981',
    marginLeft: 8,
  },
  selectMenu: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  selectItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectItemText: {
    fontSize: 15,
    color: TEXT,
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
  registerBtn: {
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
  registerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#6B7280',
    top: -30,
  },
  footerLink: {
    color: GREEN,
    top: -30,
    fontWeight: '700',
  },
});

