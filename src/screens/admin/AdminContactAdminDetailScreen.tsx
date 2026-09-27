import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SuperAdminContact, deleteSuperAdminContact, getSuperAdminContacts } from '../../api/adminContactApi';
import { DetailRow } from '../calendar/calendarUi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { AttachmentChips } from '../notification/inboxUi';
import { Hint, QuietAction, confirmDestructive } from './adminFormUi';

/**
 * One message to the Super Admin, as a student's View Query page draws a
 * query — when it was sent and where it stands, the topic, the message with
 * its attachment as a chip, who sent it, then the Super Admin's reply with
 * its own attachment — as the panel's Message Details has it. Edit, in the
 * header, stays until the Super Admin replies, as on the panel; Delete, at
 * the foot, removes the message and its attachment.
 *
 * Route params: item – from the list, or as the form saved it.
 */

const TITLE = 'Message Details';

const PENDING = '#F59E0B';
const REPLIED = '#10B981';

const when = (iso?: string | null) => (iso ? moment(iso).format('DD MMM YYYY, hh:mm A') : '');

const AdminContactAdminDetailScreen = ({ navigation, route }: any) => {
  const [item, setItem] = useState<SuperAdminContact | null>(route?.params?.item ?? null);
  const [deleting, setDeleting] = useState(false);

  // The form hands back the message as it saved it.
  const passed: SuperAdminContact | undefined = route?.params?.item;
  useEffect(() => {
    if (passed) setItem(passed);
  }, [passed]);

  // What the list passed shows at once; each return here fetches it again, so
  // a reply the Super Admin has sent since shows up.
  const refresh = useCallback(async () => {
    if (!item) return;
    try {
      const res = await getSuperAdminContacts({});
      const found = res.contacts.find(c => c.id === item.id);
      if (found) setItem(found);
    } catch {
      // keep what is shown
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useFocusLoad(refresh);
  const { refreshing, onRefresh } = useRefresh(refresh);

  if (!item) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Message not found</Text>
        </View>
      </View>
    );
  }

  const replied = item.replied;
  const color = replied ? REPLIED : PENDING;

  const remove = () =>
    confirmDestructive(
      'Delete message?',
      'This will permanently delete the message and its attachment. This action cannot be undone.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteSuperAdminContact(item.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          replied ? undefined : (
            <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminContactAdminForm', { item })} />
          )
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* When it was sent and where it stands, then the topic */}
        <View>
          <View style={s.metaLine}>
            {!!item.created_at && <Text style={s.dateText}>{when(item.created_at)}</Text>}
            <View style={s.status}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={[s.statusText, { color }]}>{replied ? 'Replied' : 'Pending reply'}</Text>
            </View>
          </View>
          <Text style={s.title}>{item.topic || 'No topic'}</Text>
        </View>

        {/* The message, with its attachment right under it */}
        <DocSection title="Your Message">
          <DocBody>{item.admin_query || '—'}</DocBody>
          <AttachmentChips items={[{ url: item.image_url, kind: item.image_is_pdf ? 'pdf' : 'image' }]} />
        </DocSection>

        {/* Who sent it, as the panel's view shows */}
        <DocSection title="Sent By">
          <DetailRow label="Name" value={item.user_name || '—'} />
          <DetailRow label="Email" value={item.user_email || '—'} />
          <DetailRow label="Organization" value={item.organization || '—'} last />
        </DocSection>

        <View style={s.divider} />

        <DocSection title="Super Admin's Reply">
          {replied ? (
            <>
              <Text style={s.replyMeta}>Super Admin{item.replied_at ? ` · ${when(item.replied_at)}` : ''}</Text>
              <DocBody>{item.super_admin_text || '—'}</DocBody>
              <AttachmentChips
                items={[
                  { url: item.super_admin_attachment, kind: item.super_admin_attachment_is_pdf ? 'pdf' : 'image' },
                ]}
              />
            </>
          ) : (
            <Text style={s.muted}>No reply yet. The Super Admin will get back to you shortly.</Text>
          )}
        </DocSection>

        <View style={s.divider} />
        {replied && <Hint>The Super Admin has replied, so this message can no longer be edited.</Hint>}
        <QuietAction icon="trash-2" label="Delete message" danger busy={deleting} onPress={remove} />
      </ScrollView>
    </View>
  );
};

export default AdminContactAdminDetailScreen;

const __mk_s = () => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },

  // The date and time with the status right after it, over the topic
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginBottom: 8 },
  dateText: { fontSize: 13, color: theme.colors.textMuted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },

  // Line between the message and the reply
  divider: { height: 1, backgroundColor: theme.colors.border },
  replyMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
