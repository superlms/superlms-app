import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getStudentProfile } from '../../api/studentApi';
import { DocHeader, DocError } from '../more/docUi';
import ProfileSkeleton from './ProfileSkeleton';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileData {
  personal_info:    Record<string, any>;
  family_info:      Record<string, any>;
  address_info:     Record<string, any>;
  academic_info:    Record<string, any>;
  transport_info:   Record<string, any>;
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

const hasVal = (v: any) => val(v) !== '—';

// The detail list, in page order: personal, then academic, then address. Name
// and admission no. sit at the top, so they aren't repeated. The loading
// skeleton draws one row per entry.
const ROWS: [string, (d: ProfileData) => any][] = [
  ['Email', d => d.personal_info.email],
  ['Mobile', d => d.personal_info.mobile_number],
  ['DOB', d => d.personal_info.dob],
  ['Gender', d => d.personal_info.gender],
  ['Religion', d => d.personal_info.religion],
  ['Aadhar No', d => d.personal_info.aadhar_no],
  ['Father Name', d => d.family_info.father_name],
  ['Mother Name', d => d.family_info.mother_name],
  ['Class', d => d.academic_info.standard_name],
  ['Section', d => d.academic_info.section_name],
  ['Roll No', d => d.academic_info.roll_no],
  ['Date of Admission', d => d.academic_info.date_of_admission],
  ['Board', d => d.academic_info.board],
  ['Local Address', d => d.address_info.local_address],
  ['Permanent Address', d => d.address_info.permanent_address],
  ['City', d => d.address_info.city],
  ['State', d => d.address_info.state],
  ['Pincode', d => d.address_info.pincode],
];

// ─── Info Row: label, then value from the middle ──────────────────────────────
const InfoRow = ({
  label, value, last,
}: {
  label: string; value: any; last?: boolean;
}) => (
  <View style={[s.infoRow, !last && s.infoRowBorder]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{val(value)}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const StudentProfileScreen = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStudentProfile();
      setProfile(data);
    } catch (e: any) {
      console.log('[StudentProfile] ❌', e?.response?.data ?? e?.message);
      setError(e?.response?.data?.message ?? 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchProfile);

  useFocusLoad(fetchProfile);

  if (loading) return <ProfileSkeleton labels={ROWS.map(([label]) => label)} subWidth="42%" />;
  if (error || !profile) {
    return <DocError title="Profile" message={error || 'Something went wrong.'} onRetry={fetchProfile} />;
  }

  const { personal_info: p, academic_info: ac } = profile;

  // One plain list (see ROWS); empty fields are left out.
  const rows = ROWS
    .map(([label, get]) => [label, get(profile)] as [string, any])
    .filter(([, v]) => hasVal(v));

  return (
    <View style={s.root}>
      <DocHeader title="Profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Photo, name, admission no. — centred */}
        <View style={s.head}>
          {p.image ? (
            <Image source={{ uri: p.image }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>
                {(p.full_name?.charAt(0) ?? 'S').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.name}>{val(p.full_name)}</Text>
          {hasVal(ac.admission_no) && (
            <Text style={s.admission}>Admission No. {val(ac.admission_no)}</Text>
          )}
        </View>

        <View style={s.divider} />

        <View style={s.body}>
          {rows.map(([label, value], i) => (
            <InfoRow
              key={label}
              label={label}
              value={value}
              last={i === rows.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default StudentProfileScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // Head
  head: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, resizeMode: 'cover' },
  avatarFallback: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: '600', color: theme.colors.textSecondary },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 14,
  },
  admission: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

  // Full-width line between the head and the details — 1px, a touch stronger
  // than the hairline under the header.
  divider: { height: 1, backgroundColor: theme.colors.divider },

  body: { paddingHorizontal: 20, paddingTop: 4 },

  // Two left-aligned columns: label in the left half, value from the middle.
  // Same 14px font; the value is just a touch heavier (medium, the lightest
  // step above regular in the system font).
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { width: '50%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
