import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { Exam, EXAMS, iconForType } from './examData';

interface Props {
  selected: Exam;
  onSelect: (exam: Exam) => void;
  // Optional list to choose from. Defaults to the bundled mock EXAMS so the
  // existing exam screens keep working; screens wired to the live API (e.g.
  // Admit Card) pass the fetched exams instead.
  exams?: Exam[];
}

// Collapsible exam selector used at the top of exam sub-screens
const ExamDropdown = ({ selected, onSelect, exams = EXAMS }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        style={s.btn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <View style={s.btnLeft}>
          <View style={s.iconWrap}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={iconForType(selected.type)}
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <View style={s.btnTextWrap}>
            <Text style={s.label}>Selected Exam</Text>
            <Text style={s.selectedText} numberOfLines={1}>
              {selected.name} — {selected.academicYear}
            </Text>
          </View>
        </View>
        <VectorIcon
          iconSet="Ionicons"
          iconName={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.primary}
        />
      </TouchableOpacity>

      {open && (
        <View style={s.list}>
          {exams.map((exam, i) => {
            const active = exam.id === selected.id;
            return (
              <TouchableOpacity
                key={exam.id}
                style={[
                  s.item,
                  active && s.itemActive,
                  i === exams.length - 1 && s.itemLast,
                ]}
                onPress={() => {
                  onSelect(exam);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <View style={s.itemTextWrap}>
                  <Text style={[s.itemTitle, active && s.itemTitleActive]}>
                    {exam.name}
                  </Text>
                  <Text style={s.itemSub}>
                    {exam.type} · {exam.academicYear}
                  </Text>
                </View>
                {active && (
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="checkmark-circle"
                    size={18}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default ExamDropdown;

const __mk_s = () => StyleSheet.create({
  wrap: { zIndex: 99 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
  },
  btnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextWrap: { flex: 1 },
  label: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  selectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  list: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  itemLast: { borderBottomWidth: 0 },
  itemActive: { backgroundColor: theme.colors.primaryLight },
  itemTextWrap: { flex: 1 },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  itemTitleActive: { color: theme.colors.primary, fontWeight: '700' },
  itemSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
