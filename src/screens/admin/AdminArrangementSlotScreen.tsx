import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import {
  ArrangementSlot,
  assignArrangement,
  deleteArrangement,
  updateArrangement,
} from '../../api/adminArrangementApi';
import { FormCard, FormError, QuietAction, SubmitButton, confirmDestructive } from './adminFormUi';
import { Block, BlockTitle, useRevealFocused } from './adminProfileUi';
import { slotClassLine, slotTimeLine } from './adminArrangementUi';

/**
 * One period of an absent teacher — the panel's row for it, as a page. It says
 * which period it is, when, the class and subject, and whose it is.
 *
 *  • Not covered: the teachers free then (not in a class of their own, not
 *    already covering another class then, not absent), one to pick, and a
 *    remark (optional) — Assign.
 *  • Covered: who covers it and the remark; the pencil changes them (the
 *    panel's Edit — the same list, with who covers it now), and Remove, at the
 *    foot, takes the substitute off so the period is open again (asks first).
 *
 * The server checks again that the teacher is still free when it saves.
 *
 * Route params: date, teacherName, slot.
 */

const AdminArrangementSlotScreen = ({ navigation, route }: any) => {
  const date: string = route?.params?.date;
  const teacherName: string = route?.params?.teacherName ?? '';
  const slot: ArrangementSlot = route?.params?.slot;
  const arr = slot?.arrangement ?? null;

  const [editing, setEditing] = useState(!arr);
  const [pick, setPick] = useState<number | null>(arr?.substitute_id ?? null);
  const [reason, setReason] = useState(arr?.reason ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  if (!slot) return null;

  // Who can take it: the free teachers; editing, the list the panel's Edit
  // offers (it keeps who covers it now), or — from an older server — them.
  const options = arr
    ? slot.edit_substitutes ??
      (arr.substitute_id ? [{ id: arr.substitute_id, name: arr.substitute_name }] : [])
    : slot.available_substitutes ?? [];

  const dayText = moment(date, 'YYYY-MM-DD').format('dddd, D MMM YYYY');

  const save = async () => {
    if (!pick) return setError('Pick a substitute teacher first.');
    setSaving(true);
    setError('');
    try {
      if (arr) await updateArrangement(arr.id, { substitute_id: pick, reason: reason.trim() });
      else await assignArrangement({ date, slot_id: slot.slot_id, substitute_id: pick, reason: reason.trim() });
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, arr ? 'Could not update the arrangement.' : 'Could not assign the substitute.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!arr) return;
    const label = `${arr.substitute_name} for ${slot.subject}${slot.class ? ` (${slot.class})` : ''}`;
    confirmDestructive(
      'Remove this arrangement?',
      `${label} will be unassigned. The slot will become unarranged again.`,
      'Remove',
      async () => {
        setRemoving(true);
        try {
          await deleteArrangement(arr.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Error', apiErr(e, 'Could not remove the arrangement.'));
        } finally {
          setRemoving(false);
        }
      },
    );
  };

  const cancelEdit = () => {
    setEditing(false);
    setPick(arr?.substitute_id ?? null);
    setReason(arr?.reason ?? '');
    setError('');
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={arr ? 'Arrangement' : 'Arrange Substitute'}
        onBackPress={() => navigation.goBack()}
        rightSlot={arr && !editing ? <HeaderIconButton icon="create-outline" onPress={() => setEditing(true)} /> : undefined}
      />

      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          {/* The period */}
          <Text style={s.time}>{slotTimeLine(slot)}</Text>
          <Text style={s.title}>{slotClassLine(slot) || '—'}</Text>
          <Text style={s.sub}>
            {teacherName ? `${teacherName} is absent · ` : ''}
            {dayText}
          </Text>

          {arr && !editing ? (
            <>
              <Block
                title="Covered by"
                lines={[
                  { label: 'Substitute', value: arr.substitute_name },
                  { label: 'Remark', value: arr.reason },
                ]}
              />
              <View style={s.foot}>
                <QuietAction icon="trash-2" label="Remove arrangement" danger busy={removing} onPress={remove} />
              </View>
            </>
          ) : (
            <>
              <BlockTitle>{arr ? 'Change substitute' : 'Substitute'}</BlockTitle>
              {options.length === 0 ? (
                <Text style={s.none}>None available — every teacher is in a class of their own, covering another, or absent then.</Text>
              ) : (
                options.map((t, i) => {
                  const on = pick === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.option, i < options.length - 1 && s.optionDivider]}
                      activeOpacity={0.6}
                      onPress={() => {
                        setPick(t.id);
                        setError('');
                      }}
                    >
                      <View style={[s.avatar, on && s.avatarOn]}>
                        <Text style={[s.avatarText, on && s.avatarTextOn]}>{(t.name || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[s.optionText, on && s.optionTextOn]} numberOfLines={1}>
                        {t.name}
                        {arr?.substitute_id === t.id ? <Text style={s.current}>  · now</Text> : null}
                      </Text>
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={on ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={on ? theme.colors.primary : theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={s.remark}>
                <FormCard label="Remark" value={reason} onChangeText={t => setReason(t)} placeholder="Reason (optional)" maxLength={500} />
              </View>

              <View style={s.submit}>
                <FormError>{error}</FormError>
                <SubmitButton label={arr ? 'Save' : 'Assign'} busy={saving} onPress={save} />
                {!!arr && (
                  <TouchableOpacity onPress={cancelEdit} hitSlop={8} activeOpacity={0.6} style={s.cancel}>
                    <Text style={s.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default AdminArrangementSlotScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18 },
  tail: { height: 48 },

  time: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  title: { fontSize: 19, fontWeight: '600', lineHeight: 25, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

  none: { fontSize: 13, lineHeight: 19, color: '#B45309', marginTop: 10 },

  // A teacher to pick
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  optionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOn: { backgroundColor: theme.colors.primaryLight },
  avatarText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  avatarTextOn: { color: theme.colors.primary },
  optionText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  optionTextOn: { color: theme.colors.primary, fontWeight: '500' },
  current: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '400' },

  remark: { marginTop: 18 },
  submit: { marginTop: 22, gap: 12 },
  cancel: { alignSelf: 'center', paddingVertical: 4 },
  cancelText: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  foot: { marginTop: 28 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
