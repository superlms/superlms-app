import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getPrivacyPolicy } from '../../api/authApi';
import {
  DocIntro,
  DocSection,
  DocBody,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
  lastUpdated,
} from './docUi';

interface Section { head: string; desc: string; }
interface PrivacyData {
  metadata:     { sections: Section[] };
  last_updated: string;
}

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

  return (
    <View style={docStyles.root}>
      <Header title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {sections.length === 0 ? (
          <DocNoData
            icon="lock-closed-outline"
            subtitle="The privacy policy hasn’t been added yet. Pull down to refresh."
          />
        ) : (
          <>
            <DocIntro meta={lastUpdated(data.last_updated)} />
            {sections.map((sec, i) => (
              <DocSection key={i} title={sec.head}>
                <DocBody>{sec.desc}</DocBody>
              </DocSection>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;
