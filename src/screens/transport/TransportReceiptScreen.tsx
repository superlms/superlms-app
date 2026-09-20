import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { PdfSheet, SheetPage } from '../exam/pdfSheet';
import { authHeader, downloadPdf } from '../../api/pdfDownload';
import { transportReceiptUrl, type TransportPayment } from '../../api/transportApi';

/**
 * One fee payment's receipt, as the school issues it: the sheet
 * itself, full screen, to pinch or double-tap to zoom — the viewer Report Card
 * and Admit Card use — with Download in the header to keep a copy.
 *
 * Route params:
 *   payment    – the payment from the list
 *   url        – where its receipt is, when not the student's own transport one
 *                (the admin app's, or a student's academic fee receipt)
 *   namePrefix – what the downloaded file is called before the receipt number
 */

const TITLE = 'Receipt';

// The receipt's outline as bars: the school's head, the student, the amount
// and the signature.
const PageSkeleton = ({ width }: { width: number }) => (
  <SheetPage width={width}>
    <View style={s.skHead}>
      <Skeleton width="62%" height={14} />
      <Skeleton width="44%" height={8} />
    </View>
    <View style={s.skTitle}>
      <Skeleton width="34%" height={10} />
    </View>
    <View style={s.skGrid}>
      {[0, 1, 2].map(i => (
        <View key={i} style={s.skGridRow}>
          <Skeleton width="40%" height={9} />
          <Skeleton width="34%" height={9} />
        </View>
      ))}
    </View>
    <View style={s.skAmount}>
      <Skeleton width="28%" height={8} />
      <Skeleton width="46%" height={20} />
      <Skeleton width="66%" height={8} />
    </View>
    <View style={s.skGrid}>
      {[0, 1].map(i => (
        <View key={i} style={s.skGridRow}>
          <Skeleton width="30%" height={9} />
          <Skeleton width="44%" height={9} />
        </View>
      ))}
    </View>
    <View style={s.skSign}>
      <Skeleton width="30%" height={9} />
    </View>
  </SheetPage>
);

const TransportReceiptScreen = ({ navigation, route }: any) => {
  const payment: TransportPayment = route.params.payment;
  const url: string = route.params.url ?? transportReceiptUrl(payment.id);
  const namePrefix: string = route.params.namePrefix ?? 'Transport-Receipt';
  const { width: pageWidth } = useWindowDimensions();

  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  // The receipt is behind the login, so the viewer carries the token.
  useEffect(() => {
    let live = true;
    authHeader().then(h => {
      if (live) setHeaders(h);
    });
    return () => {
      live = false;
    };
  }, []);

  // Saves the receipt to the phone's Downloads (the share sheet on iOS).
  const download = async () => {
    if (saving) return;
    setSaving(true);
    const fileName = `${namePrefix}-${String(payment.receipt_number).replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`;
    try {
      await downloadPdf(url, fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch (e: any) {
      console.log('[transportReceipt] Error:', e?.message);
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          saving ? (
            <View style={s.saving}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <HeaderIconButton icon="download-outline" onPress={download} />
          )
        }
      />
      {headers ? (
        <PdfSheet
          uri={url}
          headers={headers}
          skeleton={<PageSkeleton width={pageWidth} />}
          errorText="Couldn’t open this receipt. Check your connection and try again."
          label="TransportReceipt"
        />
      ) : (
        <View style={s.viewer}>
          <PageSkeleton width={pageWidth} />
        </View>
      )}
    </View>
  );
};

export default TransportReceiptScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  viewer: { flex: 1, backgroundColor: theme.colors.background },
  saving: { width: 36, alignItems: 'center', justifyContent: 'center' },

  // Loading sheet
  skHead: { alignItems: 'center', gap: 6 },
  skTitle: { alignItems: 'center' },
  skGrid: { gap: 8 },
  skGridRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skAmount: { gap: 8 },
  skSign: { alignItems: 'flex-end', marginTop: 'auto' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
