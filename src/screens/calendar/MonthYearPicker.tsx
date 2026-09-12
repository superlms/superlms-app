import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { MONTHS, YEAR_RANGE } from './calendarTypes';

const { width } = Dimensions.get('window');

const MIN_YEAR = YEAR_RANGE[0];
const MAX_YEAR = YEAR_RANGE[YEAR_RANGE.length - 1];

interface Props {
  visible: boolean;
  current: moment.Moment;
  onClose: () => void;
  onSelect: (m: moment.Moment) => void;
}

/**
 * A plain bottom sheet: step through years with the arrows, then tap a month.
 * Tapping a month applies it and closes — there is nothing to confirm, and no
 * long strip of years to scroll through.
 */
const MonthYearPicker = ({ visible, current, onClose, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(current.year());

  // Re-sync with the calendar every time the sheet opens.
  useEffect(() => {
    if (visible) setYear(current.year());
  }, [visible, current]);

  const now = moment();
  const shiftYear = (delta: number) =>
    setYear(y => Math.min(MAX_YEAR, Math.max(MIN_YEAR, y + delta)));

  const pick = (monthIndex: number) => {
    onSelect(moment().year(year).month(monthIndex).date(1));
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

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <View style={s.handle} />

          {/* ‹  2026  › */}
          <View style={s.yearBar}>
            <TouchableOpacity
              style={s.yearArrow}
              activeOpacity={0.6}
              hitSlop={10}
              disabled={year <= MIN_YEAR}
              onPress={() => shiftYear(-1)}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="chevron-back"
                size={18}
                color={year <= MIN_YEAR ? theme.colors.border : theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <Text style={s.yearText}>{year}</Text>

            <TouchableOpacity
              style={s.yearArrow}
              activeOpacity={0.6}
              hitSlop={10}
              disabled={year >= MAX_YEAR}
              onPress={() => shiftYear(1)}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="chevron-forward"
                size={18}
                color={year >= MAX_YEAR ? theme.colors.border : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Months — the one the calendar is showing is filled in */}
          <View style={s.grid}>
            {MONTHS.map((m, i) => {
              const shown = i === current.month() && year === current.year();
              const isThisMonth = i === now.month() && year === now.year();
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => pick(i)}
                  activeOpacity={0.6}
                  style={[s.cell, shown && s.cellShown]}
                >
                  <Text
                    style={[
                      s.cellText,
                      isThisMonth && !shown && s.cellTextThisMonth,
                      shown && s.cellTextShown,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MonthYearPicker;

// Three months across the sheet, inside its 20px padding and 10px gutters.
const CELL_W = (width - 40 - 20) / 3;

const __mk_s = () => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 6,
  },

  // Year stepper
  yearBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  yearArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  yearText: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },

  divider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: -20 },

  // Month grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 16 },
  cell: {
    width: CELL_W,
    paddingVertical: 14,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellShown: { backgroundColor: theme.colors.primary },
  cellText: { fontSize: 15, color: theme.colors.textPrimary },
  cellTextThisMonth: { color: theme.colors.primary, fontWeight: '600' },
  cellTextShown: { color: theme.colors.white, fontWeight: '600' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
