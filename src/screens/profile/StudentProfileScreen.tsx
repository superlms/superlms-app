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
import {
  DocHeader,
  DocSection,
  DocList,
  DocLoading,
  DocError,
} from '../more/docUi';

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

// ─── Info Row: label left, value right ────────────────────────────────────────
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

  if (loading) return <DocLoading title="Profile" />;
  if (error || !profile) {
    return <DocError title="Profile" message={error || 'Something went wrong.'} onRetry={fetchProfile} />;
  }

  const { personal_info: p, family_info: f, address_info: a, academic_info: ac } = profile;

  // Name and admission no. sit at the top, so they aren't repeated below.
  // Empty fields are left out; a section with nothing to show is hidden.
  const sections = [
    {
      title: 'Personal Information',
      rows: [
        ['Email', p.email],
        ['Mobile', p.mobile_number],
        ['DOB', p.dob],
        ['Gender', p.gender],
        ['Religion', p.religion],
        ['Aadhar No', p.aadhar_no],
        ['Father Name', f.father_name],
        ['Mother Name', f.mother_name],
      ],
    },
    {
      title: 'Academic Information',
      rows: [
        ['Class', ac.standard_name],
        ['Section', ac.section_name],
        ['Roll No', ac.roll_no],
        ['Date of Admission', ac.date_of_admission],
        ['Board', ac.board],
      ],
    },
    {
      title: 'Address',
      rows: [
        ['Local Address', a.local_address],
        ['Permanent Address', a.permanent_address],
        ['City', a.city],
        ['State', a.state],
        ['Pincode', a.pincode],
      ],
    },
  ]
    .map(sec => ({ ...sec, rows: sec.rows.filter(([, v]) => hasVal(v)) as [string, any][] }))
    .filter(sec => sec.rows.length > 0);

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
          {sections.map(sec => (
            <DocSection key={sec.title} title={sec.title}>
              <DocList>
                {sec.rows.map(([label, value], i) => (
                  <InfoRow
                    key={label}
                    label={label}
                    value={value}
                    last={i === sec.rows.length - 1}
                  />
                ))}
              </DocList>
            </DocSection>
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

  // Full-width thin line between the head and the details
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider },

  body: { paddingHorizontal: 20, paddingTop: 24, gap: 28 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, textAlign: 'right' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
