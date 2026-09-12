import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
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

// Short, human label for the picked file's type.
const attachmentKind = (type?: string) => {
  if (!type) return 'File';
  if (type.startsWith('image/')) return 'Image';
  if (type.startsWith('video/')) return 'Video';
  if (type === 'application/pdf') return 'PDF';
  return 'File';
};

const ContactSchoolScreen = ({ navigation }: any) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; uri: string; type?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('student');
  const [successVisible, setSuccessVisible] = useState(false);
  const [focused, setFocused] = useState<'subject' | 'message' | null>(null);

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
        Alert.alert(
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
      Alert.alert('Missing Subject', 'Please enter a subject for your query.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter your query message.');
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

      Alert.alert('Submission Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const closeSuccess = () => {
    setSuccessVisible(false);
    navigation.goBack();
  };

  const isImage = !!attachment?.type?.startsWith('image/');

  return (
    <View style={s.root}>
      <DocHeader title="Contact School" onBackPress={() => navigation.goBack()} />

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
          <View>
            <Text style={s.label}>Subject</Text>
            <TextInput
              style={[s.input, focused === 'subject' && s.inputFocused]}
              placeholder="Write your subject here..."
              placeholderTextColor={theme.colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              onFocus={() => setFocused('subject')}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
            />
          </View>

          <View>
            <Text style={s.label}>Message</Text>
            <TextInput
              style={[s.input, s.inputMulti, focused === 'message' && s.inputFocused]}
              placeholder="Enter your query here..."
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              onFocus={() => setFocused('message')}
              onBlur={() => setFocused(null)}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Attachment */}
          <View>
            <Text style={s.label}>Attachment</Text>
            {attachment ? (
              <View style={s.attachCard}>
                {isImage ? (
                  <Image source={{ uri: attachment.uri }} style={s.attachThumb} />
                ) : (
                  <View style={s.attachIcon}>
                    <VectorIcon iconSet="Feather" iconName="file" size={18} color={theme.colors.primary} />
                  </View>
                )}
                <View style={s.attachText}>
                  <Text style={s.attachTitle} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text style={s.attachMeta}>{attachmentKind(attachment.type)}</Text>
                </View>
                <TouchableOpacity
                  style={s.attachRemove}
                  onPress={() => setAttachment(null)}
                  hitSlop={8}
                >
                  <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.attachPicker}
                onPress={handlePickAttachment}
                activeOpacity={0.7}
              >
                <View style={s.attachIcon}>
                  <VectorIcon iconSet="Feather" iconName="paperclip" size={18} color={theme.colors.primary} />
                </View>
                <View style={s.attachText}>
                  <Text style={s.attachTitle}>Attach a file</Text>
                  <Text style={s.attachMeta}>Optional · from your gallery</Text>
                </View>
                <VectorIcon iconSet="Ionicons" iconName="add" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

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
      <Modal
        transparent
        visible={successVisible}
        animationType="fade"
        onRequestClose={closeSuccess}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <VectorIcon iconSet="Ionicons" iconName="checkmark-circle-outline" size={44} color={theme.colors.success} />
            <Text style={s.modalTitle}>Query submitted</Text>
            <Text style={s.modalDesc}>
              Your query has been submitted successfully. We will get back to
              you shortly.
            </Text>
            <TouchableOpacity style={s.modalBtn} activeOpacity={0.85} onPress={closeSuccess}>
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ContactSchoolScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 18 },

  // Fields
  label: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputFocused: { borderColor: theme.colors.primary },
  inputMulti: { minHeight: 140 },

  // Attachment — dashed picker when empty, solid card once a file is picked
  attachPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.textMuted,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  attachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  attachIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachThumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
  },
  attachText: { flex: 1 },
  attachTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  attachMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  attachRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
  },
  modalDesc: {
    marginTop: 6,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    marginTop: 22,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
