import React, { useState } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getAboutApp } from '../../api/authApi';
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
  lastUpdated,
  docShapeOf,
  useDocShape,
  useDocumentDownload,
  type DocShape,
} from './docUi';

interface ContentItem  { title: string; description: string; }
interface ContactItem  { type: string; value: string; }
interface SocialItem   { platform: string; url: string; icon: string; }
interface TeamMember   { id: number; name: string; designation: string; photo_url: string | null; url?: string | null; }
interface DocItem      { id?: number; title: string; file_path: string | null; file_type?: string | null; }

interface AboutData {
  heading: string;
  sub_heading: string;
  logo: string;
  company_name?: string | null;
  company_cin?: string | null;
  content: ContentItem[];
  contact_details: ContactItem[];
  address: string;
  core_team: TeamMember[];
  social_media: SocialItem[];
  documents: DocItem[];
  updated_at?: string | null;
}

const TITLE = 'About App';

// The page's opening sections as they read — the heading's and each line's
// length in characters — for the skeleton until the page has loaded once on
// this phone; after that it takes the shape of what loaded.
const SHAPE: DocShape[] = [
  // Who We Are
  { head: 10, lines: [461, 0, 283] },
  // Our Mission
  { head: 11, lines: [254, 0, 244] },
  // Our Story
  { head: 9, lines: [440, 0, 288, 0, 351, 0, 16, 144, 120, 123, 106] },
];

// A website written without its scheme opens over https.
const siteHref = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

const contactCfg = (type: string, value: string) => {
  const t = type.toLowerCase();
  if (t.includes('email') || t.includes('mail')) {
    return { icon: 'mail', trailing: 'chevron-forward', action: () => Linking.openURL(`mailto:${value}`) };
  }
  if (t.includes('mobile') || t.includes('phone')) {
    return { icon: 'phone', trailing: 'chevron-forward', action: () => Linking.openURL(`tel:${value}`) };
  }
  if (t.includes('web') || t.includes('site') || /^(https?:\/\/|www\.)/i.test(value)) {
    return { icon: 'globe', trailing: 'open-outline', action: () => Linking.openURL(siteHref(value)) };
  }
  return { icon: 'map-pin', trailing: undefined, action: undefined };
};

const socialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes('face')) return 'logo-facebook';
  if (p.includes('insta')) return 'logo-instagram';
  if (p.includes('you')) return 'logo-youtube';
  if (p.includes('twit') || p === 'x') return 'logo-twitter';
  if (p.includes('linked')) return 'logo-linkedin';
  if (p.includes('whats')) return 'logo-whatsapp';
  return 'globe-outline';
};

const AboutAppScreen = () => {
  const [info, setInfo]       = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [shape, rememberShape] = useDocShape('about_app', SHAPE);
  const { downloading, download } = useDocumentDownload();

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const data: AboutData = await getAboutApp();
      setInfo(data);
      // The next loading skeleton takes the shape of this content.
      rememberShape(docShapeOf((data?.content ?? []).map(c => ({ head: c.title, desc: c.description }))));
    } catch (e: any) {
      // No record yet → show the "No data found" empty state, not an error.
      if (e?.response?.status === 404) {
        setInfo({} as AboutData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load app info.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  // The big logo, "SUPERLMS", the company name and the sub heading, the rule,
  // then the content line for line down to the bottom of the screen.
  if (loading) {
    return <DocSkeleton title={TITLE} hero={{ logo: true, name: 8, lines: [31, 127] }} shape={shape} />;
  }
  if (error || !info) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const content = info.content ?? [];
  const contacts = info.contact_details ?? [];
  const team = info.core_team ?? [];
  const socials = info.social_media ?? [];
  const documents = info.documents ?? [];
  const address = (info.address ?? '').trim();
  const hasContact = contacts.length > 0 || !!address;
  const hasHead = !!(info.logo || info.heading || info.company_name || info.sub_heading);
  const hasAnyBody =
    content.length > 0 ||
    hasContact ||
    team.length > 0 ||
    socials.length > 0 ||
    documents.length > 0;
  const updated = lastUpdated(info.updated_at);

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {hasHead && (
          <>
            {/* Platform logo, platform name, company name, sub heading — centred */}
            <View style={docStyles.hero}>
              {!!info.logo && (
                <Image source={{ uri: info.logo }} style={docStyles.heroLogo} resizeMode="contain" />
              )}
              {!!info.heading && <Text style={docStyles.heroName}>{info.heading}</Text>}
              {!!info.company_name && <Text style={docStyles.heroLine}>{info.company_name}</Text>}
              {!!info.sub_heading && <Text style={docStyles.heroLine}>{info.sub_heading}</Text>}
            </View>
            <View style={docStyles.rule} />
          </>
        )}

        <View style={docStyles.scroll}>
          {!hasAnyBody && (
            <DocNoData
              icon="information-circle-outline"
              subtitle="The app info hasn’t been added yet. Pull down to refresh."
            />
          )}

          {content.map((item, i) => (
            <DocSection key={i} title={item.title}>
              <DocBody>{item.description}</DocBody>
            </DocSection>
          ))}

          {hasContact && (
            <DocSection title="Contact">
              <DocList>
                {contacts.map((item, i) => {
                  const cfg = contactCfg(item.type, item.value);
                  return (
                    <DocRow
                      key={i}
                      icon={cfg.icon}
                      title={item.value}
                      sub={item.type}
                      trailingIcon={cfg.trailing}
                      onPress={cfg.action}
                      isLast={!address && i === contacts.length - 1}
                    />
                  );
                })}
                {!!address && <DocRow icon="map-pin" title={address} sub="Address" isLast />}
              </DocList>
            </DocSection>
          )}

          {team.length > 0 && (
            <DocSection title="Core Team">
              <DocList>
                <DocPeople
                  people={team}
                  onPressPerson={p => {
                    const link = p.url || p.photo_url;
                    if (link) Linking.openURL(link);
                  }}
                />
              </DocList>
            </DocSection>
          )}

          {documents.length > 0 && (
            <DocSection title="Documents">
              <DocList>
                {documents.map((doc, i) => {
                  const key = String(doc.id ?? i);
                  const title = doc.title || `Document ${i + 1}`;
                  return (
                    <DocRow
                      key={key}
                      icon="file-text"
                      title={title}
                      sub={doc.file_type ? doc.file_type.toUpperCase() : undefined}
                      trailingIcon={doc.file_path ? 'download-outline' : undefined}
                      trailingBusy={downloading === key}
                      onPress={
                        doc.file_path ? () => download(key, title, doc.file_path!, doc.file_type) : undefined
                      }
                      isLast={i === documents.length - 1}
                    />
                  );
                })}
              </DocList>
            </DocSection>
          )}

          {socials.length > 0 && (
            <DocSection title="Follow Us">
              <DocList>
                {socials.map((item, i) => (
                  <DocRow
                    key={i}
                    iconSet="Ionicons"
                    icon={socialIcon(item.platform)}
                    title={item.platform}
                    trailingIcon="open-outline"
                    onPress={() => Linking.openURL(item.url)}
                    isLast={i === socials.length - 1}
                  />
                ))}
              </DocList>
            </DocSection>
          )}

          {hasAnyBody && !!updated && <Text style={docStyles.footnote}>{updated}</Text>}
        </View>
      </ScrollView>
    </View>
  );
};

export default AboutAppScreen;
