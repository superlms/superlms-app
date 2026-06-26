import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { Selection } from './uploadData';

interface Props {
  selection: Selection;
}

const ROWS = [
  { key: 'exam', icon: 'documents-outline', label: 'Exam' },
  { key: 'cls', icon: 'people-outline', label: 'Class' },
  { key: 'subject', icon: 'book-outline', label: 'Subject' },
] as const;

// Compact summary of the chosen exam / class / subject.
const SelectionCard = ({ selection }: Props) => (
  <View style={s.card}>
    <View style={s.accent} />
    <View style={s.body}>
      {ROWS.map((r, i) => {
        const item =
          r.key === 'exam'
            ? selection.exam
            : r.key === 'cls'
            ? selection.cls
            : selection.subject;
        return (
          <View
            key={r.key}
            style={[s.row, i < ROWS.length - 1 && s.rowDivider]}
          >
            <View style={s.iconWrap}>
              <VectorIcon
                iconSet="Ionicons"
                iconName={r.icon}
                size={15}
                color={theme.colors.primary}
              />
            </View>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.value} numberOfLines={1}>
              {item?.label ?? '—'}
            </Text>
          </View>
        );
      })}
    </View>
  </View>
);

export default SelectionCard;

const __mk_s = () => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accent: { width: 4, backgroundColor: theme.colors.primary },
  body: { flex: 1, paddingHorizontal: theme.spacing.md, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    width: 56,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
