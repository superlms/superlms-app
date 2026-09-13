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

  // Platform logo, name, company line and "Last updated"; then the sections.
  if (loading) {
    return (
      <DocSkeleton
        title={TITLE}
        intro={{ logo: true, title: true, subtitle: true, meta: true }}
        sections={3}
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
