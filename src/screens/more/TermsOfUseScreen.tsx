import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getTermsOfUse } from '../../api/authApi';
import {
  DocHeader,
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
interface TermsOfUseData {
  metadata:     { sections: Section[] };
  last_updated: string;
}

const TITLE = 'Terms of Use';

const TermsOfUseScreen = () => {
  const [data, setData]       = useState<TermsOfUseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getTermsOfUse());
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setData({} as TermsOfUseData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load terms of use.');
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
      <DocHeader title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {sections.length === 0 ? (
          <DocNoData
            icon="document-text-outline"
            subtitle="The terms of use haven’t been added yet. Pull down to refresh."
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

export default TermsOfUseScreen;
