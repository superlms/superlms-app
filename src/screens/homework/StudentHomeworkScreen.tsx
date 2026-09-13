import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  getStudentHomework,
  homeworkErrorMessage,
  markHomeworkComplete,
  type HomeworkItem,
} from '../../api/homeworkApi';
import {
  CompleteTick,
  DateStrip,
  DayHead,
  ErrorBox,
  HOMEWORK_DAYS,
  HomeworkRow,
  HomeworkSkeleton,
  periodLabel,
  tasks,
  todayKey,
} from './homeworkUi';

const TITLE = 'Homework';

// Completing homework used to be kept only on the device. Whatever is still
// there is sent to the school once, then forgotten. Returns the ids it sent.
const sendDeviceCompletions = async (studentId: number | undefined, list: HomeworkItem[]) => {
  const key = `homework_done_${studentId ?? 'me'}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const saved = JSON.parse(raw);
    const ids = (Array.isArray(saved) ? saved : []).filter((id: unknown) =>
      list.some(h => h.id === id && !h.is_completed),
    ) as number[];
    await Promise.all(ids.map(id => markHomeworkComplete(id)));
    await AsyncStorage.removeItem(key);
    return ids;
  } catch {
    // Kept for the next load.
    return [];
  }
};

const StudentHomeworkScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(todayKey);

  const [confirm, setConfirm] = useState<HomeworkItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates the list in place.
  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError(null);
    try {
      const res = await getStudentHomework(HOMEWORK_DAYS);
      const list = res?.homeworks ?? [];
      const sent = await sendDeviceCompletions(res?.student_info?.id, list);
      setItems(list.map(h => (sent.includes(h.id) ? { ...h, is_completed: true } : h)));
    } catch (e: any) {
      console.log('[getStudentHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(load);

  // The school sees it on its Homework Status tab; here it moves to Completed.
  const markComplete = async () => {
    if (!confirm) return;
    const id = confirm.id;
    setSaving(true);
    try {
      await markHomeworkComplete(id);
      setItems(prev => prev.map(h => (h.id === id ? { ...h, is_completed: true } : h)));
      setConfirm(null);
    } catch (e: any) {
      setConfirm(null);
      Alert.alert('Could not mark complete', homeworkErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const marked = useMemo(
    () => new Set(items.map(h => h.assigned_date).filter(Boolean) as string[]),
    [items],
  );

  const dayItems = items.filter(h => h.assigned_date === selected);
  const pending = dayItems.filter(h => !h.is_completed);
  const completed = dayItems.filter(h => h.is_completed);

  // "Mathematics · Ms. Patel"
  const headingFor = (hw: HomeworkItem) =>
    [quietCaps(hw.subject?.name), hw.assigned_by].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <DateStrip selected={selected} onSelect={setSelected} marked={marked} />
      <View style={s.fullDivider} />

      {loading ? (
        <HomeworkSkeleton trailing="tick" />
      ) : error && items.length === 0 ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, dayItems.length === 0 && s.grow]}
          // The skeleton stands in for the spinner.
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          <DayHead
            day={selected}
            line={
              dayItems.length > 0
                ? [tasks(dayItems.length), completed.length > 0 ? `${completed.length} completed` : null]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
          />

          {dayItems.length === 0 ? (
            <DocNoData
              icon="create-outline"
              title="No homework"
              subtitle={
                selected === todayKey()
                  ? 'Nothing has been set for today.'
                  : 'Nothing was set on this day.'
              }
            />
          ) : (
            <>
              {pending.map((hw, i) => (
                <HomeworkRow
                  key={hw.id}
                  hw={hw}
                  period={periodLabel(hw)}
                  heading={headingFor(hw)}
                  trailing={<CompleteTick done={false} onPress={() => setConfirm(hw)} />}
                  isLast={i === pending.length - 1}
                  onPreviewImage={setPreview}
                />
              ))}

              {completed.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, pending.length === 0 && s.sectionTitleFirst]}>Completed</Text>
                  {completed.map((hw, i) => (
                    <HomeworkRow
                      key={hw.id}
                      hw={hw}
                      period={periodLabel(hw)}
                      heading={headingFor(hw)}
                      trailing={<CompleteTick done />}
                      done
                      isLast={i === completed.length - 1}
                      onPreviewImage={setPreview}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Image attachment */}
      <AttachmentPreviewModal
        visible={!!preview}
        accentColor={theme.colors.primary}
        imageUrl={preview ?? undefined}
        onClose={() => setPreview(null)}
      />

      {/* Marking complete */}
      <Modal
        transparent
        visible={!!confirm}
        animationType="fade"
        onRequestClose={() => !saving && setConfirm(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Mark this homework as complete?</Text>
            <Text style={s.modalDesc}>“{quietCaps(confirm?.title)}” moves to Completed.</Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                disabled={saving}
                onPress={() => setConfirm(null)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, saving && s.modalBtnBusy]}
                activeOpacity={0.85}
                disabled={saving}
                onPress={markComplete}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={s.modalBtnPrimaryText}>Mark complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default StudentHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 22, marginBottom: 2 },
  sectionTitleFirst: { marginTop: 10 },

  // Confirm
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
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: { flex: 1, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnPrimary: { backgroundColor: theme.colors.primary },
  modalBtnBusy: { opacity: 0.7 },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
