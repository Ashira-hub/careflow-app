import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, FlatList, TextInput, Modal, Alert, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';
const CARD_BG = '#F9FAFB';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'supervisor' | 'labstaff' | 'user';
  active: boolean;
};

export default function AdminManageUsers() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const API_BASE = 'https://capstone-production-8af8.up.railway.app';
  const [showEditor, setShowEditor] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<{ name: string; email: string; role: User['role']; active: boolean; password?: string }>({ name: '', email: '', role: 'user', active: true });
  const [darkMode, setDarkMode] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(undefined);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const getAuthHeaders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('session');
      if (!raw) return { 'Content-Type': 'application/json' } as Record<string, string>;
      const sess = JSON.parse(raw);
      const token = sess?.token || sess?.user?.token || sess?.accessToken;
      if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } as Record<string, string>;
      return { 'Content-Type': 'application/json' };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  const list = React.useMemo(() => {
    return users.filter(u => (
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
    ));
  }, [users, query]);

  const fetchUsers = React.useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users`, { headers });
      if (!res.ok) {
        const msg = `Failed to load users (HTTP ${res.status})`;
        Alert.alert('Error', msg);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data as User[]);
      } else if (Array.isArray(data.users)) {
        setUsers(data.users as User[]);
      } else if (Array.isArray(data.data)) {
        setUsers(data.data as User[]);
      } else if (Array.isArray(data.results)) {
        setUsers(data.results as User[]);
      } else {
        Alert.alert('Error', 'Unexpected response format from /api/admin/users');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE, refreshing, getAuthHeaders]);

  React.useEffect(() => {
    fetchUsers();
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
        if (av) setAvatarUri(String(av)); else {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          if (cache?.avatar_uri) setAvatarUri(String(cache.avatar_uri));
        }
      } catch {}
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arr: any[] = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => !n.read).length : 0;
        setUnreadCount(unread);
      } catch {}
    })();
  }, [fetchUsers]);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem('admin_dark_mode'); if (raw != null) setDarkMode(raw === '1'); } catch {}
      try {
        const rawS = await AsyncStorage.getItem('session');
        const sess = rawS ? JSON.parse(rawS) : null;
        const av = sess?.user?.avatar_uri || sess?.user?.avatarUrl || null;
        if (av) setAvatarUri(String(av)); else {
          const rawC = await AsyncStorage.getItem('admin_profile_cache');
          const cache = rawC ? JSON.parse(rawC) : null;
          setAvatarUri(cache?.avatar_uri || undefined);
        }
      } catch {}
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arr: any[] = rawN ? JSON.parse(rawN) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => !n.read).length : 0;
        setUnreadCount(unread);
      } catch {}
    })();
    return () => {};
  }, []));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'user', active: true, password: '' });
    setShowEditor(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, active: u.active });
    setShowEditor(true);
  };
  const saveUser = async () => {
    if (!form.name || !form.email) {
      Alert.alert('Validation', 'Name and Email are required.');
      return;
    }
    if (!editing) {
      if (!form.password || form.password.length < 6) {
        Alert.alert('Validation', 'Password is required (min 6 characters).');
        return;
      }
    }
    try {
      const headers = await getAuthHeaders();
      if (editing) {
        const res = await fetch(`${API_BASE}/api/users/${editing.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          let msg = `Save failed (HTTP ${res.status})`;
          try { const data = await res.json(); if (data?.message) msg = data.message; } catch {}
          throw new Error(msg);
        }
      } else {
        const res = await fetch(`${API_BASE}/api/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: form.name, email: form.email, role: form.role, active: form.active, password: form.password }),
        });
        if (!res.ok) {
          let msg = `Create failed (HTTP ${res.status})`;
          try { const data = await res.json(); if (data?.message) msg = data.message; } catch {}
          throw new Error(msg);
        }
        try {
          const rawN = await AsyncStorage.getItem('admin_notifications');
          const arrN = rawN ? JSON.parse(rawN) : [];
          const notif = {
            id: `ADMIN-N-${Date.now()}`,
            title: 'New User Added',
            message: `${form.name} (${form.email}) • Role: ${form.role}`,
            timestamp: Date.now(),
            read: false,
          } as any;
          const nextN = [notif, ...(Array.isArray(arrN) ? arrN : [])];
          await AsyncStorage.setItem('admin_notifications', JSON.stringify(nextN));
        } catch {}
      }
      setShowEditor(false);
      setRefreshing(true);
      fetchUsers();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save user');
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/${u.id}/active`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) throw new Error(`Status update failed (HTTP ${res.status})`);
      try {
        const rawN = await AsyncStorage.getItem('admin_notifications');
        const arrN = rawN ? JSON.parse(rawN) : [];
        const now = Date.now();
        const notif = {
          id: `ADMIN-STATUS-${now}`,
          title: !u.active ? 'User Enabled' : 'User Disabled',
          message: `${u.name} (${u.email}) is now ${!u.active ? 'Active' : 'Disabled'}.`,
          timestamp: now,
          read: false,
        } as any;
        await AsyncStorage.setItem('admin_notifications', JSON.stringify([notif, ...(Array.isArray(arrN) ? arrN : [])]));
      } catch {}
      setRefreshing(true);
      fetchUsers();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const deleteUser = (u: User) => {
    Alert.alert('Delete User', `Delete ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/api/users/${u.id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
            try {
              const rawN = await AsyncStorage.getItem('admin_notifications');
              const arrN = rawN ? JSON.parse(rawN) : [];
              const now = Date.now();
              const notif = { id: `ADMIN-DELETE-${now}`, title: 'User Deleted', message: `${u.name} (${u.email}) has been deleted.`, timestamp: now, read: false } as any;
              await AsyncStorage.setItem('admin_notifications', JSON.stringify([notif, ...(Array.isArray(arrN) ? arrN : [])]));
            } catch {}
            setRefreshing(true);
            fetchUsers();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete user');
          }
        } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, darkMode && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.container, darkMode && { backgroundColor: '#0B1220' }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}> 
          <Image source={require('../../assets/appicon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerIcons}>
            <View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AdminNotification' as never)}>
                <Image source={require('../../assets/notification_icon.png')} style={[styles.headerIconImg, darkMode && { tintColor: '#9CA3AF' }]} resizeMode="contain" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{Math.min(99, unreadCount)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileMenu(true)}>
              <View style={[styles.avatarCircle, darkMode && { borderColor: '#374151' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <Image source={require('../../assets/appicon.png')} style={styles.avatarImg} resizeMode="cover" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, darkMode && { backgroundColor: '#1F2937' }]} />

        {/* Controls */}
        <View style={{ padding: 16, gap: 8 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.screenTitle, darkMode && { color: '#22C55E' }]}>Manage Users</Text>
            <TouchableOpacity style={[styles.addBtn, darkMode && { backgroundColor: '#0B1220', borderColor: '#1F2937' }]} onPress={openCreate}>
              <Text style={[styles.addText, darkMode && { color: '#22C55E' }]}>+ Add User</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <View style={[styles.searchWrap, darkMode && { backgroundColor: '#0B1220', borderColor: '#1F2937' }]}>
              <Image source={require('../../assets/search_icon.png')} style={styles.searchIcon} resizeMode="contain" />
              <TextInput
                placeholder="Search name or email"
                placeholderTextColor={darkMode ? '#9CA3AF' : MUTED}
                style={[styles.searchInput, darkMode && { color: '#E5E7EB' }]}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </View>

          
        </View>

        {/* List */}
        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchUsers(); }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {loading ? (
                <>
                  <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, darkMode && { color: '#9CA3AF' }]}>Loading users...</Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.emptyText, darkMode && { color: '#9CA3AF' }]}>No users found.</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={[styles.userRow, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}>
              <View style={[styles.avatarRound, darkMode && { backgroundColor: '#0B1220', borderColor: '#374151' }]}><Text style={[styles.avatarText, darkMode && { color: '#22C55E' }]}>{initials(item.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, darkMode && { color: '#E5E7EB' }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.userMeta, darkMode && { color: '#9CA3AF' }]}>{item.email} • {item.role}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[
                  styles.statusBadge,
                  item.active ? styles.statusActive : styles.statusInactive,
                  darkMode && (item.active
                    ? { backgroundColor: '#052e1f', borderColor: '#14532d' }
                    : { backgroundColor: '#0B1220', borderColor: '#374151' }
                  )
                ]}>
                  <Text style={[styles.statusText, item.active && { color: GREEN }, darkMode && { color: item.active ? '#22C55E' : '#9CA3AF' }]}>{item.active ? 'Active' : 'Disabled'}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Text style={[styles.actionLink, darkMode && { color: '#22C55E' }]}>Edit</Text>
                  </TouchableOpacity>
                  <Text style={{ color: MUTED }}>|</Text>
                  <TouchableOpacity onPress={() => toggleActive(item)}>
                    <Text style={[styles.actionLink, darkMode && { color: '#22C55E' }]}>{item.active ? 'Disable' : 'Enable'}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: MUTED }}>|</Text>
                  <TouchableOpacity onPress={() => deleteUser(item)}>
                    <Text style={[styles.actionLink, { color: '#EF4444' }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />

        {/* Editor Modal */}
        <Modal visible={showEditor} animationType="fade" transparent onRequestClose={() => setShowEditor(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, darkMode && { backgroundColor: '#111827' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, darkMode && { color: '#E5E7EB' }]}>{editing ? 'Edit User' : 'Add User'}</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEditor(false)}>
                  <Text style={[styles.closeText, darkMode && { color: '#9CA3AF' }]}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={[styles.fieldLabel, darkMode && { color: '#9CA3AF' }]}>Name</Text>
                <TextInput
                  style={[styles.fieldInput, darkMode && { borderColor: '#1F2937', color: '#E5E7EB' }]}
                  value={form.name}
                  onChangeText={(t) => setForm({ ...form, name: t })}
                  placeholder="Full name"
                  placeholderTextColor={darkMode ? '#9CA3AF' : MUTED}
                />
                <Text style={[styles.fieldLabel, darkMode && { color: '#9CA3AF' }]}>Email</Text>
                <TextInput
                  style={[styles.fieldInput, darkMode && { borderColor: '#1F2937', color: '#E5E7EB' }]}
                  value={form.email}
                  onChangeText={(t) => setForm({ ...form, email: t })}
                  placeholder="user@email.com"
                  placeholderTextColor={darkMode ? '#9CA3AF' : MUTED}
                  autoCapitalize="none"
                />
                {!editing && (
                  <>
                    <Text style={[styles.fieldLabel, darkMode && { color: '#9CA3AF' }]}>Password</Text>
                    <TextInput
                      style={[styles.fieldInput, darkMode && { borderColor: '#1F2937', color: '#E5E7EB' }]}
                      value={form.password}
                      onChangeText={(t) => setForm({ ...form, password: t })}
                      placeholder="Enter password"
                      placeholderTextColor={darkMode ? '#9CA3AF' : MUTED}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </>
                )}
                <Text style={[styles.fieldLabel, darkMode && { color: '#9CA3AF' }]}>Role</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(['admin','doctor','nurse','pharmacist','supervisor','labstaff','user'] as User['role'][]).map(r => (
                    <TouchableOpacity key={r} style={[styles.chip, form.role === r && styles.chipActive, darkMode && { borderColor: '#1F2937', backgroundColor: '#0B1220' }]} onPress={() => setForm({ ...form, role: r })}>
                      <Text style={[styles.chipText, form.role === r && styles.chipTextActive, darkMode && { color: '#9CA3AF' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.switchRow}>
                  <Text style={[styles.fieldLabel, darkMode && { color: '#9CA3AF' }]}>Active</Text>
                  <Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} thumbColor={form.active ? GREEN : '#ccc'} />
                </View>
                <TouchableOpacity style={[styles.saveBtn]} onPress={saveUser}>
                  <Text style={[styles.saveText]}>{editing ? 'Save Changes' : 'Create User'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
            <View style={[styles.dropdownCard, { top: insets.top + 48, right: 16 }, darkMode && { backgroundColor: '#111827', borderColor: '#1F2937' }]}> 
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('AdminProfile' as never); }}>
                <Text style={[styles.dropdownText, darkMode && { color: '#E5E7EB' }]}>Profile</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, darkMode && { backgroundColor: '#1F2937' }]} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try { await AsyncStorage.removeItem('session'); } catch {}
                  navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
                }}
              >
                <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Bottom Bar */}
        <View style={[styles.bottomBar, darkMode && { backgroundColor: '#111827', borderTopColor: '#1F2937' }]}>
          <BottomItem label="Home" source={require('../../assets/home_icon.png')} onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <BottomItem label="Users" active source={require('../../assets/profile_icon.png')} onPress={() => {}} />
          <BottomItem label="Reports" source={require('../../assets/reports_icon.png')} onPress={() => navigation.navigate('AdminReports' as never)} />
          <BottomItem label="Settings" source={require('../../assets/settings_icon.png')} onPress={() => navigation.navigate('AdminSettings' as never)} />
        </View>

      </View>
    </SafeAreaView>
  );
}

function BottomItem({ label, active, source, onPress }: { label: string; active?: boolean; source: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.bottomItem} activeOpacity={0.85} onPress={onPress}>
      <Image source={source} style={[styles.bottomImg, { tintColor: active ? GREEN : MUTED }]} resizeMode="contain" />
      <Text style={[styles.bottomLabel, active && { color: GREEN }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },

  container: { 
    flex: 1, 
    paddingBottom: 80 
  },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 8 
  },

  headerLogo: { 
    width: 40, 
    height: 40 
  },

  headerIcons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },

  iconBtn: { 
    padding: 8 
  },

  headerIconImg: { 
    width: 20, 
    height: 20, 
    tintColor: GREEN 
  },
  badgeWrap: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  
  avatarBtn: { 
    padding: 4 
  },

  avatarCircle: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: GREEN 
  },

  avatarImg: { 
    width: '100%', 
    height: '100%' 
  },

  divider: { 
    height: 1, 
    backgroundColor: BORDER 
  },

  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    top: -5 
  },

  screenTitle: { 
    color: GREEN, 
    fontWeight: '700', 
    fontSize: 16 
  },

  addBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: GREEN 
  },

  addText: { 
    color: GREEN, 
    fontWeight: '700' 
  },

  searchRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },

  searchWrap: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8,
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: BORDER, 
    borderRadius: 12 
  },

  searchIcon: { 
    width: 16, 
    height: 16, 
    tintColor: GREEN 
  },

  searchInput: { 
    flex: 1, 
    color: '#111827' 
  },

  chipsRow: { 
    gap: 8, 
    paddingVertical: 10 
  },

  chip: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 999, 
    borderWidth: 1, 
    borderColor: BORDER, 
    backgroundColor: '#FFFFFF', 
    marginRight: 6 
  },

  chipActive: { 
    borderColor: GREEN, 
    backgroundColor: '#ECFDF5' 
  },

  chipText: { 
    color: MUTED, 
    fontWeight: '700' 
  },

  chipTextActive: { 
    color: GREEN 
  },

  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 12, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#F3F4F6' 
  },

  avatarRound: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#E6FFF5', 
    borderWidth: 1, 
    borderColor: GREEN, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  avatarText: { 
    color: GREEN, 
    fontWeight: '700' 
  },

  userName: { 
    color: '#111827', 
    fontWeight: '700' 
  },

  userMeta: { 
    color: MUTED, 
    fontSize: 12, 
    marginTop: 2 
  },

  statusBadge: { 
    minWidth: 90, 
    paddingHorizontal: 8, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    marginBottom: 6 
  },

  statusActive: { 
    backgroundColor: '#E6FFF5', 
    borderColor: GREEN 
  },

  statusInactive: { 
    backgroundColor: '#F3F4F6', 
    borderColor: BORDER 
  },

  statusText: { 
    color: '#111827', 
    fontWeight: '700', 
    fontSize: 12 
  },

  actionsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },

  actionLink: { 
    color: GREEN, 
    fontWeight: '700' 
  },
  // Modal
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16 
  },

  modalCard: { 
    width: '100%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16 
  },

  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },

  modalTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827' 
  },

  closeBtn: { 
    padding: 6, 
    borderRadius: 14 
  },

  closeText: { 
    fontSize: 24, 
    color: MUTED, 
    lineHeight: 24 
  },

  fieldLabel: { 
    color: MUTED 
  },

  fieldInput: { 
    borderWidth: 1, 
    borderColor: BORDER, 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    color: '#111827' 
  },

  switchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },

  saveBtn: { 
    backgroundColor: GREEN, 
    borderRadius: 12, 
    paddingVertical: 12, 
    alignItems: 'center', 
    marginTop: 6 
  },

  saveText: { 
    color: '#FFFFFF', 
    fontWeight: '700' 
  },
  // Dropdown styles
  dropdownOverlay: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0 
  },

  dropdownCard: { 
    position: 'absolute', 
    width: 180, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: BORDER, 
    paddingVertical: 6, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 3 
  },

  dropdownItem: { 
    paddingVertical: 10, 
    paddingHorizontal: 12 
  },

  dropdownText: { 
    color: '#111827',
    fontWeight: '700' 
  },

  menuDivider: { 
    height: 1,
    backgroundColor: BORDER 
  },

  bottomBar: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 45, 
    height: 64, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: BORDER, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center' 
  },

  bottomItem: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  bottomImg: { 
    width: 22, 
    height: 22, 
    marginBottom: 4 
  },

  bottomLabel: { 
    fontSize: 10, 
    color: MUTED 
  },

  // Loading and empty states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500'
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500'
  },
});

