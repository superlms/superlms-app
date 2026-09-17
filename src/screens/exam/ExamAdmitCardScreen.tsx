import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  admitCardErrorMessage,
  admitCardPdfUrl,
  authHeader,
  getExamAdmitCard,
  isAdmitCardNotIssued,
} from '../../api/admitCardApi';
import type { Exam } from './examData';
import { PdfSheet, SheetPage } from './pdfSheet';

/**
 * One exam's admit card, as the school issued it: the admin panel's own
 * admit-card template, full screen, to pinch or double-tap to zoom. Nothing to
 * download or print. Until the school issues it, the page says so.
 *
 * Route params:
 *   exam – the exam, from the list
 */

const TITLE = 'Admit Card';

type Card = { id: number; headers: Record<string, string> };

// The admit card's outline as bars: the school's name and address, the title
// bar, the student's details beside the photo, the paper schedule, the
// instructions and the signatures.
const PageSkeleton = ({ width }: { width: number }) => (
  <SheetPage width={width}>
    <View style={s.skCentre}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="45%" height={8} />
    </View>
    <View style={s.skTitleBar}>
      <Skeleton width="28%" height={11} />
      <Skeleton width="36%" height={9} />
    </View>
    <View style={s.skInfo}>
      <View style={s.skInfoRows}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={s.skInfoRow}>
            <Skeleton width="22%" height={9} />
            <Skeleton width="30%" height={9} />
          </View>
        ))}
      </View>
      <Skeleton width={Math.round(width * 0.16)} height={Math.round(width * 0.2)} radius={4} />
    </View>
    <View style={s.skTable}>
      <Skeleton width={120} height={8} />
      <Skeleton width="100%" height={14} radius={3} />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} width="100%" height={10} radius={3} />
      ))}
    </View>
    <View style={s.skTable}>
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

const ExamAdmitCardScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const { width: pageWidth } = useWindowDimensions();

  // undefined while it first loads; null when the card isn't issued.
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // The card on screen, so coming back to the same one leaves it as it is.
  const shownId = useRef<number | null>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        shownId.current = null;
        setCard(undefined);
      }
      setError(null);
      try {
        const issued = await getExamAdmitCard(exam.id);
        if (shownId.current === issued.id) return;
        // A newly issued card opens in place of the last.
        const headers = await authHeader();
        shownId.current = issued.id;
        setCard({ id: issued.id, headers });
      } catch (e: any) {
        if (isAdmitCardNotIssued(e)) {
          shownId.current = null;
          setCard(null);
          return;
        }
        console.log('[getExamAdmitCard] Error:', e?.response?.status, e?.message);
        setError(admitCardErrorMessage(e));
      }
    },
    [exam.id],
  );

  const reload = useCallback(() => load(true), [load]);

  // Opening the screen, and coming back to it, checks what the school has issued.
  useFocusLoad(() => load());

  const renderBody = () => {
    if (card === undefined) {
      if (error) {
        return (
          <View style={s.center}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.stateText}>{error}</Text>
            <TouchableOpacity onPress={reload} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={s.viewer}>
          <PageSkeleton width={pageWidth} />
        </View>
      );
    }

    if (card === null) {
      return (
        <ScrollView
          contentContainerStyle={s.grow}
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          <DocNoData
            icon="card-outline"
            title="Not issued yet"
            subtitle={`Your admit card for ${exam.name} will appear here once the school issues it.`}
          />
        </ScrollView>
      );
    }

    return (
      <PdfSheet
        key={card.id}
        uri={admitCardPdfUrl(exam.id)}
        headers={card.headers}
        skeleton={<PageSkeleton width={pageWidth} />}
        errorText="Couldn’t open the admit card. Check your connection and try again."
        label="AdmitCard"
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamAdmitCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  grow: { flexGrow: 1 },
  viewer: { flex: 1, backgroundColor: theme.colors.background },

  // Loading sheet
  skCentre: { alignItems: 'center', gap: 6 },
  skTitleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skInfo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  skInfoRows: { flex: 1, gap: 8 },
  skInfoRow: { flexDirection: 'row', gap: 10 },
  skTable: { gap: 6 },
  skSigns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
