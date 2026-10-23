import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface Props {
  label?: string;
  placeholder?: string;
  value?: string | number | null;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  /** The box outlined only, with no fill — for forms drawn that way. */
  plain?: boolean;
  /** Once something is chosen, the outline turns the accent colour. */
  markChosen?: boolean;
  /** The label set into the box's top border instead of over it (outlined forms, on a card-coloured page). */
  notched?: boolean;
  /** A small star after a notched label: the form needs it. */
  required?: boolean;
}

// Labelled dropdown: a pressable box that opens a modal list. Replaces the chip
// pickers on admin forms so long option lists (classes, routes) stay compact.
const Select = ({
  label,
  placeholder = 'Select',
  value,
  options,
  onChange,
  disabled,
  plain,
  markChosen,
  notched,
  required,
}: Props) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={notched ? styles.notchedWrap : styles.wrap}>
      {!!label && !notched && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.box,
          (plain || notched) && styles.boxPlain,
          notched && styles.boxNotched,
          (markChosen && !!selected) || (notched && open) ? styles.boxChosen : null,
          disabled && styles.boxDisabled,
        ]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.value, notched && styles.valueNotched, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {!!label && notched && (
        <View style={styles.notchLabelWrap} pointerEvents="none">
          <Text style={[styles.notchLabel, open && styles.notchLabelOpen]} numberOfLines={1}>
            {label}
            {required && <Text style={styles.star}> *</Text>}
          </Text>
        </View>
      )}

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {!!label && <Text style={styles.sheetTitle}>{label}</Text>}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {options.length === 0 && <Text style={styles.empty}>No options</Text>}
              {options.map(o => {
                const active = o.value === value;
                return (
                  <TouchableOpacity
                    key={String(o.value)}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>{o.label}</Text>
                    {active && (
                      <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default Select;

const __mk_styles = () =>
  StyleSheet.create({
    wrap: { marginTop: 12 },
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
    // Notched: room above for the label that sits in the border, and the
    // outlined fields' height and padding.
    notchedWrap: { marginTop: 18 },
    boxNotched: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
    valueNotched: { fontSize: 15 },
    notchLabelWrap: { position: 'absolute', top: -8, left: 10, right: 10, flexDirection: 'row' },
    notchLabel: {
      flexShrink: 1,
      paddingHorizontal: 5,
      backgroundColor: theme.colors.card,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    notchLabelOpen: { color: theme.colors.primary },
    star: { color: theme.colors.danger },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: theme.colors.background,
    },
    boxPlain: { backgroundColor: 'transparent' },
    boxChosen: { borderColor: theme.colors.primary },
    boxDisabled: { opacity: 0.5 },
    value: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, marginRight: 8 },
    placeholder: { color: theme.colors.textMuted },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    sheet: { width: '100%', maxWidth: 420, maxHeight: '70%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16 },
    sheetTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowText: { fontSize: 14, color: theme.colors.textPrimary },
    rowTextActive: { color: theme.colors.primary, fontWeight: '700' },
    empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  });

let styles = __mk_styles();
onThemeChange(() => {
  styles = __mk_styles();
});
