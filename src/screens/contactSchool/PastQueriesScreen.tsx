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
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getStudentContactList,
  getTeacherContactList,
} from '../../api/contactApi';
import { DocHeader, DocNoData } from '../more/docUi';
import QueryRow from './QueryRow';
import type { Query } from './queryTypes';

const PastQueriesScreen = () => {
  // ✅ ALL hooks must be at the top, in the same order every render
  const navigation = useNavigation<any>();

  // ── All useState together ──────────────────────────────────────────────────
  const [role, setRole] = useState<string>('student');
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate days ago from date string
  const calculateDaysAgo = (dateString: string): number => {
    const createdDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Map API response to Query format
  const mapApiResponseToQuery = (apiItem: any): Query => {
    let status: 'Pending' | 'In Progress' | 'Resolved' = 'Pending';
    if (apiItem.admin_text && apiItem.admin_text !== null) {
      status = 'Resolved';
    } else if (apiItem.admin_reply === 1 || apiItem.admin_reply === true) {
      status = 'Resolved';
    } else if (apiItem.admin_reply === 2) {
      status = 'In Progress';
    }

    const daysAgo = calculateDaysAgo(apiItem.created_at);

    // The API stores the uploaded file in image_url — it may be an image or a PDF
    const fileUrl: string | null = apiItem.image_url ?? null;
    const isPdf = !!fileUrl && /\.pdf(\?|$)/i.test(fileUrl);
    const fileName = fileUrl
      ? decodeURIComponent(fileUrl.split('/').pop() ?? '') || 'Attachment'
      : null;

    return {
      id: apiItem.id,
      subject: apiItem.topic,
      // Students store the body in `student_query`, teachers in `teacher_query`.
      message: apiItem.student_query ?? apiItem.teacher_query ?? '',
      status: status,
      created_at: apiItem.created_at,
      daysAgo: daysAgo,
      attachmentName: fileName,
      attachmentUrl: isPdf ? null : fileUrl,
      pdfUrl: apiItem.pdf_url ?? apiItem.pdf ?? (isPdf ? fileUrl : null),
      admin_reply: apiItem.admin_text,
      replied_at: apiItem.updated_at,
    };
  };

  // ── fetchQueries - defined as a regular function (not useCallback to avoid hook issues)
  const fetchQueries = async () => {
    setLoading(true);
    setError(null);
    console.log('[PastQueriesScreen] Fetching queries for role:', role);

    try {
      let apiResponse;
      if (role === 'teacher') {
        apiResponse = await getTeacherContactList();
      } else {
        apiResponse = await getStudentContactList();
      }

      let dataArray = [];
      if (Array.isArray(apiResponse)) {
        dataArray = apiResponse;
      } else if (apiResponse?.data && Array.isArray(apiResponse.data)) {
        dataArray = apiResponse.data;
      } else {
        dataArray = [];
      }

      console.log('[PastQueriesScreen] Data array length:', dataArray.length);

      const mappedQueries = dataArray.map(mapApiResponseToQuery);
      console.log('[PastQueriesScreen] Mapped queries count:', mappedQueries.length);

      setQueries(mappedQueries);
    } catch (err: any) {
      console.log('[PastQueriesScreen] Fetch error:', err?.message);
      let msg = 'Failed to load queries. Please check your internet connection.';
      if (err?.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err?.message === 'Network Error') {
        msg = 'Network Error. Please check your internet connection.';
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Load role on mount only ──
  useEffect(() => {
    const loadRole = async () => {
      try {
        const userRole = await AsyncStorage.getItem('user_role');
        console.log('[PastQueriesScreen] Role loaded:', userRole);
        if (userRole) {
          setRole(userRole);
        }
      } catch (error) {
        console.error('[PastQueriesScreen] Error loading role:', error);
      }
    };
    loadRole();
  }, []);

  // Fetch when role changes
  useEffect(() => {
    if (role) {
      fetchQueries();
    }
  }, [role]);

  // Refresh when screen comes into focus - useFocusEffect is a hook, called unconditionally
  useFocusEffect(
    useCallback(() => {
      if (role) {
        fetchQueries();
      }
    }, [role])
  );

  const { refreshing, onRefresh } = useRefresh(fetchQueries);

  // Handle new query button press
  const handleNewQuery = () => {
    console.log('[PastQueriesScreen] Navigating to ContactSchool');
    navigation.navigate('NewQuery');
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Past Queries"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={handleNewQuery}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[s.skeletonRow, i < 3 && s.rowBorder]}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="85%" height={12} />
                <Skeleton width="30%" height={10} />
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={s.centeredBox}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchQueries} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : queries.length === 0 ? (
          <View>
            <DocNoData
              icon="chatbubbles-outline"
              title="No queries yet"
              subtitle="Raise a query and the school's reply will show up here."
            />
            <TouchableOpacity style={s.emptyAction} onPress={handleNewQuery} hitSlop={10}>
              <Text style={s.linkText}>Raise a query</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {queries.map((item, i) => (
              <QueryRow
                key={String(item.id)}
                item={item}
                isLast={i === queries.length - 1}
                onPress={() => navigation.navigate('ViewQuery', { item })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default PastQueriesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  skeletonRow: { paddingVertical: 16, gap: 8 },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  emptyAction: { alignSelf: 'center', marginTop: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
