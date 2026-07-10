import React, { useState } from 'react';
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
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminEnquiry, EnquiryTab, deleteEnquiry } from '../../api/adminContentApi';

const AdminEnquiryDetailScreen = ({ navigation, route }: any) => {
  const tab: EnquiryTab = route.params?.tab ?? 'teacher';
  const enquiry: AdminEnquiry = route.params?.enquiry;
  const [deleting, setDeleting] = useState(false);

  if (!enquiry) {
    return (
      <View style={s.root}>
        <Header title="Enquiry" onBackPress={() => navigation.goBack()} />
        <Text style={s.empty}>Enquiry not found.</Text>
      </View>
    );
  }

  const replied = enquiry.replied;

  const openReply = () =>
    navigation.navigate('AdminEnquiryReply', {
      tab,
      id: enquiry.id,
      topic: enquiry.topic,
      admin_text: enquiry.admin_text ?? '',
    });

  const confirmDelete = () =>
    Alert.alert('Delete enquiry', 'Delete this enquiry permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEnquiry(tab, enquiry.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  return (
    <View style={s.root}>
      <Header title="Enquiry" onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status + topic */}
        <View style={s.topRow}>
          <View style={[s.statusBadge, { backgroundColor: (replied ? '#22C55E' : '#F59E0B') + '18' }]}>
            <VectorIcon iconSet="Ionicons" iconName={replied ? 'checkmark-circle' : 'time'} size={13}
              color={replied ? '#22C55E' : '#F59E0B'} />
            <Text style={[s.statusText, { color: replied ? '#22C55E' : '#F59E0B' }]}>
              {replied ? 'Replied' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={s.topic}>{enquiry.topic}</Text>

        {/* From */}
        <View style={s.card}>
          <View style={s.fromRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(enquiry.user_name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fromName} numberOfLines={1}>{enquiry.user_name}</Text>
              {!!enquiry.user_email && <Text style={s.fromEmail} numberOfLines={1}>{enquiry.user_email}</Text>}
            </View>
            {!!enquiry.created_at && (
              <Text style={s.date}>{new Date(enquiry.created_at).toLocaleDateString()}</Text>
            )}
          </View>
        </View>

        {/* Query */}
        <Text style={s.sectionLabel}>Query</Text>
        <View style={s.card}>
          <Text style={s.body}>{enquiry.query}</Text>
          {!!enquiry.image_url && (
            <TouchableOpacity onPress={() => Linking.openURL(enquiry.image_url!)} activeOpacity={0.85}>
              <Image source={{ uri: enquiry.image_url }} style={s.image} />
            </TouchableOpacity>
          )}
        </View>

        {/* Reply */}
        {!!enquiry.admin_text && (
          <>
            <Text style={s.sectionLabel}>Your reply</Text>
            <View style={[s.card, s.replyCard]}>
              <Text style={s.body}>{enquiry.admin_text}</Text>
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Sticky actions */}
      <View style={s.actionBar}>
        <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={confirmDelete} activeOpacity={0.85} disabled={deleting}>
          {deleting ? <ActivityIndicator color={theme.colors.danger} /> : (
            <>
              <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color={theme.colors.danger} />
              <Text style={s.deleteText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.replyBtn]} onPress={openReply} activeOpacity={0.9}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-undo" size={18} color="#fff" />
          <Text style={s.replyText}>{replied ? 'Edit Reply' : 'Reply'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AdminEnquiryDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  scroll: { padding: 16 },

  topRow: { flexDirection: 'row' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  statusText: { fontSize: 11, fontWeight: '800' },
  topic: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 10 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { backgroundColor: theme.colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginTop: 12 },
  replyCard: { backgroundColor: '#22C55E10', borderColor: '#22C55E33' },

  fromRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900', color: theme.colors.primary },
  fromName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  fromEmail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  date: { fontSize: 11, color: theme.colors.textMuted },

  body: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 21 },
  image: { width: '100%', height: 190, borderRadius: 12, marginTop: 12, resizeMode: 'cover' },

  actionBar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  deleteBtn: { flex: 1, backgroundColor: theme.colors.danger + '14' },
  deleteText: { fontSize: 15, fontWeight: '800', color: theme.colors.danger },
  replyBtn: { flex: 2, backgroundColor: theme.colors.primary },
  replyText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
