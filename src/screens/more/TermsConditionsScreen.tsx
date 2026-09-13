import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getTermsConditions } from '../../api/authApi';
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
  type DocShape,
} from './docUi';

interface Section        { head: string; desc: string; }
interface FileItem       { title: string; file_path: string; file_type: string; }
interface AdditionalInfo { key: string; value: string; }

interface TermsData {
  platform_logo: string;
  platform_name: string;
  company_name: string;
  company_cin: string;
  last_updated: string;
  metadata: {
    sections: Section[];
    files: FileItem[];
    additional_info: AdditionalInfo[];
  };
}

const TITLE = 'Terms & Conditions';

// The terms' opening sections as they read — the heading's and each line's
// length in characters — so the loading page has the terms' own shape.
const SHAPE: DocShape[] = [
  // Introduction
  { head: 12, lines: [57, 24, 103, 50, 29, 0, 459, 0, 230, 0, 225, 0, 97, 32, 67, 49, 115, 94, 119, 171, 52] },
  // Definitions
  { head: 11, lines: [144, 142, 148, 177, 124, 92] },
];

const contactCfg = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('email') || k.includes('mail')) return { icon: 'mail', action: (v: string) => Linking.openURL(`mailto:${v}`) };
  if (k.includes('phone') || k.includes('mobile')) return { icon: 'phone', action: (v: string) => Linking.openURL(`tel:${v}`) };
  return { icon: 'info', action: undefined as undefined | ((v: string) => void) };
};

const TermsConditionsScreen = () => {
  const [data, setData]       = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getTermsConditions());
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setData({} as TermsData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load terms.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  // The platform name ("SUPERLMS"), the company line ("Super Learnings Private
  // Limited") and "Last updated" — there is no platform logo — then the sections.
  if (loading) {
    return (
      <DocSkeleton
        title={TITLE}
        intro={{ title: 8, subtitle: 31, meta: true }}
        shape={SHAPE}
      />
    );
  }
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const { metadata, platform_logo, platform_name, company_name, company_cin, last_updated } = data;
  const sections = metadata?.sections ?? [];
  const files = metadata?.files ?? [];
  const additional = metadata?.additional_info ?? [];

  const isEmpty = sections.length === 0 && files.length === 0 && additional.length === 0;
  const company = [company_name, company_cin ? `CIN: ${company_cin}` : ''].filter(Boolean).join(' · ');

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DocIntro
          logoUrl={platform_logo}
          title={platform_name}
          subtitle={company || undefined}
          meta={isEmpty ? undefined : lastUpdated(last_updated)}
        />

        {isEmpty && (
          <DocNoData
            icon="document-text-outline"
            subtitle="The terms & conditions haven’t been added yet. Pull down to refresh."
          />
        )}

        {sections.map((sec, i) => (
          <DocSection key={i} title={sec.head}>
            <DocBody>{sec.desc}</DocBody>
          </DocSection>
        ))}

        {files.length > 0 && (
          <DocSection title="Documents">
            <DocList>
              {files.map((file, i) => (
                <DocRow
                  key={i}
                  icon="file-text"
                  title={file.title}
                  sub={file.file_type?.toUpperCase()}
                  trailingIcon="download-outline"
                  onPress={() => Linking.openURL(file.file_path)}
                  isLast={i === files.length - 1}
                />
              ))}
            </DocList>
          </DocSection>
        )}

        {additional.length > 0 && (
          <DocSection title="Contact">
            <DocList>
              {additional.map((item, i) => {
                const cfg = contactCfg(item.key);
                return (
                  <DocRow
                    key={i}
                    icon={cfg.icon}
                    title={item.value}
                    trailingIcon={cfg.action ? 'chevron-forward' : undefined}
                    onPress={cfg.action ? () => cfg.action!(item.value) : undefined}
                    isLast={i === additional.length - 1}
                  />
                );
              })}
            </DocList>
          </DocSection>
        )}
      </ScrollView>
    </View>
  );
};

export default TermsConditionsScreen;
