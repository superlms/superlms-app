import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { GenerateOptions, generateSeatingPlan, getGenerateOptions } from '../../api/adminSeatingApi';
import { DocHeader } from '../more/docUi';
import { ChipChoices, FieldLabel, FormCard, FormError, Hint, OptionSheet, PickerCard, SubmitButton } from './adminFormUi';
import { useSeatingLookups } from './adminSeatingUi';

/**
 * Generate Seating Plan, as the panel's Generate panel has it: it reads the exam's
 * datesheet and makes one plan per exam date and shift, across the classes
 * picked (those with a datesheet for the exam, by default) and the rooms
 * picked (every active room, by default); a date short of seats gets an
 * overflow "Exam Hall", and invigilators are assigned by date. The plan name
 * starts from the exam's, and each plan carries its date after it.
 *
 * Route params: examId – the exam the finder was on.
 */

const AdminSeatingGenerateScreen = ({ navigation, route }: any) => {
  const lookups = useSeatingLookups();

  const [examId, setExamId] = useState<number | null>(route?.params?.examId ?? null);
  const [name, setName] = useState('');
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [options, setOptions] = useState<GenerateOptions | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ message: string; examId: number } | null>(null);
  // The rooms are all picked once, when they first arrive.
  const roomsPicked = useRef(false);

  // The rooms and classes; with an exam, the classes its datesheet seats.
  useEffect(() => {
    let alive = true;
    getGenerateOptions(examId)
      .then(o => {
        if (!alive) return;
        setOptions(o);
        // Rooms: all active rooms selected by default.
        if (!roomsPicked.current) {
          roomsPicked.current = true;
          setRoomIds(o.rooms.map(r => String(r.id)));
        }
        if (examId) {
          setStandardIds(o.datesheet_standard_ids.map(String));
          // A name from the exam, if none is typed yet.
          setName(n => (n.trim() ? n : o.suggested_name ?? n));
        }
      })
      .catch(e => alive && setError(apiErr(e, 'Could not load the classes and rooms.')));
    return () => {
      alive = false;
    };
  }, [examId]);

  const exams = lookups?.exams ?? [];
  const exam = exams.find(e => e.id === examId);
  const dsIds = options?.datesheet_standard_ids ?? [];
  const rooms = options?.rooms ?? [];

  const toggle = (list: string[], set: (v: string[]) => void) => (key: string) => {
    set(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
    setError('');
  };

  const generate = async () => {
    if (!examId) return setError('Select an exam.');
    if (!name.trim()) return setError('Enter a plan name.');
    if (standardIds.length === 0) return setError('Select at least one class.');
    if (roomIds.length === 0) return setError('Select at least one room.');

    setError('');
    setSaving(true);
    try {
      const res = await generateSeatingPlan({
        exam_id: examId,
        name: name.trim(),
        standard_ids: standardIds.map(Number),
        room_ids: roomIds.map(Number),
      });
      setDone({ message: res.message, examId });
    } catch (e) {
      setError(apiErr(e, 'Could not generate the seating plan.'));
    } finally {
      setSaving(false);
    }
  };

  // Back to Seating Plans, on the exam just seated.
  const closeDone = () => {
    const id = done?.examId;
    setDone(null);
    navigation.popTo('AdminSeatingPlans', { examId: id, at: Date.now() });
  };

  return (
    <View style={s.root}>
      <DocHeader title="Generate Plan" onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Hint>
            Reads the exam datesheet — one plan per exam date/shift is created automatically. Invigilators are assigned
            by date.
          </Hint>

          <View style={s.group}>
            <PickerCard
              label="Exam"
              value={exam ? `${exam.exam_name}${exam.academic_year ? ` (${exam.academic_year})` : ''}` : null}
              placeholder="Select exam"
              onPress={() => setExamOpen(true)}
            />
            {!!examId && !!options && (
              <Hint>
                {dsIds.length
                  ? `Datesheet found for ${dsIds.length} class(es) — selected below by default.`
                  : 'No datesheet for this exam yet. Create one in the Datesheet tab first.'}
              </Hint>
            )}
          </View>

          <View style={s.group}>
            <FormCard
              label="Plan Name"
              value={name}
              onChangeText={t => {
                setName(t);
                setError('');
              }}
              placeholder="e.g. Final Exam 2026"
              maxLength={150}
            />
            <Hint>{`The exam date is appended per plan, e.g. “${name.trim() || 'Final Exam'} — 01 Jun 2026”.`}</Hint>
          </View>

          {/* Classes */}
          <View style={s.group}>
            <View style={s.groupHead}>
              <FieldLabel>Classes</FieldLabel>
              <View style={s.links}>
                <TouchableOpacity onPress={() => setStandardIds(dsIds.map(String))} hitSlop={6}>
                  <Text style={s.link}>Datesheet classes</Text>
                </TouchableOpacity>
                <Text style={s.sep}>|</Text>
                <TouchableOpacity onPress={() => setStandardIds([])} hitSlop={6}>
                  <Text style={s.link}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
            {(options?.standards ?? []).length === 0 ? (
              <Hint>No classes found.</Hint>
            ) : (
              <ChipChoices
                options={(options?.standards ?? []).map(c => ({
                  key: String(c.id),
                  label: dsIds.includes(c.id) ? `${c.name} · datesheet` : c.name,
                }))}
                selected={standardIds}
                onToggle={toggle(standardIds, setStandardIds)}
              />
            )}
            <Hint>Only classes with a datesheet for this exam can be seated.</Hint>
          </View>

          {/* Rooms */}
          <View style={s.group}>
            <View style={s.groupHead}>
              <FieldLabel>Rooms</FieldLabel>
              <View style={s.links}>
                <TouchableOpacity onPress={() => setRoomIds(rooms.map(r => String(r.id)))} hitSlop={6}>
                  <Text style={s.link}>Select all</Text>
                </TouchableOpacity>
                <Text style={s.sep}>|</Text>
                <TouchableOpacity onPress={() => setRoomIds([])} hitSlop={6}>
                  <Text style={s.link}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
            {options && rooms.length === 0 ? (
              <Hint>No active rooms. Add rooms first.</Hint>
            ) : (
              <ChipChoices
                options={rooms.map(r => ({ key: String(r.id), label: `${r.room_name} · ${r.capacity} seats` }))}
                selected={roomIds}
                onToggle={toggle(roomIds, setRoomIds)}
              />
            )}
            <Hint>If capacity is short on a date, an overflow “Exam Hall” is added automatically.</Hint>
          </View>

          <FormError>{error}</FormError>
          <SubmitButton label="Generate Plan" busy={saving} onPress={generate} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={examOpen}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => {
          setExamId(Number(k));
          setExamOpen(false);
          setError('');
        }}
        onClose={() => setExamOpen(false)}
        emptyText="No exams yet."
      />

      <AppDialog
        visible={!!done}
        title="Seating plans generated"
        message={done?.message ?? ''}
        actions={[{ text: 'Done', onPress: closeDone }]}
        onRequestClose={closeDone}
      />
    </View>
  );
};

export default AdminSeatingGenerateScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  sep: { fontSize: 13, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
