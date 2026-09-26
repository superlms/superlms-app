import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { PdfSheet } from '../exam/pdfSheet';
import { admitCardSheetPdfUrl, authHeader, downloadAdmitCardPdf } from '../../api/adminAdmitCardApi';
import { plural } from './adminStudentsUi';
import { HeadBtn, SheetSkeleton } from './adminAdmitCardUi';

/**
 * The print run, as the web's Print opens it: the cards four to an A4
 * landscape sheet, cut along the dotted lines — the school's own sheet, to
 * pinch or double-tap to zoom, and Download to save it for the printer. The
 * cards were stamped as printed before this opened.
 *
 * Route params: ids — the cards; name — the student, when there is one.
 */

const AdminAdmitCardSheetScreen = ({ navigation, route }: any) => {
  const ids: number[] = route?.params?.ids ?? [];
  const name: string | undefined = route?.params?.name;
  const { width } = useWindowDimensions();

  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    authHeader().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  const uri = admitCardSheetPdfUrl(ids);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const file =
        ids.length === 1 && name
          ? `Admit_Card_Sheet_${name.replace(/\s+/g, '_')}`
          : `Admit_Cards_${ids.length}_${Date.now()}`;
      await downloadAdmitCardPdf(uri, file);
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download the print sheet.'));
    } finally {
      setDownloading(false);
    }
  };

  const sheets = Math.ceil(ids.length / 4);

  return (
    <View style={s.root}>
      <DocHeader
        title="Print Admit Cards"
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeadBtn icon="download-outline" onPress={download} busy={downloading} />}
      />

      <Text style={s.line}>
        {`${plural(ids.length, 'card')} · ${plural(sheets, 'sheet')} · 4 to an A4 page, cut along the dotted lines`}
      </Text>

      {headers ? (
        <PdfSheet
          key={uri}
          uri={uri}
          headers={headers}
          skeleton={<SheetSkeleton width={width} />}
          errorText="Couldn’t open the print sheet. Check your connection and try again."
          label="AdminAdmitCardSheet"
        />
      ) : (
        <View style={s.viewer}>
          <SheetSkeleton width={width} />
        </View>
      )}
    </View>
  );
};

export default AdminAdmitCardSheetScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  viewer: { flex: 1, backgroundColor: theme.colors.background },
  line: {
    fontSize: 12,
    color: theme.colors.textMuted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
