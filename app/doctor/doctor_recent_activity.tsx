import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const GREEN = '#10B981';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';

const DATA = [
  {
    id: '1',
    type: 'appointment',
    title: 'Appointment with John Doe',
    time: 'Today • 2:00 PM',
  },
  {
    id: '2',
    type: 'prescription',
    title: 'Prescription updated for Jane',
    time: 'Yesterday • 4:45 PM',
  },
  {
    id: '3',
    type: 'report',
    title: 'Report generated: CBC',
    time: 'Oct 10 • 9:15 AM',
  },
  {
    id: '4',
    type: 'appointment',
    title: 'Appointment with Mark Spencer',
    time: 'Oct 9 • 11:00 AM',
  },
  {
    id: '5',
    type: 'prescription',
    title: 'New prescription for Lily',
    time: 'Oct 9 • 9:20 AM',
  },
];

export default function DoctorRecentActivity() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const iconFor = (type: string) => {
    switch (type) {
      case 'appointment':
        return require('../../assets/appointment_icon.png');
      case 'prescription':
        return require('../../assets/prescription_icon.png');
      case 'report':
      default:
        return require('../../assets/reports_icon.png');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recent Activity</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.divider} />

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        data={DATA}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} activeOpacity={0.85}>
            <View style={styles.itemLeft}>
              <Image
                source={iconFor(item.type)}
                style={styles.itemIcon}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemSub}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: MUTED },
  title: { color: GREEN, fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: BORDER },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  itemLeft: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  itemIcon: { width: 20, height: 20, tintColor: GREEN },
  itemTitle: { color: '#111827', fontWeight: '700' },
  itemSub: { color: MUTED, marginTop: 2 },
});
