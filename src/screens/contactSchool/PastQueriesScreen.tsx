import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SkeletonText } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import QueryRow from './QueryRow';
import type { Query } from './queryTypes';
import { fetchQueries, queriesToDraw, queriesToKeep, queryErrorMessage } from './queryData';

const PastQueriesScreen = () => {
  const navigation = useNavigation<any>();

  const [role, setRole] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates the list in place.
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<Query[]>(role ? `queries:${role}` : null);

  // ── Load role on mount only ──
  useEffect(() => {
    AsyncStorage.getItem('user_role')
      .then(userRole => setRole(userRole || 'student'))
      .catch(() => setRole('student'));
  }, []);

  const load = useCallback(async (showSkeleton = false) => {
    if (!role) return;
    if (showSkeleton) setLoading(true);
    setError(null);
    try {
      const list = await fetchQueries(role);
      setQueries(list);
      setLoaded(true);
      rememberLast(queriesToKeep(list));
    } catch (err: any) {
      console.log('[PastQueriesScreen] Fetch error:', err?.message);
      setError(queryErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [role, rememberLast]);

  const reload = useCallback(() => load(true), [load]);

  // Loads once the role is known, and again each time the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleNewQuery = () => navigation.navigate('NewQuery');

  // While it loads, the page is drawn as a skeleton from the queries it shows.
  const shown = loading ? queriesToDraw(loaded, queries, last) : queries;

  const page = (skeleton: boolean) =>
    shown.length === 0 ? (
      <View>
        <DocNoData
          icon="chatbubbles-outline"
          title="No queries yet"
          subtitle="Raise a query and the school's reply will show up here."
          skeleton={skeleton}
        />
        <TouchableOpacity style={s.emptyAction} onPress={handleNewQuery} hitSlop={10} disabled={skeleton}>
          {skeleton ? (
            <SkeletonText style={s.linkText}>Raise a query</SkeletonText>
          ) : (
            <Text style={s.linkText}>Raise a query</Text>
          )}
        </TouchableOpacity>
      </View>
    ) : (
      <View>
        {shown.map((item, i) => (
          <QueryRow
            key={String(item.id)}
            item={item}
            isLast={i === shown.length - 1}
            skeleton={skeleton}
            onPress={() => navigation.navigate('ViewQuery', { item })}
          />
        ))}
      </View>
    );

  return (
    <View style={s.root}>
      <DocHeader
        title="Queries"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={handleNewQuery}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {loading ? (
          page(true)
        ) : error ? (
          <View style={s.centeredBox}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={reload} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          page(false)
        )}
      </ScrollView>
    </View>
  );
};

export default PastQueriesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  emptyAction: { alignSelf: 'center', marginTop: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
