import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { collectionApi } from '@/services/collectionApi';
import type { UserCard } from '@/types';
import { LANGUAGE_LABELS } from '@/types';

type Props = {
  visible: boolean;
  userCard: UserCard;
  onClose: () => void;
  onDeleted: () => void;
};

const attributeColors: Record<string, { bg: string; fg: string; label?: string }> = {
  DARK: { bg: '#1f2937', fg: '#fff', label: 'TÉNÈBRES' },
  LIGHT: { bg: '#fef3c7', fg: '#92400e', label: 'LUMIÈRE' },
  FIRE: { bg: '#fee2e2', fg: '#991b1b', label: 'FEU' },
  WATER: { bg: '#dbeafe', fg: '#1e40af', label: 'EAU' },
  EARTH: { bg: '#fef3c7', fg: '#78350f', label: 'TERRE' },
  WIND: { bg: '#dcfce7', fg: '#166534', label: 'VENT' },
  DIVINE: { bg: '#fde68a', fg: '#78350f', label: 'DIVIN' },
};

const banlistColor = (status?: string) => {
  if (status === 'Banned') return { bg: '#fee2e2', fg: '#991b1b' };
  if (status === 'Limited') return { bg: '#ffedd5', fg: '#9a3412' };
  return { bg: '#fef3c7', fg: '#92400e' }; // Semi-Limited
};

export default function CardDetailModal({ visible, userCard, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const card = userCard.card;
  const attr = card?.attribute ? attributeColors[card.attribute] : null;

  const handleDelete = () => {
    Alert.alert(
      'Retirer la carte ?',
      `${card?.name || 'Cette carte'} sera retirée de ta collection.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await collectionApi.remove(userCard.id);
              onDeleted();
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error || 'Suppression échouée');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {card?.name || 'Carte'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {card?.card_images?.[0] && (
            <Image
              source={{ uri: card.card_images[0].image_url }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          )}

          {card && (
            <View style={styles.chipRow}>
              <View style={[styles.chip, styles.chipType]}>
                <Text style={styles.chipText}>{card.type}</Text>
              </View>
              {attr && (
                <View style={[styles.chip, { backgroundColor: attr.bg }]}>
                  <Text style={[styles.chipText, { color: attr.fg }]}>
                    {attr.label || card.attribute}
                  </Text>
                </View>
              )}
              {card.race && (
                <View style={[styles.chip, styles.chipRace]}>
                  <Text style={styles.chipText}>{card.race}</Text>
                </View>
              )}
            </View>
          )}

          {card &&
            (card.atk !== undefined ||
              card.def !== undefined ||
              card.level !== undefined ||
              card.linkval !== undefined ||
              card.scale !== undefined) && (
              <View style={styles.statsRow}>
                {card.level !== undefined && (
                  <Text style={styles.stat}>★ Niv. {card.level}</Text>
                )}
                {card.linkval !== undefined && (
                  <Text style={styles.stat}>LIEN-{card.linkval}</Text>
                )}
                {card.scale !== undefined && (
                  <Text style={styles.stat}>Échelle {card.scale}</Text>
                )}
                {card.atk !== undefined && (
                  <Text style={[styles.stat, { color: '#dc2626' }]}>ATK {card.atk}</Text>
                )}
                {card.def !== undefined && (
                  <Text style={[styles.stat, { color: '#2563eb' }]}>DEF {card.def}</Text>
                )}
              </View>
            )}

          {card?.linkmarkers && card.linkmarkers.length > 0 && (
            <MetaLine label="Flèches Lien" value={card.linkmarkers.join(', ')} />
          )}

          {card?.archetype && <MetaLine label="Archétype" value={card.archetype} />}

          {card?.banlist_info &&
            (card.banlist_info.ban_tcg || card.banlist_info.ban_ocg) && (
              <View style={styles.banRow}>
                {card.banlist_info.ban_tcg && (
                  <View
                    style={[
                      styles.banChip,
                      { backgroundColor: banlistColor(card.banlist_info.ban_tcg).bg },
                    ]}>
                    <Text
                      style={[
                        styles.banChipText,
                        { color: banlistColor(card.banlist_info.ban_tcg).fg },
                      ]}>
                      TCG : {card.banlist_info.ban_tcg}
                    </Text>
                  </View>
                )}
                {card.banlist_info.ban_ocg && (
                  <View
                    style={[
                      styles.banChip,
                      { backgroundColor: banlistColor(card.banlist_info.ban_ocg).bg },
                    ]}>
                    <Text
                      style={[
                        styles.banChipText,
                        { color: banlistColor(card.banlist_info.ban_ocg).fg },
                      ]}>
                      OCG : {card.banlist_info.ban_ocg}
                    </Text>
                  </View>
                )}
              </View>
            )}

          {card?.description && (
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>Texte de la carte</Text>
              <Text style={styles.descText}>{card.description}</Text>
            </View>
          )}

          <View style={styles.collectionBox}>
            <Text style={styles.collectionTitle}>Dans ta collection</Text>
            <View style={styles.collectionGrid}>
              <InfoCell label="Set" value={userCard.set_code} />
              <InfoCell label="Rareté" value={userCard.rarity} />
              <InfoCell
                label="Langue"
                value={LANGUAGE_LABELS[userCard.language] || userCard.language}
              />
              <InfoCell label="Quantité" value={String(userCard.quantity)} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
            onPress={handleDelete}
            disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteBtnText}>Retirer de la collection</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoCell}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const MetaLine = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metaLine}>
    <Text style={styles.metaLabel}>{label} : </Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: '#6b7280' },
  body: { padding: 16, gap: 12 },
  cardImage: {
    width: '100%',
    height: 400,
    alignSelf: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipType: { backgroundColor: '#ede9fe' },
  chipRace: { backgroundColor: '#dbeafe' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { fontSize: 14, fontWeight: '600', color: '#111827' },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  metaLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  metaValue: { fontSize: 13, color: '#111827' },
  banRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  banChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  banChipText: { fontSize: 12, fontWeight: '700' },
  descBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  descTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  descText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  collectionBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  collectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 2 },
  deleteBtn: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
