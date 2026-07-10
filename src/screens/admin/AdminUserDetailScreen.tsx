import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { AdminUserRow } from '../../api/adminMoreApi';

const roleLabel = (r: string) => (r === 'admin' ? 'Admin' : r === 'sub-admin' ? 'Sub-admin' : r);

const Row = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) =>
  value == null || value === '' ? null : (
    <View style={s.row}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.textMuted} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );

const AdminUserDetailScreen = ({ navigation, route }: any) => {
  const u: AdminUserRow = route.params?.user;
  if (!u) {
    return (
      <View style={s.root}>
        <Header title="User" onBackPress={() => navigation.goBack()} />
        <Text style={s.empty}>Not found.</Text>
      </View>
    );
  }
  const accent = u.is_active ? (u.role === 'admin' ? '#8B5CF6' : '#6366F1') : '#EF4444';

  return (
    <View style={s.root}>
      <Header title="User" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          {u.image ? <Image source={{ uri: u.image }} style={s.avatarImg} /> : (
            <View style={[s.avatar, { backgroundColor: accent + '18' }]}>
              <Text style={[s.avatarText, { color: accent }]}>{(u.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.name}>{u.name}</Text>
          <View style={[s.badge, { backgroundColor: accent + '18' }]}>
            <Text style={[s.badgeText, { color: accent }]}>{roleLabel(u.role)}{u.is_active ? '' : ' · Inactive'}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Row icon="mail-outline" label="Email" value={u.email} />
          <Row icon="call-outline" label="Mobile" value={u.mobile} />
          <Row icon="male-female-outline" label="Gender" value={u.gender} />
          <Row icon="calendar-outline" label="Joined" value={u.date_of_joining} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

export default AdminUserDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  head: { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 28, fontWeight: '900' },
  name: { fontSize: 19, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 12 },
  badge: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  card: { backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600', width: 80 },
  rowValue: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700', textAlign: 'right' },
});
