import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import {
  DOC_FALLBACK_SHAPE,
  DocBody,
  DocError,
  DocHeader,
  DocList,
  DocPeople,
  DocRow,
  DocSection,
  DocSkeleton,
  docStyles,
} from '../more/docUi';
import { stampOf, useSchoolProfile } from './adminProfileUi';

/**
 * School Profile — the panel's School Info tab, opened from Profile, read as
 * the student's School Info: About, Vision, Mission, Values, Goals and the
 * school's own sections as headed paragraphs, the management team, the
 * documents (a tap opens one) and when it was last saved. The pencil in the
 * header opens the form (the panel's Edit); with nothing added yet, the page
 * says so and Add School Info opens it.
 */

const TITLE = 'School Profile';

const AdminSchoolInfoScreen = ({ navigation }: any) => {
  const { profile, loading, error, load, refreshing, onRefresh } = useSchoolProfile();

  if (loading && !profile) return <DocSkeleton title={TITLE} shape={DOC_FALLBACK_SHAPE} />;
  if (error && !profile) return <DocError title={TITLE} message={error} onRetry={load} />;
  if (!profile) return null;

  const info = profile.school_info ?? {};
  const team = profile.management_team ?? [];
  const docs = profile.documents ?? [];

  // The panel's paragraph cards: About and the four values, then the school's
  // own sections — each only when it has something.
  const paragraphs = [
    { title: 'About Our School', body: info.about_school },
    { title: 'Vision', body: info.usm_vision },
    { title: 'Mission', body: info.usm_mission },
    { title: 'Values', body: info.usm_values },
    { title: 'Goals', body: info.usm_goals },
  ].filter(p => !!p.body?.trim());
  (info.custom_sections ?? []).forEach(cs => {
    if (cs?.title?.trim() || cs?.description?.trim()) paragraphs.push({ title: cs.title ?? '', body: cs.description ?? '' });
  });
  const websiteInfo = (info.website_info || '').trim();

  const hasAnyInfo = paragraphs.length > 0 || team.length > 0 || docs.length > 0 || !!websiteInfo;
  const updated = stampOf(info.updated_at);
  const openForm = () => navigation.navigate('AdminSchoolInfoForm');

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={hasAnyInfo ? <HeaderIconButton icon="create-outline" onPress={openForm} /> : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!hasAnyInfo ? (
          // The panel's "no information" state, with its Add button.
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <VectorIcon iconSet="Ionicons" iconName="information-circle-outline" size={34} color={theme.colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No School Info Yet</Text>
            <Text style={s.emptySub}>
              Add your school's about, vision, management team and documents to bring this profile to life.
            </Text>
            <TouchableOpacity style={s.addBtn} activeOpacity={0.85} onPress={openForm}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.white} />
              <Text style={s.addBtnText}>Add School Info</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={docStyles.scroll}>
            {paragraphs.map((p, i) => (
              <DocSection key={i} title={p.title?.trim() || undefined}>
                {!!p.body?.trim() && <DocBody>{p.body.trim()}</DocBody>}
              </DocSection>
            ))}

            {!!websiteInfo && (
              <DocSection title="Website">
                <DocBody>{websiteInfo}</DocBody>
              </DocSection>
            )}

            {team.length > 0 && (
              <DocSection title="Management Team">
                <DocList>
                  <DocPeople
                    people={team.map(m => ({ id: m.id, name: m.name, designation: m.designation, photo_url: m.photo_path ?? null }))}
                  />
                </DocList>
              </DocSection>
            )}

            {docs.length > 0 && (
              <DocSection title="School Documents">
                <DocList>
                  {docs.map((d, i) => (
                    <DocRow
                      key={d.id}
                      icon="file-text"
                      title={d.title}
                      sub={d.file_type ? String(d.file_type).toUpperCase() : undefined}
                      trailingIcon="open-outline"
                      onPress={() => Linking.openURL(d.file_path).catch(() => {})}
                      isLast={i === docs.length - 1}
                    />
                  ))}
                </DocList>
              </DocSection>
            )}

            {!!updated && <Text style={docStyles.footnote}>Last updated {updated}</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminSchoolInfoScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // No school info yet
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 32, paddingBottom: 48 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16 },
  emptySub: { fontSize: 13, lineHeight: 19, color: theme.colors.textMuted, textAlign: 'center', marginTop: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
