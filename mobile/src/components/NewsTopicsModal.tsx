import { memo, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import newsApi from '@/services/newsApi';
import type { NewsTopic, NewsTopicMeta } from '@/types';

interface Props {
  visible: boolean;
  topics: NewsTopicMeta[];
  onClose: () => void;
  /** Rappele avec la liste finale reelle (celle renvoyee par le back). */
  onSaved: (topics: NewsTopicMeta[]) => void;
}

/**
 * Modal des abonnements aux themes d'actualites.
 *
 * Six cases a cocher, un bouton d'enregistrement. Tap sur l'overlay ferme sans
 * sauvegarder. L'etat local est reinitialise a chaque ouverture pour refleter
 * la selection courante (l'utilisateur peut avoir touche a ses abonnements
 * ailleurs entre deux ouvertures).
 */
function NewsTopicsModalBase({ visible, topics, onClose, onSaved }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<Set<NewsTopic>>(new Set());
  const [saving, setSaving] = useState(false);

  // A chaque ouverture, on repart de la source de verite fournie par le
  // parent — evite d'afficher un etat perime si l'utilisateur reouvre.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(topics.filter((t) => t.subscribed).map((t) => t.key)));
    }
  }, [visible, topics]);

  const toggle = (key: NewsTopic) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await newsApi.setTopics(Array.from(selected));
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).response?.data?.error
          : undefined;
      Alert.alert('Erreur', msg || 'Impossible d’enregistrer les abonnements.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Le panneau intercepte le tap pour ne pas se fermer quand on
            manipule les cases. */}
        <Pressable style={styles.panel} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.kicker}>— Sanctuaire des chroniques —</Text>
            <Text style={styles.title}>Mes abonnements</Text>
            <Text style={styles.sub}>
              Coche les themes qui doivent remonter en tete de ton fil.
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {topics.map((t) => {
              const active = selected.has(t.key);
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.75}
                  onPress={() => toggle(t.key)}
                  style={[styles.row, active && styles.rowActive]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowLabel, active && { color: colors.gold }]}>
                      {t.label}
                    </Text>
                    <Text style={styles.rowDesc}>{t.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.check,
                      active
                        ? { borderColor: colors.gold, backgroundColor: colors.gold }
                        : { borderColor: colors.border },
                    ]}>
                    {active && (
                      <Text style={[styles.checkMark, { color: colors.onGold }]}>
                        {'✓'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <CyberButton
              label="Annuler"
              variant="ghost"
              onPress={onClose}
              disabled={saving}
              cutColor={colors.panel}
            />
            <View style={{ flex: 1 }} />
            {saving ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <CyberButton
                label="Enregistrer"
                variant="primary"
                onPress={handleSave}
                cutColor={colors.panel}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const NewsTopicsModal = memo(NewsTopicsModalBase);
export default NewsTopicsModal;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    panel: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.gold,
    },
    header: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
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
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    sub: {
      marginTop: 6,
      fontSize: 12,
      color: t.colors.textMuted,
    },
    list: { flexGrow: 0 },
    listContent: { paddingHorizontal: 18, paddingVertical: 12, gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    rowActive: {
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.06)',
    },
    rowLabel: {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    rowDesc: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 15,
      color: t.colors.textMuted,
    },
    check: {
      width: 22,
      height: 22,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkMark: {
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.panel2,
    },
  });
