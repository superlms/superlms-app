import React, { useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getTeacherProfile } from '../../api/teacherApi';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeacherProfile {
  personal_info:     Record<string, any>;
  professional_info: Record<string, any>;
  address_info:      Record<string, any>;
  assignments:       { subjects: any[]; classes: any[]; sections: any[]; summary: Record<string, any> };
  organization_info: Record<string, any>;
}

// Normalize any field to a display string — missing/empty/"N/A" → dash.
const val = (v: any): string => {
  if (v === null || v === undefined) return '—';
  const str = String(v).trim();
  if (str === '' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') {
    return '—';
  }
  return str;
};

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({
  label, value, last,
}: {
  label: string; value: any; last?: boolean;
}) => (
  <View style={[s.infoRow, !last && s.infoRowBorder]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue} numberOfLines={2}>{val(value)}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const TeacherProfileScreen = () => {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTeacherProfile();
      setProfile(data);
    } catch (e: any) {
      console.log('[TeacherProfile] ❌', e?.response?.data ?? e?.message);
      setError(e?.response?.data?.message ?? 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchProfile);

  useFocusLoad(fetchProfile);

  if (loading) {
    return (
      <View style={s.root}>
        <Header title="Profile" />
        <View style={s.center}>
          <ScreenSkeleton variant="profile" />
          <Text style={s.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={s.root}>
        <Header title="Profile" />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={48} color={theme.colors.danger} />
          <Text style={s.errorText}>{error || 'Something went wrong.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchProfile}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { personal_info: p, professional_info: pr, address_info: a } = profile;

  return (
    <View style={s.root}>
      <Header title="Profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Single announcement-style card ── */}
        <View style={s.card}>
          <View style={[s.accentStrip, { backgroundColor: theme.colors.primary }]} />

          <View style={s.cardInner}>
            {/* Header: avatar + name + role */}
            <View style={s.profileHead}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>
                    {(p.name?.charAt(0) ?? 'T').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.headInfo}>
                <Text style={s.name} numberOfLines={2}>{val(p.name)}</Text>
                <View style={s.roleRow}>
                  <View style={s.rolePill}>
                    <Text style={s.rolePillText}>Faculty Member</Text>
                  </View>
                  {!!pr.employee_id && <Text style={s.roleSub}>{pr.employee_id}</Text>}
                </View>
              </View>
            </View>

            {/* Personal */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Personal Information</Text>
            <InfoRow label="Full Name"         value={p.name} />
            <InfoRow label="Email"             value={p.email} />
            <InfoRow label="Mobile"            value={p.mobile_number} />
            <InfoRow label="Emergency Contact" value={p.emergency_contact} />
            <InfoRow label="DOB"               value={p.dob} />
            <InfoRow label="Gender"            value={p.gender} last />

            {/* Professional */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Professional Information</Text>
            <InfoRow label="Employee ID"     value={pr.employee_id} />
            <InfoRow label="Date of Joining" value={pr.date_of_joining} />
            <InfoRow label="Qualification"   value={pr.qualification} last />

            {/* Address */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Address</Text>
            <InfoRow label="Address" value={a.address} />
            <InfoRow label="City"    value={a.city} />
            <InfoRow label="State"   value={a.state} />
            <InfoRow label="Pincode" value={a.pincode} last />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default TeacherProfileScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8 },
  errorText: { fontSize: 14, color: theme.colors.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: theme.radius.full, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },

  // Card (View Announcement style)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },

  // Header
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, resizeMode: 'cover' },
  avatarFallback: {
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
  headInfo: { flex: 1 },
  name: { fontSize: 19, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 25 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rolePill: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rolePillText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  roleSub: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F6FA' },
  infoLabel: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  infoValue: {
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: width * 0.5,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
