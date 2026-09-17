import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  authHeader,
  getReportCards,
  latestIssued,
  reportCardErrorMessage,
  reportCardPdfUrl,
} from '../../api/reportCardApi';

/**
 * A student's report card, as the school issued it: the admin panel's own
 * report-card template, full screen, to pinch or double-tap to zoom. Nothing
 * to download or print. Until the school issues one (or after it is revoked),
 * the page says it isn't issued yet.
 */

const TITLE = 'Report Card';

// ISO A4, height over width.
const A4 = 297 / 210;

type Card = { id: number; headers: Record<string, string> };

// An A4 sheet as bars: the school's head, the student's details, the marks
// table and the signatures — the template's outline while it loads.
const PageSkeleton = ({ width }: { width: number }) => {
  const pad = Math.round(width * 0.06);
  return (
    <View style={[s.page, { width, height: Math.round(width * A4), padding: pad }]}>
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
    </View>
  );
};

const ReportCardScreen = ({ navigation }: any) => {
  const { width: pageWidth } = useWindowDimensions();

  // undefined while the list first loads; null when nothing is issued.
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [listError, setListError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Bumped by "Try again" so the viewer is mounted afresh.
  const [attempt, setAttempt] = useState(0);

  // The card on screen, so coming back to the same one leaves it as it is.
  const shownId = useRef<number | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) {
      shownId.current = null;
      setCard(undefined);
    }
    setListError(null);
    try {
      const issued = latestIssued(await getReportCards());
      if (!issued) {
        shownId.current = null;
        setCard(null);
        return;
      }
      if (shownId.current === issued.id) return;
      // A newly issued card opens in place of the last.
      const headers = await authHeader();
      shownId.current = issued.id;
      setPdfReady(false);
      setPdfError(null);
      setCard({ id: issued.id, headers });
    } catch (e: any) {
      console.log('[getReportCards] Error:', e?.response?.status, e?.message);
      setListError(reportCardErrorMessage(e));
    }
  }, []);

  const reload = useCallback(() => load(true), [load]);

  // Opening the screen, and coming back to it, checks what the school has issued.
  useFocusLoad(() => load());

  const retryPdf = () => {
    setPdfError(null);
    setPdfReady(false);
    setAttempt(a => a + 1);
  };

  const renderBody = () => {
    if (card === undefined) {
      if (listError) {
        return (
          <View style={s.center}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.stateText}>{listError}</Text>
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
            icon="ribbon-outline"
            title="Not issued yet"
            subtitle="Your report card will appear here once the school issues it."
          />
        </ScrollView>
      );
    }

    if (pdfError) {
      return (
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.stateText}>{pdfError}</Text>
          <TouchableOpacity onPress={retryPdf} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.viewer}>
        <Pdf
          key={`${card.id}-${attempt}`}
          source={{ uri: reportCardPdfUrl(card.id), cache: false, headers: card.headers }}
          style={s.pdf}
          trustAllCerts={false}
          // The page across the screen, to pinch or double-tap up to 5×.
          fitPolicy={0}
          minScale={1}
          maxScale={5}
          enableDoubleTapZoom
          enableAntialiasing
          spacing={0}
          onLoadComplete={() => setPdfReady(true)}
          onError={(e: any) => {
            console.log('[ReportCard] PDF error:', e);
            setPdfError('Couldn’t open the report card. Check your connection and try again.');
          }}
        />
        {!pdfReady && (
          <View style={s.cover} pointerEvents="none">
            <PageSkeleton width={pageWidth} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ReportCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  grow: { flexGrow: 1 },

  // The document on the page's grey, edge to edge
  viewer: { flex: 1, backgroundColor: theme.colors.background },
  pdf: { flex: 1, width: '100%', backgroundColor: theme.colors.background },
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.background,
  },

  // Loading sheet
  page: { backgroundColor: theme.colors.card, gap: 18 },
  skHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skHeadText: { flex: 1, gap: 6 },
  skTitle: { alignItems: 'center' },
  skGrid: { gap: 8 },
  skGridRow: { flexDirection: 'row', justifyContent: 'space-between' },
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
