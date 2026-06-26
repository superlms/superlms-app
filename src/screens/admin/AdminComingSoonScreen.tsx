import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation, useRoute } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';

// Shared placeholder for admin bottom-nav tabs whose full screens land in later
// phases (Chats, Attendance, Fees). Title/icon come from the tab's route params.
const AdminComingSoonScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const title: string = route?.params?.title ?? 'Coming soon';
  const icon: string = route?.params?.icon ?? 'construct-outline';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />

      <View style={s.topbar}>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <VectorIcon iconSet="Feather" iconName="menu" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>{title}</Text>
      </View>

      <View style={s.body}>
        <View style={s.iconWrap}>
          <VectorIcon iconSet="Ionicons" iconName={icon} size={40} color={theme.colors.primary} />
        </View>
        <Text style={s.heading}>{title}</Text>
        <Text style={s.sub}>This module is coming soon to the admin app.</Text>
      </View>
    </View>
  );
};

export default AdminComingSoonScreen;

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

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heading: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
});
