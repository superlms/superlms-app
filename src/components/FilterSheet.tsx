import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from './VectorIcon';
import { theme, onThemeChange } from '../utils/theme';

export interface FilterOption { label: string; value: any }
export interface FilterSection {
  key: string;
  title: string;
  options: FilterOption[];
  value: any;
  onChange: (v: any) => void;
}

// Header-anchored filter overlay: opened from a filter icon in the Header, it
// drops a card from the top-right with single-select chip groups. Selecting a
// chip applies immediately (onChange); "Clear" resets every section.
const FilterSheet = ({
  visible, onClose, sections, onClear,
}: {
  visible: boolean;
  onClose: () => void;
  sections: FilterSection[];
  onClear?: () => void;
}) => {
  if (!visible) return null;
  return (
    <View style={s.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.title}>Filters</Text>
          <TouchableOpacity onPress={onClose}><VectorIcon iconSet="Ionicons" iconName="close" size={20} color={theme.colors.textMuted} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {sections.map(sec => (
            <View key={sec.key} style={s.section}>
              <Text style={s.sectionTitle}>{sec.title}</Text>
              <View style={s.chipWrap}>
                {sec.options.map(o => {
                  const active = sec.value === o.value;
                  return (
                    <TouchableOpacity key={String(o.value)} style={[s.chip, active && s.chipActive]}
                      onPress={() => sec.onChange(o.value)} activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={s.actions}>
          {onClear && (
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClear} activeOpacity={0.85}>
              <Text style={s.btnGhostText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={onClose} activeOpacity={0.9}>
            <Text style={s.btnPrimaryText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default FilterSheet;

const __mk = () => StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, elevation: 60, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 60, paddingRight: 10 },
  card: { width: '88%', maxWidth: 380, maxHeight: '82%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: theme.colors.border },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

let s = __mk();
onThemeChange(() => { s = __mk(); });
