import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getRulesRegulations } from '../../api/authApi';
import {
  DocIntro,
  DocSection,
  DocBody,
  DocRow,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
  lastUpdated,
} from './docUi';

interface Section      { head: string; desc: string; }
interface FileItem     { title: string; file_path: string; file_type: string; }
interface AdditionalInfo { key: string; value: string; }

interface RulesData {
  sections:        Section[];
  files:           FileItem[];
  additional_info: AdditionalInfo[];
  last_updated:    string;
}

const TITLE = 'Rules & Regulations';

const contactCfg = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('email') || k.includes('mail')) return { icon: 'mail', action: (v: string) => Linking.openURL(`mailto:${v}`) };
  if (k.includes('phone') || k.includes('mobile')) return { icon: 'phone', action: (v: string) => Linking.openURL(`tel:${v}`) };
  return { icon: 'info', action: undefined as undefined | ((v: string) => void) };
};

const RulesRegulationsScreen = () => {
  const [data, setData]       = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getRulesRegulations());
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setData({} as RulesData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load rules & regulations.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  if (loading) return <DocLoading title={TITLE} />;
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const sections = data.sections ?? [];
  const files = data.files ?? [];
  const additional = data.additional_info ?? [];
  const isEmpty = sections.length === 0 && files.length === 0 && additional.length === 0;

  return (
    <View style={docStyles.root}>
      <Header title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isEmpty ? (
          <DocNoData
            icon="shield-checkmark-outline"
            subtitle="Nothing has been added yet. Pull down to refresh."
          />
        ) : (
          <DocIntro meta={lastUpdated(data.last_updated)} />
        )}

        {sections.map((sec, i) => (
          <DocSection key={i} title={sec.head}>
            <DocBody>{sec.desc}</DocBody>
          </DocSection>
        ))}

        {files.length > 0 && (
          <DocSection title="Documents">
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
          </DocSection>
        )}

        {additional.length > 0 && (
          <DocSection title="Contact">
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
          </DocSection>
        )}
      </ScrollView>
    </View>
  );
};

export default RulesRegulationsScreen;
