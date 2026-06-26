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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

const { width, height } = Dimensions.get('window');

/**
 * In-app PDF reader for books.
 *
 * Route params:
 *   url    – the (already resolved) absolute PDF url
 *   title  – book title for the header
 *
 * Top bar lets the reader jump to any page by typing the page number.
 */
const BookReaderScreen = ({ navigation, route }: any) => {
  const url: string | undefined = route?.params?.url;
  const title: string = route?.params?.title ?? 'Book';
  // Optional auth headers — set when previewing a token-protected PDF (e.g. the
  // student admit card). Public book PDFs (S3) don't need them.
  const headers: Record<string, string> | undefined = route?.params?.headers;

  // IMPORTANT: keep two separate values to avoid a feedback loop that crashes
  // the native Pdf view on fast scrolling.
  //   • currentPage – display only (the page badge); updated as the user scrolls
  //   • targetPage  – fed to <Pdf page={…}>; changed ONLY by "Go to page"
  // If we fed onPageChanged back into the page prop, every scroll frame would
  // re-render the Pdf and re-trigger navigation → crash + flickering badge.
  const [currentPage, setCurrentPage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInput, setPageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goToPage = useCallback(() => {
    Keyboard.dismiss();
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n)) return;
    const clamped = totalPages > 0 ? Math.min(Math.max(1, n), totalPages) : Math.max(1, n);
    setTargetPage(clamped);
    setCurrentPage(clamped);
    setPageInput('');
  }, [pageInput, totalPages]);

  if (!url) {
    return (
      <View style={s.root}>
        <Header title={title} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Feather" iconName="file-text" size={48} color={theme.colors.textMuted} />
          <Text style={s.errorText}>This book has no PDF attached.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title={title} onBackPress={() => navigation.goBack()} />

      {/* ── Go to page bar ── */}
      <View style={s.gotoBar}>
        <View style={s.gotoLeft}>
          <VectorIcon iconSet="Feather" iconName="book-open" size={15} color={theme.colors.primary} />
          <Text style={s.gotoLabel}>Go to page</Text>
        </View>

        <View style={s.gotoInputWrap}>
          <TextInput
            value={pageInput}
            onChangeText={t => setPageInput(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Page no"
            placeholderTextColor={theme.colors.textMuted}
            style={s.gotoInput}
            returnKeyType="go"
            onSubmitEditing={goToPage}
            maxLength={6}
          />
          <TouchableOpacity style={s.gotoBtn} onPress={goToPage} activeOpacity={0.85}>
            <Text style={s.gotoBtnText}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={s.pageBadge}>
          <Text style={s.pageBadgeText}>
            {totalPages ? `${currentPage} / ${totalPages}` : currentPage}
          </Text>
        </View>
      </View>

      {/* ── PDF ── */}
      <View style={s.pdfWrap}>
        {error ? (
          <View style={s.center}>
            <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={48} color={theme.colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <Pdf
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
              // make the badge / placeholder flicker to nothing.
              onPageChanged={(p: number) => {
                if (Number.isFinite(p) && p > 0) setCurrentPage(p);
              }}
              onError={(e: any) => {
                console.log('[BookReader] PDF error:', e);
                setError('Failed to open this PDF. Please try again.');
                setLoading(false);
              }}
              style={s.pdf}
            />
            {loading && (
              <View style={s.loaderOverlay}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={s.loadingText}>Loading PDF…</Text>
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
  root: { flex: 1, backgroundColor: theme.colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },

  // Go to page bar
  gotoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  gotoLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gotoLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  gotoInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  gotoInput: {
    width: 80,
    height: 36,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  gotoBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotoBtnText: { color: theme.colors.white, fontWeight: '800', fontSize: 13 },
  pageBadge: {
    minWidth: 54,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadgeText: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },

  // PDF
  pdfWrap: { flex: 1 },
  pdf: { flex: 1, width, height, backgroundColor: theme.colors.background },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
