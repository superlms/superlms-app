import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, IdCardRow, IdCardView, deleteIdCard, getIdCard } from '../../api/adminIdCardApi';
import { DocHeader } from '../more/docUi';
import {
  CARD_H,
  CARD_W,
  IdCardBack,
  IdCardFront,
  rowsFromObject,
  type IdCardFaceData,
} from '../idCard/IdCardFaces';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'ID Card';

// The admin payload → what the two faces draw. Same source as the web card.
const toFaceData = (c: IdCardView): IdCardFaceData => ({
  school: {
    name: c.school?.name ?? 'School',
    logo: c.school?.logo,
    address: c.school?.address,
    phone: c.school?.phone,
    email: c.school?.email,
    website: c.school?.website,
  },
  photo: c.photo,
  name: c.name,
  subtitle: c.subtitle,
  rows: rowsFromObject(c.front_rows),
  cardNumber: c.card_number,
  issueDate: c.issue_date,
  expiryDate: c.expiry_date,
  status: c.status,
  qrCode: c.qr_code,
});

const AdminIdCardViewScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const row: IdCardRow = route.params?.card;

  const [card, setCard] = useState<IdCardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCard(await getIdCard(type, row.id));
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not load card.'));
    } finally {
      setLoading(false);
    }
  }, [type, row?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteIdCard(type, row.id);
      setConfirmOpen(false);
      navigation.goBack();
    } catch (e) {
      setConfirmOpen(false);
      AppAlert.alert('Error', apiErr(e, 'Could not delete.'));
    } finally {
      setDeleting(false);
    }
  };

  const ready = !!card?.card_number;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon="create-outline"
        onRightPress={() => navigation.navigate('AdminIdCardEdit', { type, card: row })}
      />

      {loading && !refreshing && !ready ? (
        <View style={s.loading}>
          <Skeleton width={CARD_W} height={CARD_H} radius={12} />
        </View>
      ) : !ready ? (
        <View style={s.stateBox}>
          <VectorIcon iconSet="Ionicons" iconName="card-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>This card could not be loaded.</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Both faces, exactly as the card prints */}
          <IdCardFront data={toFaceData(card!)} />
          <IdCardBack data={toFaceData(card!)} />

          {/* Delete — a quiet text action, never a heavy red block */}
          <TouchableOpacity
            style={s.deleteBtn}
            activeOpacity={0.6}
            onPress={() => setConfirmOpen(true)}
            hitSlop={8}
          >
            <VectorIcon iconSet="Feather" iconName="trash-2" size={15} color={theme.colors.danger} />
            <Text style={s.deleteText}>Delete card</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={confirmOpen}
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Delete ID card?</Text>
            <Text style={s.modalDesc}>
              Card {row?.card_number} will be removed. This cannot be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                disabled={deleting}
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger, deleting && s.modalBtnBusy]}
                activeOpacity={0.85}
                disabled={deleting}
                onPress={remove}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={s.modalBtnDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminIdCardViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { alignItems: 'center', paddingTop: 20, paddingBottom: 40, gap: 24 },

  // States
  loading: { alignItems: 'center', paddingTop: 24 },
  stateBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Delete
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteText: { fontSize: 14, fontWeight: '500', color: theme.colors.danger },

  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnBusy: { opacity: 0.7 },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
