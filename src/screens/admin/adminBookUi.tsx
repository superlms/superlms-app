import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { SheetPage } from '../exam/pdfSheet';
import type { BookRow } from '../../api/adminBookApi';

/**
 * Books' shared pieces: where a book sits (class, section, subject) as it is
 * passed from page to page, the line a book's row carries, and the page drawn
 * while its PDF loads.
 */

/** The class, section (none for the whole class) and subject a page is about. */
export interface BookCtx {
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  subjectId: number;
  subjectName: string;
}

/** "Whole class" for a book with no section (stored as 0, or null on older data). */
export const bookWhere = (b: BookRow) => (b.section_id ? `Section ${b.section ?? ''}`.trim() : 'Whole class');

/** "Section A · Inactive · No PDF" — what a row says under a book's title. */
export const bookLine = (b: BookRow) =>
  [bookWhere(b), b.is_active ? null : 'Inactive', b.pdf_file ? null : 'No PDF'].filter(Boolean).join(' · ');

/** "report card.pdf" from the picker's percent-encoded name. */
export const readable = (name?: string | null) => {
  try {
    return decodeURIComponent(name ?? '');
  } catch {
    return name ?? '';
  }
};

// ── Loading: a book's page ───────────────────────────────────────────────────
export const PageSkeleton = ({ width }: { width: number }) => {
  const w = Math.min(width - 40, 520);
  return (
    <View style={s.wrap}>
      <SheetPage width={w}>
        <Skeleton width="56%" height={16} style={s.center} />
        <Skeleton width="30%" height={10} style={[s.center, s.gap]} />
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} width={`${62 + ((i * 11) % 34)}%`} height={10} style={s.gap} />
        ))}
      </SheetPage>
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 16, backgroundColor: theme.colors.background, flex: 1 },
  center: { alignSelf: 'center' },
  gap: { marginTop: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
