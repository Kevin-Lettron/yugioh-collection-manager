import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import { ScanFAB } from '@/components/decor/ScanFAB';
import CyberButton from '@/components/CyberButton';
import NewsTopicsModal from '@/components/NewsTopicsModal';
import newsApi from '@/services/newsApi';
import type { NewsItem, NewsRelease, NewsTopic, NewsTopicMeta } from '@/types';

const PAGE_LIMIT = 20;

/**
 * Filtre affiche par les chips. `all` = pas de filtre cote client ; le back
 * appliquera de son cote la ponderation « themes suivis » si l'utilisateur
 * est authentifie (cf. NewsController#list).
 */
type ChipKey = 'all' | NewsTopic;

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'tcg', label: 'TCG' },
  { key: 'ocg', label: 'OCG' },
  { key: 'competition', label: 'Compétition' },
  { key: 'releases', label: 'Sorties' },
  { key: 'banlist', label: 'Banlist' },
  { key: 'rulings', label: 'Règles' },
];

/**
 * Couleur d'accent par theme — sert au liseré gauche des cards articles et
 * aux pills de topic. Reprend la palette du sanctuaire.
 */
function topicColor(topic: NewsTopic, colors: Theme['colors']): string {
  switch (topic) {
    case 'tcg':
      return colors.gold;
    case 'ocg':
      return colors.magenta;
    case 'competition':
      return colors.cyan;
    case 'releases':
      return colors.violet;
    case 'banlist':
      return colors.danger;
    case 'rulings':
      return colors.success;
  }
}

const TOPIC_LABELS: Record<NewsTopic, string> = {
  tcg: 'TCG',
  ocg: 'OCG',
  competition: 'Compétition',
  releases: 'Sorties',
  banlist: 'Banlist',
  rulings: 'Règles',
};

/**
 * Date relative FR sans dependance externe. Le back renvoie de l'ISO 8601 UTC,
 * on affiche l'ecart en unites tangibles pour un joueur (« il y a 2h »,
 * « il y a 3j »). Au-dela d'un an on tombe sur une date absolue courte.
 */
function timeAgoFr(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'à venir';
  const s = Math.floor(diffMs / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  const w = Math.floor(d / 7);
  if (w < 5) return `il y a ${w} sem`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.floor(d / 365);
  return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

/** Formate une date de sortie « 2026-11-12 » en libelle court « 12 nov ». */
function formatReleaseDate(iso: string): { day: string; month: string } {
  const parts = iso.split('-');
  if (parts.length !== 3) return { day: '?', month: '' };
  const [, m, d] = parts;
  const MONTHS = [
    'jan', 'fév', 'mar', 'avr', 'mai', 'juin',
    'juil', 'aoû', 'sep', 'oct', 'nov', 'déc',
  ];
  const mi = parseInt(m, 10) - 1;
  return {
    day: String(parseInt(d, 10)),
    month: MONTHS[mi] ?? '',
  };
}

export default function NewsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();

  const [chip, setChip] = useState<ChipKey>('all');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [releases, setReleases] = useState<NewsRelease[]>([]);
  const [topics, setTopics] = useState<NewsTopicMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const subscribedTopics = useMemo(
    () => topics.filter((t) => t.subscribed).map((t) => t.key),
    [topics]
  );

  /**
   * Charge la premiere page + les meta (topics, sorties). Regroupe les 3
   * appels : les 3 sont peu couteux, et un ecran vide en attendant serait
   * pire qu'un chargement leger unique.
   */
  const fetchFirstPage = useCallback(
    async (targetChip: ChipKey) => {
      setLoading(true);
      try {
        const wantedTopics: NewsTopic[] | undefined =
          targetChip === 'all' ? undefined : [targetChip];
        const [list, tops, rels] = await Promise.all([
          newsApi.list({ topics: wantedTopics, page: 1, limit: PAGE_LIMIT }),
          newsApi.getTopics().catch(() => [] as NewsTopicMeta[]),
          newsApi.getReleases('upcoming', 90).catch(() => [] as NewsRelease[]),
        ]);
        setItems(list.items);
        setTotal(list.total);
        setPage(1);
        setTopics(tops);
        setReleases(rels);
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (err as any).response?.data?.error
            : undefined;
        Alert.alert('Erreur', msg || 'Fil d’actualités indisponible.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || loading) return;
    if (items.length >= total) return;
    setLoadingMore(true);
    try {
      const wantedTopics: NewsTopic[] | undefined =
        chip === 'all' ? undefined : [chip];
      const next = page + 1;
      const list = await newsApi.list({
        topics: wantedTopics,
        page: next,
        limit: PAGE_LIMIT,
      });
      setItems((prev) => {
        // De-doublonnage defensif : deux pages peuvent se chevaucher si un
        // article vient d'etre insere entre les deux appels.
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...list.items.filter((i) => !seen.has(i.id))];
      });
      setPage(next);
      setTotal(list.total);
    } catch {
      // On garde le silence : la pagination doit rester discrete, l'utilisateur
      // pourra retenter en tirant la liste.
    } finally {
      setLoadingMore(false);
    }
  }, [chip, items.length, loading, loadingMore, page, total]);

  useFocusEffect(
    useCallback(() => {
      fetchFirstPage(chip);
    }, [chip, fetchFirstPage])
  );

  const handleOpen = (item: NewsItem) => {
    Linking.openURL(item.url).catch(() =>
      Alert.alert('Erreur', 'Impossible d’ouvrir cet article.')
    );
  };

  const chipsLabel = useMemo(() => {
    if (chip === 'all') return 'Tous les articles';
    return `Filtré : ${TOPIC_LABELS[chip]}`;
  }, [chip]);

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFirstPage(chip);
              }}
              tintColor={colors.gold}
            />
          }>
          {/* ─── Titre ──────────────────────────────────── */}
          <View style={styles.hero}>
            <Text style={styles.kicker}>— Vitrine des chroniques —</Text>
            <Text style={styles.title}>Actualités</Text>
            <Text style={styles.sub}>
              {total > 0
                ? `${total} article${total > 1 ? 's' : ''} du méta`
                : 'Le fil du sanctuaire'}
            </Text>
            <Text style={styles.chipsHint}>{chipsLabel}</Text>
          </View>

          {/* ─── Chips + bouton abonnements ─────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {CHIPS.map((c) => {
              const active = chip === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setChip(c.key)}
                  activeOpacity={0.75}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: colors.gold,
                      borderColor: colors.gold,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipLabel,
                      active && { color: colors.onGold },
                    ]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setModalOpen(true)}
              activeOpacity={0.75}
              style={[styles.chip, styles.chipSubs]}>
              <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>
                {subscribedTopics.length > 0
                  ? `Mes abonnements · ${subscribedTopics.length}`
                  : 'Mes abonnements'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* ─── Calendrier des sorties ─────────────────── */}
          {releases.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>— Prochaines sorties —</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.releasesRow}>
                {releases.map((r) => {
                  const { day, month } = formatReleaseDate(r.tcg_date);
                  return (
                    <View key={r.set_code} style={styles.releaseCard}>
                      <View style={styles.releaseDate}>
                        <Text style={styles.releaseDay}>{day}</Text>
                        <Text style={styles.releaseMonth}>{month}</Text>
                      </View>
                      <Text style={styles.releaseCode} numberOfLines={1}>
                        {r.set_code}
                      </Text>
                      <Text style={styles.releaseName} numberOfLines={2}>
                        {r.set_name}
                      </Text>
                      <Text style={styles.releaseCount}>
                        {r.num_of_cards} cartes
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Fil articles ───────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>— Fil du sanctuaire —</Text>

            {loading && items.length === 0 ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.gold} />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  Aucun article pour ces filtres
                </Text>
                <Text style={styles.emptyText}>
                  Élargis ta sélection ou reviens plus tard — les flux se
                  rafraîchissent toutes les 30 minutes.
                </Text>
                <View style={{ height: 12 }} />
                <CyberButton
                  label="Voir tout le fil"
                  variant="ghost"
                  onPress={() => setChip('all')}
                  cutColor={colors.bg}
                />
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                {items.map((item) => {
                  const primary = item.topics[0];
                  const accent = primary
                    ? topicColor(primary, colors)
                    : colors.gold;
                  return (
                    <View
                      key={item.id}
                      style={[styles.article, { borderLeftColor: accent }]}>
                      {item.image_url ? (
                        <Image
                          source={{ uri: item.image_url }}
                          style={styles.articleImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.articleImage,
                            styles.articleImagePlaceholder,
                            { backgroundColor: colors.panel2 },
                          ]}>
                          <View
                            style={[
                              styles.articlePlaceholderBar,
                              { backgroundColor: accent, opacity: 0.35 },
                            ]}
                          />
                        </View>
                      )}
                      <View style={styles.articleBody}>
                        <View style={styles.articleMetaRow}>
                          <Text
                            style={styles.articleSource}
                            numberOfLines={1}>
                            {item.source?.name || 'Source inconnue'}
                          </Text>
                          <Text style={styles.articleDot}>·</Text>
                          <Text style={styles.articleDate}>
                            {timeAgoFr(item.published_at)}
                          </Text>
                        </View>
                        {item.topics.length > 0 && (
                          <View style={styles.pillRow}>
                            {item.topics.slice(0, 3).map((tp) => (
                              <View
                                key={tp}
                                style={[
                                  styles.pill,
                                  {
                                    borderColor: topicColor(tp, colors),
                                    backgroundColor:
                                      topicColor(tp, colors) + '22',
                                  },
                                ]}>
                                <Text
                                  style={[
                                    styles.pillLabel,
                                    { color: topicColor(tp, colors) },
                                  ]}>
                                  {TOPIC_LABELS[tp]}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text
                          style={styles.articleTitle}
                          numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.summary ? (
                          <Text
                            style={styles.articleSummary}
                            numberOfLines={3}>
                            {item.summary}
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => handleOpen(item)}
                          activeOpacity={0.7}
                          style={styles.readBtn}>
                          <Text style={styles.readBtnText}>
                            Lire l’article →
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {items.length < total && (
                  <View style={styles.loadMoreWrap}>
                    {loadingMore ? (
                      <ActivityIndicator color={colors.gold} />
                    ) : (
                      <CyberButton
                        label="Charger plus"
                        variant="secondary"
                        onPress={fetchNextPage}
                        cutColor={colors.bg}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <ScanFAB />
      <NewsTopicsModal
        visible={modalOpen}
        topics={topics}
        onClose={() => setModalOpen(false)}
        onSaved={(updated) => {
          setTopics(updated);
          // Un changement d'abonnements modifie la ponderation cote back :
          // on rafraichit le fil courant pour que ca se voie.
          fetchFirstPage(chip);
        }}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 140,
    },

    // ─── Hero ──────────────────────────────────────
    hero: { marginBottom: 14 },
    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.8,
      color: t.colors.gold,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      fontFamily: 'sans-serif',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
      lineHeight: 30,
    },
    sub: {
      marginTop: 6,
      fontSize: 13,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
    },
    chipsHint: {
      marginTop: 4,
      fontSize: 11,
      color: t.colors.goldDim,
      letterSpacing: 0.5,
    },

    // ─── Chips row ────────────────────────────────
    chipsRow: {
      paddingVertical: 4,
      paddingRight: 8,
      gap: 6,
      flexDirection: 'row',
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    chipSubs: {
      backgroundColor: t.colors.violet,
      borderColor: t.colors.violet,
    },
    chipLabel: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },

    // ─── Sections ─────────────────────────────────
    section: { marginTop: 22 },
    sectionKicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.4,
      color: t.colors.gold,
      textTransform: 'uppercase',
      marginBottom: 10,
    },

    // ─── Releases ─────────────────────────────────
    releasesRow: {
      paddingRight: 8,
      gap: 8,
      flexDirection: 'row',
    },
    releaseCard: {
      width: 120,
      minHeight: 132,
      padding: 10,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderTopWidth: 2,
      borderTopColor: t.colors.violet,
      gap: 4,
    },
    releaseDate: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    releaseDay: {
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: '900',
      color: t.colors.gold,
      letterSpacing: 0.5,
    },
    releaseMonth: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    releaseCode: {
      marginTop: 6,
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: t.colors.cyan,
    },
    releaseName: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      color: t.colors.text,
      lineHeight: 14,
    },
    releaseCount: {
      marginTop: 'auto',
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.textMuted,
      fontWeight: '600',
    },

    // ─── Articles ─────────────────────────────────
    article: {
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      overflow: 'hidden',
    },
    articleImage: {
      width: '100%',
      height: 140,
    },
    articleImagePlaceholder: {
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
    },
    articlePlaceholderBar: {
      height: 4,
      width: '40%',
      alignSelf: 'flex-start',
      marginLeft: 12,
      marginBottom: 12,
    },
    articleBody: { padding: 14, gap: 8 },
    articleMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    articleSource: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      color: t.colors.goldDim,
      maxWidth: 160,
    },
    articleDot: {
      fontSize: 10,
      color: t.colors.textMuted,
    },
    articleDate: {
      fontSize: 11,
      color: t.colors.textMuted,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    pill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
    },
    pillLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    articleTitle: {
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: t.colors.text,
      lineHeight: 19,
    },
    articleSummary: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.textMuted,
    },
    readBtn: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingVertical: 4,
    },
    readBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },

    // ─── Empty / loading ───────────────────────────
    loader: {
      paddingVertical: 60,
      alignItems: 'center',
    },
    empty: {
      padding: 24,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
    },
    emptyTitle: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '700',
      color: t.colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    emptyText: {
      marginTop: 8,
      fontSize: 12,
      textAlign: 'center',
      color: t.colors.textMuted,
      lineHeight: 17,
    },

    loadMoreWrap: {
      alignItems: 'center',
      paddingVertical: 18,
    },
  });
