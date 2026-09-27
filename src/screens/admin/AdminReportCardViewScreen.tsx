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
  ReportCardItem,
  adminReportCardPdfUrl,
  authHeader,
  downloadReportCardPdf,
  getReportCard,
  revokeReportCard,
} from '../../api/adminReportCardApi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';
import { ReportPageSkeleton } from './adminReportCardUi';

/**
 * One report card, as the student sees theirs: the school's own card on a
 * full A4 page, to pinch or double-tap to zoom — the panel's View. Under it,
 * what the panel's list says of it — the class, the academic year, when and by
 * whom it was issued — and what the issue form put on it (Regd. No, result,
 * remark); then the panel's Revoke, which asks first. The header's Download
 * saves the same PDF to the phone.
 *
 * Route params: id — the card; name / card — for the page until it loads.
 */

const AdminReportCardViewScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const { width: pageWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [card, setCard] = useState<ReportCardItem | null>(route?.params?.card ?? null);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    authHeader().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  const load = useCallback(async () => {
    try {
      setCard(await getReportCard(id));
    } catch {
      // The page itself still shows; the lines under it wait for the next look.
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = card?.full_name || route?.params?.name || 'student';
  const fileName = `Report_Card_${name.replace(/\s+/g, '_')}`;
  const issued = !card || card.status === 'issued';

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadReportCardPdf(adminReportCardPdfUrl(id), fileName);
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download the report card.'));
    } finally {
      setDownloading(false);
    }
  };

  const revoke = () =>
    confirmDestructive('Revoke report card?', 'Are you sure you want to revoke this report card?', 'Revoke', async () => {
      setRevoking(true);
      try {
        await revokeReportCard(id);
        AppAlert.alert('Revoked!', 'Report card has been revoked.');
        navigation.goBack();
      } catch (e) {
        AppAlert.alert('Error!', apiErr(e, 'Failed to revoke report card.'));
      } finally {
        setRevoking(false);
      }
    });

  const cls = card
    ? [[card.standard, card.section].filter(Boolean).join(' · '), card.academic_year].filter(Boolean).join(' · ')
    : '';
  const when = card
    ? [card.issued_label ? `Issued ${card.issued_label}` : null, card.issued_by ? `by ${card.issued_by}` : null].filter(Boolean).join(' · ')
    : '';
  const printed = card
    ? [card.regd_no ? `Regd. No ${card.regd_no}` : null, card.result ? `Result ${card.result}` : 'Result Auto'].filter(Boolean).join(' · ')
    : '';

  return (
    <View style={s.root}>
      <DocHeader
        title="Report Card"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="download-outline" onPress={download} busy={downloading} />
          </HeadActions>
        }
      />

      {headers ? (
        <PdfSheet
          key={id}
          uri={adminReportCardPdfUrl(id)}
          headers={headers}
          skeleton={<ReportPageSkeleton width={pageWidth} />}
          errorText="Couldn’t open the report card. Check your connection and try again."
          label="AdminReportCard"
        />
      ) : (
        <View style={s.viewer}>
          <ReportPageSkeleton width={pageWidth} />
        </View>
      )}

      {/* What the panel's list says of the card, and Revoke */}
      <View style={[s.foot, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={s.name} numberOfLines={1}>{name === 'student' ? 'Report Card' : name}</Text>
        {!!cls && <Text style={s.meta} numberOfLines={1}>{cls}</Text>}
        {!!when && <Text style={s.meta} numberOfLines={1}>{when}</Text>}
        {!!printed && <Text style={s.meta} numberOfLines={1}>{printed}</Text>}
        {!!card?.remark && <Text style={s.meta} numberOfLines={2}>{`Remark: ${card.remark}`}</Text>}
        <View style={s.actions}>
          {issued ? (
            <QuietAction icon="x-circle" label="Revoke card" danger onPress={revoke} busy={revoking} />
          ) : (
            <Text style={s.revoked}>Revoked</Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default AdminReportCardViewScreen;

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
  revoked: { fontSize: 13, fontStyle: 'italic', color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
