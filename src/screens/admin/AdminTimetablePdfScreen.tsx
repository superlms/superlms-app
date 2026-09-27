import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { PdfSheet } from '../exam/pdfSheet';
import { authHeader, downloadPdf } from '../../api/pdfDownload';
import { HeadBtn } from './adminAdmitCardUi';
import { GridSkeleton } from './adminTimetableUi';

/**
 * A timetable as the panel's Download makes it — the week as a grid, A4
 * landscape — to pinch or double-tap to zoom, with Download to save it.
 *
 * Route params: title, uri (the token-protected PDF), fileName.
 */

const AdminTimetablePdfScreen = ({ navigation, route }: any) => {
  const title: string = route?.params?.title ?? 'Timetable';
  const uri: string = route?.params?.uri;
  const fileName: string = route?.params?.fileName ?? 'timetable';
  const { width } = useWindowDimensions();

  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    authHeader().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadPdf(uri, fileName);
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download the timetable.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={title}
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeadBtn icon="download-outline" onPress={download} busy={downloading} />}
      />

      {headers ? (
        <PdfSheet
          key={uri}
          uri={uri}
          headers={headers}
          skeleton={<GridSkeleton width={width} />}
          errorText="Couldn’t open the timetable. Check your connection and try again."
          label="AdminTimetablePdf"
        />
      ) : (
        <View style={s.viewer}>
          <GridSkeleton width={width} />
        </View>
      )}
    </View>
  );
};

export default AdminTimetablePdfScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  viewer: { flex: 1, backgroundColor: theme.colors.background },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
