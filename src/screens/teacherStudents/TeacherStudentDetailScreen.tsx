import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HeaderIconButton } from '../../components/Header';
import CroppedPhoto from '../../components/CroppedPhoto';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { fromApiDate } from '../../utils/dayMonthYear';
import { DocHeader, DocError } from '../more/docUi';
import { StudentDetail, getStudent } from '../../api/teacherStudentApi';
import StudentPhotoModal from './StudentPhotoModal';

/**
 * One of a class teacher's students, laid out as the teacher's own Profile is:
 * the photo, the name and the email in the middle, then a line for each thing
 * the school keeps about them — label on the left, value from the middle. A
 * field with nothing in it is left out.
 *
 * Edit in the header opens the student's form (where they can also be
 * removed); saved, it comes back here showing what was saved. The photo,
 * tapped, opens large, to be cropped there (StudentPhotoModal).
 *
 * Route params: id, classes (passed on to the form).
 */

// Normalise a field for display: empty, "null" or "N/A" counts as nothing.
const val = (v: any): string => {
  if (v === null || v === undefined) return '';
  const str = String(v).trim();
  return str === '' || ['n/a', 'null'].includes(str.toLowerCase()) ? '' : str;
};

// "2015-04-12" → "12/04/2015"; anything else as it came.
const dayMonthYear = (v?: string | null) => fromApiDate(v) || val(v);

const capitalize = (v?: string | null) => (val(v) ? val(v).charAt(0).toUpperCase() + val(v).slice(1) : '');

// Every field, in page order: their numbers at school, then who they are and
// their family, then where they live and the bus.
const rowsOf = (d: StudentDetail): [string, string][] =>
  (
    [
      ['Admission No', val(d.admission_no)],
      ['Roll No', val(d.roll_no)],
      ['Class', val(d.class)],
      ['Section', val(d.section)],
      ['Mobile', val(d.phone)],
      ['DOB', dayMonthYear(d.dob)],
      ['Gender', capitalize(d.gender)],
      ['Father’s Name', val(d.father_name)],
      ['Mother’s Name', val(d.mother_name)],
      ['Religion', val(d.religion)],
      ['Aadhaar No', val(d.aadhar_no)],
      ['Date of Admission', dayMonthYear(d.date_of_admission)],
      ['Registration No', val(d.registration_number)],
      ['Apaar ID', val(d.appar_id)],
      ['Board', val(d.board)],
      ['Address', val(d.local_address)],
      ['Permanent Address', val(d.permanent_address) === val(d.local_address) ? '' : val(d.permanent_address)],
      ['City', val(d.city)],
      ['State', val(d.state)],
      ['Pincode', val(d.pincode)],
      ['Transport', d.transportation_required ? val(d.route_name) || 'Yes' : ''],
      ['App login', d.is_active ? 'Active' : 'Inactive'],
    ] as [string, string][]
  ).filter(([, v]) => v !== '');

const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[s.infoRow, !last && s.infoRowBorder]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>
);

const TeacherStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const classes = route?.params?.classes;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The photo shown large.
  const [viewing, setViewing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await getStudent(id));
    } catch (e) {
      setError(apiErr(e, 'Could not load this student.'));
    }
  }, [id]);

  // Back from Edit, the page shows what was saved.
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const edit = () => navigation.navigate('TeacherStudentForm', { id, classes });

  if (error && !d) {
    return <DocError title="Student" message={error} onRetry={load} />;
  }

  const header = (
    <DocHeader
      title="Student"
      onBackPress={() => navigation.goBack()}
      rightSlot={d ? <HeaderIconButton icon="create-outline" onPress={edit} /> : undefined}
    />
  );

  if (!d) {
    return (
      <View style={s.root}>
        {header}
        <View style={s.loader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const rows = rowsOf(d);
  const circle = d.photo_circle && d.photo_circle.w > 0 && d.photo_circle.h > 0 ? d.photo_circle : null;

  return (
    <View style={s.root}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Photo (tap to see it large), name, email — centred */}
        <View style={s.head}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setViewing(true)} disabled={!d.image}>
            {d.image && circle ? (
              <CroppedPhoto uri={d.image} crop={circle} size={96} style={s.avatar} />
            ) : d.image ? (
              <Image source={{ uri: d.image }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInitial}>{(d.full_name?.charAt(0) ?? 'S').toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={s.name}>{val(d.full_name) || 'Student'}</Text>
          {!!val(d.email) && <Text style={s.email}>{val(d.email)}</Text>}
        </View>

        <View style={s.divider} />

        <View style={s.body}>
          {rows.map(([label, value], i) => (
            <InfoRow key={label} label={label} value={value} last={i === rows.length - 1} />
          ))}
        </View>
      </ScrollView>

      <StudentPhotoModal
        student={viewing ? d : null}
        onClose={() => setViewing(false)}
        onSaved={(_, image) => setD(prev => (prev ? { ...prev, image, photo_circle: null } : prev))}
        onCircleSaved={(_, photo_circle) => setD(prev => (prev ? { ...prev, photo_circle } : prev))}
      />
    </View>
  );
};

export default TeacherStudentDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },

  // Head — as the teacher's Profile
  head: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, resizeMode: 'cover', overflow: 'hidden' },
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
  email: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' },

  divider: { height: 1, backgroundColor: theme.colors.divider },

  body: { paddingHorizontal: 20, paddingTop: 4 },

  // Label in the left half, value from the middle — as the teacher's Profile.
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { width: '50%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
