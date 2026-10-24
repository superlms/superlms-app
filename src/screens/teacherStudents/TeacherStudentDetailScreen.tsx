import React, { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HeaderIconButton } from '../../components/Header';
import CroppedPhoto from '../../components/CroppedPhoto';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { fromApiDate } from '../../utils/dayMonthYear';
import { DocHeader, DocError } from '../more/docUi';
import { StudentDetail, StudentRow, getStudent } from '../../api/teacherStudentApi';
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

const InfoRow = ({
  label,
  value,
  last,
  skeleton,
}: {
  label: string;
  value: string;
  last?: boolean;
  skeleton?: boolean;
}) => {
  const T = skeleton ? SkeletonText : Text;
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <View style={s.infoLabelCol}>
        <T style={s.infoLabel}>{label}</T>
      </View>
      <View style={s.infoValueCol}>
        <T style={s.infoValue}>{value}</T>
      </View>
    </View>
  );
};

// A student never opened on this phone: an ordinary one, with what the list
// already said about them (name, class, numbers) in its place.
const sampleOf = (row?: Partial<StudentDetail> | null): StudentDetail => ({
  id: 0,
  user_id: 0,
  full_name: 'Aarav Sharma',
  email: 'aarav.sharma@example.com',
  phone: '9876543210',
  gender: 'male',
  admission_no: '26SSIC160315',
  roll_no: '12',
  class: 'Class 6',
  section: 'Section A',
  dob: '2014-04-12',
  father_name: 'Rajesh Sharma',
  mother_name: 'Sunita Sharma',
  date_of_admission: '2024-04-01',
  local_address: 'House 12, Gandhi Nagar',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  is_active: true,
  transportation_required: false,
  ...(row ?? {}),
});

// What is kept of a student for the skeleton: the page's words, not the photo.
const toKeep = (d: StudentDetail): StudentDetail => ({ ...d, image: d.image ? 'kept' : null, photo_circle: null });

const TeacherStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const classes = route?.params?.classes;
  // The row of the list it was opened from, for a skeleton of this student.
  const row: StudentRow | undefined = route?.params?.row;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The photo shown large.
  const [viewing, setViewing] = useState(false);
  const [last, rememberLast] = useLastLoaded<StudentDetail>(id ? `teacher-student:${id}` : null);
  // The newest load wins: an older one that answers late is ignored.
  const seq = useRef(0);

  const load = useCallback(
    async (tellFailure = false) => {
      const mine = ++seq.current;
      try {
        const got = await getStudent(id);
        if (mine !== seq.current) return;
        setD(got);
        setError(null);
        rememberLast(toKeep(got));
      } catch (e) {
        if (mine !== seq.current) return;
        const message = apiErr(e, 'Could not load this student.');
        // The page already shown stays; only a first load shows the error.
        setError(message);
        if (tellFailure) AppAlert.alert('Could not refresh', message);
      }
    },
    [id, rememberLast],
  );

  // Back from Edit, the page shows what was saved.
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const pull = useCallback(() => load(true), [load]);
  const { refreshing, onRefresh } = useRefresh(pull);

  const edit = () => navigation.navigate('TeacherStudentForm', { id, classes, row: d ?? row });

  if (error && !d) {
    return (
      <DocError
        title="Student"
        message={error}
        onRetry={() => {
          setError(null);
          load();
        }}
      />
    );
  }

  const header = (
    <DocHeader
      title="Student"
      onBackPress={() => navigation.goBack()}
      rightSlot={d ? <HeaderIconButton icon="create-outline" onPress={edit} /> : undefined}
    />
  );

  if (!d) {
    // The page drawn as a skeleton from this student: what was shown the last
    // time they were opened here, else what the list said about them.
    const kept = last ?? sampleOf(row);
    const keptRows = rowsOf(kept);
    return (
      <View style={s.root}>
        {header}
        <ScrollView scrollEnabled={false} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.head}>
            <Skeleton width={96} height={96} radius={48} />
            <View style={s.skName}>
              <SkeletonText style={s.name}>{val(kept.full_name) || 'Student'}</SkeletonText>
            </View>
            {!!val(kept.email) && (
              <View style={s.skName}>
                <SkeletonText style={s.email}>{val(kept.email)}</SkeletonText>
              </View>
            )}
          </View>
          <View style={s.divider} />
          <View style={s.body}>
            {keptRows.map(([label, value], i) => (
              <InfoRow key={label} label={label} value={value} last={i === keptRows.length - 1} skeleton />
            ))}
          </View>
        </ScrollView>
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
  scroll: { paddingBottom: 40 },
  // A centred line of the skeleton's head: the bar sits in the middle.
  skName: { alignSelf: 'stretch', alignItems: 'center' },

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
  infoLabelCol: { width: '50%', paddingRight: 12 },
  infoValueCol: { flex: 1 },
  infoLabel: { fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
