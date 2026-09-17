import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  Instructor,
  InstructorProfile,
  getInstructorProfile,
} from '../../api/instructorApi';
import { DocHeader } from '../more/docUi';

const TITLE = 'Instructor Profile';

// Side padding of the page body.
const BODY_PAD = 20;

const initials = (name?: string | null) =>
  (name || 'NA')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Label in the left half, value from the middle of the screen to 20 short of
// its right edge; tappable (brand colour) when it has an action such as calling or
// emailing. Every row, the last too, has its line under it.
const InfoRow = ({
  label,
  value,
  onPress,
  labelWidth,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  // Wide enough that the value starts at the middle of the screen.
  labelWidth: number;
}) => {
  const style = [s.infoRow, s.infoRowBorder];
  const labelStyle = { width: labelWidth };
  const content = (
    <>
      <Text style={[s.infoLabel, labelStyle]}>{label}</Text>
      {/* "simple" fills each line to the edge: a long email otherwise breaks
          early on Android and leaves a gap on the right. */}
      <Text style={[s.infoValue, !!onPress && s.infoValueLink]} textBreakStrategy="simple">
        {value}
      </Text>
    </>
  );
  return onPress ? (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.6}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={style}>{content}</View>
  );
};

const Chips = ({ items }: { items: string[] }) => (
  <View style={s.chipWrap}>
    {items.map((label, i) => (
      <View key={`${label}-${i}`} style={s.chip}>
        <Text style={s.chipText}>{label}</Text>
      </View>
    ))}
  </View>
);

const InstructorProfileScreen = ({ navigation, route }: any) => {
  const base: Instructor = route.params?.instructor;
  const [profile, setProfile] = useState<InstructorProfile>(base as InstructorProfile);
  const [loading, setLoading] = useState(false);

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
  // The body's left padding is 20, so a label this wide ends at the middle.
  const { width } = useWindowDimensions();
  const labelWidth = width / 2 - BODY_PAD;

  if (!base) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.muted}>Instructor not found</Text>
        </View>
      </View>
    );
  }

  const subjects = (profile.subjects ?? []).map(sub => sub.name).filter(Boolean);
  const classes = ((profile.classes?.length ? profile.classes : profile.assigned_classes) ?? [])
    .map(c => [c.standard_name, c.section_name].filter(Boolean).join(' - '))
    .filter(Boolean);
  const location = [profile.address, profile.city, profile.state].filter(Boolean).join(', ');

  // The instructor's mobile number is theirs; a student writes to them by
  // email, or opens a chat from the header.
  const details = [
    {
      label: 'Email',
      value: profile.email,
      onPress: profile.email ? () => Linking.openURL(`mailto:${profile.email}`) : undefined,
    },
    { label: 'Address', value: location },
    { label: 'Qualification', value: profile.qualification },
  ].filter(d => !!d.value) as { label: string; value: string; onPress?: () => void }[];

  // The chat icon, as on each row of the instructors list, opens a conversation
  // with this instructor (or the chats, from a server that does not say whose
  // account they are).
  const openChat = () =>
    profile.user_id
      ? navigation.navigate('UserChats', {
          contact: {
            user_id: profile.user_id,
            name: profile.name,
            avatar: profile.avatar,
            subtitle: profile.subjects?.map(sub => sub.name).join(', ') || null,
          },
          userRole: 'student',
        })
      : navigation.navigate('ChatsList');

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon="chatbubble-ellipses-outline"
        onRightPress={openChat}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing && loading} onRefresh={onRefresh} />}
      >
        {/* Photo, name, role — centred */}
        <View style={s.head}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitials}>{initials(profile.name)}</Text>
            </View>
          )}
          <Text style={s.name}>{profile.name}</Text>
          <Text style={s.role}>Instructor</Text>
        </View>

        <View style={s.divider} />

        <View style={s.body}>
          {/* Contact & details */}
          {details.length > 0 ? (
            // The lines run to the right edge of the screen (the values keep
            // the left's padding) and the last divides the details from Subjects.
            <View style={s.details}>
              {details.map(d => (
                <InfoRow
                  key={d.label}
                  label={d.label}
                  value={d.value}
                  onPress={d.onPress}
                  labelWidth={labelWidth}
                />
              ))}
            </View>
          ) : (
            <Text style={s.muted}>No contact details available.</Text>
          )}

          {/* Subjects */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Subjects</Text>
            {subjects.length > 0 ? (
              <Chips items={subjects} />
            ) : (
              <Text style={s.muted}>No subjects assigned.</Text>
            )}
          </View>

          {/* Classes */}
          {classes.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Classes</Text>
              <Chips items={classes} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default InstructorProfileScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 13, color: theme.colors.textMuted },

  // Head
  head: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: '600', color: theme.colors.textSecondary },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 14,
  },
  role: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

  // Full-width line between the head and the details
  divider: { height: 1, backgroundColor: theme.colors.divider },

  body: { paddingHorizontal: BODY_PAD, paddingTop: 4, gap: 24 },

  // Details — pulled out past the body's right padding to the screen edge
  details: { marginRight: -BODY_PAD },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  // The same gap on the right as the page has on the left, so a long email or
  // address stops short of the edge while the row's line still runs to it
  infoValue: { flex: 1, paddingRight: BODY_PAD, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  infoValueLink: { color: theme.colors.primary },

  // Subjects / classes
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
