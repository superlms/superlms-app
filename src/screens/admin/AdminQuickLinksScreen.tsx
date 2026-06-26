import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { ADMIN_MODULES } from './adminModules';

// Quick Links shows every admin sidebar module except the Quick Links tile
// itself — mirrors the web Quick Links page.
const LINKS = ADMIN_MODULES.filter(m => m.key !== 'quick-links');

type OrderKey = 'sidebar' | 'ascending';

const ORDER_OPTIONS: { key: OrderKey; label: string; icon: string }[] = [
  { key: 'sidebar', label: 'Sidebar Order', icon: 'menu-outline' },
  { key: 'ascending', label: 'A → Z (Ascending)', icon: 'swap-vertical-outline' },
];

const AdminQuickLinksScreen = () => {
  const navigation = useNavigation<any>();
  const [order, setOrder] = useState<OrderKey>('sidebar');
  const [orderOpen, setOrderOpen] = useState(false);

  const orderedLinks = useMemo(() => {
    if (order === 'ascending') {
      return [...LINKS].sort((a, b) => a.label.localeCompare(b.label));
    }
    return LINKS; // already in sidebar order
  }, [order]);

  const activeOrder = ORDER_OPTIONS.find(o => o.key === order)!;

  const moduleRoutes: Record<string, string> = {
    announcement: 'AdminAnnouncement',
    calender: 'AdminCalendar',
    enquiries: 'AdminEnquiries',
    standard: 'AdminStandard',
    students: 'AdminStudents',
    teachers: 'AdminTeachers',
    'id-card': 'AdminIdCard',
    exam: 'AdminExam',
    syllabus: 'AdminSyllabus',
    content: 'AdminContent',
    quiz: 'AdminQuiz',
    book: 'AdminBook',
    timetable: 'AdminTimetable',
    arrangement: 'AdminArrangement',
  };

  const openModule = (m: { key: string; label: string }) => {
    if (m.key === 'dashboard') {
      navigation.navigate('Dashboard');
      return;
    }
    const route = moduleRoutes[m.key];
    if (route) {
      navigation.navigate(route);
      return;
    }
    Alert.alert(m.label, 'This module is coming soon to the admin app.');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />

      {/* Top bar */}
      <View style={s.topbar}>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <VectorIcon iconSet="Feather" iconName="menu" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Quick Links</Text>
      </View>

      {/* Filter bar */}
      <View style={s.orderBar}>
        <View style={s.filterLeft}>
          <VectorIcon iconSet="Ionicons" iconName="funnel-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={s.orderLabel}>Filter by</Text>
        </View>
        <View style={s.orderSelectWrap}>
          <TouchableOpacity
            style={s.orderSelect}
            activeOpacity={0.8}
            onPress={() => setOrderOpen(o => !o)}
          >
            <VectorIcon iconSet="Ionicons" iconName={activeOrder.icon} size={15} color={theme.colors.primary} />
            <Text style={s.orderSelectText}>{activeOrder.label}</Text>
            <VectorIcon
              iconSet="Ionicons"
              iconName={orderOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          {orderOpen && (
            <View style={s.orderDropdown}>
              {ORDER_OPTIONS.map((o, i) => {
                const active = o.key === order;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      s.orderItem,
                      i === ORDER_OPTIONS.length - 1 && s.orderItemLast,
                      active && s.orderItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setOrder(o.key);
                      setOrderOpen(false);
                    }}
                  >
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={o.icon}
                      size={15}
                      color={active ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[s.orderItemText, active && s.orderItemTextActive]}>
                      {o.label}
                    </Text>
                    {active && (
                      <VectorIcon iconSet="Ionicons" iconName="checkmark" size={15} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.modGrid}>
          {orderedLinks.map(m => (
            <TouchableOpacity key={m.key} style={s.modCard} activeOpacity={0.8} onPress={() => openModule(m)}>
              <View style={[s.modIcon, { backgroundColor: m.color + '18' }]}>
                <VectorIcon iconSet="Ionicons" iconName={m.icon} size={24} color={m.color} />
              </View>
              <Text style={s.modLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default AdminQuickLinksScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },

  orderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    zIndex: 50,
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  orderSelectWrap: { position: 'relative' },
  orderSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  orderSelectText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  orderDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 210,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  orderItemLast: { borderBottomWidth: 0 },
  orderItemActive: { backgroundColor: theme.colors.primaryLight },
  orderItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  orderItemTextActive: { color: theme.colors.primary, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40 },

  // Tiles — identical to the dashboard module grid.
  modGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modCard: { width: '22%', alignItems: 'center', gap: 8, paddingVertical: 6 },
  modIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },
});
