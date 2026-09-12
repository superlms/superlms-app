import React, { useState, useRef, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import { MONTHS, YEAR_RANGE } from './calendarTypes';

const { width } = Dimensions.get('window');
const YEAR_W = 60;

interface Props {
  visible: boolean;
  current: moment.Moment;
  onClose: () => void;
  onSelect: (m: moment.Moment) => void;
}

// A plain bottom sheet: a strip of years, then a grid of months. Tapping a
// month applies the choice and closes — there is nothing to confirm.
const MonthYearPicker = ({ visible, current, onClose, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  const [pickerYear, setPickerYear] = useState(current.year());
  const yearRef = useRef<FlatList>(null);
  const initialIndex = Math.max(0, YEAR_RANGE.indexOf(current.year()) - 2);

  // Re-sync with the calendar every time the sheet opens, and bring the active
  // year back into view.
  useEffect(() => {
    if (!visible) return;
    setPickerYear(current.year());
    const idx = Math.max(0, YEAR_RANGE.indexOf(current.year()) - 2);
    setTimeout(() => {
      yearRef.current?.scrollToIndex({ index: idx, animated: false });
    }, 50);
  }, [visible, current]);

  const pick = (monthIndex: number) => {
    onSelect(moment().year(pickerYear).month(monthIndex).date(1));
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
          <Text style={s.title}>Select month</Text>

          {/* Years */}
          <FlatList
            ref={yearRef}
            data={YEAR_RANGE}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={y => String(y)}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: YEAR_W, offset: YEAR_W * i, index: i })}
            style={s.years}
            renderItem={({ item: y }) => {
              const active = y === pickerYear;
              return (
                <TouchableOpacity
                  onPress={() => setPickerYear(y)}
                  style={s.yearItem}
                  activeOpacity={0.6}
                >
                  <Text style={[s.yearText, active && s.yearTextActive]}>{y}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Months */}
          <View style={s.monthGrid}>
            {MONTHS.map((m, i) => {
              const active = i === current.month() && pickerYear === current.year();
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => pick(i)}
                  activeOpacity={0.6}
                  style={[s.monthCell, active && s.monthCellActive]}
                >
                  <Text style={[s.monthText, active && s.monthTextActive]}>{m}</Text>
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

const CELL_W = (width - 40 - 24) / 4;

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
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },

  // Years — plain text, the active one in the accent colour
  years: { marginTop: 14, marginHorizontal: -20, paddingHorizontal: 20, flexGrow: 0 },
  yearItem: { width: YEAR_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  yearText: { fontSize: 14, color: theme.colors.textSecondary },
  yearTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Months — a bare 4-column grid, the current month outlined
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  monthCell: {
    width: CELL_W,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellActive: { borderColor: theme.colors.primary },
  monthText: { fontSize: 14, color: theme.colors.textPrimary },
  monthTextActive: { color: theme.colors.primary, fontWeight: '600' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
