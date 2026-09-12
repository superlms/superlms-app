import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Pdf from 'react-native-pdf';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';

const { width, height } = Dimensions.get('window');

/**
 * In-app PDF reader — books, and the admit card and report card previews.
 *
 * Route params:
 *   url     – the (already resolved) absolute PDF url
 *   title   – title for the header
 *   headers – optional auth headers for a token-protected PDF
 *
 * One quiet line under the header says where the reader is, and takes a page
 * number to jump to.
 */
const BookReaderScreen = ({ navigation, route }: any) => {
  const url: string | undefined = route?.params?.url;
  const title: string = route?.params?.title ?? 'Book';
  // Optional auth headers — set when previewing a token-protected PDF (e.g. the
  // student admit card). Public book PDFs (S3) don't need them.
  const headers: Record<string, string> | undefined = route?.params?.headers;

  // IMPORTANT: keep two separate values to avoid a feedback loop that crashes
  // the native Pdf view on fast scrolling.
  //   • currentPage – display only (the page line); updated as the user scrolls
  //   • targetPage  – fed to <Pdf page={…}>; changed ONLY by "Go to page"
  // If we fed onPageChanged back into the page prop, every scroll frame would
  // re-render the Pdf and re-trigger navigation → crash + flickering page line.
  const [currentPage, setCurrentPage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInput, setPageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "Try again" so the native view is mounted afresh.
  const [attempt, setAttempt] = useState(0);

  const goToPage = useCallback(() => {
    Keyboard.dismiss();
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n)) return;
    const clamped = totalPages > 0 ? Math.min(Math.max(1, n), totalPages) : Math.max(1, n);
    setTargetPage(clamped);
    setCurrentPage(clamped);
    setPageInput('');
  }, [pageInput, totalPages]);

  const retry = () => {
    setError(null);
    setLoading(true);
    setAttempt(a => a + 1);
  };

  if (!url) {
    return (
      <View style={s.root}>
        <DocHeader title={title} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="document-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.stateText}>There is no PDF to open.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      {/* Where the reader is, and a page to jump to */}
      {!error && (
        <View style={s.bar}>
          <Text style={s.pageText}>
            {loading ? (
              'Opening…'
            ) : (
              <>
                Page <Text style={s.pageStrong}>{currentPage}</Text>
                {totalPages > 0 ? ` of ${totalPages}` : ''}
              </>
            )}
          </Text>

          <View style={s.goto}>
            <TextInput
              value={pageInput}
              onChangeText={t => setPageInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Go to page"
              placeholderTextColor={theme.colors.textMuted}
              style={s.gotoInput}
              returnKeyType="go"
              onSubmitEditing={goToPage}
              maxLength={6}
              editable={!loading}
            />
            <TouchableOpacity onPress={goToPage} disabled={!pageInput} hitSlop={10} activeOpacity={0.6}>
              <Text style={[s.gotoBtn, !pageInput && s.gotoBtnIdle]}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.pdfWrap}>
        {error ? (
          <View style={s.center}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.stateText}>{error}</Text>
            <TouchableOpacity onPress={retry} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Pdf
              key={attempt}
              source={{ uri: url, cache: true, ...(headers ? { headers } : {}) }}
              page={targetPage}
              trustAllCerts={false}
              enablePaging={false}
              onLoadComplete={(numberOfPages: number) => {
                setTotalPages(numberOfPages);
                setLoading(false);
              }}
              // Display-only: never feed this back into the page prop.
              // Guard against transient 0/undefined values the native view
              // can emit during very fast scrolling, which would otherwise
              // make the page line flicker to nothing.
              onPageChanged={(p: number) => {
                if (Number.isFinite(p) && p > 0) setCurrentPage(p);
              }}
              onError={(e: any) => {
                console.log('[BookReader] PDF error:', e);
                setError('Couldn’t open this PDF.');
                setLoading(false);
              }}
              style={s.pdf}
            />
            {loading && (
              <View style={s.loaderOverlay}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

export default BookReaderScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Page line
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pageText: { fontSize: 13, color: theme.colors.textSecondary },
  pageStrong: { fontWeight: '600', color: theme.colors.textPrimary },
  goto: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gotoInput: {
    width: 104,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  gotoBtn: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  gotoBtnIdle: { color: theme.colors.textMuted },

  // PDF — pages sit on the grey so their edges show
  pdfWrap: { flex: 1, backgroundColor: theme.colors.background },
  pdf: { flex: 1, width, height, backgroundColor: theme.colors.background },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
