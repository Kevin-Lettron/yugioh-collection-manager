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
import type { CardLanguage, ScanResult } from '@/types';
import { LANGUAGE_LABELS } from '@/types';

type Step = 'camera' | 'preview' | 'analyzing' | 'confirm' | 'noresult';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setStep('preview');
      }
    } catch (err: any) {
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const retake = () => {
    setPhotoUri(null);
    setScan(null);
    setDescription('');
    setStep('camera');
  };

  const analyze = async () => {
    if (!photoUri) return;
    setStep('analyzing');
    try {
      const result = await collectionApi.scan(photoUri, {
        description: description.trim() || undefined,
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
    if (!scan?.card || !setCode.trim() || !rarity) return;
    setAdding(true);
    try {
      await collectionApi.add({
        card_code: scan.card.card_id,
        set_code: setCode.trim().toUpperCase(),
        rarity,
        language,
        quantity: parseInt(quantity, 10) || 1,
      });
      Alert.alert('Ajouté', `${scan.card.name} ajouté à ta collection.`, [
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
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.title}>Accès caméra requis</Text>
        <Text style={styles.subtitle}>
          Pour scanner tes cartes, l'app a besoin d'accéder à la caméra.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={close}>
          <Text style={styles.link}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Step: camera live preview ─────────────────────────
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={close} style={styles.closeBtnDark}>
              <Text style={styles.closeTextDark}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scanner une carte</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.cameraFrame}>
            <View style={styles.frameCorner} />
          </View>

          <View style={styles.cameraFooter}>
            <Text style={styles.cameraHint}>
              Cadre la carte dans l'écran, en gros plan sur le nom et l'illustration.
            </Text>
            <TouchableOpacity
              style={[styles.captureBtn, capturing && { opacity: 0.5 }]}
              onPress={capture}
              disabled={capturing}>
              {capturing ? (
                <ActivityIndicator color="#111" />
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Aperçu</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImage} />}

          <Text style={styles.label}>Description (optionnel)</Text>
          <Text style={styles.hint}>
            Ex : "Édition française, holographique" — aide l'IA à mieux identifier.
          </Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Précisions sur la carte…"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={2}
          />

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={retake}>
              <Text style={styles.secondaryBtnText}>Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={analyze}>
              <Text style={styles.primaryBtnText}>Analyser</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step: analyzing (loading) ─────────────────────────
  if (step === 'analyzing') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.title}>Analyse en cours…</Text>
        <Text style={styles.subtitle}>Claude Vision inspecte la carte (~5-10s)</Text>
      </SafeAreaView>
    );
  }

  // ─── Step: no result ──────────────────────────────────
  if (step === 'noresult') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.title}>Carte non identifiée</Text>
        <Text style={styles.subtitle}>
          {scan?.notes || scan?.error || "L'IA n'a pas pu identifier la carte."}
        </Text>
        {typeof scan?.remainingScans === 'number' && (
          <Text style={styles.subtitle}>Scans restants : {scan.remainingScans}</Text>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={retake}>
          <Text style={styles.primaryBtnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={close}>
          <Text style={styles.link}>Ajouter manuellement</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Step: confirm identified card ────────────────────
  if (step === 'confirm' && scan?.card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carte identifiée</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.identifiedBox}>
            {scan.officialImage && (
              <Image
                source={{ uri: scan.officialImage }}
                style={styles.identifiedImage}
                resizeMode="contain"
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.identifiedName}>{scan.card.name}</Text>
              <Text style={styles.identifiedMeta}>{scan.card.type}</Text>
              {typeof scan.confidence === 'number' && (
                <Text style={styles.identifiedMeta}>
                  Confiance : {Math.round(scan.confidence * 100)}%
                </Text>
              )}
            </View>
          </View>

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
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Rareté</Text>
          <View style={styles.chipRow}>
            {(scan.availableRarities && scan.availableRarities.length > 0
              ? scan.availableRarities
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
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={retake}>
              <Text style={styles.secondaryBtnText}>Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { flex: 1 },
                (!setCode || !rarity || adding) && { opacity: 0.5 },
              ]}
              onPress={confirmAdd}
              disabled={!setCode || !rarity || adding}>
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Ajouter</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  closeBtn: { padding: 4, width: 30 },
  closeText: { fontSize: 22, color: '#6b7280' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  body: { padding: 16, gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  hint: { fontSize: 11, color: '#9ca3af' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  identifiedBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  identifiedImage: { width: 80, height: 115 },
  identifiedName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  identifiedMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  remaining: { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    backgroundColor: '#7c3aed',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: '#e5e7eb',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  link: { color: '#7c3aed', fontSize: 14, fontWeight: '600', marginTop: 8 },

  // Camera-specific
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeBtnDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTextDark: { color: '#fff', fontSize: 22 },
  cameraFrame: { flex: 1 },
  frameCorner: {},
  cameraFooter: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  cameraHint: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  captureBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#111',
  },
});
