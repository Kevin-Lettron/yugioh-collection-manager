import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import CyberButton from '@/components/CyberButton';
import { API_URL } from '@/config';
import { spacing } from '@/theme/palette';

/**
 * Écran /settings — édition du compte user :
 *   - Upload avatar (expo-image-picker → POST /auth/upload-avatar)
 *   - Modification username / email
 *   - Changement de mot de passe (nouvelle + confirmation)
 *   - Déconnexion
 * Toutes les modifs passent par AuthContext qui rafraîchit le user global.
 */
export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const { user, updateProfile, uploadAvatar, logout } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  const avatarUri = user?.profile_picture
    ? user.profile_picture.startsWith('http')
      ? user.profile_picture
      : `${String(API_URL || '').replace(/\/api\/?$/, '')}${user.profile_picture}`
    : null;
  const initials = (user?.username || 'YG').slice(0, 2).toUpperCase();

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorise l\'accès aux photos pour changer ton avatar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      await uploadAvatar(res.assets[0].uri, res.assets[0].mimeType || 'image/jpeg');
      Alert.alert('Avatar mis à jour');
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Upload échoué');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Champs manquants', 'Pseudo et email sont requis');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ username: username.trim(), email: email.trim() });
      Alert.alert('Profil mis à jour');
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || err?.response?.data?.message || 'Sauvegarde impossible');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Mot de passe invalide', 'Minimum 8 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Confirmation incorrecte', 'Les 2 mots de passe ne correspondent pas.');
      return;
    }
    setSavingPassword(true);
    try {
      await updateProfile({ password });
      setPassword('');
      setPasswordConfirm('');
      Alert.alert('Mot de passe modifié');
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || err?.response?.data?.message || 'Changement échoué');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Se déconnecter ?', 'Tu devras te reconnecter au prochain lancement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Compte</Text>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.kicker}>— Sanctuaire personnel —</Text>
            <Text style={styles.title}>Réglages du compte</Text>

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={uploading}
                style={styles.avatarWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
                {uploading && (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color={colors.gold} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickAvatar} disabled={uploading}>
                <Text style={styles.avatarBtn}>Changer l'avatar</Text>
              </TouchableOpacity>
            </View>

            {/* Identity form */}
            <Text style={styles.sectionTitle}>Identité</Text>
            <Text style={styles.fieldLabel}>Pseudo</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Ton pseudo"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ton@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.actionRow}>
              <CyberButton
                label={savingProfile ? 'Enregistrement…' : 'Enregistrer'}
                variant="primary"
                onPress={handleSaveProfile}
                loading={savingProfile}
                disabled={savingProfile}
                block
                cutColor={colors.bg}
              />
            </View>

            {/* Password form */}
            <Text style={styles.sectionTitle}>Mot de passe</Text>
            <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min 8 caractères"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <Text style={styles.fieldLabel}>Confirmation</Text>
            <TextInput
              style={styles.input}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="Retape le nouveau mot de passe"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <View style={styles.actionRow}>
              <CyberButton
                label={savingPassword ? 'Changement…' : 'Changer le mot de passe'}
                variant="secondary"
                onPress={handleChangePassword}
                loading={savingPassword}
                disabled={savingPassword}
                block
                cutColor={colors.bg}
              />
            </View>

            {/* Logout */}
            <View style={styles.dangerZone}>
              <Text style={styles.sectionTitle}>Zone rouge</Text>
              <CyberButton
                label="Se déconnecter"
                variant="danger"
                onPress={handleLogout}
                block
                cutColor={colors.bg}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    backBtn: { paddingVertical: 6, paddingRight: 8 },
    backText: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      color: t.colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '900',
      color: t.colors.text,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    body: { padding: 20, gap: 14, paddingBottom: 80 },

    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.6,
      color: t.colors.gold,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 4,
      fontFamily: 'sans-serif',
      fontSize: 26,
      fontWeight: '900',
      color: t.colors.text,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },

    avatarSection: {
      marginTop: 12,
      alignItems: 'center',
      gap: 10,
    },
    avatarWrap: {
      width: 96,
      height: 96,
      borderWidth: 2,
      borderColor: t.colors.gold,
      backgroundColor: t.colors.violet,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarInitials: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      fontWeight: '900',
      color: t.colors.onGold,
    },
    avatarLoading: {
      position: 'absolute',
      inset: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    avatarBtn: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      color: t.colors.gold,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      fontWeight: '700',
    },

    sectionTitle: {
      marginTop: 24,
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: t.colors.gold,
      fontWeight: '700',
    },
    fieldLabel: {
      marginTop: 10,
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1.8,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    input: {
      marginTop: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.gold,
      color: t.colors.text,
      fontSize: 15,
    },
    actionRow: {
      marginTop: spacing[3],
    },
    dangerZone: {
      marginTop: 32,
      gap: 10,
    },
  });
