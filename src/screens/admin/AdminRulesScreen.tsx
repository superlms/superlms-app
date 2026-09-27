import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { getRulesRegulations } from '../../api/authApi';
import { AdminRules, getAdminRules } from '../../api/adminRulesApi';
import {
  DocHeader,
  DocIntro,
  DocSection,
  DocList,
  DocBody,
  DocRow,
  DocNoData,
  DocSkeleton,
  DocError,
  docStyles,
  lastUpdated,
  DOC_FALLBACK_SHAPE,
  docShapeOf,
  useDocShape,
} from '../more/docUi';

/**
 * The school's Rules & Regulations as its students and teachers read them —
 * each section's heading and text, then the additional information and the
 * attached documents — with the pencil in the header to edit them, as on the
 * web panel. With nothing saved yet the page says so and offers to create
 * them, starting from the standard school rules. A sub-admin without the
 * panel's permission reads them as before, without the pencil.
 */

const TITLE = 'Rules & Regulations';

// "PDF · 0.4 MB"
const fileSub = (type?: string | null, size?: number | null) =>
  [(type || 'pdf').toUpperCase(), size ? `${(size / 1048576).toFixed(1)} MB` : null].filter(Boolean).join(' · ');

const AdminRulesScreen = ({ navigation }: any) => {
  const [data, setData] = useState<AdminRules | null>(null);
  // Only the panel's editor account may edit; others read.
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shape, rememberShape] = useDocShape('rules', DOC_FALLBACK_SHAPE);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAdminRules();
      setData(res);
      setCanEdit(true);
      if (res.exists) rememberShape(docShapeOf(res.sections ?? []));
    } catch (e: any) {
      if (e?.response?.status === 403) {
        // No permission to edit: the rules as students read them.
        setCanEdit(false);
        try {
          const read = await getRulesRegulations();
          setData({ exists: true, using_defaults: false, sections: [], additional_info: [], files: [], last_updated: null, ...read });
        } catch (e2: any) {
          if (e2?.response?.status === 404) {
            setData({ exists: false, using_defaults: false, sections: [], additional_info: [], files: [], last_updated: null });
          } else {
            setError(e2?.response?.data?.message ?? 'Failed to load rules & regulations.');
          }
        }
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load rules & regulations.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'));

  if (loading) {
    return <DocSkeleton title={TITLE} intro={{ meta: true }} shape={shape} lists={[{ rows: 2 }]} />;
  }
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const edit = () => navigation.navigate('AdminRulesForm', { rules: data });

  // Before the first save, the page holds nothing yet (the standard rules
  // wait in the editor).
  const sections = data.exists ? data.sections ?? [] : [];
  const files = data.exists ? data.files ?? [] : [];
  const additional = (data.exists ? data.additional_info ?? [] : []).filter(a => !!a?.key && !!a?.value);
  const isEmpty = sections.length === 0 && files.length === 0 && additional.length === 0;

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={back}
        rightIcon={canEdit ? 'create-outline' : undefined}
        onRightPress={canEdit ? edit : undefined}
      />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isEmpty ? (
          <View>
            <DocNoData
              icon="shield-checkmark-outline"
              title="No Rules & Regulations Yet"
              subtitle={
                canEdit
                  ? "Create your school's rules — you start from the standard school rules."
                  : 'Nothing has been added yet. Pull down to refresh.'
              }
            />
            {canEdit && (
              <TouchableOpacity style={s.emptyAction} onPress={edit} hitSlop={10}>
                <Text style={s.linkText}>Create Rules & Regulations</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <DocIntro meta={lastUpdated(data.last_updated)} />
        )}

        {sections.map((sec, i) => (
          <DocSection key={i} title={sec.head}>
            <DocBody>{sec.desc}</DocBody>
          </DocSection>
        ))}

        {additional.length > 0 && (
          <DocSection title="Additional Information">
            <DocList>
              {additional.map((item, i) => (
                <DocRow
                  key={i}
                  icon="info"
                  title={item.value ?? ''}
                  sub={item.key ?? undefined}
                  isLast={i === additional.length - 1}
                />
              ))}
            </DocList>
          </DocSection>
        )}

        {files.length > 0 && (
          <DocSection title="Documents">
            <DocList>
              {files.map((file, i) => (
                <DocRow
                  key={file.file_path || i}
                  icon="file-text"
                  title={file.title || 'Document'}
                  sub={fileSub(file.file_type, file.file_size)}
                  trailingIcon="download-outline"
                  onPress={() => Linking.openURL(file.file_path)}
                  isLast={i === files.length - 1}
                />
              ))}
            </DocList>
          </DocSection>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminRulesScreen;

const __mk_s = () => StyleSheet.create({
  emptyAction: { alignSelf: 'center', marginTop: 16 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
