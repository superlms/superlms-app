import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import { MonthBar, MonthGrid } from '../calendar/calendarUi';

interface Props {
  visible: boolean;
  selected: string; // YYYY-MM-DD
  minDate: string; // the session's 1 April
  maxDate: string; // today
  onClose: () => void;
  onSelect: (date: string) => void;
}

const NO_MARKS: Record<string, boolean> = {};

/**
 * The day to mark, as a month calendar in a bottom sheet: any day from the
 * start of the session up to today. A Sunday can be picked — the screen then
 * says it is already a holiday. Tapping a day applies it and closes.
 */
const AttendanceDateSheet = ({ visible, selected, minDate, maxDate, onClose, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => moment(selected).startOf('month'));

  // Opens on the chosen day's month every time.
  useEffect(() => {
    if (visible) setMonth(moment(selected).startOf('month'));
  }, [visible, selected]);

  const canPrev = month.isAfter(moment(minDate).startOf('month'));
  const canNext = month.isBefore(moment(maxDate).startOf('month'));

  const pick = (date: string) => {
    onSelect(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={s.handle} />
          <Text style={s.title}>Select date</Text>

          <MonthBar
            label={month.format('MMMM YYYY')}
            onPrev={() => {
              if (canPrev) setMonth(m => m.clone().subtract(1, 'month'));
            }}
            onNext={() => {
              if (canNext) setMonth(m => m.clone().add(1, 'month'));
            }}
          />

          <View style={s.grid}>
            <MonthGrid
              month={month}
              selected={selected}
              marked={NO_MARKS}
              onSelectDate={pick}
              disabledDate={d => d < minDate || d > maxDate}
            />
          </View>

          <Text style={s.note}>
            From {moment(minDate).format('D MMM YYYY')} to today. Sundays are holidays.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

export default AttendanceDateSheet;

const __mk_s = () => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 10,
  },
  title: {
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  grid: { paddingHorizontal: 20 },
  note: {
    paddingHorizontal: 20,
    paddingTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
