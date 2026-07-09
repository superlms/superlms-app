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
}: Props) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={{ marginTop: 12 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.box, disabled && styles.boxDisabled]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

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
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
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
