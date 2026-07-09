import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminAnnouncement,
  AnnouncementType,
  deleteAnnouncement,
  getAdminAnnouncements,
} from '../../api/adminContentApi';

const TYPE_LABEL: Record<AnnouncementType, string> = { all: 'Both', user: 'Students', teacher: 'Teachers' };
const TYPE_COLOR: Record<AnnouncementType, string> = { all: '#6366F1', user: '#0EA5E9', teacher: '#EC4899' };

const AdminAnnouncementDetailScreen = ({ navigation, route }: any) => {
  const [item, setItem] = useState<AdminAnnouncement | null>(route?.params?.item ?? null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!item?.id) return;
    try {
      const res = await getAdminAnnouncements();
      const found = res.announcements.find(a => a.id === item.id);
      if (found) setItem(found);
      else navigation.goBack();
    } catch {
      // keep the passed item
    }
  }, [item?.id, navigation]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const remove = () =>
    Alert.alert('Delete', `Delete "${item?.announcement_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAnnouncement(item!.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  if (!item) {
    return (
      <View style={s.root}>
        <Header title="Announcement" onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const color = TYPE_COLOR[item.type];

  return (
    <View style={s.root}>
      <Header title="Announcement" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.badge, { backgroundColor: color + '18' }]}>
          <VectorIcon iconSet="Ionicons" iconName="megaphone" size={13} color={color} />
          <Text style={[s.badgeText, { color }]}>{TYPE_LABEL[item.type]}</Text>
        </View>

        <Text style={s.title}>{item.announcement_name}</Text>
        <Text style={s.meta}>
          {item.creator_name ?? 'Admin'}{item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString()}` : ''}
        </Text>

        <View style={s.divider} />

        <Text style={s.content}>{item.announcement_content}</Text>

        {!!item.image_url && <Image source={{ uri: item.image_url }} style={s.image} />}
        {!!item.pdf_url && (
          <TouchableOpacity style={s.pdfBtn} onPress={() => Linking.openURL(item.pdf_url!)} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="document-text" size={18} color="#EF4444" />
            <Text style={s.pdfText}>View attached PDF</Text>
          </TouchableOpacity>
        )}

        <View style={s.actions}>
          <TouchableOpacity style={[s.actBtn, s.editBtn]} activeOpacity={0.9}
            onPress={() => navigation.navigate('AdminAnnouncementForm', { item })}>
            <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color="#fff" />
            <Text style={s.actBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, s.deleteBtn]} activeOpacity={0.9} onPress={remove} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#fff" /> : (
              <>
                <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color="#fff" />
                <Text style={s.actBtnText}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default AdminAnnouncementDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 12 },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },
  content: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 23 },
  image: { width: '100%', height: 200, borderRadius: 14, marginTop: 16, resizeMode: 'cover' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  pdfText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtn: { backgroundColor: theme.colors.primary },
  deleteBtn: { backgroundColor: theme.colors.danger },
  actBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
