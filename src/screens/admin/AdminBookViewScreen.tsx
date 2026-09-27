import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { PdfSheet } from '../exam/pdfSheet';
import { resolveFileUrl } from '../books/bookData';
import type { BookRow } from '../../api/adminBookApi';
import { HeadBtn } from './adminAdmitCardUi';
import { BookCtx, PageSkeleton, bookLine } from './adminBookUi';

/**
 * A subject's book, open on its PDF — the school's upload, to pinch or
 * double-tap to zoom — with the pencil in the header to edit it. A subject with
 * no book (or a book with no PDF yet) says "No PDF added", with + to add it.
 *
 * Route params: ctx — the class, section and subject; book — the book, or null
 * (a save hands back the saved one).
 */

const NO_HEADERS = {}; // books are public on S3 — the app's token stays home

const AdminBookViewScreen = ({ navigation, route }: any) => {
  const ctx: BookCtx = route?.params?.ctx;
  const book: BookRow | null = route?.params?.book ?? null;
  const { width } = useWindowDimensions();

  const uri = resolveFileUrl(book?.pdf_file);
  const add = () => navigation.navigate('AdminBookForm', { ctx });
  const edit = () => navigation.navigate('AdminBookForm', { ctx, book });

  return (
    <View style={s.root}>
      <DocHeader
        title={book?.title || ctx?.subjectName || 'Book'}
        onBackPress={() => navigation.goBack()}
        rightSlot={book ? <HeadBtn icon="create-outline" onPress={edit} /> : <HeadBtn icon="add" onPress={add} />}
      />

      {!!book && <Text style={s.line} numberOfLines={1}>{[ctx?.subjectName, bookLine(book)].filter(Boolean).join(' · ')}</Text>}

      {uri ? (
        <PdfSheet
          key={uri}
          uri={uri}
          headers={NO_HEADERS}
          skeleton={<PageSkeleton width={width} />}
          errorText="Couldn’t open the book. Check your connection and try again."
          label="AdminBookView"
        />
      ) : (
        <View style={s.empty}>
          <DocNoData
            icon="document-outline"
            title="No PDF added"
            subtitle={
              book
                ? `${book.title} has no PDF yet. Tap the pencil to add it.`
                : `No book has been added for ${ctx?.subjectName ?? 'this subject'} yet.`
            }
          />
          <TouchableOpacity style={s.addBtn} activeOpacity={0.85} onPress={book ? edit : add}>
            <Text style={s.addText}>{book ? 'Add PDF' : 'Add Book'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default AdminBookViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  line: { fontSize: 13, color: theme.colors.textSecondary, paddingHorizontal: 20, paddingVertical: 10 },
  empty: { flex: 1, paddingHorizontal: 20 },
  addBtn: {
    alignSelf: 'center',
    marginTop: 18,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
