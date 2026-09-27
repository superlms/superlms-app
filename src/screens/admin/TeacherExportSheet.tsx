import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { exportTeachers } from '../../api/adminTeacherApi';

/**
 * Export, as the panel asks it — in the sheet Export Students uses: Excel or
 * PDF, for every teacher. Export saves the file to the phone's Downloads.
 */

type Format = 'xlsx' | 'pdf';

const FORMATS: { key: Format; title: string; sub: string; icon: string }[] = [
  { key: 'xlsx', title: 'Excel', sub: 'Every field, subjects, bank details and attendance', icon: 'grid-outline' },
  { key: 'pdf', title: 'PDF', sub: 'A record card per teacher, attendance by month', icon: 'document-text-outline' },
];

const TeacherExportSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const contextInsets = useSafeAreaInsets();
  const insets = {
    top: Math.max(contextInsets.top, initialWindowMetrics?.insets.top ?? 0),
    bottom: Math.max(contextInsets.bottom, initialWindowMetrics?.insets.bottom ?? 0),
  };

  const [format, setFormat] = useState<Format>('xlsx');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const name = await exportTeachers({ format, fileName: `teachers_${moment().format('YYYY-MM-DD')}` });
      onClose();
      AppAlert.alert('Exported', `${name} is saved in your Downloads.`);
    } catch (e) {
      AppAlert.alert('Export failed', apiErr(e, 'Could not export the teachers.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.statusStrip, { height: insets.top }]} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>Export Teachers</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.6}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <Text style={s.label}>FORMAT</Text>
            {FORMATS.map((f, i) => {
              const on = format === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[s.row, i < FORMATS.length - 1 && s.rowDivider]}
                  activeOpacity={0.6}
                  onPress={() => setFormat(f.key)}
                >
                  <View style={[s.tile, on && s.tileOn]}>
                    <VectorIcon iconSet="Ionicons" iconName={f.icon} size={18} color={on ? theme.colors.primary : theme.colors.textSecondary} />
                  </View>
                  <View style={s.rowMain}>
                    <Text style={[s.rowTitle, on && s.rowTitleOn]} numberOfLines={1}>{f.title}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{f.sub}</Text>
                  </View>
                  {on ? (
                    <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={22} color={theme.colors.primary} />
                  ) : (
                    <View style={s.radio} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={[s.exportBtn, busy && s.exportBusy]} activeOpacity={0.85} onPress={run} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <>
                  <VectorIcon iconSet="Ionicons" iconName="download-outline" size={18} color={theme.colors.white} />
                  <Text style={s.exportText}>Export {format === 'pdf' ? 'PDF' : 'Excel'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TeacherExportSheet;

const __mk_s = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.colors.statusBar },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginTop: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 4, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  tileOn: { backgroundColor: theme.colors.primaryLight },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowTitleOn: { fontWeight: '600' },
  rowSub: { fontSize: 12, color: theme.colors.textMuted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.border },

  exportBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  exportBusy: { opacity: 0.7 },
  exportText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
