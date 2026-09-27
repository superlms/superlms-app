import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { SheetPage } from '../exam/pdfSheet';
import type { RcIssueStudent, ReportCardItem } from '../../api/adminReportCardApi';

/**
 * Report Card's shared pieces, drawn as the student app draws its lists and
 * its report card: plain rows with a line between them, and the card itself as
 * the school's PDF.
 */

/** Where a student stands on the panel's Issue screen. */
export type RcState = 'issued' | 'eligible' | 'incomplete';

// Issued once a card is out; eligible when every exam-subject mark is in and
// no card is out yet (the panel's rule); else incomplete.
export const stateOf = (st: RcIssueStudent): RcState =>
  st.already_issued || st.report_card_id ? 'issued' : st.marks_complete ? 'eligible' : 'incomplete';

// ── The photo, or the initial ────────────────────────────────────────────────
const Avatar = ({ uri, name }: { uri?: string | null; name: string }) => {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    // Decoded at the avatar's size: students' photos are full camera shots.
    return <Image source={{ uri }} style={s.photo} resizeMethod="resize" onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.photo, s.initialBox]}>
      <Text style={s.initial}>{(name || 'S').charAt(0).toUpperCase()}</Text>
    </View>
  );
};

// ── One student on the Issue list ────────────────────────────────────────────
//   (photo)  Aarav Sharma                                        [✓]
//            Roll 12 · 2026-0007
//            Ready to issue
// A student with a card opens it; one who is ready is ticked for the batch;
// one whose marks are not all in says how many are missing.
export const RcStudentRow = ({
  student,
  selected,
  isLast,
  onPress,
}: {
  student: RcIssueStudent;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
}) => {
  const state = stateOf(student);
  const ids = [student.roll_no && student.roll_no !== 'N/A' ? `Roll ${student.roll_no}` : null, student.admission_no]
    .filter(Boolean)
    .join(' · ');
  const line =
    state === 'issued'
      ? student.issued_label
        ? `Issued ${student.issued_label}`
        : 'Already issued'
      : state === 'eligible'
        ? 'Ready to issue'
        : student.missing_info || 'Marks incomplete';

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={state === 'incomplete' ? 1 : 0.6}
      disabled={state === 'incomplete'}
      onPress={onPress}
    >
      <Avatar uri={student.image} name={student.full_name} />
      <View style={s.body}>
        <Text style={[s.name, state === 'incomplete' && s.dim]} numberOfLines={1}>{student.full_name}</Text>
        {!!ids && <Text style={s.meta} numberOfLines={1}>{ids}</Text>}
        <Text style={[s.state, state === 'issued' && s.accent]} numberOfLines={1}>{line}</Text>
      </View>
      {state === 'issued' ? (
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
      ) : state === 'eligible' ? (
        <VectorIcon
          iconSet="Ionicons"
          iconName={selected ? 'checkbox' : 'square-outline'}
          size={21}
          color={selected ? theme.colors.primary : theme.colors.textMuted}
        />
      ) : null}
    </TouchableOpacity>
  );
};

// ── One card, as the panel's list shows it ───────────────────────────────────
//   (A)  Aarav Sharma                                     ISSUED  >
//        Class 5 · A · 2026-2027
//        Issued 20 Sep 2026 · by Solo Admin
export const RcCardRow = ({ card, isLast, onPress }: { card: ReportCardItem; isLast: boolean; onPress: () => void }) => {
  const issued = card.status === 'issued';
  const cls = [[card.standard, card.section].filter(Boolean).join(' · '), card.academic_year].filter(Boolean).join(' · ');
  const when = [card.issued_label ? `Issued ${card.issued_label}` : null, card.issued_by ? `by ${card.issued_by}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={issued ? 0.6 : 1} disabled={!issued} onPress={onPress}>
      <Avatar name={card.full_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{card.full_name}</Text>
        {!!cls && <Text style={s.meta} numberOfLines={1}>{cls}</Text>}
        {!!when && <Text style={s.state} numberOfLines={1}>{when}</Text>}
      </View>
      <Text style={[s.status, issued ? s.accent : s.danger]}>{issued ? 'ISSUED' : 'REVOKED'}</Text>
      {issued && <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />}
    </TouchableOpacity>
  );
};

// ── The report card's page while its PDF loads ───────────────────────────────
// As the student's Report Card draws it: the school's head, the student's
// details, the marks table and the signatures.
export const ReportPageSkeleton = ({ width }: { width: number }) => (
  <SheetPage width={width}>
    <View style={s.skHead}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={s.skHeadText}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={9} />
      </View>
    </View>
    <View style={s.skTitle}>
      <Skeleton width="40%" height={12} />
    </View>
    <View style={s.skGrid}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={s.skGridRow}>
          <Skeleton width="44%" height={9} />
          <Skeleton width="44%" height={9} />
        </View>
      ))}
    </View>
    <View style={s.skTable}>
      <Skeleton width="100%" height={16} radius={3} />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} width="100%" height={11} radius={3} />
      ))}
    </View>
    <View style={s.skSigns}>
      {[0, 1, 2].map(i => (
        <Skeleton key={i} width="24%" height={9} />
      ))}
    </View>
  </SheetPage>
);

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  dim: { color: theme.colors.textSecondary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  state: { fontSize: 12, color: theme.colors.textMuted },
  accent: { color: theme.colors.primary },
  danger: { color: theme.colors.danger },
  status: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  photo: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Page skeleton
  skHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skHeadText: { flex: 1, gap: 6 },
  skTitle: { alignItems: 'center' },
  skGrid: { gap: 8 },
  skGridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skTable: { gap: 6 },
  skSigns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
