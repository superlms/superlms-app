import React, { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminEnquiry, EnquiryTab, deleteEnquiry } from '../../api/adminContentApi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { DetailRow } from '../calendar/calendarUi';
import { QuietAction, confirmDestructive, isPdfUrl } from './adminFormUi';

/**
 * One enquiry, as a student's View Query page draws a query — when it came in
 * and where it stands, the topic, the query with its attachment as a chip,
 * then the school's reply — with who sent it, as the panel's view shows. Reply
 * (or Edit reply) writes the answer; the bin deletes the enquiry and its
 * attachment. A website enquiry shows who sent it and their message, and takes
 * no reply.
 *
 * Route params: tab – student, teacher or website; enquiry – from the list.
 */

const TITLE = 'View Enquiry';

const PENDING = '#F59E0B';
const REPLIED = '#10B981';

const when = (iso?: string | null) => (iso ? moment(iso).format('DD MMM YYYY, hh:mm A') : '');

const AdminEnquiryDetailScreen = ({ navigation, route }: any) => {
  const tab: EnquiryTab = route.params?.tab ?? 'teacher';
  const enquiry: AdminEnquiry | undefined = route.params?.enquiry;
  const website = tab === 'website';
  const [deleting, setDeleting] = useState(false);

  if (!enquiry) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Enquiry not found</Text>
        </View>
      </View>
    );
  }

  const replied = enquiry.replied;
  const color = replied ? REPLIED : PENDING;

  const openReply = () =>
    navigation.navigate('AdminEnquiryReply', {
      tab,
      id: enquiry.id,
      topic: enquiry.topic,
      admin_text: enquiry.admin_text ?? '',
      user_name: enquiry.user_name,
      query: enquiry.query,
    });

  const remove = () =>
    confirmDestructive(
      'Delete enquiry?',
      'This will permanently delete the enquiry and any attachment.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteEnquiry(tab, enquiry.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
          setDeleting(false);
        }
      },
    );

  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      AppAlert.alert('Error', 'Unable to open this file on this device.');
    }
  };

  const file = enquiry.image_url;
  const pdf = !!file && isPdfUrl(file);

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          deleting ? (
            <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
          ) : (
            <HeaderIconButton icon="trash-outline" onPress={remove} />
          )
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={docStyles.scroll}>
        {/* When it came in and where it stands, then the topic */}
        <View>
          <View style={s.metaLine}>
            {!!enquiry.created_at && <Text style={s.dateText}>{when(enquiry.created_at)}</Text>}
            {website ? (
              <Text style={s.dateText}>From the school website</Text>
            ) : (
              <View style={s.status}>
                <View style={[s.dot, { backgroundColor: color }]} />
                <Text style={[s.statusText, { color }]}>{replied ? 'Replied' : 'Pending'}</Text>
              </View>
            )}
          </View>
          <Text style={s.title}>{enquiry.topic || (website ? 'No subject' : 'No topic')}</Text>
        </View>

        {/* Who sent it */}
        <DocSection title="From">
          <DetailRow label="Name" value={enquiry.user_name || '—'} />
          {website && <DetailRow label="Phone" value={enquiry.phone || '—'} />}
          <DetailRow label="Email" value={enquiry.user_email || '—'} />
          <DetailRow label={website ? 'Received' : 'Sent by'} value={website ? when(enquiry.created_at) : tab === 'student' ? 'Student' : 'Teacher'} last />
        </DocSection>

        {/* The query, with its attachment right under it */}
        <DocSection title={website ? 'Message' : 'Query'}>
          <DocBody>{enquiry.query || '—'}</DocBody>
          {!!file && (
            <View style={s.chips}>
              <TouchableOpacity style={s.chip} activeOpacity={0.7} onPress={() => openFile(file)}>
                <VectorIcon iconSet="Feather" iconName={pdf ? 'file-text' : 'image'} size={14} color={theme.colors.primary} />
                <Text style={s.chipText}>{pdf ? 'PDF' : 'Image'}</Text>
                <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </DocSection>

        {!website && (
          <>
            <View style={s.divider} />
            <DocSection title="School's Reply">
              {replied && !!enquiry.admin_text ? (
                <>
                  <Text style={s.replyMeta}>
                    School Admin{enquiry.replied_at ? ` · ${when(enquiry.replied_at)}` : ''}
                  </Text>
                  <DocBody>{enquiry.admin_text}</DocBody>
                </>
              ) : (
                <Text style={s.muted}>No reply yet.</Text>
              )}
              <View style={s.action}>
                <QuietAction icon="corner-up-left" label={replied ? 'Edit reply' : 'Reply'} onPress={openReply} />
              </View>
            </DocSection>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminEnquiryDetailScreen;

const __mk_s = () => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },
  headBusy: { width: 36 },

  // The date and time with the status right after it, over the topic
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginBottom: 8 },
  dateText: { fontSize: 13, color: theme.colors.textMuted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },

  // Attachment chip
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },

  // Line between the query and the reply
  divider: { height: 1, backgroundColor: theme.colors.border },
  replyMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  action: { marginTop: 18 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
