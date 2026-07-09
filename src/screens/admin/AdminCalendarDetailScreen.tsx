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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, EventDetail, getEventById } from '../../api/calendarApi';
import { deleteEvent } from '../../api/adminContentApi';
import { colorFor } from './AdminCalendarFormScreen';

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const Row = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) =>
  value ? (
    <View style={s.row}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value}</Text>
      </View>
    </View>
  ) : null;

const AdminCalendarDetailScreen = ({ navigation, route }: any) => {
  const passed: ApiEvent | undefined = route?.params?.item;
  const id: number = route?.params?.id ?? passed?.id;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await getEventById(id);
      setDetail(d);
    } catch {
      // fall back to the list event we were passed
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const remove = () =>
    Alert.alert('Delete event', `Delete "${detail?.title ?? passed?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEvent(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  // Prefer full detail; fall back to the passed list event.
  const title = detail?.title ?? passed?.title ?? '';
  const eventType = detail?.event_type ?? passed?.event_type ?? 'event';
  const color = detail?.color || passed?.color || colorFor(eventType);
  const date = detail?.date ?? passed?.date;
  const isAllDay = detail?.is_all_day ?? passed?.is_all_day;
  const startT = detail?.start_time ?? passed?.start_time;
  const endT = detail?.end_time ?? passed?.end_time;
  const description = detail?.description ?? passed?.description;
  const timing = isAllDay ? 'All day' : (startT ? `${hhmm(startT)}${endT ? ` – ${hhmm(endT)}` : ''}` : null);

  const forEdit: ApiEvent = {
    id,
    title,
    description: description ?? '',
    date: date ?? '',
    start_time: startT ?? null,
    end_time: endT ?? null,
    is_all_day: !!isAllDay,
    event_type: eventType,
    color: color ?? '',
    location: null,
    academic_details: null,
    created_at: '',
    updated_at: '',
  };

  const loc = detail?.location;
  const acad = detail?.academic_details;

  return (
    <View style={s.root}>
      <Header title="Event" onBackPress={() => navigation.goBack()} />
      {loading && !detail ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <View style={[s.colorBar, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              <View style={[s.typeTag, { backgroundColor: color + '18' }]}>
                <Text style={[s.typeTagText, { color }]}>{eventType}</Text>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <Row icon="calendar-outline" label="Date" value={date} />
            <Row icon="time-outline" label="Timing" value={timing} />
            <Row icon="document-text-outline" label="Description" value={description} />
            {!!loc && <Row icon="location-outline" label="Location" value={loc.full_address || loc.location || loc.room_number || loc.building} />}
            {!!acad?.standard && <Row icon="school-outline" label="Class" value={`${acad.standard.name}${acad.section ? ' - ' + acad.section.name : ''}`} />}
            {!!acad?.subject && <Row icon="book-outline" label="Subject" value={acad.subject.name} />}
            {!!acad?.teacher?.name && <Row icon="person-outline" label="Teacher" value={acad.teacher.name} />}
            {!!detail?.creator_name && <Row icon="create-outline" label="Created by" value={detail.creator_name} />}
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={[s.actBtn, s.editBtn]} activeOpacity={0.9}
              onPress={() => navigation.navigate('AdminCalendarForm', { item: forEdit })}>
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
      )}
    </View>
  );
};

export default AdminCalendarDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  colorBar: { width: 5, borderRadius: 3, alignSelf: 'stretch', minHeight: 44 },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  typeTag: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.full },
  typeTagText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  card: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, marginTop: 18 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  rowValue: { fontSize: 14, color: theme.colors.textPrimary, marginTop: 2, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtn: { backgroundColor: theme.colors.primary },
  deleteBtn: { backgroundColor: theme.colors.danger },
  actBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
