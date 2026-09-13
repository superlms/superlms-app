import React, { useCallback, useState } from 'react';
import { Image, Linking, Platform, ScrollView, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getSchoolInfo } from '../../api/authApi';
import { downloadFile } from '../../api/pdfDownload';
import {
  DocHeader,
  DocSection,
  DocList,
  DocBody,
  DocRow,
  DocPeople,
  DocNoData,
  DocSkeleton,
  DocError,
  docStyles,
  DOC_FALLBACK_SHAPE,
  docShapeOf,
  useDocShape,
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

// The text sections that have something in them, in page order.
const sectionsOf = (info: SchoolInfo) =>
  [
    { title: 'About School', content: info.about_school },
    { title: 'Our Vision', content: info.usm_vision },
    { title: 'Our Mission', content: info.usm_mission },
    { title: 'Our Values', content: info.usm_values },
    { title: 'Our Goals', content: info.usm_goals },
    { title: 'Website Info', content: info.website_info },
  ].filter(sec => !!sec.content?.trim());

// "https://www.school.in/" reads "www.school.in"; a bare address opens over https.
const siteLabel = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
const siteHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// The name a document is saved under: its title, with the file's own extension.
const fileNameFor = (doc: any, url: string, i: number) => {
  const ext = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? String(doc.file_type ?? 'pdf');
  const base =
    String(doc.title ?? doc.name ?? `Document ${i + 1}`)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim() || 'Document';
  return `${base}.${ext.toLowerCase()}`;
};

const SchoolInfoScreen = () => {
  const [info, setInfo] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [shape, rememberShape] = useDocShape('school_info', DOC_FALLBACK_SHAPE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: SchoolInfo = await getSchoolInfo();
      setInfo(data);
      // The next loading skeleton takes the shape of these sections.
      rememberShape(docShapeOf(sectionsOf(data ?? ({} as SchoolInfo)).map(sec => ({ head: sec.title, desc: sec.content }))));
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
  }, [rememberShape]);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  // The centred head — logo, name, address, and the phone · email · website
  // line — and its rule; then the school's sections as they read last time,
  // down to the bottom of the screen.
  if (loading) return <DocSkeleton title={TITLE} hero={{ logo: true, lines: 2 }} shape={shape} />;
  if (error || !info) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={load} />;

  const sections = sectionsOf(info);
  const team = info.management_team ?? [];
  const documents = info.documents ?? [];
  const name = info.organization?.name;
  const logo = info.organization?.logo_url;

  const contacts = [
    info.school_mobile && {
      key: 'mobile',
      label: info.school_mobile,
      onPress: () => Linking.openURL(`tel:${info.school_mobile}`),
    },
    info.school_email && {
      key: 'email',
      label: info.school_email,
      onPress: () => Linking.openURL(`mailto:${info.school_email}`),
    },
    info.website_url && {
      key: 'website',
      label: siteLabel(info.website_url),
      onPress: () => Linking.openURL(siteHref(info.website_url)),
    },
  ].filter(Boolean) as { key: string; label: string; onPress: () => void }[];

  const isEmpty =
    sections.length === 0 &&
    team.length === 0 &&
    documents.length === 0 &&
    !info.school_address &&
    contacts.length === 0;

  // Saves the document to the phone's Downloads (on iOS, the share sheet).
  const download = async (doc: any, i: number, url: string) => {
    if (downloading) return;
    setDownloading(String(doc.id ?? i));
    try {
      const fileName = fileNameFor(doc, url, i);
      await downloadFile(url, fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch (e: any) {
      console.log('[SchoolInfo] download ❌', e?.message);
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Logo, name, address, then phone · email · website — centred */}
        <View style={docStyles.hero}>
          {!!logo && <Image source={{ uri: logo }} style={docStyles.heroLogo} resizeMode="contain" />}
          {!!name && <Text style={docStyles.heroName}>{name}</Text>}
          {!!info.school_address && <Text style={docStyles.heroLine}>{info.school_address}</Text>}
          {contacts.length > 0 && (
            <Text style={docStyles.heroLine}>
              {contacts.map((c, i) => (
                <Text key={c.key}>
                  {i > 0 ? '  ·  ' : ''}
                  <Text style={docStyles.heroLink} onPress={c.onPress}>
                    {c.label}
                  </Text>
                </Text>
              ))}
            </Text>
          )}
        </View>

        <View style={docStyles.rule} />

        <View style={docStyles.scroll}>
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
              <DocList>
                <DocPeople people={team} />
              </DocList>
            </DocSection>
          )}

          {documents.length > 0 && (
            <DocSection title="Documents">
              <DocList>
                {documents.map((doc: any, i: number) => {
                  const fileUrl = doc.file_url ?? doc.file_path ?? null;
                  return (
                    <DocRow
                      key={doc.id ?? i}
                      icon="file-text"
                      title={doc.title ?? doc.name ?? `Document ${i + 1}`}
                      sub={doc.file_type ? String(doc.file_type).toUpperCase() : undefined}
                      trailingIcon={fileUrl ? 'download-outline' : undefined}
                      trailingBusy={downloading === String(doc.id ?? i)}
                      onPress={fileUrl ? () => download(doc, i, fileUrl) : undefined}
                      isLast={i === documents.length - 1}
                    />
                  );
                })}
              </DocList>
            </DocSection>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default SchoolInfoScreen;
