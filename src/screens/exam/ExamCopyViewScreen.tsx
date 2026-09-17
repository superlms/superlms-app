import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { PdfSheet, SheetPage } from './pdfSheet';

/**
 * A checked exam copy, as the teacher uploaded it: the PDF itself, full
 * screen, to pinch or double-tap to zoom up to five times, with nothing to
 * download or print — the way Report Card and Admit Card show theirs.
 *
 * Route params:
 *   title – the header (a student their subject, a teacher the student)
 *   url   – the copy's PDF
 */

// The sheet's outline as bars: the name and marks at the head, then the
// written pages.
const PageSkeleton = ({ width }: { width: number }) => (
  <SheetPage width={width}>
    <View style={s.skHead}>
      <View style={s.skHeadText}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={9} />
      </View>
      <Skeleton width={Math.round(width * 0.16)} height={Math.round(width * 0.1)} radius={4} />
    </View>
    {[0, 1, 2].map(block => (
      <View key={block} style={s.skBlock}>
        <Skeleton width="30%" height={10} />
        {['92%', '86%', '95%', '64%'].map((w, i) => (
          <Skeleton key={i} width={w} height={8} />
        ))}
      </View>
    ))}
  </SheetPage>
);

const ExamCopyViewScreen = ({ navigation, route }: any) => {
  const { title, url } = route.params as { title: string; url: string };
  const { width: pageWidth } = useWindowDimensions();

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <PdfSheet
        uri={url}
        headers={{}}
        skeleton={<PageSkeleton width={pageWidth} />}
        errorText="Couldn’t open this copy. Check your connection and try again."
        label="ExamCopy"
      />
    </View>
  );
};

export default ExamCopyViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Loading sheet
  skHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  skHeadText: { flex: 1, gap: 8 },
  skBlock: { gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
