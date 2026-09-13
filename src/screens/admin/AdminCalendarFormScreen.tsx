import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent } from '../../api/calendarApi';
import { EventType, createEvent, updateEvent } from '../../api/adminContentApi';
import { DocHeader } from '../more/docUi';

// The colour still travels to the API with every event; it is simply no longer
// used to paint the screens.
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
  const [type, setType] = useState<EventType>(
    (EVENT_TYPES.find(t => t.key === item?.event_type)?.key ?? 'event') as EventType,
  );
  const [allDay, setAllDay] = useState(item ? !!item.is_all_day : true);
  const [start, setStart] = useState(hhmm(item?.start_time));
  const [end, setEnd] = useState(hhmm(item?.end_time));
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const titleRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);

  const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  const save = async () => {
    if (!title.trim()) {
      setError('Enter a title for the event.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('The date must be written as YYYY-MM-DD.');
      return;
    }
    if (!allDay) {
      if (start && !validTime(start)) {
        setError('Start time must be HH:mm on a 24-hour clock.');
        return;
      }
      if (end && !validTime(end)) {
        setError('End time must be HH:mm on a 24-hour clock.');
        return;
      }
    }

    setError('');
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
      setSuccessMsg(
        isEdit ? 'The event has been updated.' : 'The event has been added to the calendar.',
      );
    } catch (e) {
      setError(apiErr(e, 'Could not save event.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSuccess = () => {
    setSuccessMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={isEdit ? 'Edit Event' : 'New Event'}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title card — tap anywhere on it to type */}
          <Pressable
            style={[s.field, focused === 'title' && s.fieldFocused]}
            onPress={() => titleRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput
              ref={titleRef}
              style={s.fieldInput}
              placeholder="What is happening?"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={t => { setTitle(t); setError(''); }}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
              multiline
              submitBehavior="submit"
              textAlignVertical="top"
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
            />
          </Pressable>

          {/* Description card */}
          <Pressable
            style={[s.field, focused === 'desc' && s.fieldFocused]}
            onPress={() => descRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput
              ref={descRef}
              style={[s.fieldInput, s.fieldInputMulti]}
              placeholder="Optional"
              placeholderTextColor={theme.colors.textMuted}
              value={desc}
              onChangeText={setDesc}
              onFocus={() => setFocused('desc')}
              onBlur={() => setFocused(null)}
              multiline
              textAlignVertical="top"
            />
          </Pressable>

          {/* Date card */}
          <View style={[s.field, focused === 'date' && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Date</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              value={date}
              onChangeText={t => { setDate(t); setError(''); }}
              onFocus={() => setFocused('date')}
              onBlur={() => setFocused(null)}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Type */}
          <View>
            <Text style={s.sectionLabel}>Type</Text>
            <View style={s.segment}>
              {EVENT_TYPES.map(t => {
                const active = type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.7}
                    onPress={() => setType(t.key)}
                    style={[s.segmentItem, active && s.segmentItemActive]}
                  >
                    <Text
                      style={[s.segmentText, active && s.segmentTextActive]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* All day */}
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>All day</Text>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={theme.colors.white}
            />
          </View>

          {/* Times, only when it is not an all-day event */}
          {!allDay && (
            <View style={s.timeRow}>
              <View style={[s.field, s.flex, focused === 'start' && s.fieldFocused]}>
                <Text style={s.fieldLabel}>Start</Text>
                <TextInput
                  style={s.fieldInput}
                  placeholder="09:00"
                  placeholderTextColor={theme.colors.textMuted}
                  value={start}
                  onChangeText={t => { setStart(t); setError(''); }}
                  onFocus={() => setFocused('start')}
                  onBlur={() => setFocused(null)}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[s.field, s.flex, focused === 'end' && s.fieldFocused]}>
                <Text style={s.fieldLabel}>End</Text>
                <TextInput
                  style={s.fieldInput}
                  placeholder="10:00"
                  placeholderTextColor={theme.colors.textMuted}
                  value={end}
                  onChangeText={t => { setEnd(t); setError(''); }}
                  onFocus={() => setFocused('end')}
                  onBlur={() => setFocused(null)}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={save}
            style={[s.submitBtn, saving && s.submitBtnBusy]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>{isEdit ? 'Update Event' : 'Create Event'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saved */}
      <AppDialog
        visible={!!successMsg}
        title={isEdit ? 'Event updated' : 'Event created'}
        message={successMsg}
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default AdminCalendarFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  // Input cards — label inside, borderless input underneath
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  fieldInputMulti: { minHeight: 100 },

  // Type segment
  sectionLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
  segmentText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // All day
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 15, color: theme.colors.textPrimary },

  timeRow: { flexDirection: 'row', gap: 12 },
  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
