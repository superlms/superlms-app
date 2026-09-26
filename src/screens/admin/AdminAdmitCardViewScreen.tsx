import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { PdfSheet } from '../exam/pdfSheet';
import { QuietAction, confirmDestructive } from './adminFormUi';
import {
  AdmitCardView,
  admitCardPagePdfUrl,
  authHeader,
  deleteAdmitCard,
  downloadAdmitCardPdf,
  getAdmitCard,
  markAdmitCardUnprinted,
  printAdmitCards,
} from '../../api/adminAdmitCardApi';
import { CardPageSkeleton, HeadActions, HeadBtn } from './adminAdmitCardUi';

/**
 * One admit card, as the student sees theirs: the school's own card on a full
 * A4 page, to pinch or double-tap to zoom. Under it, what the web list says of
 * it — the card number, when it was issued, whether it has been printed — and
 * the web's actions: Download (the same PDF), Print (the card on the four-up
 * sheet, stamped as printed), Print on the next run (for a printed card) and
 * Delete, which puts the student back among the not issued.
 *
 * Route params: id — the card; name — the student, for the page until it loads.
 */

const AdminAdmitCardViewScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const { width: pageWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [card, setCard] = useState<AdmitCardView | null>(null);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authHeader().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  const load = useCallback(async () => {
    try {
      setCard(await getAdmitCard(id));
    } catch {
      // The page itself still shows; its line under it waits for the next look.
    }
  }, [id]);

  // Back from the print sheet, the printed line is fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = card?.student?.full_name || route?.params?.name || 'student';
  const fileName = `Admit_Card_${name.replace(/\s+/g, '_')}`;

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAdmitCardPdf(admitCardPagePdfUrl(id), fileName);
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download the admit card.'));
    } finally {
      setDownloading(false);
    }
  };

  // The web's "Print this card": the four-up sheet with this card alone, and
  // the card stamped as printed so the next run leaves it out.
  const print = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const r = await printAdmitCards([id]);
      navigation.navigate('AdminAdmitCardSheet', { ids: r.ids, name });
    } catch (e) {
      AppAlert.alert('Could not print', apiErr(e, 'The print sheet could not be made.'));
    } finally {
      setPrinting(false);
    }
  };

  const queueAgain = async () => {
    setQueueing(true);
    try {
      await markAdmitCardUnprinted(id);
      await load();
      AppAlert.alert('Queued again', 'This card will print on the next run.');
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not queue the card again.'));
    } finally {
      setQueueing(false);
    }
  };

  const remove = () =>
    confirmDestructive(
      'Delete admit card?',
      'The student will move back to the not-issued list.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteAdmitCard(id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Error', apiErr(e, 'Could not delete the admit card.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const meta = card
    ? [card.admit_card_number, card.issue_date ? `Issued ${card.issue_date}` : null].filter(Boolean).join(' · ')
    : '';
  const printedLine = card ? (card.printed_at ? `Printed ${card.printed_at}` : 'Not printed yet') : '';

  return (
    <View style={s.root}>
      <DocHeader
        title="Admit Card"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="download-outline" onPress={download} busy={downloading} />
            <HeadBtn icon="print-outline" onPress={print} busy={printing} />
          </HeadActions>
        }
      />

      {headers ? (
        <PdfSheet
          key={id}
          uri={admitCardPagePdfUrl(id)}
          headers={headers}
          skeleton={<CardPageSkeleton width={pageWidth} />}
          errorText="Couldn’t open the admit card. Check your connection and try again."
          label="AdminAdmitCard"
        />
      ) : (
        <View style={s.viewer}>
          <CardPageSkeleton width={pageWidth} />
        </View>
      )}

      {/* What the web list says of the card, and what can be done with it */}
      <View style={[s.foot, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={s.name} numberOfLines={1}>{name === 'student' ? 'Admit Card' : name}</Text>
        {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
        {!!printedLine && <Text style={s.meta} numberOfLines={1}>{printedLine}</Text>}
        <View style={s.actions}>
          {!!card?.printed_at && (
            <QuietAction icon="rotate-ccw" label="Print on next run" onPress={queueAgain} busy={queueing} />
          )}
          <QuietAction icon="trash-2" label="Delete card" danger onPress={remove} busy={deleting} />
        </View>
      </View>
    </View>
  );
};

export default AdminAdmitCardViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  viewer: { flex: 1, backgroundColor: theme.colors.background },

  // Under the card
  foot: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
