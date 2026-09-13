import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getAboutApp } from '../../api/authApi';
import { theme, onThemeChange } from '../../utils/theme';
import {
  DocHeader,
  DocIntro,
  DocSection,
  DocList,
  DocBody,
  DocRow,
  DocPeople,
  DocNoData,
  DocSkeleton,
  DocError,
  docStyles,
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
  content: ContentItem[];
  contact_details: ContactItem[];
  address: string;
  core_team: TeamMember[];
  social_media: SocialItem[];
  documents: DocItem[];
}

const TITLE = 'About App';

const contactCfg = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('email') || t.includes('mail')) return { icon: 'mail', action: (v: string) => Linking.openURL(`mailto:${v}`) };
  if (t.includes('mobile') || t.includes('phone')) return { icon: 'phone', action: (v: string) => Linking.openURL(`tel:${v}`) };
  return { icon: 'map-pin', action: undefined as undefined | ((v: string) => void) };
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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setInfo(await getAboutApp());
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

  // Logo, name and tagline; a couple of sections; then the contact list.
  if (loading) {
    return (
      <DocSkeleton
        title={TITLE}
        intro={{ logo: true, title: true, subtitle: true }}
        sections={2}
        lists={[{ rows: 3 }]}
      />
    );
  }
  if (error || !info) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const content = info.content ?? [];
  const contacts = info.contact_details ?? [];
  const team = info.core_team ?? [];
  const socials = info.social_media ?? [];
  const documents = info.documents ?? [];
  const address = (info.address ?? '').trim();
  const hasContact = contacts.length > 0 || !!address;
  const hasAnyBody =
    content.length > 0 ||
    hasContact ||
    team.length > 0 ||
    socials.length > 0 ||
    documents.length > 0;

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DocIntro logoUrl={info.logo} title={info.heading} subtitle={info.sub_heading} />

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
                const cfg = contactCfg(item.type);
                return (
                  <DocRow
                    key={i}
                    icon={cfg.icon}
                    title={item.value}
                    sub={item.type}
                    trailingIcon={cfg.action ? 'chevron-forward' : undefined}
                    onPress={cfg.action ? () => cfg.action!(item.value) : undefined}
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
              {documents.map((doc, i) => (
                <DocRow
                  key={doc.id ?? i}
                  icon="file-text"
                  title={doc.title || `Document ${i + 1}`}
                  sub={doc.file_type ? doc.file_type.toUpperCase() : undefined}
                  trailingIcon={doc.file_path ? 'download-outline' : undefined}
                  onPress={doc.file_path ? () => Linking.openURL(doc.file_path!) : undefined}
                  isLast={i === documents.length - 1}
                />
              ))}
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

        {hasAnyBody && (
          <Text style={cs.copyright}>© {new Date().getFullYear()} · All rights reserved</Text>
        )}
      </ScrollView>
    </View>
  );
};

export default AboutAppScreen;

const __mk_cs = () => StyleSheet.create({
  copyright: { textAlign: 'center', fontSize: 12, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let cs = __mk_cs();
onThemeChange(() => { cs = __mk_cs(); });
