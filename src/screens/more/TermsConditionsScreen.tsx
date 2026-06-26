import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getTermsConditions } from '../../api/authApi';
import {
  DocHero,
  DocCard,
  DocBody,
  DocRow,
  DocFooter,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
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

const ACCENT = '#8B5CF6';
const TITLE = 'Terms & Conditions';

const contactCfg = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('email') || k.includes('mail')) return { icon: 'mail', bg: '#3B82F6', action: (v: string) => Linking.openURL(`mailto:${v}`) };
  if (k.includes('phone') || k.includes('mobile')) return { icon: 'phone', bg: '#A78BFA', action: (v: string) => Linking.openURL(`tel:${v}`) };
  return { icon: 'info', bg: '#10B981', action: undefined as undefined | ((v: string) => void) };
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

  if (loading) return <DocLoading title={TITLE} />;
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const { metadata, platform_logo, platform_name, company_name, company_cin, last_updated } = data;
  const sections = metadata?.sections ?? [];
  const files = metadata?.files ?? [];
  const additional = metadata?.additional_info ?? [];

  const isEmpty = sections.length === 0 && files.length === 0 && additional.length === 0;
  const subtitleParts = [company_name, company_cin ? `CIN: ${company_cin}` : ''].filter(Boolean);
  const formattedDate = last_updated
    ? new Date(last_updated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={docStyles.root}>
      <Header title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <DocHero
          accent={ACCENT}
          logoUrl={platform_logo}
          icon="document-text-outline"
          title={platform_name || TITLE}
          subtitle={subtitleParts.join('  ·  ') || 'Please read these terms carefully before using our services.'}
        />

        {isEmpty ? (
          <DocNoData
            accent={ACCENT}
            icon="document-text-outline"
            title="No Data found"
            subtitle="The terms & conditions haven’t been added yet. Pull down to refresh."
          />
        ) : (
          <>
            {sections.map((sec, i) => (
              <DocCard key={i} accent={ACCENT} label={sec.head}>
                <DocBody>{sec.desc}</DocBody>
              </DocCard>
            ))}

            {files.length > 0 && (
              <DocCard accent={ACCENT} label="Documents">
                {files.map((file, i) => (
                  <DocRow
                    key={i}
                    iconBg="#EF4444"
                    icon="file-text"
                    title={file.title}
                    sub={file.file_type?.toUpperCase()}
                    trailingIcon="download-outline"
                    trailingColor={ACCENT}
                    onPress={() => Linking.openURL(file.file_path)}
                    isLast={i === files.length - 1}
                  />
                ))}
              </DocCard>
            )}

            {additional.length > 0 && (
              <DocCard accent={ACCENT} label="Contact">
                {additional.map((item, i) => {
                  const cfg = contactCfg(item.key);
                  return (
                    <DocRow
                      key={i}
                      iconBg={cfg.bg}
                      icon={cfg.icon}
                      title={item.value}
                      trailingIcon={cfg.action ? 'chevron-forward' : undefined}
                      onPress={cfg.action ? () => cfg.action!(item.value) : undefined}
                      isLast={i === additional.length - 1}
                    />
                  );
                })}
              </DocCard>
            )}
          </>
        )}

        {!!formattedDate && !isEmpty && (
          <DocFooter accent={ACCENT} text={`Last updated: ${formattedDate}`} />
        )}
      </ScrollView>
    </View>
  );
};

export default TermsConditionsScreen;
