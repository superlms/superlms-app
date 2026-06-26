import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getRulesRegulations } from '../../api/authApi';
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

interface Section      { head: string; desc: string; }
interface FileItem     { title: string; file_path: string; file_type: string; }
interface AdditionalInfo { key: string; value: string; }

interface RulesData {
  sections:        Section[];
  files:           FileItem[];
  additional_info: AdditionalInfo[];
  last_updated:    string;
}

const ACCENT = '#F59E0B';
const TITLE = 'Rules & Regulations';

const contactCfg = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('email') || k.includes('mail')) return { icon: 'mail', bg: '#3B82F6', action: (v: string) => Linking.openURL(`mailto:${v}`) };
  if (k.includes('phone') || k.includes('mobile')) return { icon: 'phone', bg: '#A78BFA', action: (v: string) => Linking.openURL(`tel:${v}`) };
  return { icon: 'info', bg: '#10B981', action: undefined as undefined | ((v: string) => void) };
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
  const formattedDate = data.last_updated
    ? new Date(data.last_updated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
          iconSet="Ionicons"
          icon="shield-checkmark-outline"
          title={TITLE}
          subtitle="Please read and follow all rules and regulations carefully."
        />

        {isEmpty ? (
          <DocNoData
            accent={ACCENT}
            icon="shield-checkmark-outline"
            title="No Data found"
            subtitle="Nothing has been added yet. Pull down to refresh."
          />
        ) : (
          sections.map((sec, i) => (
            <DocCard key={i} accent={ACCENT} label={sec.head}>
              <DocBody>{sec.desc}</DocBody>
            </DocCard>
          ))
        )}

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

        {!!formattedDate && !isEmpty && (
          <DocFooter accent={ACCENT} text={`Last updated: ${formattedDate}`} />
        )}
      </ScrollView>
    </View>
  );
};

export default RulesRegulationsScreen;
