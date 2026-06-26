import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  Instructor,
  InstructorProfile,
  getInstructorProfile,
} from '../../api/instructorApi';

const ACCENTS = [
  { color: '#4F46E5', bg: '#E0E7FF' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#16A34A', bg: '#DCFCE7' },
  { color: '#D97706', bg: '#FEF3C7' },
  { color: '#DB2777', bg: '#FCE7F3' },
  { color: '#7C3AED', bg: '#EDE9FE' },
];
const accentFor = (id: number) => ACCENTS[(id || 0) % ACCENTS.length];

const initials = (name?: string | null) =>
  (name || 'NA')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const InfoRow = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value?: string | null;
  accent: { color: string; bg: string };
}) => {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <View style={[s.infoIcon, { backgroundColor: accent.bg }]}>
        <VectorIcon iconSet="Feather" iconName={icon} size={15} color={accent.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

const InstructorProfileScreen = ({ navigation, route }: any) => {
  const base: Instructor = route.params?.instructor;
  const [profile, setProfile] = useState<InstructorProfile>(base as InstructorProfile);
  const [loading, setLoading] = useState(false);

  const accent = accentFor(base?.id ?? 0);

  const load = async () => {
    if (!base?.id) return;
    setLoading(true);
    try {
      const full = await getInstructorProfile(base.id);
      setProfile(prev => ({ ...prev, ...full }));
    } catch {
      // keep the data we already have from the list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.id]);

  const { refreshing, onRefresh } = useRefresh(load);

  if (!base) {
    return (
      <View style={s.root}>
        <Header title="Instructor Profile" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.errorText}>Instructor not found</Text>
        </View>
      </View>
    );
  }

  const subjects = profile.subjects ?? [];
  const classes = (profile.classes?.length ? profile.classes : profile.assigned_classes) ?? [];
  const location = [profile.address, profile.city, profile.state].filter(Boolean).join(', ');

  return (
    <View style={s.root}>
      <Header title="Instructor Profile" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing && loading} onRefresh={onRefresh} />}
      >
        <View style={s.card}>
          <View style={[s.accentStrip, { backgroundColor: accent.color }]} />

          <View style={s.cardInner}>
            {/* ── Profile header ── */}
            <View style={s.headerRow}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: accent.bg }]}>
                  <Text style={[s.avatarInitials, { color: accent.color }]}>
                    {initials(profile.name)}
                  </Text>
                </View>
              )}
              <View style={s.headerMeta}>
                <Text style={s.name}>{profile.name}</Text>
                <View style={[s.rolePill, { backgroundColor: accent.bg }]}>
                  <VectorIcon iconSet="Ionicons" iconName="school-outline" size={12} color={accent.color} />
                  <Text style={[s.rolePillText, { color: accent.color }]}>Instructor</Text>
                </View>
              </View>
            </View>

            {/* ── Contact ── */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Contact</Text>
            <InfoRow icon="phone" label="Mobile" value={profile.phone} accent={accent} />
            <InfoRow icon="mail" label="Email" value={profile.email} accent={accent} />
            <InfoRow icon="map-pin" label="Address" value={location || null} accent={accent} />
            {!profile.phone && !profile.email && !location && (
              <Text style={s.muted}>No contact details available.</Text>
            )}

            {/* ── Subjects ── */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Subjects</Text>
            {subjects.length > 0 ? (
              <View style={s.chipWrap}>
                {subjects.map(sub => (
                  <View key={sub.id} style={[s.chip, { backgroundColor: accent.bg }]}>
                    <Text style={[s.chipText, { color: accent.color }]}>{sub.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.muted}>No subjects assigned.</Text>
            )}

            {/* ── Classes ── */}
            {classes.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={s.sectionLabel}>Classes</Text>
                <View style={s.chipWrap}>
                  {classes.map((c, i) => {
                    const lbl = [c.standard_name, c.section_name].filter(Boolean).join(' - ');
                    if (!lbl) return null;
                    return (
                      <View key={`${c.standard_id}-${c.section_id}-${i}`} style={s.classChip}>
                        <VectorIcon iconSet="Ionicons" iconName="people-outline" size={12} color={theme.colors.textSecondary} />
                        <Text style={s.classChipText}>{lbl}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── About / Qualification ── */}
            {!!profile.qualification && (
              <>
                <View style={s.divider} />
                <Text style={s.sectionLabel}>Qualification</Text>
                <Text style={s.bodyText}>{profile.qualification}</Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default InstructorProfileScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },

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

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800' },
  headerMeta: { flex: 1 },
  name: { fontSize: 19, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },
  muted: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  infoIcon: { width: 38, height: 38, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600', marginBottom: 1 },
  infoValue: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '700' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  classChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full, paddingHorizontal: 11, paddingVertical: 6,
  },
  classChipText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.textSecondary },

  bodyText: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
