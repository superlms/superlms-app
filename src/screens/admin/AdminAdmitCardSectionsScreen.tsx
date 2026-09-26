import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { AdmitClassCount, getAdmitClasses } from '../../api/adminAdmitCardApi';
import { GroupRow, plural } from './adminStudentsUi';
import { HeadActions, HeadBtn, issuedLine } from './adminAdmitCardUi';

/**
 * One class's sections for an exam, as the admin app's Students draws a
 * class's sections: a count, then All sections — the web page's "All Sections"
 * filter, every student of the class — and a row per section, each with how
 * many of its students hold the exam's card.
 */

type Row = { key: string; sectionId?: number; sectionName?: string; title: string; letter?: string; students: number; issued: number };

const AdminAdmitCardSectionsScreen = ({ navigation, route }: any) => {
  const exam: { id: number; name: string } = route?.params?.exam;
  const [cls, setCls] = useState<AdmitClassCount>(route?.params?.classItem);
  const [refreshing, setRefreshing] = useState(false);

  // Back from a section's students, its counts are fresh.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await getAdmitClasses(exam.id);
      const fresh = r.classes.find(c => c.id === cls.id);
      if (mine === seq.current && fresh) setCls(fresh);
    } catch {
      // The counts it came with stay on screen.
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [exam.id, cls.id]);

  const loaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!loaded.current) {
        loaded.current = true;
        return;
      }
      load();
    }, [load]),
  );

  const rows: Row[] = [
    { key: 'all', title: 'All sections', students: cls.students, issued: cls.issued },
    ...cls.sections.map(x => ({
      key: String(x.id),
      sectionId: x.id,
      sectionName: x.name,
      title: `Section ${x.name}`,
      letter: x.name.slice(0, 2).toUpperCase(),
      students: x.students,
      issued: x.issued,
    })),
  ];

  return (
    <View style={s.root}>
      <DocHeader
        title={cls.name}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn
              icon="print-outline"
              onPress={() => navigation.navigate('AdminAdmitCardPrint', { examId: exam.id, classId: cls.id })}
            />
            <HeadBtn
              icon="add"
              onPress={() => navigation.navigate('AdminAdmitCardIssue', { examId: exam.id, classId: cls.id })}
            />
          </HeadActions>
        }
      />

      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <Text style={s.count}>{`${exam.name} · ${plural(cls.sections.length, 'section')}`}</Text>
        }
        renderItem={({ item, index }) => (
          <GroupRow
            icon={item.letter ? undefined : 'layers-outline'}
            letter={item.letter}
            title={item.title}
            meta={issuedLine(item.issued, item.students)}
            isLast={index === rows.length - 1}
            onPress={() =>
              navigation.navigate('AdminAdmitCardStudents', {
                exam,
                classId: cls.id,
                className: cls.name,
                sectionId: item.sectionId,
                sectionName: item.sectionName,
              })
            }
          />
        )}
      />
    </View>
  );
};

export default AdminAdmitCardSectionsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
