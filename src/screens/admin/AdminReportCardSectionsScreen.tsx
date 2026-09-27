import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { RcClass, getReportCardLookups } from '../../api/adminReportCardApi';
import { GroupRow, plural } from './adminStudentsUi';
import { issuedLine } from './adminAdmitCardUi';

/**
 * One class's sections, as the admin app's Students draws them: a count, then
 * a row per section with how many of its students hold an issued report card.
 * A section opens onto its students — the panel's Issue screen once a class
 * and section are picked.
 */

const AdminReportCardSectionsScreen = ({ navigation, route }: any) => {
  const [cls, setCls] = useState<RcClass>(route?.params?.classItem);
  const [refreshing, setRefreshing] = useState(false);

  // Back from issuing, the counts are fresh.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const l = await getReportCardLookups();
      const next = l.classes.find(c => c.id === cls.id);
      if (mine === seq.current && next) setCls(next);
    } catch {
      // The counts already shown stay.
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [cls.id]);
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

  const sections = cls?.sections ?? [];

  return (
    <View style={s.root}>
      <DocHeader title={cls?.name ?? 'Sections'} onBackPress={() => navigation.goBack()} />

      <FlatList
        data={sections}
        keyExtractor={x => String(x.id)}
        contentContainerStyle={[s.list, sections.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          sections.length > 0 ? (
            <Text style={s.count}>
              {[plural(sections.length, 'section'), cls.students != null ? issuedLine(cls.issued ?? 0, cls.students) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData icon="grid-outline" title="No sections yet" subtitle="Report cards are issued section by section — add this class’s sections under Standards first." />
        }
        renderItem={({ item, index }) => (
          <GroupRow
            letter={item.name}
            title={`Section ${item.name}`}
            meta={
              item.students == null
                ? null
                : item.students === 0
                  ? 'No students'
                  : `${plural(item.students, 'student')} · ${issuedLine(item.issued ?? 0, item.students)}`
            }
            isLast={index === sections.length - 1}
            onPress={() =>
              navigation.navigate('AdminReportCardStudents', {
                classId: cls.id,
                className: cls.name,
                sectionId: item.id,
                sectionName: item.name,
              })
            }
          />
        )}
      />
    </View>
  );
};

export default AdminReportCardSectionsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
