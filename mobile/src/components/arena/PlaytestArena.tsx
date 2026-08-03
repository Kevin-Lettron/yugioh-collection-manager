import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import CyberButton from '@/components/CyberButton';
import type { DeckCard } from '@/types';
import ZoneSheet, { type ZoneKey } from './ZoneSheet';
import {
  cardArt,
  cardName,
  zoneKindOf,
  type BoardCard,
  type Playtest,
  type ZoneKind,
} from './usePlaytest';

interface PlaytestArenaProps {
  playtest: Playtest;
  /** Extra Deck du deck consulté — consultable, pas jouable (invocations non simulées). */
  extraDeck: DeckCard[];
  mainCount: number;
  extraCount: number;
  openZone: ZoneKey | null;
  onOpenZone: (zone: ZoneKey | null) => void;
}

/**
 * Plateau de test jouable : main, pioche, pose des cartes, face verso, zones.
 *
 * Portage tactile de l'arène web. Le geste est en deux temps — on sélectionne
 * une carte de la main, puis on tape la zone d'accueil : le glisser-déposer
 * demanderait un gestionnaire de gestes et tomberait en conflit avec le
 * défilement horizontal de la main.
 */
export default function PlaytestArena({
  playtest,
  extraDeck,
  mainCount,
  extraCount,
  openZone,
  onOpenZone,
}: PlaytestArenaProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();

  const {
    playMode,
    handCards,
    deckPile,
    graveyard,
    banished,
    selectedHandIdx,
    boardMonsters,
    boardSpellTraps,
    boardField,
    nextFaceDown,
    notice,
    active,
    setNextFaceDown,
    selectHand,
    startHand,
    resetHand,
    drawOne,
    placeOnBoard,
    flipZone,
    clearZone,
    sendToGraveyard,
    banishFromHand,
  } = playtest;

  const selectedCard = selectedHandIdx !== null ? handCards[selectedHandIdx] : null;
  const selectedKind = zoneKindOf(selectedCard);

  const zoneAccent: Record<ZoneKind, string> = {
    monster: colors.gold,
    spelltrap: colors.violet,
    field: colors.goldDim,
  };

  const renderSlot = (kind: ZoneKind, slotIdx: number, occupant: BoardCard | null) => {
    const isTarget = selectedCard !== null && selectedKind === kind && !occupant;
    const accent = zoneAccent[kind];
    const art = occupant ? cardArt(occupant.card) : undefined;

    return (
      <TouchableOpacity
        key={`${kind}-${slotIdx}`}
        activeOpacity={0.75}
        style={[
          styles.zone,
          kind === 'field' && styles.zoneField,
          occupant ? { borderColor: accent, backgroundColor: colors.panel2 } : styles.zoneEmpty,
          isTarget && { borderColor: accent, backgroundColor: colors.panel2, borderStyle: 'solid' },
        ]}
        accessibilityLabel={
          occupant
            ? `${cardName(occupant.card)}${occupant.faceDown ? ', face verso' : ''}`
            : `Zone ${kind === 'monster' ? 'monstre' : kind === 'spelltrap' ? 'magie ou piège' : 'terrain'} libre`
        }
        onPress={() => (occupant ? flipZone(kind, slotIdx) : placeOnBoard(kind, slotIdx))}>
        {occupant ? (
          occupant.faceDown ? (
            <View style={styles.faceDown}>
              <Text style={[styles.faceDownMark, { color: accent }]}>▨</Text>
            </View>
          ) : art ? (
            <Image source={{ uri: art }} style={styles.zoneArt} resizeMode="cover" />
          ) : (
            <Text style={styles.zoneFallback} numberOfLines={3}>
              {cardName(occupant.card)}
            </Text>
          )
        ) : (
          <Text style={[styles.zoneHint, isTarget && { color: accent }]}>
            {isTarget ? '＋' : kind === 'monster' ? 'M' : kind === 'spelltrap' ? 'S/T' : '⛰'}
          </Text>
        )}

        {occupant && (
          <TouchableOpacity
            style={styles.zoneKill}
            hitSlop={8}
            accessibilityLabel="Envoyer au cimetière"
            onPress={() => clearZone(kind, slotIdx)}>
            <Text style={styles.zoneKillText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={styles.board}>
        {/* ── Barre d'état + commandes */}
        {!active ? (
          <>
            <Text style={styles.pitch}>
              Simule une ouverture : pioche, pose tes cartes et suis les probabilités en direct.
            </Text>
            <View style={styles.startRow}>
              <View style={{ flex: 1 }}>
                <CyberButton
                  label="Je commence · 5"
                  variant="primary"
                  size="sm"
                  block
                  cutColor={colors.panel}
                  onPress={() => startHand('first')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <CyberButton
                  label="Je suis second · 6"
                  variant="secondary"
                  size="sm"
                  block
                  cutColor={colors.panel}
                  onPress={() => startHand('second')}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.modeBadge,
                  { backgroundColor: playMode === 'first' ? colors.gold : colors.violet },
                ]}>
                <Text
                  style={[
                    styles.modeBadgeText,
                    { color: playMode === 'first' ? colors.bg : '#FFFFFF' },
                  ]}>
                  {playMode === 'first' ? 'Joueur 1' : 'Joueur 2'}
                </Text>
              </View>
              <Text style={styles.statusText}>
                Main <Text style={styles.statusStrong}>{handCards.length}</Text> · Deck{' '}
                <Text style={[styles.statusStrong, { color: colors.gold }]}>{deckPile.length}</Text>
              </Text>
            </View>

            <View style={styles.controlRow}>
              <View style={{ flex: 1 }}>
                <CyberButton
                  label={deckPile.length ? `Piocher · ${deckPile.length}` : 'Deck vide'}
                  variant="primary"
                  size="sm"
                  block
                  cutColor={colors.panel}
                  disabled={deckPile.length === 0}
                  onPress={drawOne}
                />
              </View>
              <TouchableOpacity
                onPress={() => setNextFaceDown((v) => !v)}
                style={[styles.toggle, nextFaceDown && styles.toggleOn]}>
                <Text style={[styles.toggleText, nextFaceDown && styles.toggleTextOn]}>
                  {nextFaceDown ? '✓ Face verso' : 'Face verso'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.controlRow}>
              <TouchableOpacity onPress={() => startHand(playMode!)} style={styles.linkBtn}>
                <Text style={styles.linkText}>↻ Nouvelle main</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetHand} style={styles.linkBtn}>
                <Text style={styles.linkText}>✕ Terminer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {/* ── Plateau : 5 monstres, 5 magies/pièges */}
        <View style={styles.zoneRow}>
          {boardMonsters.map((occ, i) => renderSlot('monster', i, occ))}
        </View>
        <View style={styles.zoneRow}>
          {boardSpellTraps.map((occ, i) => renderSlot('spelltrap', i, occ))}
        </View>

        {/* ── Terrain + zones consultables */}
        <View style={styles.bottomRow}>
          {renderSlot('field', 0, boardField)}

          <TouchableOpacity
            style={[styles.tag, { borderColor: colors.cyan }]}
            onPress={() => onOpenZone('extra')}>
            <Text style={[styles.tagText, { color: colors.cyan }]}>EXTRA</Text>
            <Text style={styles.tagCount}>{extraCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tag, { borderColor: colors.magenta }]}
            onPress={() => onOpenZone('graveyard')}>
            <Text style={[styles.tagText, { color: colors.magenta }]}>CIM.</Text>
            <Text style={styles.tagCount}>{graveyard.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tag, { borderColor: colors.violet }]}
            onPress={() => onOpenZone('banished')}>
            <Text style={[styles.tagText, { color: colors.violet }]}>BANNIS</Text>
            <Text style={styles.tagCount}>{banished.length}</Text>
          </TouchableOpacity>
        </View>

        {!active && (
          <View style={styles.counters}>
            <View style={styles.counter}>
              <Text style={styles.counterLabel}>Main</Text>
              <Text style={[styles.counterVal, { color: colors.gold }]}>{mainCount}</Text>
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterLabel}>Extra</Text>
              <Text style={[styles.counterVal, { color: colors.violet }]}>{extraCount}</Text>
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterLabel}>Side</Text>
              <Text style={[styles.counterVal, { color: colors.cyan }]}>—</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Main */}
      {active && (
        <>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>Ta main</Text>
            <Text style={styles.handHint}>
              {selectedCard
                ? selectedKind
                  ? `Choisis une zone ${
                      selectedKind === 'monster'
                        ? 'monstre'
                        : selectedKind === 'spelltrap'
                          ? 'magie/piège'
                          : 'terrain'
                    }`
                  : 'Type inconnu — pose impossible'
                : 'Tape une carte pour la sélectionner'}
            </Text>
          </View>

          {handCards.length === 0 ? (
            <Text style={styles.handEmpty}>Main vide — pioche une carte.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.handScroll}>
              {handCards.map((dc, i) => {
                const art = cardArt(dc);
                const selected = selectedHandIdx === i;
                return (
                  <TouchableOpacity
                    key={`${dc.card_id}-${i}`}
                    activeOpacity={0.8}
                    onPress={() => selectHand(i)}
                    style={[styles.handCard, selected && { borderColor: colors.gold }]}>
                    {art ? (
                      <Image source={{ uri: art }} style={styles.handArt} resizeMode="cover" />
                    ) : (
                      <View style={[styles.handArt, styles.handArtFallback]}>
                        <Text style={styles.handArtFallbackText} numberOfLines={4}>
                          {cardName(dc)}
                        </Text>
                      </View>
                    )}
                    {selected && (
                      <View style={styles.handSelectedBar}>
                        <Text style={styles.handSelectedText}>SÉLECTION</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedCard && (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {cardName(selectedCard)}
              </Text>
              <View style={styles.selectedActions}>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => sendToGraveyard(selectedHandIdx!)}>
                  <Text style={[styles.linkText, { color: colors.magenta }]}>Cimetière</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => banishFromHand(selectedHandIdx!)}>
                  <Text style={[styles.linkText, { color: colors.violet }]}>Bannir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => selectHand(null)}>
                  <Text style={styles.linkText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      <ZoneSheet
        zone={openZone}
        cards={
          openZone === 'extra' ? extraDeck : openZone === 'graveyard' ? graveyard : banished
        }
        onClose={() => onOpenZone(null)}
      />
    </>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    board: {
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 12,
      gap: 8,
    },
    pitch: { fontSize: 12, color: t.colors.textMuted, lineHeight: 17 },
    startRow: { flexDirection: 'row', gap: 8 },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modeBadge: { paddingHorizontal: 8, paddingVertical: 3 },
    modeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: t.type.tracking,
      textTransform: 'uppercase',
    },
    statusText: { fontSize: 12, color: t.colors.textMuted },
    statusStrong: { color: t.colors.text, fontWeight: '700' },

    controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggle: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel2,
    },
    toggleOn: { borderColor: t.colors.violet, backgroundColor: 'rgba(168,85,247,0.16)' },
    toggleText: { fontSize: 11, fontWeight: '600', color: t.colors.textMuted },
    toggleTextOn: { color: t.colors.violet },

    linkBtn: { paddingVertical: 6, paddingHorizontal: 4 },
    linkText: { fontSize: 12, color: t.colors.textMuted, fontWeight: '600' },

    notice: {
      borderLeftWidth: 2,
      borderLeftColor: t.colors.magenta,
      backgroundColor: t.colors.panel2,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    noticeText: { fontSize: 12, color: t.colors.text, lineHeight: 16 },

    zoneRow: { flexDirection: 'row', gap: 6 },
    zone: {
      flex: 1,
      aspectRatio: 0.72,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    zoneEmpty: {
      borderColor: t.colors.border,
      borderStyle: 'dashed',
      backgroundColor: t.colors.bgElev,
    },
    zoneField: { flex: 0, width: 52 },
    zoneArt: { width: '100%', height: '100%' },
    zoneFallback: { fontSize: 8, color: t.colors.textDim, textAlign: 'center', padding: 2 },
    zoneHint: { fontSize: 11, color: t.colors.textDim, fontWeight: '700' },
    faceDown: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.bgElev,
    },
    faceDownMark: { fontSize: 20, opacity: 0.7 },
    zoneKill: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: 4,
      paddingVertical: 1,
      backgroundColor: t.colors.scrim,
    },
    zoneKillText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },

    bottomRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
    tag: {
      flex: 1,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      backgroundColor: t.colors.bgElev,
    },
    tagText: { fontSize: 10, fontWeight: '700', letterSpacing: t.type.tracking },
    tagCount: { fontSize: 13, fontWeight: '700', color: t.colors.text, marginTop: 2 },

    counters: { flexDirection: 'row', gap: 6 },
    counter: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    counterLabel: {
      fontSize: 9,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.type.tracking,
    },
    counterVal: { fontSize: 16, fontWeight: '700', marginTop: 2 },

    handHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
    },
    handTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: t.type.trackingWide,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },
    handHint: { flex: 1, fontSize: 11, color: t.colors.textMuted },
    handEmpty: { fontSize: 12, color: t.colors.textMuted, paddingVertical: 12 },
    handScroll: { gap: 8, paddingBottom: 4 },
    handCard: {
      width: 74,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    handArt: { width: 70, height: 102, backgroundColor: t.colors.bgElev },
    handArtFallback: { alignItems: 'center', justifyContent: 'center', padding: 4 },
    handArtFallbackText: { fontSize: 8, color: t.colors.textDim, textAlign: 'center' },
    handSelectedBar: { backgroundColor: t.colors.gold, alignItems: 'center', paddingVertical: 1 },
    handSelectedText: {
      fontSize: 8,
      fontWeight: '700',
      color: t.colors.bg,
      letterSpacing: t.type.tracking,
    },

    selectedBox: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel2,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    selectedName: { fontSize: 13, fontWeight: '600', color: t.colors.text },
    selectedActions: { flexDirection: 'row', gap: 16, marginTop: 2 },
  });
