import React, { useState } from 'react';
import {
  Alert,
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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentContactAdmin, teacherContactAdmin } from '../../api/contactApi';

const ContactSchoolScreen = ({ navigation }: any) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; uri: string; type?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('student');
  const [successVisible, setSuccessVisible] = useState(false);

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

  return (
    <View style={s.root}>
      <Header title="Contact School" onBackPress={() => navigation.goBack()} />

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
          {/* ── Query form card ── */}
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="school-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Raise a Query</Text>
                  <Text style={s.cardSubtitle}>We'll get back to you shortly</Text>
                </View>
              </View>

              <Text style={s.label}>Subject</Text>
              <TextInput
                style={s.input}
                placeholder="Write your subject here..."
                placeholderTextColor={theme.colors.textMuted}
                value={subject}
                onChangeText={setSubject}
                returnKeyType="next"
              />

              <Text style={s.label}>Message</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Enter your query here..."
                placeholderTextColor={theme.colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />

              {/* Attachment */}
              {attachment ? (
                <View style={s.attachPreview}>
                  <View style={s.attachIconBox}>
                    <VectorIcon
                      iconSet="Feather"
                      iconName="paperclip"
                      size={14}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.attachLabel}>Attachment</Text>
                    <Text style={s.attachName} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAttachment(null)}
                    activeOpacity={0.8}
                  >
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="close-circle"
                      size={22}
                      color={theme.colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.attachBtn}
                  onPress={handlePickAttachment}
                  activeOpacity={0.8}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="attach"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text style={s.attachBtnText}>Attach a file (optional)</Text>
                </TouchableOpacity>
              )}

              {/* Submit */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmit}
                style={s.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="send"
                      size={15}
                      color="#fff"
                    />
                    <Text style={s.submitText}>Submit Query</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Query submitted modal (logout style) ── */}
      <Modal
        transparent
        visible={successVisible}
        animationType="fade"
        onRequestClose={() => {
          setSuccessVisible(false);
          navigation.goBack();
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="checkmark-circle-outline"
                size={28}
                color="#16A34A"
              />
            </View>

            <Text style={s.modalTitle}>Query Submitted</Text>
            <Text style={s.modalDesc}>
              Your query has been submitted successfully. We will get back to
              you shortly.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnConfirm]}
                activeOpacity={0.9}
                onPress={() => {
                  setSuccessVisible(false);
                  navigation.goBack();
                }}
              >
                <Text style={[s.modalBtnText, s.modalBtnConfirmText]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ContactSchoolScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 40 },

  // Card (shared template)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Form (shared template)
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  inputMulti: { minHeight: 120 },

  // Attachment
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    marginBottom: 8,
  },
  attachBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  attachPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  attachIconBox: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  attachName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 13,
    marginTop: 4,
  },
  submitText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Success modal (logout style)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalDesc: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnConfirm: {
    backgroundColor: '#16A34A',
  },
  modalBtnConfirmText: {
    color: theme.colors.white,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
