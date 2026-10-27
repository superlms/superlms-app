import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import type { CertItem, TcClass, TcItem, TcStudent, TcTab } from '../../api/adminTcCertificateApi';
import { getTcStudents } from '../../api/adminTcCertificateApi';
import { FieldPair, OutlinedBox } from '../teacherStudents/outlinedFormUi';

/**
 * TC & Certificate's shared pieces, drawn as the student app draws its lists:
 * plain rows with a line between them — the student's initial, their name, what
 * was issued and when — and, for the issue forms (drawn as Change Password is),
 * the panel's class → section → student picker in the same outlines, with what
 * the forms need to stop at the field a save is held up by.
 */

/** The field a save stopped at, and what is wrong with it (none: the whole form's). */
export type FieldWrong<K extends string> = { field: K | null; message: string };

/**
 * What the server said when it refused a save, set against the form's field
 * it is about: the first of its field errors (`fields` names the server's key
 * for each), or its message.
 */
export const serverWrong = <K extends string>(e: any, fields: Record<string, K>, fallback: string): FieldWrong<K> => {
  const errors = e?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    for (const [key, field] of Object.entries(fields)) {
      const first = Array.isArray(errors[key]) ? errors[key][0] : null;
      if (first) return { field, message: String(first) };
    }
  }
  return { field: null, message: apiErr(e, fallback) };
};

/**
 * Where each field of a form is, to bring the one a save stopped at into view
 * and, when it is typed in, the keyboard up on it.
 */
export function useFieldSpots<K extends string>(scrollRef: React.RefObject<ScrollView | null>) {
  const contentRef = useRef<View>(null);
  const spots = useRef<Partial<Record<K, View | null>>>({});
  const inputs = useRef<Partial<Record<K, TextInput | null>>>({});

  const spot = (k: K) => (el: View | null) => {
    spots.current[k] = el;
  };
  const input = (k: K) => (el: TextInput | null) => {
    inputs.current[k] = el;
  };
  const goTo = (k: K | null) => {
    if (!k) return;
    const el = spots.current[k];
    const content = contentRef.current;
    if (el && content) {
      el.measureLayout(
        content as any,
        (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 28), animated: true }),
        () => {},
      );
    }
    setTimeout(() => inputs.current[k]?.focus(), 250);
  };

  return { contentRef, spot, input, goTo };
}

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
// Class, then (optionally) a section — outlined dropdowns — and, in a box named
// Student, a search on name or admission number over the class's students A to
// Z; choosing one collapses the box to that student with Change — no Change
// while editing, as a certificate stays with its student. A save held up for
// want of a student turns the box red, with what is wrong under it.
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
  error,
  onSelect,
  onClear,
}: {
  classes: TcClass[];
  selected: PickedStudent | null;
  locked?: boolean;
  error?: string | null;
  onSelect: (st: PickedStudent) => void;
  onClear: () => void;
}) => {
  const [cls, setCls] = useState<TcClass | null>(null);
  const [sec, setSec] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<TcStudent[]>([]);
  const [loading, setLoading] = useState(false);

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
      <OutlinedBox label="Student" required error={error}>
        <View style={s.pickedRow}>
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
      </OutlinedBox>
    );
  }

  const sections = cls?.sections ?? [];

  return (
    <View>
      <FieldPair>
        <View style={s.half}>
          <Select
            notched
            required
            label="Class"
            placeholder="Select class"
            value={cls?.id ?? null}
            options={classes.map(c => ({ label: c.name, value: c.id }))}
            onChange={v => {
              setCls(classes.find(c => c.id === Number(v)) ?? null);
              setSec(null);
            }}
          />
        </View>
        <View style={s.half}>
          <Select
            notched
            label="Section"
            value={sec?.id ?? 0}
            options={[{ label: 'All Sections', value: 0 }, ...sections.map(x => ({ label: x.name, value: x.id }))]}
            disabled={sections.length === 0}
            onChange={v => setSec(sections.find(x => x.id === Number(v)) ?? null)}
          />
        </View>
      </FieldPair>

      <OutlinedBox
        label="Student"
        required
        error={error}
        hint={classes.length === 0 ? 'No classes yet. Add them under Standards first.' : undefined}
      >
        <View style={[s.searchRow, !cls && s.disabled]}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or admission no."
            placeholderTextColor={theme.colors.textMuted + 'B3'}
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
        <View style={s.listLine} />

        <View style={s.listBox}>
          {!cls ? (
            <Text style={s.boxNote}>Select a class to see its students.</Text>
          ) : loading && students.length === 0 ? (
            <ActivityIndicator style={s.boxSpinner} color={theme.colors.primary} />
          ) : students.length === 0 ? (
            <Text style={s.boxNote}>No students found.</Text>
          ) : (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {students.map((st, i) => (
                <TouchableOpacity
                  key={st.id}
                  style={[s.pickRow, i < students.length - 1 && s.pickDivider]}
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
      </OutlinedBox>
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

  // Picker — inside the outlined Student box
  half: { flex: 1 },
  disabled: { opacity: 0.55 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 6, paddingHorizontal: 0 },
  listLine: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginTop: 6 },
  listBox: { maxHeight: 240, minHeight: 52, justifyContent: 'center' },
  boxNote: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  boxSpinner: { paddingVertical: 16 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  pickDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  pickName: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  pickAdm: { fontSize: 12, color: theme.colors.textMuted },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  change: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
