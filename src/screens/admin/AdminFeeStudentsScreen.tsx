import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeStudent, getFeeStudents } from '../../api/adminFeeApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorBox, ListRow, ListSkeleton, SearchBar } from './adminTransportUi';
import { ClassPills, inr, useFeeClasses } from './adminFeeUi';

/**
 * Fee Submission's student list, as the panel finds them: a class (and a
 * section), or a name — the student's or their father's — with or without a
 * class. With a class picked, each row says what is still pending for the
 * year, as View Fee's By Class list does. A row opens the student's fees.
 */

const AdminFeeStudentsScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<FeeStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const term = search.trim();
  const ready = !!classId || term !== '';

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!classId && !term) {
      setRows(null);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const d = await getFeeStudents({
        standard_id: classId ?? undefined,
        section_id: sectionId ?? undefined,
        search: term || undefined,
      });
      if (mine === seq.current) setRows(d);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load students.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [classId, sectionId, term]);

  // Typing waits a moment before it asks.
  useEffect(() => {
    const t = setTimeout(load, term ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, term]);

  // Back from collecting, the pending figures are fresh.
  useFocusLoad(() => {
    if (rows) load();
  });

  const pending = (rows ?? []).reduce((sum, r) => sum + (r.fee?.pending ?? 0), 0);
  const withFees = (rows ?? []).some(r => r.fee);

  return (
    <View style={s.root}>
      <DocHeader title="Fee Submission" onBackPress={() => navigation.goBack()} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search student or father name…" />
      <View style={s.filters}>
        <ClassPills
          classes={classes}
          classId={classId}
          sectionId={sectionId}
          allLabel="Class"
          onChange={(c, sec) => {
            setClassId(c);
            setSectionId(sec);
          }}
        />
      </View>

      {!ready ? (
        <DocNoData icon="person-outline" title="Select a student" subtitle="Pick a class, or search by the student's or father's name, to see their fees." />
      ) : error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows || (loading && rows.length === 0) ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          ListHeaderComponent={
            <Text style={s.count}>
              {`${rows.length} ${rows.length === 1 ? 'student' : 'students'}${withFees ? ` · ${inr(pending)} pending` : ''}`}
            </Text>
          }
          renderItem={({ item, index }) => (
            <ListRow
              photo={{ uri: item.photo, name: item.name }}
              title={item.name}
              sub={[
                [item.class, item.section].filter(Boolean).join(' · '),
                item.admission_no ? `Adm ${item.admission_no}` : null,
                item.roll_no ? `Roll ${item.roll_no}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              meta={item.father_name ? `Father: ${item.father_name}` : null}
              right={item.fee ? (item.fee.pending > 0 ? inr(item.fee.pending) : 'Paid') : null}
              tone={item.fee ? (item.fee.pending > 0 ? 'due' : 'paid') : undefined}
              onPress={() => navigation.navigate('AdminFeeStudent', { id: item.id, name: item.name })}
              isLast={index === rows.length - 1}
            />
          )}
          ListEmptyComponent={
            <DocNoData icon="people-outline" title="No students found" subtitle={term ? 'Try another name.' : 'No students in this class yet.'} />
          }
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

export default AdminFeeStudentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingVertical: 6 },
  list: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
