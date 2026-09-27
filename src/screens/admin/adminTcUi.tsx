import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import type { CertItem, TcClass, TcItem, TcStudent, TcTab } from '../../api/adminTcCertificateApi';
import { getTcStudents } from '../../api/adminTcCertificateApi';
import { FieldLabel, OptionSheet, PickerCard } from './adminFormUi';

/**
 * TC & Certificate's shared pieces, drawn as the student app draws its lists:
 * plain rows with a line between them — the student's initial, their name, what
 * was issued and when — and the panel's class → section → student picker for
 * the issue forms.
 */

export const TABS: { key: TcTab; label: string }[] = [
  { key: 'achievement', label: 'Achievement' },
  { key: 'participation', label: 'Participation' },
  { key: 'tc', label: 'Transfer Certificate' },
];

export const CONDUCT = ['Excellent', 'Good', 'Satisfactory', 'Poor'];
export const FAILED = ['No', 'Once', 'Twice'];
export const NCC = ['No', 'NCC Cadet', 'Boy Scout', 'Girl Guide'];

export const today = () => moment().format('YYYY-MM-DD');

/** The panel's month filter as a list: this month and the two years before it. */
export const monthOptions = () =>
  Array.from({ length: 36 }, (_, i) => {
    const m = moment().startOf('month').subtract(i, 'months');
    return { key: m.format('YYYY-MM'), label: m.format('MMMM YYYY') };
  });

export const monthLabel = (ym: string) => (ym ? moment(`${ym}-01`).format('MMM YYYY') : '');

export const longDate = (iso?: string | null) => (iso ? moment(iso).format('D MMM YYYY') : '');

const Initial = ({ name }: { name?: string | null }) => (
  <View style={s.initialBox}>
    <Text style={s.initial}>{(name || 'S').trim().charAt(0).toUpperCase()}</Text>
  </View>
);

// ── A certificate ────────────────────────────────────────────────────────────
//   (D)  Dheeraj Chaudhary                              12 Sep 2026
//        Annual Science Olympiad 2026
//        ACH-2026-0002 · By Amit Dagur · Adm 1043
export const CertRow = ({ item, isLast, onPress }: { item: CertItem; isLast: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <Initial name={item.student_name} />
    <View style={s.body}>
      <View style={s.line}>
        <Text style={s.name} numberOfLines={1}>{item.student_name || '—'}</Text>
        <Text style={s.date}>{item.issued_label || ''}</Text>
      </View>
      <Text style={s.meta} numberOfLines={1}>{item.event_name}</Text>
      <Text style={s.sub} numberOfLines={1}>
        {[item.certificate_no, item.issued_by ? `By ${item.issued_by}` : null, item.admission_no ? `Adm ${item.admission_no}` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  </TouchableOpacity>
);

// ── A transfer certificate ───────────────────────────────────────────────────
//   (D)  Dheeraj Chaudhary                              12 Sep 2026
//        TC-2026-0001 · Book 096
//        Last class 12th · Conduct Good · Adm 1043
export const TcRow = ({ item, isLast, onPress }: { item: TcItem; isLast: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <Initial name={item.student_name} />
    <View style={s.body}>
      <View style={s.line}>
        <Text style={s.name} numberOfLines={1}>{item.student_name || '—'}</Text>
        <Text style={s.date}>{item.issue_label || ''}</Text>
      </View>
      <Text style={s.meta} numberOfLines={1}>
        {[item.tc_no, item.book_no ? `Book ${item.book_no}` : null].filter(Boolean).join(' · ') || 'Transfer Certificate'}
      </Text>
      <Text style={s.sub} numberOfLines={1}>
        {[
          item.last_class_studied ? `Last class ${item.last_class_studied}` : null,
          item.general_conduct ? `Conduct ${item.general_conduct}` : null,
          item.admission_no ? `Adm ${item.admission_no}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  </TouchableOpacity>
);

// ── The panel's student picker ───────────────────────────────────────────────
// Class, then (optionally) a section, a search on name or admission number, and
// the class's students A to Z; choosing one collapses it to that student's card
// with Change — no Change while editing, as a certificate stays with its student.
export interface PickedStudent {
  id: number;
  full_name: string;
  admission_no?: string | null;
  class?: string | null;
}

export const StudentPicker = ({
  classes,
  selected,
  locked,
  onSelect,
  onClear,
}: {
  classes: TcClass[];
  selected: PickedStudent | null;
  locked?: boolean;
  onSelect: (st: PickedStudent) => void;
  onClear: () => void;
}) => {
  const [cls, setCls] = useState<TcClass | null>(null);
  const [sec, setSec] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<TcStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<'class' | 'section' | null>(null);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!cls) {
      setStudents([]);
      return;
    }
    setLoading(true);
    try {
      const r = await getTcStudents({ standard_id: cls.id, section_id: sec?.id ?? null, search: search.trim() || undefined });
      if (mine === seq.current) setStudents(r);
    } catch {
      if (mine === seq.current) setStudents([]);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [cls, sec, search]);

  // Typing waits a moment before it asks, as the panel's search does.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  if (selected) {
    return (
      <View>
        <FieldLabel>Student *</FieldLabel>
        <View style={s.picked}>
          <Initial name={selected.full_name} />
          <View style={s.body}>
            <Text style={s.name} numberOfLines={1}>{selected.full_name}</Text>
            <Text style={s.sub} numberOfLines={1}>
              {[`Adm ${selected.admission_no || '—'}`, selected.class || null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {!locked && (
            <TouchableOpacity onPress={onClear} hitSlop={10} activeOpacity={0.6}>
              <Text style={s.change}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const sections = cls?.sections ?? [];

  return (
    <View style={s.pickerWrap}>
      <FieldLabel>Student *</FieldLabel>
      <View style={s.pair}>
        <PickerCard style={s.half} label="Class" value={cls?.name} placeholder="Select Class" onPress={() => setSheet('class')} />
        <PickerCard
          style={s.half}
          label="Section"
          value={sec?.name}
          placeholder="All Sections"
          disabled={sections.length === 0}
          onPress={() => setSheet('section')}
        />
      </View>

      <View style={[s.searchRow, !cls && s.disabled]}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name or admission no."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          editable={!!cls}
          autoCorrect={false}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.listBox}>
        {!cls ? (
          <Text style={s.boxNote}>Select a class to see students.</Text>
        ) : loading && students.length === 0 ? (
          <ActivityIndicator style={s.boxSpinner} color={theme.colors.primary} />
        ) : students.length === 0 ? (
          <Text style={s.boxNote}>No students found.</Text>
        ) : (
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {students.map((st, i) => (
              <TouchableOpacity
                key={st.id}
                style={[s.pickRow, i < students.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() => onSelect({ id: st.id, full_name: st.full_name, admission_no: st.admission_no, class: st.class })}
              >
                <Initial name={st.full_name} />
                <Text style={s.pickName} numberOfLines={1}>{st.full_name}</Text>
                {!!st.admission_no && <Text style={s.pickAdm}>{st.admission_no}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <OptionSheet
        visible={sheet !== null}
        title={sheet === 'section' ? 'Section' : 'Class'}
        options={
          sheet === 'section'
            ? [{ key: '', label: 'All Sections' }, ...sections.map(x => ({ key: String(x.id), label: x.name }))]
            : classes.map(c => ({ key: String(c.id), label: c.name }))
        }
        selected={[sheet === 'section' ? String(sec?.id ?? '') : String(cls?.id ?? '')]}
        onPick={k => {
          if (sheet === 'section') {
            setSec(sections.find(x => String(x.id) === k) ?? null);
          } else {
            setCls(classes.find(c => String(c.id) === k) ?? null);
            setSec(null);
          }
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet. Add them under Standards first."
      />
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, flexGrow: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  date: { fontSize: 12, color: theme.colors.textMuted },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  sub: { fontSize: 12, color: theme.colors.textMuted },

  initialBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Picker
  pickerWrap: { gap: 10 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  disabled: { opacity: 0.6 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },
  listBox: {
    maxHeight: 260,
    minHeight: 60,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  boxNote: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  boxSpinner: { paddingVertical: 16 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pickName: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  pickAdm: { fontSize: 12, color: theme.colors.textMuted },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  change: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
