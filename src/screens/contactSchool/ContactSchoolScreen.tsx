import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentContactAdmin, teacherContactAdmin } from '../../api/contactApi';
import { DocHeader } from '../more/docUi';
import { AppDialog, AppAlert } from '../../components/AppDialog';

// Attachments show only a file-type icon and label, never the file name.
const fileTypeIcon = (mime?: string) => {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'file-text';
  return 'file';
};

const fileTypeLabel = (mime?: string, name?: string) => {
  if (mime?.startsWith('image/')) return 'Image';
  if (mime?.startsWith('video/')) return 'Video';
  if (mime === 'application/pdf') return 'PDF';
  const ext = name?.includes('.') ? name.split('.').pop() : undefined;
  return ext ? ext.toUpperCase() : 'File';
};

const ContactSchoolScreen = ({ navigation }: any) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; uri: string; type?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('student');
  const [successVisible, setSuccessVisible] = useState(false);
  const [focused, setFocused] = useState<'subject' | 'message' | null>(null);
  const subjectRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  // TODO: wire to an API loader if this screen gains server data.
  const { refreshing, onRefresh } = useRefresh(() => {});

  // Load role on mount
  React.useEffect(() => {
    loadRole();
  }, []);

  const loadRole = async () => {
    try {
      const userRole = await AsyncStorage.getItem('user_role');
      if (userRole) {
        setRole(userRole);
      }
    } catch (error) {
      console.error('Error loading role:', error);
    }
  };

  const requestAndroidPermission = async (): Promise<boolean> => {
    // Android 13+ (API 33+): image picker uses system photo picker — no permission needed
    // @ts-ignore
    if (Platform.Version >= 33) return true;
    // Android 10–12: no storage permission needed for media picker
    // @ts-ignore
    if (Platform.Version >= 29) return true;
    // Android 9 and below: needs READ_EXTERNAL_STORAGE
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'App needs access to your storage to attach files.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handlePickAttachment = async () => {
    if (Platform.OS === 'android') {
      const granted = await requestAndroidPermission();
      if (!granted) {
        AppAlert.alert(
          'Permission Denied',
          'Storage permission is required to attach files. Please enable it in Settings.',
          [{ text: 'OK' }],
        );
        return;
      }
    }
    // iOS: react-native-image-picker handles NSPhotoLibraryUsageDescription automatically
    launchImageLibrary(
      { mediaType: 'mixed', quality: 0.8 },
      response => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (asset) {
          setAttachment({
            name: asset.fileName ?? 'attachment',
            uri: asset.uri ?? '',
            type: asset.type ?? 'image/jpeg',
          });
        }
      },
    );
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      AppAlert.alert('Missing Subject', 'Please enter a subject for your query.');
      return;
    }
    if (!message.trim()) {
      AppAlert.alert('Missing Message', 'Please enter your query message.');
      return;
    }

    setLoading(true);
    try {
      console.log('[ContactSchoolScreen] Submitting as role:', role);

      let response;
      if (role === 'student') {
        response = await studentContactAdmin({
          subject: subject.trim(),
          message: message.trim(),
          attachment: attachment || undefined,
        });
      } else {
        response = await teacherContactAdmin({
          subject: subject.trim(),
          message: message.trim(),
          attachment: attachment || undefined,
        });
      }

      console.log('[ContactSchoolScreen] Submit success:', response);

      setSuccessVisible(true);
    } catch (err: any) {
      console.error('[ContactSchoolScreen] Submit error:', err?.response?.data || err.message);

      let errorMessage = 'Failed to submit query. Please try again.';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      AppAlert.alert('Submission Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const closeSuccess = () => {
    setSuccessVisible(false);
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      {/* The clip icon in the header attaches a file */}
      <DocHeader
        title="Contact School"
        onBackPress={() => navigation.goBack()}
        rightIcon="attach"
        onRightPress={handlePickAttachment}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Subject card — tap anywhere on it to type */}
          <Pressable
            style={[s.field, focused === 'subject' && s.fieldFocused]}
            onPress={() => subjectRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Subject</Text>
            <TextInput
              ref={subjectRef}
              style={s.fieldInput}
              placeholder="Write your subject here..."
              placeholderTextColor={theme.colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              onFocus={() => setFocused('subject')}
              onBlur={() => setFocused(null)}
              multiline
              submitBehavior="submit"
              textAlignVertical="top"
              returnKeyType="next"
              onSubmitEditing={() => messageRef.current?.focus()}
            />
          </Pressable>

          {/* Message card */}
          <Pressable
            style={[s.field, focused === 'message' && s.fieldFocused]}
            onPress={() => messageRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Message</Text>
            <TextInput
              ref={messageRef}
              style={[s.fieldInput, s.fieldInputMulti]}
              placeholder="Enter your query here..."
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              onFocus={() => setFocused('message')}
              onBlur={() => setFocused(null)}
              multiline
              textAlignVertical="top"
            />
          </Pressable>

          {/* Attached file as a chip, or a quiet hint */}
          {attachment ? (
            <View style={s.chips}>
              <View style={s.chip}>
                <VectorIcon iconSet="Feather" iconName={fileTypeIcon(attachment.type)} size={14} color={theme.colors.primary} />
                <Text style={s.chipText} numberOfLines={1}>
                  {fileTypeLabel(attachment.type, attachment.name)}
                </Text>
                <TouchableOpacity onPress={() => setAttachment(null)} hitSlop={8}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={s.hint}>
              Optional: attach a file with the clip icon at the top.
            </Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            style={[s.submitBtn, loading && s.submitBtnBusy]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>Submit Query</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Query submitted */}
      <AppDialog
        visible={successVisible}
        title="Query submitted"
        message="Your query has been submitted successfully. We will get back to you shortly."
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default ContactSchoolScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  // Input cards — label inside, borderless input underneath
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  fieldInputMulti: { minHeight: 120 },

  // Attachment chip
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  hint: { fontSize: 12, color: theme.colors.textMuted },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
