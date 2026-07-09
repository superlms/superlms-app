import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  deleteClass,
  deleteSection,
  deleteSubject,
  getClasses,
  getSections,
  getSubjects,
} from '../../api/adminStandardApi';

type StdType = 'class' | 'section' | 'subject';
const TITLES: Record<StdType, string> = { class: 'Class Details', section: 'Section Details', subject: 'Subject Details' };
const ICONS: Record<StdType, { icon: string; color: string }> = {
  class: { icon: 'book', color: '#F59E0B' },
  section: { icon: 'grid', color: '#0EA5E9' },
  subject: { icon: 'library', color: '#22C55E' },
};

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value === null || value === undefined || value === '' ? null : (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{String(value)}</Text>
    </View>
  );

const AdminStandardDetailScreen = ({ navigation, route }: any) => {
  const type: StdType = route?.params?.type ?? 'class';
  const [item, setItem] = useState<any>(route?.params?.item ?? null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-fetch through the admin list endpoints so the detail reflects edits.
  const refresh = useCallback(async () => {
    if (!item?.id) return;
    setLoading(true);
    try {
      let found: any = null;
      if (type === 'class') {
        found = (await getClasses()).standards.find((x: any) => x.id === item.id);
      } else if (type === 'section') {
        found = (await getSections({ standard_id: item.standard_id })).sections.find((x: any) => x.id === item.id);
      } else {
        found = (await getSubjects({ standard_id: item.standard_id })).subjects.find((x: any) => x.id === item.id);
      }
      if (found) setItem(found);
      else navigation.goBack(); // deleted elsewhere
    } catch {
      // keep the item we were passed
    } finally {
      setLoading(false);
    }
  }, [type, item?.id, item?.standard_id, navigation]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const remove = () =>
    Alert.alert(`Delete ${type}`, `Delete "${item?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            if (type === 'class') await deleteClass(item.id);
            else if (type === 'section') await deleteSection(item.id);
            else await deleteSubject(item.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  if (!item) {
    return (
      <View style={s.root}>
        <Header title={TITLES[type]} onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const meta = ICONS[type];

  return (
    <View style={s.root}>
      <Header title={TITLES[type]} onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: meta.color + '18' }]}>
            <VectorIcon iconSet="Ionicons" iconName={meta.icon} size={30} color={meta.color} />
          </View>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.sub}>Code {item.code}</Text>
          <View style={[s.statusTag, item.is_active ? s.statusActive : s.statusInactive]}>
            <Text style={[s.statusText, item.is_active ? s.statusTextActive : s.statusTextInactive]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
          {loading && <ActivityIndicator style={{ marginTop: 10 }} color={theme.colors.primary} />}
        </View>

        <View style={s.card}>
          {type === 'class' && (
            <>
              <Row label="Board" value={item.board} />
              <Row label="Display Order" value={item.order} />
              <Row label="Sections" value={item.sections_count ?? 0} />
              <Row label="Subjects" value={item.subjects_count ?? 0} />
            </>
          )}
          {type === 'section' && (
            <>
              <Row label="Class" value={item.standard_name} />
              <Row label="Description" value={item.description} />
              <Row label="Subjects" value={item.subjects_count ?? 0} />
            </>
          )}
          {type === 'subject' && (
            <>
              <Row label="Class" value={item.standard_name} />
              <Row label="Sections" value={item.sections} />
              <Row label="Type" value={item.is_mandatory ? 'Mandatory' : 'Optional'} />
              <Row label="Description" value={item.description} />
            </>
          )}
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={[s.actBtn, s.editBtn]} activeOpacity={0.9}
            onPress={() => navigation.navigate('AdminStandardForm', { type, id: item.id, item })}>
            <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color="#fff" />
            <Text style={s.actBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, s.deleteBtn]} activeOpacity={0.9} onPress={remove} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#fff" /> : (
              <>
                <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color="#fff" />
                <Text style={s.actBtnText}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default AdminStandardDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },

  hero: { alignItems: 'center', paddingVertical: 12 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 10, textAlign: 'center' },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  statusTag: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radius.full },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextActive: { color: '#15803D' },
  statusTextInactive: { color: theme.colors.danger },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, marginTop: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtn: { backgroundColor: theme.colors.primary },
  deleteBtn: { backgroundColor: theme.colors.danger },
  actBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
