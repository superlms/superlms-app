import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getSchoolInfo } from '../../api/authApi';
import {
  DocIntro,
  DocSection,
  DocBody,
  DocRow,
  DocPeople,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
} from './docUi';

interface ManagementMember {
  id: number;
  name: string;
  designation: string;
  photo_url: string | null;
  sort_order: number;
}

interface SchoolInfo {
  about_school: string;
  website_info: string;
  website_url: string;
  usm_vision: string;
  usm_mission: string;
  usm_values: string;
  usm_goals: string;
  school_mobile: string;
  school_email: string;
  school_address: string;
  management_team: ManagementMember[];
  documents: any[];
  organization: { logo_url: string; name: string };
}

const TITLE = 'School Info';

const SchoolInfoScreen = () => {
  const [info, setInfo] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInfo(await getSchoolInfo());
      setError('');
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setInfo({} as SchoolInfo);
        setError('');
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load school info.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  if (loading) return <DocLoading title={TITLE} />;
  if (error || !info) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={load} />;

  const sections: { title: string; content: string }[] = [
    { title: 'About School', content: info.about_school },
    { title: 'Our Vision', content: info.usm_vision },
    { title: 'Our Mission', content: info.usm_mission },
    { title: 'Our Values', content: info.usm_values },
    { title: 'Our Goals', content: info.usm_goals },
    { title: 'Website Info', content: info.website_info },
  ].filter(sec => !!sec.content?.trim());

  const team = info.management_team ?? [];
  const documents = info.documents ?? [];
  const hasContact = !!(info.website_url || info.school_mobile || info.school_email || info.school_address);
  const isEmpty =
    sections.length === 0 && team.length === 0 && documents.length === 0 && !hasContact;

  return (
    <View style={docStyles.root}>
      <Header title={TITLE} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DocIntro logoUrl={info.organization?.logo_url} title={info.organization?.name} />

        {isEmpty && (
          <DocNoData
            icon="school-outline"
            subtitle="The school info hasn’t been added yet. Pull down to refresh."
          />
        )}

        {sections.map((sec, i) => (
          <DocSection key={i} title={sec.title}>
            <DocBody>{sec.content}</DocBody>
          </DocSection>
        ))}

        {team.length > 0 && (
          <DocSection title="School Management">
            <DocPeople people={team} />
          </DocSection>
        )}

        {documents.length > 0 && (
          <DocSection title="Documents">
            {documents.map((doc: any, i: number) => {
              const fileUrl = doc.file_url ?? doc.file_path ?? null;
              return (
                <DocRow
                  key={doc.id ?? i}
                  icon="file-text"
                  title={doc.title ?? doc.name ?? `Document ${i + 1}`}
                  sub={doc.file_type ? String(doc.file_type).toUpperCase() : undefined}
                  trailingIcon={fileUrl ? 'download-outline' : undefined}
                  onPress={fileUrl ? () => Linking.openURL(fileUrl) : undefined}
                  isLast={i === documents.length - 1}
                />
              );
            })}
          </DocSection>
        )}

        {hasContact && (
          <DocSection title="Contact">
            {!!info.website_url && (
              <DocRow
                icon="globe"
                title="Visit website"
                trailingIcon="open-outline"
                onPress={() => Linking.openURL(info.website_url)}
                isLast={!info.school_mobile && !info.school_email && !info.school_address}
              />
            )}
            {!!info.school_mobile && (
              <DocRow
                icon="phone"
                title={info.school_mobile}
                sub="Phone"
                trailingIcon="chevron-forward"
                onPress={() => Linking.openURL(`tel:${info.school_mobile}`)}
                isLast={!info.school_email && !info.school_address}
              />
            )}
            {!!info.school_email && (
              <DocRow
                icon="mail"
                title={info.school_email}
                sub="Email"
                trailingIcon="chevron-forward"
                onPress={() => Linking.openURL(`mailto:${info.school_email}`)}
                isLast={!info.school_address}
              />
            )}
            {!!info.school_address && (
              <DocRow icon="map-pin" title={info.school_address} sub="Address" isLast />
            )}
          </DocSection>
        )}
      </ScrollView>
    </View>
  );
};

export default SchoolInfoScreen;
