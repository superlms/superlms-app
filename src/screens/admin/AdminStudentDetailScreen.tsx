import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { StudentDetail, deleteStudent, getStudent } from '../../api/adminStudentApi';
import { AppAlert } from '../../components/AppDialog';

/**
 * One student, as the app shows a person: the photo, the name and the class
 * over what the school keeps about them — each block a heading and plain lines,
 * with no boxes around them. Edit opens the same form the + does; Remove takes
 * the student and their login away, and asks first.
 */

interface Line {
  label: string;
  value?: string | null;
}

// A heading and its lines — the ones the school has nothing for are left out,
// and the last line keeps no divider under it.
const Block = ({ title, lines }: { title: string; lines: Line[] }) => {
  const shown = lines.filter(l => !!l.value);
  if (shown.length === 0) return null;
  return (
    <View>
      <Text style={s.blockTitle}>{title.toUpperCase()}</Text>
      {shown.map((l, i) => (
        <View key={l.label} style={[s.line, i < shown.length - 1 && s.lineDivider]}>
          <Text style={s.lineLabel}>{l.label}</Text>
          <Text style={s.lineValue}>{l.value}</Text>
        </View>
      ))}
    </View>
  );
};

const AdminStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStudent(id);
      setD(res);
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not load student.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    AppAlert.alert('Remove this student?', `${d?.full_name || 'This student'} and their login will be deleted. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteStudent(id);
            navigation.goBack();
          } catch (e) {
            AppAlert.alert('Could not remove', apiErr(e, 'Please try again.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  return (
    <View style={s.root}>
      <DocHeader title="Student" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : !d ? null : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Who they are */}
          <View style={s.hero}>
            {d.image ? (
              <Image source={{ uri: d.image }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.photoEmpty]}>
                <Text style={s.initial}>{(d.full_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.name}>{d.full_name}</Text>
            <Text style={s.sub}>
              {[[d.class, d.section].filter(Boolean).join(' · '), d.roll_no ? `Roll ${d.roll_no}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </Text>
            {!d.is_active && <Text style={s.inactive}>Signed out of the app</Text>}
          </View>

          <Block
            title="Academic"
            lines={[
              { label: 'Admission No', value: d.admission_no },
              { label: 'Roll No', value: d.roll_no },
              { label: 'Class', value: d.class },
              { label: 'Section', value: d.section },
              { label: 'Board', value: d.board },
              { label: 'Date of Admission', value: d.date_of_admission },
              { label: 'Registration No', value: d.registration_number },
              { label: 'Apaar ID', value: d.appar_id },
            ]}
          />

          <Block
            title="Personal"
            lines={[
              { label: 'Email', value: d.email },
              { label: 'Phone', value: d.phone },
              { label: 'Gender', value: d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null },
              { label: 'Date of Birth', value: d.dob },
              { label: 'Religion', value: d.religion },
              { label: 'Aadhaar No', value: d.aadhar_no },
              { label: 'Father’s Name', value: d.father_name },
              { label: 'Mother’s Name', value: d.mother_name },
            ]}
          />

          <Block
            title="Address"
            lines={[
              { label: 'Local Address', value: d.local_address },
              { label: 'Permanent Address', value: d.permanent_address },
              { label: 'City', value: d.city },
              { label: 'State', value: d.state },
              { label: 'Pincode', value: d.pincode },
            ]}
          />

          {d.transportation_required && (
            <Block title="Transport" lines={[{ label: 'Route', value: d.route_name ?? '—' }]} />
          )}

          <TouchableOpacity style={s.editBtn} activeOpacity={0.9}
            onPress={() => navigation.navigate('AdminStudentForm', { id })}>
            <Text style={s.editText}>Edit student</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.removeBtn} activeOpacity={0.7} onPress={remove} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={theme.colors.danger} />
            ) : (
              <>
                <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} />
                <Text style={s.removeText}>Remove student</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.tail} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminStudentDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  // Photo, name, class
  hero: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  photo: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  initial: { fontSize: 30, fontWeight: '600', color: theme.colors.primary },
  name: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 12, textAlign: 'center' },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  inactive: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },

  // Blocks
  blockTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineLabel: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 0 },
  lineValue: { fontSize: 14, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  editBtn: { marginTop: 28, height: 50, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.danger + '55' },
  removeText: { fontSize: 14, fontWeight: '600', color: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
