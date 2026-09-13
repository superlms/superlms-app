import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getPrivacyPolicy } from '../../api/authApi';
import {
  DocHeader,
  DocIntro,
  DocSection,
  DocBody,
  DocNoData,
  DocSkeleton,
  DocError,
  docStyles,
  lastUpdated,
  type DocShape,
} from './docUi';

interface Section { head: string; desc: string; }
interface PrivacyData {
  metadata:     { sections: Section[] };
  last_updated: string;
}

const TITLE = 'Privacy Policy';

// The policy's opening sections as they read — the heading's and each line's
// length in characters — so the loading page has the policy's own shape.
const SHAPE: DocShape[] = [
  // Introduction
  { head: 12, lines: [57, 24, 103, 50, 28, 0, 447, 0, 327, 0, 191, 94, 87, 131, 97, 116, 123, 138, 157, 216, 99, 0, 241, 0, 207] },
  // Applicability
  { head: 13, lines: [84, 44, 35, 19, 19, 19, 15, 30, 33, 71, 27, 27, 51] },
];

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

  // "Last updated", then the policy's sections.
  if (loading) return <DocSkeleton title={TITLE} intro={{ meta: true }} shape={SHAPE} />;
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
