import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const API_BASE = 'https://backend-careflow.vercel.app';

type Props = {
  unreadCount?: number;
  onPressProfile?: () => void;
  onPressNotifications?: () => void;
};

export default function DoctorTopNav({
  unreadCount = 0,
  onPressProfile,
  onPressNotifications,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [userName, setUserName] = React.useState('');
  const [userRole, setUserRole] = React.useState('Doctor');
  const [internalUnreadCount, setInternalUnreadCount] = React.useState(0);

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
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/notifications`, { headers });
      if (!res.ok) return;
      const rows = await res.json();
      const mapped = Array.isArray(rows)
        ? rows.map((n: any) => ({
            id: String(n.id),
            title: String(n.title || 'Notification'),
            message: String(n.message || ''),
            timestamp: n.created_at
              ? new Date(n.created_at).getTime()
              : Date.now(),
            read: Boolean(n.read) === true,
          }))
        : [];

      const rawLocal = await AsyncStorage.getItem('doctor_notifications');
      const localArr: any[] = rawLocal ? JSON.parse(rawLocal) : [];
      const byId: Record<string, any> = {};
      for (const it of Array.isArray(localArr) ? localArr : []) {
        if (it?.id) byId[String(it.id)] = it;
      }
      for (const it of mapped) {
        if (it?.id) byId[String(it.id)] = { ...byId[String(it.id)], ...it };
      }
      const merged = Object.values(byId)
        .filter(Boolean)
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      await AsyncStorage.setItem(
        'doctor_notifications',
        JSON.stringify(merged),
      );
      setInternalUnreadCount(
        merged.filter((n: any) => n && n.read === false).length,
      );
    } catch {}
  }, [getAuthHeaders]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const rawS = await AsyncStorage.getItem('session');
          const sess = rawS ? JSON.parse(rawS) : null;

          const name =
            sess?.user?.full_name ||
            sess?.user?.fullName ||
            sess?.user?.name ||
            sess?.full_name ||
            sess?.name ||
            '';
          const username = sess?.user?.username || sess?.username || '';
          const email = sess?.user?.email || sess?.email || '';
          const role = sess?.user?.role || sess?.role || 'Doctor';

          setUserName(String(name || username || email || 'Doctor'));
          setUserRole(String(role || 'Doctor'));
        } catch {
          setUserName('Doctor');
          setUserRole('Doctor');
        }
      })();
      syncUnread();
      return () => {};
    }, [syncUnread]),
  );

  const handlePressNotifications = () => {
    if (onPressNotifications) return onPressNotifications();
    navigation.navigate('DoctorNotification' as never);
  };

  const handlePressProfile = () => {
    if (onPressProfile) return onPressProfile();
    navigation.navigate('DoctorProfile' as never);
  };

  const displayUnreadCount = Math.max(
    Number.isFinite(unreadCount) ? unreadCount : 0,
    internalUnreadCount,
  );

  return (
    <>
      <View style={[styles.topHeader, { paddingTop: insets.top }]}>
        <Image
          source={require('../../assets/appicon.png')}
          style={styles.topHeaderLogo}
          resizeMode="contain"
        />
        <View style={styles.topHeaderIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handlePressNotifications}
          >
            <View style={{ position: 'relative' }}>
              <Image
                source={require('../../assets/notification_icon.png')}
                style={styles.topHeaderIconImg}
                resizeMode="contain"
              />
              {displayUnreadCount > 0 && (
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
                    {displayUnreadCount > 99
                      ? '99+'
                      : String(displayUnreadCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topProfileBtn}
            onPress={handlePressProfile}
            activeOpacity={0.8}
          >
            <View style={styles.topProfileAvatar}>
              <Text style={styles.topProfileAvatarText}>
                {String(userName || 'D')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.topProfileTextCol}>
              <Text style={styles.topProfileName} numberOfLines={1}>
                {String(userName || 'Doctor')}
              </Text>
              <Text style={styles.topProfileRole} numberOfLines={1}>
                {String(userRole || 'Doctor')}
              </Text>
            </View>
            <Image
              source={require('../../assets/dropdown.png')}
              style={styles.topProfileChevron}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.topDivider} />
    </>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  topHeaderLogo: { width: 40, height: 40 },
  topHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  topHeaderIconImg: { width: 20, height: 20, tintColor: GREEN },
  topProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  topProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProfileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  topProfileTextCol: {
    marginLeft: 12,
    marginRight: 10,
    maxWidth: 160,
  },
  topProfileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  topProfileRole: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  topProfileChevron: {
    width: 14,
    height: 14,
    tintColor: '#111827',
  },
  topDivider: { height: 1, backgroundColor: BORDER },
});
