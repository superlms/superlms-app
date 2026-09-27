import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SeatingRoom, saveSeatingRoom } from '../../api/adminSeatingApi';
import { DocHeader } from '../more/docUi';
import { FormCard, FormError, Hint, SubmitButton, SwitchRow } from './adminFormUi';

/**
 * Add Room / Edit Room, as the panel's room panel has it: the name (100 characters)
 * and building, rows and columns of desks (1–50 each), how many candidates sit
 * at one desk (1–10), whether it is active for seating plans, and notes. The
 * capacity — rows × columns × seats per desk — shows as it is typed; saving
 * rebuilds the room's seats from it.
 *
 * Route params: room – the room being edited.
 */

const digits = (t: string) => t.replace(/\D/g, '');

const AdminSeatingRoomFormScreen = ({ navigation, route }: any) => {
  const room: SeatingRoom | undefined = route?.params?.room;
  const isEdit = !!room;

  const [name, setName] = useState(room?.room_name ?? '');
  const [building, setBuilding] = useState(room?.building ?? '');
  const [rows, setRows] = useState(String(room?.rows ?? 5));
  const [cols, setCols] = useState(String(room?.columns ?? 6));
  const [perDesk, setPerDesk] = useState(String(room?.seat_capacity ?? 1));
  const [active, setActive] = useState(room?.is_active ?? true);
  const [notes, setNotes] = useState(room?.notes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ room: SeatingRoom; message: string } | null>(null);

  const r = Number(rows) || 0;
  const c = Number(cols) || 0;
  const p = Math.max(1, Number(perDesk) || 0);

  const edited = (set: (v: string) => void) => (t: string) => {
    set(t);
    setError('');
  };

  const save = async () => {
    if (!name.trim()) return setError('Enter the room name.');
    if (r < 1 || r > 50) return setError('Rows must be between 1 and 50.');
    if (c < 1 || c > 50) return setError('Columns must be between 1 and 50.');
    const pd = Number(perDesk) || 0;
    if (pd < 1 || pd > 10) return setError('Seats per desk must be between 1 and 10.');

    setError('');
    setSaving(true);
    try {
      const res = await saveSeatingRoom(room?.id ?? null, {
        room_name: name.trim(),
        building: building.trim(),
        rows: r,
        columns: c,
        seat_capacity: pd,
        is_active: active,
        notes: notes.trim(),
      });
      setSaved(res);
    } catch (e) {
      setError(apiErr(e, 'Could not save the room.'));
    } finally {
      setSaving(false);
    }
  };

  // A new room goes back to the list; an edit, to the room as saved.
  const closeSaved = () => {
    const done = saved;
    setSaved(null);
    if (isEdit && done?.room) navigation.popTo('AdminSeatingRoom', { room: done.room });
    else navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Room' : 'Add Room'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Hint>Seats are auto-generated from rows × columns.</Hint>

          <FormCard label="Room Name" value={name} onChangeText={edited(setName)} placeholder="e.g. Hall A" maxLength={100} />
          <FormCard
            label="Building (optional)"
            value={building}
            onChangeText={edited(setBuilding)}
            placeholder="e.g. Main Block"
            maxLength={100}
          />

          <View style={s.pair}>
            <FormCard
              label="Rows"
              value={rows}
              onChangeText={t => edited(setRows)(digits(t))}
              keyboardType="number-pad"
              maxLength={2}
              style={s.flex}
            />
            <FormCard
              label="Columns"
              value={cols}
              onChangeText={t => edited(setCols)(digits(t))}
              keyboardType="number-pad"
              maxLength={2}
              style={s.flex}
            />
          </View>

          <View style={s.group}>
            <FormCard
              label="Seats per desk"
              value={perDesk}
              onChangeText={t => edited(setPerDesk)(digits(t))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Hint>How many candidates sit at one desk — a two-seater bench is 2.</Hint>
          </View>

          <Text style={s.capacity}>
            {'Capacity: '}
            <Text style={s.capacityStrong}>{`${r * c * p} seats`}</Text>
            <Text style={s.capacityMuted}>{`  (${r} × ${c} desks × ${p} per desk)`}</Text>
          </Text>

          <SwitchRow label="Active (available for seating plans)" value={active} onValueChange={setActive} />

          <FormCard label="Notes" value={notes} onChangeText={edited(setNotes)} placeholder="Optional" multiline minHeight={70} />

          <FormError>{error}</FormError>
          <SubmitButton label={isEdit ? 'Update' : 'Add Room'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog
        visible={!!saved}
        title={isEdit ? 'Room updated' : 'Room added'}
        message={saved?.message ?? ''}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminSeatingRoomFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  capacity: { fontSize: 14, color: theme.colors.textSecondary },
  capacityStrong: { fontWeight: '700', color: theme.colors.textPrimary },
  capacityMuted: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
