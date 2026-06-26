import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getPrivacyPolicy } from '../../api/authApi';
import {
  DocHero,
  DocCard,
  DocBody,
  DocFooter,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
} from './docUi';

interface Section { head: string; desc: string; }
interface PrivacyData {
  metadata:     { sections: Section[] };
  last_updated: string;
}

const ACCENT = '#6366F1';
const TITLE = 'Privacy Policy';

const PrivacyPolicyScreen = () => {
  const [data, setData]       = useState<PrivacyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPrivacyPolicy());
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setData({} as PrivacyData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load privacy policy.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  if (loading) return <DocLoading title={TITLE} />;
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const sections = data.metadata?.sections ?? [];
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
          icon="lock-closed-outline"
          title={TITLE}
          subtitle="Your privacy matters to us. Please read our policy carefully."
        />

        {sections.length === 0 ? (
          <DocNoData
            accent={ACCENT}
            icon="lock-closed-outline"
            title="No Data found"
            subtitle="The privacy policy hasn’t been added yet. Pull down to refresh."
          />
        ) : (
          sections.map((sec, i) => (
            <DocCard key={i} accent={ACCENT} label={sec.head}>
              <DocBody>{sec.desc}</DocBody>
            </DocCard>
          ))
        )}

        {!!formattedDate && sections.length > 0 && (
          <DocFooter accent={ACCENT} text={`Last updated: ${formattedDate}`} />
        )}
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;
