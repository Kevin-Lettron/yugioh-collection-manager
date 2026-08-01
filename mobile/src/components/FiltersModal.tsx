import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';

export type CollectionFilterValues = {
  type: string;
  attribute: string;
  rarity: string;
};

type Props = {
  visible: boolean;
  initial: CollectionFilterValues;
  onClose: () => void;
  onApply: (values: CollectionFilterValues) => void;
};

const TYPES = [
  'Effect Monster',
  'Normal Monster',
  'Spell Card',
  'Trap Card',
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Link Monster',
  'Ritual Monster',
  'Pendulum Effect Monster',
];

const ATTRIBUTES: { value: string; label: string }[] = [
  { value: 'DARK', label: 'TÉNÈBRES' },
  { value: 'LIGHT', label: 'LUMIÈRE' },
  { value: 'EARTH', label: 'TERRE' },
  { value: 'WATER', label: 'EAU' },
  { value: 'FIRE', label: 'FEU' },
  { value: 'WIND', label: 'VENT' },
  { value: 'DIVINE', label: 'DIVIN' },
];

const RARITIES = [
  'Common',
  'Short Print',
  'Rare',
  'Super Rare',
  'Ultra Rare',
  'Secret Rare',
  'Ultimate Rare',
  'Ghost Rare',
  'Starlight Rare',
  "Collector's Rare",
  'Prismatic Secret Rare',
  'Platinum Secret Rare',
  'Quarter Century Secret Rare',
  'Gold Rare',
  'Gold Secret Rare',
  'Premium Gold Rare',
  'Starfoil Rare',
  'Mosaic Rare',
  'Shatterfoil Rare',
  'Parallel Rare',
];

export default function FiltersModal({ visible, initial, onClose, onApply }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [values, setValues] = useState<CollectionFilterValues>(initial);

  const toggle = (key: keyof CollectionFilterValues, v: string) =>
    setValues((prev) => ({ ...prev, [key]: prev[key] === v ? '' : v }));

  const reset = () => setValues({ type: '', attribute: '', rarity: '' });

  const activeCount =
    (values.type ? 1 : 0) + (values.attribute ? 1 : 0) + (values.rarity ? 1 : 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filtres</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Section title="Type de carte">
            <ChipRow>
              {TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={values.type === t}
                  onPress={() => toggle('type', t)}
                />
              ))}
            </ChipRow>
          </Section>

          <Section title="Attribut">
            <ChipRow>
              {ATTRIBUTES.map((a) => (
                <Chip
                  key={a.value}
                  label={a.label}
                  selected={values.attribute === a.value}
                  onPress={() => toggle('attribute', a.value)}
                />
              ))}
            </ChipRow>
          </Section>

          <Section title="Rareté">
            <ChipRow>
              {RARITIES.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={values.rarity === r}
                  onPress={() => toggle('rarity', r)}
                />
              ))}
            </ChipRow>
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <CyberButton
            label="Réinitialiser"
            variant="ghost"
            onPress={reset}
            disabled={activeCount === 0}
            block
            style={{ flex: 1 }}
            cutColor={colors.panel}
          />
          <CyberButton
            label={`Appliquer ${activeCount > 0 ? `(${activeCount})` : ''}`.trim()}
            variant="primary"
            onPress={() => onApply(values)}
            block
            style={{ flex: 1 }}
            cutColor={colors.panel}
          />
        </View>
      </View>
    </Modal>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
  );
};

const ChipRow = ({ children }: { children: React.ReactNode }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.chipRow}>{children}</View>
  );
};

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={onPress}>
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: t.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.colors.text },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: t.colors.textMuted },
  body: { padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: t.colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chipSelected: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
  chipText: { fontSize: 12, color: t.colors.text, fontWeight: '500' },
  chipTextSelected: { color: t.colors.onGold },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.panel,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  footerBtnGhost: { backgroundColor: t.colors.panel2 },
  footerBtnGhostText: { color: t.colors.text, fontSize: 15, fontWeight: '600' },
  footerBtnPrimary: { backgroundColor: t.colors.gold },
  footerBtnPrimaryText: { color: t.colors.onGold, fontSize: 15, fontWeight: '600' },
});
