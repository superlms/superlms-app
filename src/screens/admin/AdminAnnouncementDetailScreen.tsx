import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncements,
} from '../../api/adminContentApi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { AttachmentChips, INK, QUIET } from '../notification/inboxUi';
import { DetailRow } from '../calendar/calendarUi';
import { QuietAction, confirmDestructive } from './adminFormUi';

/**
 * One announcement, as a student's View Announcement page draws it — when it
 * was posted, the title, the description with its files, and who posted it —
 * with what the admin panel's view adds: who it went to. The pencil opens it
 * to edit; Delete removes it, and its files, for everyone.
 */

const TITLE = 'View Announcement';

const SENT_TO: Record<string, string> = {
  all: 'Students and teachers',
  user: 'Students',
  teacher: 'Teachers',
};

const AdminAnnouncementDetailScreen = ({ navigation, route }: any) => {
  const [item, setItem] = useState<AdminAnnouncement | null>(route?.params?.item ?? null);
  const [deleting, setDeleting] = useState(false);
  const id: number | undefined = item?.id ?? route?.params?.id;

  // What the list passed shows at once; coming back (from Edit) refreshes it
  // in place. The list is the only source for one announcement.
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getAdminAnnouncements();
      const found = res.announcements.find(a => a.id === id);
      if (found) setItem(found);
    } catch {
      // keep what was passed
    }
  }, [id]);

  useFocusLoad(refresh);
  const { refreshing, onRefresh } = useRefresh(refresh);

  const remove = () =>
    confirmDestructive(
      'Delete announcement?',
      'This cannot be undone. The announcement and all its attachments will be permanently removed.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteAnnouncement(id!);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  if (!item) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Announcement not found</Text>
        </View>
      </View>
    );
  }

  const dateLabel = item.created_at ? moment(item.created_at).format('DD MMM YYYY, hh:mm A') : '';
  const poster = item.creator_name || 'Admin';

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton
            icon="create-outline"
            onPress={() => navigation.navigate('AdminAnnouncementForm', { item })}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* When it was posted, then the title */}
        <View>
          {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}
          <Text style={s.title}>{item.announcement_name}</Text>
        </View>

        {/* Description, with any attachments right under it */}
        <DocSection title="Description">
          <DocBody>{item.announcement_content || 'No description available'}</DocBody>
          <AttachmentChips
            // A tap saves the file to Downloads, named after the announcement
            downloadAs={item.announcement_name}
            items={[
              { url: item.image_url, kind: 'image' },
              { url: item.pdf_url, kind: 'pdf' },
            ]}
          />
        </DocSection>

        {/* Who it went to */}
        <DocSection title="Audience">
          <DetailRow label="Sent to" value={SENT_TO[item.type] ?? SENT_TO.all} last={item.type !== 'user'} />
          {item.type === 'user' && (
            <DetailRow label="Class" value={item.standard_name || 'All classes'} last />
          )}
        </DocSection>

        {/* Posted by */}
        <View style={s.divider} />
        <DocSection title="Posted By">
          <View style={s.creatorRow}>
            <View style={[s.creatorAvatar, s.creatorAvatarFallback]}>
              <Text style={s.creatorInitial}>{poster.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.creatorInfo}>
              <Text style={s.creatorName}>{poster}</Text>
              {!!dateLabel && <Text style={s.creatorSub}>Posted {dateLabel}</Text>}
            </View>
          </View>
        </DocSection>

        <View style={s.divider} />
        <QuietAction icon="trash-2" label="Delete announcement" danger busy={deleting} onPress={remove} />
      </ScrollView>
    </View>
  );
};

export default AdminAnnouncementDetailScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted },

  // Date + title
  dateText: { fontSize: 12, color: QUIET, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: INK, lineHeight: 27 },

  divider: { height: 1, backgroundColor: theme.colors.border },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: INK },
  creatorSub: { fontSize: 13, color: QUIET, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
