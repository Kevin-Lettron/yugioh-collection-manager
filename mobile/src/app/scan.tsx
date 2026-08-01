import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { collectionApi } from '@/services/collectionApi';
import type { CardLanguage, ScanCandidate, ScanMode, ScanResult, VisionReading } from '@/types';
import { LANGUAGE_LABELS } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { spacing } from '@/theme/palette';

/** Résumé lisible de ce que l'IA a lu sur la photo, pour comparaison visuelle. */
function readingSummary(reading?: VisionReading): string | null {
  if (!reading) return null;
  const parts: string[] = [];
  if (reading.nameAsPrinted) parts.push(`« ${reading.nameAsPrinted} »`);
  if (reading.cardKind) {
    const kind =
      reading.cardKind === 'Spell' ? 'Magie' : reading.cardKind === 'Trap' ? 'Piège' : 'Monstre';
    parts.push(reading.spellTrapType ? `${kind} ${reading.spellTrapType}` : kind);
  }
  if (reading.attribute) parts.push(reading.attribute);
  if (reading.level !== null) parts.push(`Niv.${reading.level}`);
  if (reading.atk !== null) {
    parts.push(reading.def !== null ? `ATK ${reading.atk} / DEF ${reading.def}` : `ATK ${reading.atk}`);
  }
  if (reading.code) parts.push(reading.code);
  return parts.length > 0 ? parts.join(' · ') : null;
}

type Step = 'camera' | 'preview' | 'analyzing' | 'confirm' | 'noresult';

export default function ScanScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>('camera');
  const [mode, setMode] = useState<ScanMode>('card');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  // Carte retenue quand l'utilisateur corrige le choix de l'IA parmi les alternatives.
  const [chosen, setChosen] = useState<ScanCandidate | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [adding, setAdding] = useState(false);

  // Confirmation form state
  const [setCode, setSetCode] = useState('');
  const [rarity, setRarity] = useState('');
  const [language, setLanguage] = useState<CardLanguage>('EN');
  const [quantity, setQuantity] = useState('1');

  const close = () => router.back();

  const capture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      // Qualité max : le code de set fait quelques pixels de haut, la compression
      // JPEG le rend illisible bien avant que la photo paraisse floue à l'œil.
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setStep('preview');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const retake = () => {
    setPhotoUri(null);
    setScan(null);
    setChosen(null);
    setDescription('');
    setStep('camera');
  };

  /** L'IA s'est trompée : l'utilisateur retient une des autres pistes proposées. */
  const applyCandidate = (candidate: ScanCandidate) => {
    setChosen(candidate);
    setSetCode(candidate.code || '');
    setRarity(candidate.availableRarities?.[0] || '');
    setLanguage(candidate.detectedLanguage || scan?.detectedLanguage || 'EN');
    setQuantity('1');
    setStep('confirm');
  };

  const analyze = async () => {
    if (!photoUri) return;
    setStep('analyzing');
    setChosen(null);
    try {
      const result = await collectionApi.scan(photoUri, {
        description: description.trim() || undefined,
        mode,
      });
      setScan(result);
      if (result.success && result.card) {
        // Pre-fill confirmation form
        setSetCode(result.code || '');
        setRarity(result.availableRarities?.[0] || '');
        setLanguage(result.detectedLanguage || 'EN');
        setQuantity('1');
        setStep('confirm');
      } else {
        setStep('noresult');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        (err?.response?.status === 429
          ? 'Limite de scans atteinte. Réessaie plus tard.'
          : 'Analyse échouée');
      Alert.alert('Erreur', message);
      setStep('preview');
    }
  };

  const confirmAdd = async () => {
    const card = chosen?.card ?? scan?.card;
    if (!card || !setCode.trim() || !rarity) return;
    setAdding(true);
    try {
      await collectionApi.add({
        card_code: card.card_id,
        set_code: setCode.trim().toUpperCase(),
        rarity,
        language,
        quantity: parseInt(quantity, 10) || 1,
      });
      Alert.alert('Ajouté', `${card.name} ajouté à ta collection.`, [
        { text: 'OK', onPress: close },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Ajout échoué');
    } finally {
      setAdding(false);
    }
  };

  // ─── Permission gates ─────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.centerContainer}>
          <HeroTitle
            kicker="— Oracle —"
            title="Accès caméra"
            sub="Pour scanner tes cartes, l'app a besoin d'accéder à la caméra."
          />
          <CyberButton
            label="Autoriser la caméra"
            variant="primary"
            onPress={requestPermission}
            cutColor={colors.bg}
          />
          <TouchableOpacity onPress={close}>
            <Text style={styles.link}>Retour</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <CornerOrnaments />
      </View>
    );
  }

  // ─── Step: camera live preview ─────────────────────────
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* Scanlines subtiles */}
        <View pointerEvents="none" style={styles.scanlines} />

        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={close} style={styles.closeBtnDark}>
              <Text style={styles.closeTextDark}>✕</Text>
            </TouchableOpacity>
            <View style={styles.oracleTitleWrap}>
              <Text style={styles.oracleKicker}>— Oracle —</Text>
              <Text style={styles.oracleTitle}>Aligne la carte</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Cadre de visée : portrait pour la carte, bande étroite pour le code */}
          <View style={styles.cameraFrame}>
            <View style={mode === 'code' ? styles.frameCode : styles.frameCard}>
              {/* 4 coins de verrouillage dorés */}
              <View style={[styles.lockCorner, styles.lockTL]} pointerEvents="none" />
              <View style={[styles.lockCorner, styles.lockTR]} pointerEvents="none" />
              <View style={[styles.lockCorner, styles.lockBL]} pointerEvents="none" />
              <View style={[styles.lockCorner, styles.lockBR]} pointerEvents="none" />
            </View>
          </View>

          <View style={styles.cameraFooter}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                onPress={() => setMode('card')}
                style={[styles.modeChip, mode === 'card' && styles.modeChipActive]}>
                <Text style={[styles.modeText, mode === 'card' && styles.modeTextActive]}>
                  Carte entière
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('code')}
                style={[styles.modeChip, mode === 'code' && styles.modeChipActive]}>
                <Text style={[styles.modeText, mode === 'code' && styles.modeTextActive]}>
                  Code uniquement
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cameraHint}>
              {mode === 'code'
                ? "Colle l'appareil sur le code en bas de la carte (ex. CORE-FR058)."
                : "Pose la carte à plat, l'oracle fait le reste."}
            </Text>
            <TouchableOpacity
              style={[styles.captureBtn, capturing && { opacity: 0.5 }]}
              onPress={capture}
              disabled={capturing}>
              {capturing ? (
                <ActivityIndicator color={colors.onGold} />
              ) : (
                <View style={styles.captureBtnInner} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Step: preview photo before send ───────────────────
  if (step === 'preview') {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={close} style={styles.iconBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerCrumb}>Aperçu</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <HeroTitle
              kicker="— Oracle —"
              title="Aperçu"
              sub={`Mode : ${mode === 'code' ? 'code uniquement' : 'carte entière'}`}
            />

            {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImage} />}

            <Text style={styles.label}>Description (optionnel)</Text>
            <Text style={styles.hint}>
              {mode === 'code'
                ? "Ex : « carte magie, édition française » — sert à recouper le code lu."
                : "Ex : « Édition française, holographique » — aide l'oracle à mieux identifier."}
            </Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Précisions sur la carte…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />

            <View style={styles.rowBtns}>
              <CyberButton label="Reprendre" variant="ghost" onPress={retake} style={{ flex: 1 }} block cutColor={colors.bg} />
              <CyberButton label="Consulter l'oracle" variant="primary" onPress={analyze} style={{ flex: 1 }} block cutColor={colors.bg} />
            </View>
          </ScrollView>
        </SafeAreaView>
        <CornerOrnaments />
      </View>
    );
  }

  // ─── Step: analyzing (loading) ─────────────────────────
  if (step === 'analyzing') {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <HeroTitle
            kicker="— Oracle —"
            title="Invocation…"
            sub="Claude Vision inspecte la carte (~5-10s)"
          />
        </SafeAreaView>
        <CornerOrnaments />
      </View>
    );
  }

  // ─── Step: no result ──────────────────────────────────
  if (step === 'noresult') {
    const read = readingSummary(scan?.reading);
    // Même sans validation, l'IA a pu proposer des pistes : on laisse choisir
    // plutôt que d'imposer un nouveau scan.
    const pistes: ScanCandidate[] = [
      ...(scan?.card
        ? [
            {
              code: scan.code,
              name: scan.card.name,
              card: scan.card,
              officialImage: scan.officialImage,
              availableRarities: scan.availableRarities,
              detectedLanguage: scan.detectedLanguage,
              score: scan.verification?.score ?? 0,
              source: scan.verification?.source ?? 'code',
            } as ScanCandidate,
          ]
        : []),
      ...(scan?.alternatives || []),
    ];

    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={close} style={styles.iconBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerCrumb}>Oracle silencieux</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <HeroTitle
              kicker="— Oracle —"
              title="Non confirmée"
              sub={scan?.error || "L'oracle n'a pas pu identifier la carte avec certitude."}
            />

            {scan?.notes && <Text style={styles.hint}>{scan.notes}</Text>}

            {read && (
              <View style={styles.readBox}>
                <Text style={styles.readTitle}>Lu sur ta photo</Text>
                <Text style={styles.readText}>{read}</Text>
              </View>
            )}

            {pistes.length > 0 && (
              <>
                <Text style={styles.label}>Pistes possibles</Text>
                <Text style={styles.hint}>
                  Compare avec ta carte, puis choisis la bonne — ou reprends la photo.
                </Text>
                {pistes.map((c, i) => (
                  <TouchableOpacity
                    key={`${c.card.card_id}-${c.code || i}`}
                    style={styles.candidateRow}
                    onPress={() => applyCandidate(c)}>
                    {c.officialImage && (
                      <Image
                        source={{ uri: c.officialImage }}
                        style={styles.candidateImage}
                        resizeMode="contain"
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.identifiedName}>{c.name}</Text>
                      <Text style={styles.identifiedMeta}>{c.card.type}</Text>
                      {c.code && <Text style={styles.identifiedMeta}>{c.code}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {typeof scan?.remainingScans === 'number' && (
              <Text style={styles.remaining}>Scans restants : {scan.remainingScans}</Text>
            )}

            <CyberButton label="Reprendre la photo" variant="primary" onPress={retake} block cutColor={colors.bg} />
            <TouchableOpacity onPress={close}>
              <Text style={[styles.link, { textAlign: 'center' }]}>Ajouter manuellement</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        <CornerOrnaments />
      </View>
    );
  }

  // ─── Step: confirm identified card ────────────────────
  const activeCard = chosen?.card ?? scan?.card;
  if (step === 'confirm' && scan && activeCard) {
    const activeImage = chosen?.officialImage ?? scan.officialImage;
    const activeRarities = chosen?.availableRarities ?? scan.availableRarities;
    const read = readingSummary(scan.reading);
    // Après correction manuelle, l'avertissement de l'IA n'a plus lieu d'être.
    const uncertain = !chosen && scan.verification?.status !== 'confirmed';
    const others = (scan.alternatives || []).filter((c) => c.card.card_id !== activeCard.card_id);

    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={close} style={styles.iconBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerCrumb}>Relique identifiée</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <HeroTitle
              kicker="— Oracle —"
              title="Confirme la pièce"
              sub={typeof scan.confidence === 'number' ? `Confiance : ${Math.round(scan.confidence * 100)} %` : undefined}
            />

            <View style={styles.identifiedBox}>
              {activeImage && (
                <Image
                  source={{ uri: activeImage }}
                  style={styles.identifiedImage}
                  resizeMode="contain"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.identifiedName}>{activeCard.name}</Text>
                <Text style={styles.identifiedMeta}>{activeCard.type}</Text>
              </View>
            </View>

            {uncertain && (
              <View style={styles.warnBox}>
                <Text style={styles.warnTitle}>⚠ Vérifie que c'est bien ta carte</Text>
                <Text style={styles.warnText}>
                  {scan.verification?.mismatched?.length
                    ? `Incohérences détectées : ${scan.verification.mismatched.join(', ')}.`
                    : mode === 'code'
                      ? "Le code a été lu seul : rien d'autre à recouper. Compare avec l'image officielle."
                      : "Les indices lus sur la photo n'ont pas suffi à confirmer l'identification."}
                </Text>
              </View>
            )}

            {read && (
              <View style={styles.readBox}>
                <Text style={styles.readTitle}>Lu sur ta photo</Text>
                <Text style={styles.readText}>{read}</Text>
              </View>
            )}

            {others.length > 0 && (
              <>
                <Text style={styles.label}>Ce n'est pas la bonne carte ?</Text>
                {others.map((c, i) => (
                  <TouchableOpacity
                    key={`${c.card.card_id}-${c.code || i}`}
                    style={styles.candidateRow}
                    onPress={() => applyCandidate(c)}>
                    {c.officialImage && (
                      <Image
                        source={{ uri: c.officialImage }}
                        style={styles.candidateImage}
                        resizeMode="contain"
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.identifiedName}>{c.name}</Text>
                      <Text style={styles.identifiedMeta}>{c.card.type}</Text>
                      {c.code && <Text style={styles.identifiedMeta}>{c.code}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {typeof scan.remainingScans === 'number' && (
              <Text style={styles.remaining}>Scans restants : {scan.remainingScans}</Text>
            )}

            <Text style={styles.label}>Code Set</Text>
            <TextInput
              style={styles.input}
              value={setCode}
              onChangeText={(v) => setSetCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="LDK2-FRK40"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Rareté</Text>
            <View style={styles.chipRow}>
              {(activeRarities && activeRarities.length > 0
                ? activeRarities
                : ['Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare']
              ).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRarity(r)}
                  style={[styles.chip, rarity === r && styles.chipSelected]}>
                  <Text style={[styles.chipText, rarity === r && styles.chipTextSelected]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Langue</Text>
            <View style={styles.chipRow}>
              {(Object.keys(LANGUAGE_LABELS) as CardLanguage[]).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  onPress={() => setLanguage(lang)}
                  style={[styles.chip, language === lang && styles.chipSelected]}>
                  <Text style={[styles.chipText, language === lang && styles.chipTextSelected]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Quantité</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, '') || '1')}
              keyboardType="number-pad"
            />

            <View style={styles.rowBtns}>
              <CyberButton label="Reprendre" variant="ghost" onPress={retake} style={{ flex: 1 }} block cutColor={colors.bg} />
              <CyberButton
                label="Ajouter"
                variant="primary"
                onPress={confirmAdd}
                loading={adding}
                disabled={!setCode || !rarity}
                style={{ flex: 1 }}
                block
                cutColor={colors.bg}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
        <CornerOrnaments />
      </View>
    );
  }

  return null;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingTop: Platform.OS === 'ios' ? 0 : spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerCrumb: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.gold,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20, color: t.colors.textMuted },
  body: { padding: spacing[4], gap: spacing[3] },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing[1],
  },
  hint: { fontSize: 11, color: t.colors.textMuted },
  input: {
    backgroundColor: t.colors.panel,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 15,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 2,
    borderLeftColor: t.colors.gold,
    color: t.colors.text,
  },
  previewImage: {
    width: '100%',
    height: 300,
    backgroundColor: t.colors.panel2,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  identifiedBox: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: t.colors.gold,
  },
  identifiedImage: { width: 80, height: 115 },
  warnBox: {
    backgroundColor: t.colors.panel2,
    borderWidth: 1,
    borderColor: t.colors.gold,
    padding: spacing[3],
    gap: spacing[1],
  },
  warnTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  warnText: { fontSize: 12, color: t.colors.gold },
  readBox: {
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing[3],
    gap: spacing[1],
  },
  readTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  readText: { fontSize: 13, color: t.colors.text },
  candidateRow: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
  },
  candidateImage: { width: 48, height: 70 },
  identifiedName: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  identifiedMeta: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  remaining: { fontSize: 11, color: t.colors.textMuted, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chipSelected: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
  chipText: { fontSize: 12, color: t.colors.text, fontWeight: '500' },
  chipTextSelected: { color: t.colors.onGold, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  link: { color: t.colors.gold, fontSize: 14, fontWeight: '600', marginTop: spacing[2] },

  // Camera-specific
  cameraContainer: { flex: 1, backgroundColor: t.colors.camera },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.05,
  },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  oracleTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  oracleKicker: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 10,
    color: '#F5C518',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  oracleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  closeBtnDark: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTextDark: { color: '#FFFFFF', fontSize: 20 },
  cameraFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameCard: {
    width: '78%',
    aspectRatio: 59 / 86, // proportions d'une carte Yu-Gi-Oh
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    position: 'relative',
  },
  frameCode: {
    width: '80%',
    height: 64,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.5)',
    backgroundColor: 'rgba(168,85,247,0.08)',
    position: 'relative',
  },
  lockCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#F5C518',
  },
  lockTL: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  lockTR: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  lockBL: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  lockBR: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  modeRow: { flexDirection: 'row', gap: spacing[2] },
  modeChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modeChipActive: {
    backgroundColor: '#F5C518',
    borderColor: '#F5C518',
  },
  modeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modeTextActive: { color: '#0B0906', fontWeight: '700' },
  cameraFooter: {
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
    gap: spacing[4],
  },
  cameraHint: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.4)',
  },
  captureBtn: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.5)',
    backgroundColor: 'transparent',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    backgroundColor: '#F5C518',
    borderWidth: 1,
    borderColor: '#C29A0F',
  },
});
