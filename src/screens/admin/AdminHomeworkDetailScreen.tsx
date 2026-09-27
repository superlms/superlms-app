import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import { HomeworkItem, deleteHomework } from '../../api/adminHomeworkApi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { Block, BlockTitle } from './adminProfileUi';
import { classOf, fileTypeOf, setByLabel, subjectLabel } from './adminHomeworkUi';

/**
 * A homework's details — the panel's View: the title, the task in full, who
 * set it (a teacher, and who, or the admin), the class, the subject (or All
 * Subjects), when it was assigned, and its attachment, which opens (an image
 * large, here). The pencil in the header opens the form, and saved, the edit
 * comes back here; Delete, at the foot, takes it and its attachment away and
 * asks first.
 *
 * Route params: item – the homework.
 */

const AdminHomeworkDetailScreen = ({ navigation, route }: any) => {
  const item: HomeworkItem = route?.params?.item;
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  if (!item) return null;

  const kind = fileTypeOf(item.file);
  const assigned = item.created_time_label || item.created_label;

  const openFile = () => {
    if (!item.file) return;
    if (kind === 'image') setPreview(item.file);
    else Linking.openURL(item.file).catch(() => AppAlert.alert('Error', 'Unable to open this attachment.'));
  };

  const remove = () =>
    confirmDestructive('Delete Homework?', 'This removes the homework and its attachment for good.', 'Delete', async () => {
      setDeleting(true);
      try {
        await deleteHomework(item.id);
        navigation.goBack();
      } catch (e) {
        AppAlert.alert('Error Deleting Homework', apiErr(e, 'Please try again.'));
      } finally {
        setDeleting(false);
      }
    });

  return (
    <View style={s.root}>
      <DocHeader
        title="Homework"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton
            icon="create-outline"
            onPress={() => navigation.navigate('AdminHomeworkForm', { item, from: 'detail' })}
          />
        }
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{quietCaps(item.title) || 'No Title'}</Text>
        <Text style={s.meta}>{[subjectLabel(item), classOf(item)].filter(Boolean).join(' · ')}</Text>

        {!!item.description?.trim() && (
          <>
            <BlockTitle>Description</BlockTitle>
            <Text style={s.body}>{item.description.trim()}</Text>
          </>
        )}

        <Block
          title="Details"
          lines={[
            { label: 'Set by', value: setByLabel(item) },
            { label: 'Class', value: classOf(item) },
            { label: 'Subject', value: subjectLabel(item) },
            { label: 'Assigned', value: assigned },
          ]}
        />

        {!!item.file && (
          <>
            <BlockTitle>Attachment</BlockTitle>
            <TouchableOpacity style={s.file} activeOpacity={0.6} onPress={openFile}>
              <VectorIcon
                iconSet="Ionicons"
                iconName={kind === 'image' ? 'image-outline' : 'document-attach-outline'}
                size={18}
                color={theme.colors.primary}
              />
              <Text style={s.fileText}>{kind === 'image' ? 'View image' : 'View Attachment'}</Text>
              <VectorIcon iconSet="Ionicons" iconName="open-outline" size={15} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <View style={s.foot}>
          <QuietAction icon="trash-2" label="Delete homework" danger busy={deleting} onPress={remove} />
        </View>
      </ScrollView>

      <AttachmentPreviewModal
        visible={!!preview}
        accentColor={theme.colors.primary}
        imageUrl={preview ?? undefined}
        onClose={() => setPreview(null)}
      />
    </View>
  );
};

export default AdminHomeworkDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48 },

  title: { fontSize: 19, fontWeight: '600', lineHeight: 25, color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 23, color: theme.colors.textPrimary, marginTop: 8 },

  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fileText: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.primary },

  foot: { marginTop: 28 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
