import React, { useState, useEffect, useCallback } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getStudentContactList,
  getTeacherContactList,
} from '../../api/contactApi';
import QueryCard from './QueryCard';
import { STATUS_META } from './queryTypes';
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
      <Header title="Past Queries" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Overview card ── */}
        <View style={s.card}>
          <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
          <View style={s.cardInner}>
            <View style={s.cardTop}>
              <View style={s.iconWrap}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="chatbubbles-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Past Queries</Text>
                <Text style={s.cardSubtitle}>
                  {queries.length} quer{queries.length !== 1 ? 'ies' : 'y'} raised
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleNewQuery}
                style={s.addBtn}
              >
                <VectorIcon iconSet="Ionicons" iconName="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Stats footer */}
            {!loading && !error && queries.length > 0 && (
              <View style={s.tableFooter}>
                {(['Pending', 'In Progress', 'Resolved'] as const).map((status, i, arr) => {
                  const count = queries.filter(q => q.status === status).length;
                  return (
                    <React.Fragment key={status}>
                      <View style={s.footerItem}>
                        <View
                          style={[s.footerDot, { backgroundColor: STATUS_META[status].color }]}
                        />
                        <Text style={s.footerLabel}>{status}</Text>
                        <Text style={s.footerValue}>{count}</Text>
                      </View>
                      {i < arr.length - 1 && <View style={s.footerDivider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={s.centeredBox}>
            <ScreenSkeleton variant="list" />
          </View>
        ) : error ? (
          <View style={s.centeredBox}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={36} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={fetchQueries}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : queries.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="chatbubbles-outline" size={40} color={theme.colors.primary} />
            </View>
            <Text style={s.emptyTitle}>No queries found</Text>
            <Text style={s.emptySubtitle}>Tap "+" to raise a concern</Text>
          </View>
        ) : (
          <View style={s.list}>
            {queries.map(item => (
              <QueryCard
                key={String(item.id)}
                item={item}
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
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 40, gap: 14 },

  // Card (shared template)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats footer (shared template)
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  footerDot: { width: 7, height: 7, borderRadius: 4 },
  footerLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  footerValue: { fontSize: 13, fontWeight: '900', color: theme.colors.textPrimary },
  footerDivider: { width: 1, height: 24, backgroundColor: theme.colors.border },

  list: { gap: 14 },
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: theme.radius.full, backgroundColor: theme.colors.primary,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIconRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
