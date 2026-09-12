import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  getStudentHomework,
  homeworkErrorMessage,
  type HomeworkItem,
} from '../../api/homeworkApi';
import {
  DateStrip,
  DayHead,
  DoneTick,
  ErrorBox,
  HOMEWORK_DAYS,
  HomeworkRow,
  HomeworkSkeleton,
  tasks,
  todayKey,
} from './homeworkUi';

const TITLE = 'Homework';

// Done is the student's own mark — the school never hears of it — so it is kept
// on the device, per student, so that it survives the app being closed.
const doneStoreKey = (studentId?: number | null) => `homework_done_${studentId ?? 'me'}`;

const StudentHomeworkScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(todayKey);

  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [storeKey, setStoreKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HomeworkItem | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentHomework(HOMEWORK_DAYS);
      setItems(res?.homeworks ?? []);

      const key = doneStoreKey(res?.student_info?.id);
      setStoreKey(key);
      try {
        const raw = await AsyncStorage.getItem(key);
        const saved = raw ? JSON.parse(raw) : [];
        setDoneIds(Array.isArray(saved) ? saved.filter((x: unknown) => typeof x === 'number') : []);
      } catch {
        // An unreadable store only costs the ticks.
      }
    } catch (e: any) {
      console.log('[getStudentHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // One-way: once marked done, it stays done.
  const markDone = () => {
    if (!confirm) return;
    const next = doneIds.includes(confirm.id) ? doneIds : [...doneIds, confirm.id];
    setDoneIds(next);
    if (storeKey) {
      // Only what is still in the fortnight on screen is worth remembering.
      const kept = next.filter(id => items.some(h => h.id === id));
      AsyncStorage.setItem(storeKey, JSON.stringify(kept)).catch(() => {});
    }
    setConfirm(null);
  };

  const marked = useMemo(
    () => new Set(items.map(h => h.assigned_date).filter(Boolean) as string[]),
    [items],
  );

  const dayItems = items.filter(h => h.assigned_date === selected);
  const pending = dayItems.filter(h => !doneIds.includes(h.id));
  const done = dayItems.filter(h => doneIds.includes(h.id));

  const metaFor = (hw: HomeworkItem) =>
    [quietCaps(hw.subject?.name), hw.assigned_by, hw.assigned_time].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <DateStrip selected={selected} onSelect={setSelected} marked={marked} />
      <View style={s.fullDivider} />

      {loading && !refreshing && items.length === 0 ? (
        <HomeworkSkeleton />
      ) : error && items.length === 0 ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, dayItems.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <DayHead
            day={selected}
            line={
              dayItems.length > 0
                ? [tasks(dayItems.length), done.length > 0 ? `${done.length} done` : null]
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
                  meta={metaFor(hw)}
                  leading={<DoneTick done={false} onPress={() => setConfirm(hw)} />}
                  isLast={i === pending.length - 1}
                  onPreviewImage={setPreview}
                />
              ))}

              {done.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, pending.length === 0 && s.sectionTitleFirst]}>Done</Text>
                  {done.map((hw, i) => (
                    <HomeworkRow
                      key={hw.id}
                      hw={hw}
                      meta={metaFor(hw)}
                      leading={<DoneTick done />}
                      done
                      isLast={i === done.length - 1}
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

      {/* Marking done */}
      <Modal transparent visible={!!confirm} animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Mark as done?</Text>
            <Text style={s.modalDesc}>
              “{quietCaps(confirm?.title)}” moves to Done. This can’t be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                onPress={() => setConfirm(null)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} activeOpacity={0.85} onPress={markDone}>
                <Text style={s.modalBtnPrimaryText}>Mark done</Text>
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
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
