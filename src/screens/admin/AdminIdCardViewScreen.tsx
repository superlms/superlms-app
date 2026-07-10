import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, IdCardRow, IdCardView, deleteIdCard, getIdCard } from '../../api/adminIdCardApi';

const AdminIdCardViewScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const row: IdCardRow = route.params?.card;

  const [card, setCard] = useState<IdCardView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCard(await getIdCard(type, row.id));
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load card.'));
    } finally {
      setLoading(false);
    }
  }, [type, row?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    Alert.alert('Delete Card', `Delete card ${row.card_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteIdCard(type, row.id); navigation.goBack(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <Header
        title="ID Card"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <TouchableOpacity style={s.headBtn} onPress={() => navigation.navigate('AdminIdCardEdit', { type, card: row })} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />
      {loading || !card?.card_number ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.idCard}>
            <View style={s.idHeader}>
              {!!card.school?.logo && <Image source={{ uri: card.school.logo }} style={s.idLogo} />}
              <Text style={s.idSchool}>{card.school?.name}</Text>
            </View>
            <View style={s.idBody}>
              {card.photo ? <Image source={{ uri: card.photo }} style={s.idPhoto} /> : (
                <View style={[s.idPhoto, s.idPhotoPlaceholder]}><VectorIcon iconSet="Ionicons" iconName="person" size={34} color={theme.colors.textMuted} /></View>
              )}
              <Text style={s.idName}>{card.name}</Text>
              <Text style={s.idSubtitle}>{card.subtitle}</Text>
            </View>
            <View style={s.idRows}>
              {Object.entries(card.front_rows || {}).map(([k, v]) => (
                <View key={k} style={s.idRow}><Text style={s.idRowKey}>{k}</Text><Text style={s.idRowVal} numberOfLines={1}>{v}</Text></View>
              ))}
              <View style={s.idRow}><Text style={s.idRowKey}>Card No</Text><Text style={s.idRowVal}>{card.card_number}</Text></View>
              <View style={s.idRow}><Text style={s.idRowKey}>Valid Till</Text><Text style={s.idRowVal}>{card.expiry_date}</Text></View>
            </View>
            {!!card.qr_code && <Image source={{ uri: card.qr_code }} style={s.idQr} />}
          </View>

          <TouchableOpacity style={s.deleteBtn} onPress={remove} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
            <Text style={s.deleteText}>Delete Card</Text>
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminIdCardViewScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  scroll: { padding: 16 },
  idCard: { backgroundColor: theme.colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  idHeader: { alignItems: 'center', marginBottom: 12 },
  idLogo: { width: 130, height: 50, resizeMode: 'contain', marginBottom: 6 },
  idSchool: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary, textAlign: 'center' },
  idBody: { alignItems: 'center', marginBottom: 12 },
  idPhoto: { width: 84, height: 84, borderRadius: 14, marginBottom: 8 },
  idPhotoPlaceholder: { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  idName: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  idSubtitle: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, marginTop: 2 },
  idRows: { gap: 6, marginBottom: 12 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  idRowKey: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  idRowVal: { fontSize: 12, color: theme.colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  idQr: { width: 120, height: 120, alignSelf: 'center', marginTop: 6 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, height: 48, borderRadius: 12, backgroundColor: theme.colors.danger + '14' },
  deleteText: { fontSize: 15, fontWeight: '800', color: theme.colors.danger },
});
