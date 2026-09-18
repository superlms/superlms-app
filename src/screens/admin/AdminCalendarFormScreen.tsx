import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { AdminEvent, EventType, createEvent, updateEvent } from '../../api/adminContentApi';
import { DocHeader } from '../more/docUi';
import {
  DateSheet,
  FieldLabel,
  FileChip,
  FormCard,
  FormError,
  Hint,
  PickerCard,
  Segment,
  SubmitButton,
  SwitchRow,
  TimeSheet,
  clock12,
  isPdfFile,
  isPdfUrl,
  withinOneMb,
} from './adminFormUi';
import { DEFAULT_EVENT_COLOR, EVENT_COLORS, EVENT_TYPES } from './adminCalendarUi';

/**
 * A new event, or one being edited, as the admin panel's event form has it:
 * the title, its kind, one of the panel's twelve colours, a description of up
 * to 3000 characters, an image or PDF of up to 1 MB from the clip in the
 * header, the day, and a start and an end time unless it runs all day. A new
 * event starts on the day chosen in the calendar, as a class, in blue.
 */

const TYPES = EVENT_TYPES.map(t => ({ key: t.key, label: t.label }));

const AdminCalendarFormScreen = ({ navigation, route }: any) => {
  const item: AdminEvent | undefined = route?.params?.item;
  const isEdit = !!item;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(item?.title ?? '');
  const [desc, setDesc] = useState(item?.description ?? '');
  const [date, setDate] = useState<string>(item?.date ?? route?.params?.date ?? moment().format('YYYY-MM-DD'));
  const [type, setType] = useState<EventType>(
    (TYPES.find(t => t.key === item?.event_type)?.key ?? (isEdit ? 'event' : 'class')) as EventType,
  );
  const [color, setColor] = useState(item?.color || DEFAULT_EVENT_COLOR);
  const [allDay, setAllDay] = useState(item ? !!item.is_all_day : false);
  const [start, setStart] = useState(item?.start_time ?? '');
  const [end, setEnd] = useState(item?.end_time ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);

  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState<'start' | 'end' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<AdminEvent | null>(null);

  const descRef = useRef<TextInput>(null);

  const attach = async (kind: 'image' | 'pdf') => {
    setPickerOpen(false);
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f && withinOneMb(f)) {
      setFile(f);
      setError('');
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setError('Enter a title for the event.');
      return;
    }
    if (!allDay && (!start || !end)) {
      setError(!start ? 'Pick a start time, or make it an all-day event.' : 'Pick an end time, or make it an all-day event.');
      return;
    }

    setError('');
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: desc.trim() || null,
      date,
      is_all_day: allDay,
      start_time: allDay ? null : start,
      end_time: allDay ? null : end,
      event_type: type,
      color,
      attachment: file,
    };
    try {
      const res = isEdit ? await updateEvent(item!.id, payload) : await createEvent(payload);
      // The event as saved, for the page it goes back to.
      setSaved({
        ...(item ?? ({} as AdminEvent)),
        id: item?.id ?? res?.id,
        title: payload.title,
        description: payload.description,
        date,
        is_all_day: allDay,
        start_time: payload.start_time,
        end_time: payload.end_time,
        event_type: type,
        color,
        attachment: item?.attachment ?? null,
        is_completed: false,
      } as AdminEvent);
    } catch (e) {
      setError(apiErr(e, 'Could not save event.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSuccess = () => {
    const done = saved;
    setSaved(null);
    if (isEdit && done) navigation.popTo('AdminCalendarDetail', { item: done });
    else navigation.goBack();
  };

  const newIsPdf = file ? isPdfFile(file) : false;
  const hasAttachment = !!file || !!item?.attachment;

  return (
    <View style={s.root}>
      {/* The clip in the header attaches an image or a PDF */}
      <DocHeader
        title={isEdit ? 'Edit Event' : 'New Event'}
        onBackPress={() => navigation.goBack()}
        rightIcon="attach"
        onRightPress={() => setPickerOpen(true)}
      />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <FormCard
            label="Title"
            value={title}
            onChangeText={t => {
              setTitle(t);
              setError('');
            }}
            placeholder="e.g. Annual Sports Day"
            multiline
            maxLength={255}
            returnKeyType="next"
            onSubmitEditing={() => descRef.current?.focus()}
          />

          <View>
            <FieldLabel>Event type</FieldLabel>
            <Segment options={TYPES} value={type} onChange={k => setType(k as EventType)} />
          </View>

          {/* The panel's twelve colours */}
          <View>
            <FieldLabel>Colour</FieldLabel>
            <View style={s.swatches}>
              {EVENT_COLORS.map(c => {
                const on = c.toLowerCase() === color.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    activeOpacity={0.7}
                    onPress={() => setColor(c)}
                    style={[s.swatchRing, on && { borderColor: c }]}
                  >
                    <View style={[s.swatch, { backgroundColor: c }]}>
                      {on && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={15} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <FormCard
            label="Description"
            inputRef={descRef}
            value={desc}
            onChangeText={setDesc}
            placeholder="Optional notes..."
            multiline
            minHeight={100}
            maxLength={3000}
          />

          <PickerCard
            label="Date"
            value={moment(date).format('ddd, D MMM YYYY')}
            icon="calendar-outline"
            onPress={() => setDateOpen(true)}
          />

          <SwitchRow
            label="All day event"
            value={allDay}
            onValueChange={v => {
              setAllDay(v);
              setError('');
            }}
          />

          {/* Times, only when it doesn't run all day */}
          {!allDay && (
            <View style={s.timeRow}>
              <PickerCard
                label="Start time"
                value={start ? clock12(start) : null}
                placeholder="Select"
                icon="time-outline"
                onPress={() => setTimeOpen('start')}
                style={s.flex}
              />
              <PickerCard
                label="End time"
                value={end ? clock12(end) : null}
                placeholder="Select"
                icon="time-outline"
                onPress={() => setTimeOpen('end')}
                style={s.flex}
              />
            </View>
          )}

          {/* The file: the new one, or what is on the event already */}
          {hasAttachment ? (
            <View style={s.group}>
              <View style={s.chips}>
                {file ? (
                  <FileChip kind={newIsPdf ? 'pdf' : 'image'} onRemove={() => setFile(null)} />
                ) : (
                  <FileChip
                    kind={isPdfUrl(item!.attachment!) ? 'pdf' : 'image'}
                    onPress={() => Linking.openURL(item!.attachment!)}
                  />
                )}
              </View>
              <Hint>
                {file && item?.attachment
                  ? 'This replaces the file on the event when it is saved.'
                  : 'Image or PDF · max 1 MB. The clip at the top adds or replaces it.'}
              </Hint>
            </View>
          ) : (
            <Hint>Optional: attach an image or a PDF (max 1 MB) with the clip icon at the top.</Hint>
          )}

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Event' : 'Create Event'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet
        visible={dateOpen}
        value={date}
        title="Event date"
        onPick={d => setDate(d)}
        onClose={() => setDateOpen(false)}
      />

      <TimeSheet
        visible={!!timeOpen}
        value={timeOpen === 'end' ? end || start : start}
        title={timeOpen === 'end' ? 'End time' : 'Start time'}
        onPick={t => {
          if (timeOpen === 'end') setEnd(t);
          else setStart(t);
          setError('');
        }}
        onClose={() => setTimeOpen(null)}
      />

      {/* Attachment kind */}
      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPickerOpen(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Attach a file</Text>
            <TouchableOpacity style={[s.sheetRow, s.sheetRowDivider]} activeOpacity={0.6} onPress={() => attach('image')}>
              <VectorIcon iconSet="Feather" iconName="image" size={18} color={theme.colors.textSecondary} />
              <Text style={s.sheetRowText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetRow} activeOpacity={0.6} onPress={() => attach('pdf')}>
              <VectorIcon iconSet="Feather" iconName="file-text" size={18} color={theme.colors.textSecondary} />
              <Text style={s.sheetRowText}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Saved */}
      <AppDialog
        visible={!!saved}
        title={isEdit ? 'Event updated' : 'Event created'}
        message={isEdit ? 'The event has been updated.' : 'The event has been added to the calendar.'}
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default AdminCalendarFormScreen;

const SWATCH = 30;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },

  // Colour swatches, the chosen one ringed and ticked
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRing: {
    width: SWATCH + 8,
    height: SWATCH + 8,
    borderRadius: (SWATCH + 8) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Attachment sheet
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetRowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
