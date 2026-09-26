import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { SheetPage } from '../exam/pdfSheet';
import type { AdmitStudent } from '../../api/adminAdmitCardApi';

/**
 * Admit Card's shared pieces, drawn as the student app draws its lists and its
 * admit card: plain rows with a line between them, a quiet link for the one
 * thing a row can do, and the card itself as the school's PDF.
 */

// "40 of 64 issued", "All 64 issued", "No students".
export const issuedLine = (issued: number, students: number) =>
  students === 0 ? 'No students' : issued >= students ? `All ${students} issued` : `${issued} of ${students} issued`;

// ── A header button ──────────────────────────────────────────────────────────
export const HeadBtn = ({ icon, onPress, busy }: { icon: string; onPress: () => void; busy?: boolean }) => (
  <TouchableOpacity onPress={onPress} disabled={busy} hitSlop={10} activeOpacity={0.6} style={s.headBtn}>
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
    )}
  </TouchableOpacity>
);

export const HeadActions = ({ children }: { children: React.ReactNode }) => <View style={s.headActions}>{children}</View>;

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                          >
//            Roll 12 · 2026-0007
//            ADMITDOOHAL261234 · Printed 26 Sep 2026
// A student without a card has Issue in place of the arrow.
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

export const AdmitStudentRow = ({
  student,
  isLast,
  busy,
  onOpen,
  onIssue,
}: {
  student: AdmitStudent;
  isLast: boolean;
  busy?: boolean;
  onOpen: () => void;
  onIssue: () => void;
}) => {
  const ids = [student.roll_no ? `Roll ${student.roll_no}` : null, student.admission_no].filter(Boolean).join(' · ');
  const card = student.issued
    ? [student.admit_card_number, student.printed_at ? `Printed ${student.printed_at.split(',')[0]}` : 'Not printed']
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={student.issued ? 0.6 : 1}
      disabled={!student.issued}
      onPress={onOpen}
    >
      <Avatar uri={student.image} name={student.full_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{student.full_name}</Text>
        {!!ids && <Text style={s.meta} numberOfLines={1}>{ids}</Text>}
        {!!card && <Text style={s.card} numberOfLines={1}>{card}</Text>}
      </View>
      {student.issued ? (
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
      ) : (
        <TouchableOpacity onPress={onIssue} disabled={busy} hitSlop={10} activeOpacity={0.6} style={s.issue}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={s.issueText}>Issue</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// ── The card's page while its PDF loads ──────────────────────────────────────
// The outline as bars: the school's name over its contacts, the title bar, the
// identity grid, the paper schedule, the instructions and the signatures.
export const CardPageSkeleton = ({ width }: { width: number }) => (
  <SheetPage width={width}>
    <View style={s.skStart}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="45%" height={8} />
    </View>
    <View style={s.skTitleBar}>
      <Skeleton width="28%" height={11} />
      <Skeleton width="36%" height={9} />
    </View>
    <View style={s.skRows}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={s.skInfoRow}>
          <Skeleton width="22%" height={9} />
          <Skeleton width="30%" height={9} />
        </View>
      ))}
    </View>
    <View style={s.skRows}>
      <Skeleton width={120} height={8} />
      <Skeleton width="100%" height={14} radius={3} />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} width="100%" height={10} radius={3} />
      ))}
    </View>
    <View style={s.skRows}>
      <Skeleton width={80} height={8} />
      <Skeleton width="90%" height={9} />
      <Skeleton width="70%" height={9} />
    </View>
    <View style={s.skSigns}>
      {[0, 1].map(i => (
        <Skeleton key={i} width="26%" height={9} />
      ))}
    </View>
  </SheetPage>
);

// ── The print sheet while its PDF loads ──────────────────────────────────────
// A4 landscape, cut in four: each quarter a small card of bars.
const A4_LANDSCAPE = 210 / 297;

const QuarterSkeleton = () => (
  <View style={s.quarter}>
    <Skeleton width="55%" height={8} />
    <Skeleton width="40%" height={5} />
    <Skeleton width="100%" height={22} radius={2} />
    {[0, 1, 2, 3].map(i => (
      <Skeleton key={i} width="100%" height={5} radius={2} />
    ))}
  </View>
);

export const SheetSkeleton = ({ width }: { width: number }) => (
  <View style={[s.sheet, { width, height: Math.round(width * A4_LANDSCAPE) }]}>
    {[0, 1].map(r => (
      <View key={r} style={[s.sheetRow, r === 0 && s.sheetCutH]}>
        {[0, 1].map(c => (
          <View key={c} style={[s.sheetCell, c === 0 && s.sheetCutV]}>
            <QuarterSkeleton />
          </View>
        ))}
      </View>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  // Header
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Student row
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  card: { fontSize: 12, color: theme.colors.textMuted },
  issue: { minWidth: 44, height: 30, alignItems: 'flex-end', justifyContent: 'center' },
  issueText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  photo: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Card page skeleton
  skStart: { gap: 6 },
  skTitleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skRows: { gap: 6 },
  skInfoRow: { flexDirection: 'row', gap: 10 },
  skSigns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },

  // Sheet skeleton
  sheet: { backgroundColor: theme.colors.card },
  sheetRow: { flex: 1, flexDirection: 'row' },
  sheetCell: { flex: 1, padding: 10 },
  sheetCutH: { borderBottomWidth: 1, borderBottomColor: theme.colors.border, borderStyle: 'dashed' },
  sheetCutV: { borderRightWidth: 1, borderRightColor: theme.colors.border, borderStyle: 'dashed' },
  quarter: { gap: 5 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
