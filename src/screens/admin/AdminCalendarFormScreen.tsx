import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent } from '../../api/calendarApi';
import { EventType, createEvent, updateEvent } from '../../api/adminContentApi';

export const EVENT_TYPES: { key: EventType; label: string; color: string }[] = [
  { key: 'class', label: 'Class', color: '#3b82f6' },
  { key: 'exam', label: 'Exam', color: '#ef4444' },
  { key: 'meeting', label: 'Meeting', color: '#f59e0b' },
  { key: 'event', label: 'Event', color: '#10b981' },
  { key: 'holiday', label: 'Holiday', color: '#8b5cf6' },
];
export const colorFor = (t: string) => EVENT_TYPES.find(e => e.key === t)?.color ?? '#6b7280';
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const AdminCalendarFormScreen = ({ navigation, route }: any) => {
  const item: ApiEvent | undefined = route?.params?.item;
  const presetDate: string | undefined = route?.params?.presetDate;
  const isEdit = !!item;

  const [title, setTitle] = useState(item?.title ?? '');
  const [desc, setDesc] = useState(item?.description ?? '');
  const [date, setDate] = useState(item?.date ?? presetDate ?? todayStr());
  const [type, setType] = useState<EventType>((EVENT_TYPES.find(t => t.key === item?.event_type)?.key ?? 'event') as EventType);
  const [allDay, setAllDay] = useState(item ? !!item.is_all_day : true);
  const [start, setStart] = useState(hhmm(item?.start_time));
  const [end, setEnd] = useState(hhmm(item?.end_time));
  const [saving, setSaving] = useState(false);

  const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  const save = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Title is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Invalid date', 'Use the format YYYY-MM-DD.');
    if (!allDay) {
      if (start && !validTime(start)) return Alert.alert('Invalid time', 'Start time must be HH:mm (24h).');
      if (end && !validTime(end)) return Alert.alert('Invalid time', 'End time must be HH:mm (24h).');
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: desc.trim() || null,
        date,
        is_all_day: allDay,
        start_time: allDay ? null : start || null,
        end_time: allDay ? null : end || null,
        event_type: type,
        color: colorFor(type),
      };
      if (isEdit) await updateEvent(item!.id, payload);
      else await createEvent(payload);
      Alert.alert('Success', `Event ${isEdit ? 'updated' : 'created'} successfully.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save event.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Event' : 'New Event'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={theme.colors.textMuted} />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, s.inputMultiline]} value={desc} onChangeText={setDesc} placeholder="Optional" placeholderTextColor={theme.colors.textMuted} multiline />

          <Text style={s.label}>Date</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />

          <Text style={s.label}>Type</Text>
          <View style={s.typeWrap}>
            {EVENT_TYPES.map(t => {
              const active = type === t.key;
              return (
                <TouchableOpacity key={t.key} style={[s.chip, active && { backgroundColor: t.color + '18', borderColor: t.color }]} onPress={() => setType(t.key)} activeOpacity={0.8}>
                  <View style={[s.dot, { backgroundColor: t.color }]} />
                  <Text style={[s.chipText, active && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.switchRow}>
            <Text style={[s.label, { marginTop: 0 }]}>All day</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: theme.colors.primary }} thumbColor="#fff" />
          </View>

          {!allDay && (
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Start (HH:mm)</Text>
                <TextInput style={s.input} value={start} onChangeText={setStart} placeholder="09:00" placeholderTextColor={theme.colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>End (HH:mm)</Text>
                <TextInput style={s.input} value={end} onChangeText={setEnd} placeholder="10:00" placeholderTextColor={theme.colors.textMuted} />
              </View>
            </View>
          )}

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{isEdit ? 'Update Event' : 'Create Event'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminCalendarFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  timeRow: { flexDirection: 'row', gap: 12 },
  saveBtn: { marginTop: 24, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
