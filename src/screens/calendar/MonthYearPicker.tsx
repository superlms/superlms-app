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
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { MONTHS, YEAR_RANGE } from './calendarTypes';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  current: moment.Moment;
  onClose: () => void;
  onSelect: (m: moment.Moment) => void;
}

const MonthYearPicker = ({ visible, current, onClose, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  const [pickerYear, setPickerYear] = useState(current.year());
  const [pickerMonth, setPickerMonth] = useState(current.month());
  const yearRef = useRef<FlatList>(null);
  const initialIndex = Math.max(0, YEAR_RANGE.indexOf(current.year()) - 2);

  // Re-sync the selection with the calendar every time the sheet opens, and
  // bring the active year back into view.
  useEffect(() => {
    if (!visible) return;
    setPickerYear(current.year());
    setPickerMonth(current.month());
    const idx = Math.max(0, YEAR_RANGE.indexOf(current.year()) - 2);
    setTimeout(() => {
      yearRef.current?.scrollToIndex({ index: idx, animated: false });
    }, 50);
  }, [visible, current]);

  const apply = () => {
    onSelect(moment().year(pickerYear).month(pickerMonth).date(1));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        >
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Select Month & Year</Text>
              <Text style={s.subtitle}>
                {MONTHS[pickerMonth]} {pickerYear}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="close"
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Year strip */}
          <Text style={s.sectionLabel}>YEAR</Text>
          <View style={s.yearSection}>
            <FlatList
              ref={yearRef}
              data={YEAR_RANGE}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={y => String(y)}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({
                length: 72,
                offset: 72 * i,
                index: i,
              })}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item: y }) => {
                const active = y === pickerYear;
                return (
                  <TouchableOpacity
                    onPress={() => setPickerYear(y)}
                    style={[s.yearChip, active && s.yearChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.yearText, active && s.yearTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Month grid 4×3 */}
          <Text style={s.sectionLabel}>MONTH</Text>
          <View style={s.monthGrid}>
            {MONTHS.map((m, i) => {
              const active = i === pickerMonth;
              const isCurrent =
                i === moment().month() && pickerYear === moment().year();
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPickerMonth(i)}
                  activeOpacity={0.8}
                  style={[
                    s.monthCell,
                    isCurrent && !active && s.monthCellCurrent,
                    active && s.monthCellActive,
                  ]}
                >
                  <Text
                    style={[
                      s.monthText,
                      isCurrent && !active && s.monthTextCurrent,
                      active && s.monthTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={s.cancelBtn} activeOpacity={0.8}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={apply} style={s.confirmBtn} activeOpacity={0.8}>
              <Text style={s.confirmText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default MonthYearPicker;

const CELL_W = (width - 40 - 30) / 4;

const __mk_s = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  // Year
  yearSection: { marginBottom: 18 },
  yearChip: {
    width: 64,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    backgroundColor: theme.colors.border,
  },
  yearChipActive: { backgroundColor: theme.colors.primary },
  yearText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  yearTextActive: { color: theme.colors.white, fontWeight: '800' },

  // Month grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 22,
  },
  monthCell: {
    width: CELL_W,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.border,
  },
  monthCellActive: { backgroundColor: theme.colors.primary },
  monthCellCurrent: {
    backgroundColor: theme.colors.primaryLight,
  },
  monthText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  monthTextActive: { color: theme.colors.white },
  monthTextCurrent: { color: theme.colors.primary },

  // Actions
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.textSecondary },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
