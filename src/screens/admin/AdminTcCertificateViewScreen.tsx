import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { PdfSheet, SheetPage } from '../exam/pdfSheet';
import {
  CertItem,
  TcItem,
  authHeader,
  certificatePdfUrl,
  deleteCert,
  deleteTc,
  downloadCertificatePdf,
} from '../../api/adminTcCertificateApi';
import { confirmDestructive } from './adminFormUi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';

/**
 * One certificate or TC, as the panel's View shows it: the student's name and
 * what it is — "Achievement Certificate · ACH-2026-0002" — over the printed
 * certificate itself, the school's own PDF, to pinch or double-tap to zoom. The
 * header holds the panel row's actions: Download, Edit and Delete.
 *
 * Route params: kind ('cert' | 'tc'), item — the row from the list; classes —
 * for the edit form's picker; savedAt — set by the form after an edit, so the
 * sheet is drawn afresh.
 */

const PageSkeleton = ({ width }: { width: number }) => {
  const w = Math.min(width - 40, 520);
  return (
    <View style={s.skWrap}>
      <SheetPage width={w}>
        <Skeleton width="50%" height={14} style={s.center} />
        <Skeleton width="34%" height={10} style={[s.center, s.gap]} />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} width={`${60 + ((i * 13) % 35)}%`} height={10} style={s.gap} />
        ))}
      </SheetPage>
    </View>
  );
};

const AdminTcCertificateViewScreen = ({ navigation, route }: any) => {
  const kind: 'cert' | 'tc' = route?.params?.kind ?? 'cert';
  const item: CertItem | TcItem = route?.params?.item;
  const classes = route?.params?.classes ?? [];
  const savedAt: number | undefined = route?.params?.savedAt;
  const { width } = useWindowDimensions();

  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authHeader().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  const isTc = kind === 'tc';
  const pdfUri = certificatePdfUrl(kind, item.id);
  const cert = item as CertItem;
  const tc = item as TcItem;
  const name = item?.student_name || (isTc ? 'Transfer Certificate' : 'Certificate');
  const what = isTc
    ? ['Transfer Certificate', tc.tc_no].filter(Boolean).join(' · ')
    : [`${cert.type === 'participation' ? 'Participation' : 'Achievement'} Certificate`, cert.certificate_no]
        .filter(Boolean)
        .join(' · ');

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(pdfUri, `${isTc ? 'TC' : 'Certificate'}_${(item.student_name || 'student').replace(/\s+/g, '_')}`);
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download.'));
    } finally {
      setDownloading(false);
    }
  };

  const edit = () => navigation.navigate(isTc ? 'AdminTcForm' : 'AdminCertForm', { item, classes });

  const remove = () =>
    confirmDestructive(
      isTc ? 'Delete Transfer Certificate?' : 'Delete Certificate?',
      `${what} for ${name} will be removed.`,
      'Yes, Delete',
      async () => {
        setDeleting(true);
        try {
          if (isTc) await deleteTc(item.id);
          else await deleteCert(item.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
          setDeleting(false);
        }
      },
    );

  return (
    <View style={s.root}>
      <DocHeader
        title={name}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="download-outline" onPress={download} busy={downloading} />
            <HeadBtn icon="create-outline" onPress={edit} />
            <HeadBtn icon="trash-outline" onPress={remove} busy={deleting} />
          </HeadActions>
        }
      />

      <Text style={s.what} numberOfLines={1}>{what}</Text>

      {headers ? (
        <PdfSheet
          key={`${pdfUri}#${savedAt ?? 0}`}
          uri={pdfUri}
          headers={headers}
          skeleton={<PageSkeleton width={width} />}
          errorText="Couldn’t open the certificate. Check your connection and try again."
          label="AdminTcCertificateView"
        />
      ) : (
        <View style={s.viewer}>
          <PageSkeleton width={width} />
        </View>
      )}
    </View>
  );
};

export default AdminTcCertificateViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  what: { fontSize: 13, color: theme.colors.textSecondary, paddingHorizontal: 20, paddingVertical: 10 },
  viewer: { flex: 1, backgroundColor: theme.colors.background },
  skWrap: { alignItems: 'center', paddingTop: 16 },
  center: { alignSelf: 'center' },
  gap: { marginTop: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
