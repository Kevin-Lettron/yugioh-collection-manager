import { memo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const CORNER = require('@/assets/images/decor/corner.png');
const BELL = require('@/assets/images/ui/i-bell.png');

/**
 * Header sticky global — Sanctuaire du Millénium.
 * Logo Millennium doré animé + Keit·LAND wordmark, notifications avec dot magenta,
 * avatar hexagonal dégradé violet→or avec initiales.
 * Sous le header, 2 ornements de coin ancrent le début du contenu.
 */
function AppHeaderBase({ onPressAvatar }: { onPressAvatar?: () => void }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();
  const initials = (user?.username || 'YG').slice(0, 2).toUpperCase();
  // Comportement par défaut : cliquer l'avatar nav vers l'onglet Profil.
  // Un override via `onPressAvatar` reste possible (ex: sur la page profil
  // elle-même on veut peut-être ouvrir un menu déconnexion).
  const handleAvatarPress = onPressAvatar || (() => router.push('/(tabs)/profile'));

  return (
    <View>
      <View style={[styles.wrap, { backgroundColor: colors.bgElev, borderBottomColor: colors.border }]}>
        {/* Brand — logo + wordmark */}
        <View style={styles.brand}>
          <MillenniumLogo color={colors.gold} />
          <Text style={[styles.brandName, { color: colors.text }]}>
            Keit<Text style={{ color: colors.gold }}>land</Text>
          </Text>
        </View>

        {/* Actions droite */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.iconBtn, { borderColor: colors.border }]}>
            <Image
              source={BELL}
              style={{ width: 16, height: 16, tintColor: colors.textMuted }}
              resizeMode="contain"
            />
            <View style={[styles.dot, { backgroundColor: colors.magenta }]} />
          </Pressable>
          <Pressable
            onPress={handleAvatarPress}
            style={[
              styles.avatar,
              { borderColor: colors.gold, backgroundColor: colors.violet },
            ]}>
            {user?.profile_picture ? (
              <Image
                source={{ uri: buildProfileUri(user.profile_picture) }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.avatarText, { color: colors.onGold }]}>{initials}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Ornements de coin sous le header */}
      <View style={styles.cornersRow} pointerEvents="none">
        <Image
          source={CORNER}
          style={{ width: 40, height: 40, tintColor: colors.gold, opacity: 0.4 }}
          resizeMode="contain"
        />
        <Image
          source={CORNER}
          style={{
            width: 40,
            height: 40,
            tintColor: colors.gold,
            opacity: 0.4,
            transform: [{ scaleX: -1 }],
          }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

/**
 * Logo Millennium simplifié en View — triangle inversé avec un point central,
 * pas de SVG (RN sans react-native-svg).
 */
function MillenniumLogo({ color }: { color: string }) {
  return (
    <View style={styles.logoWrap}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 13,
          borderLeftColor: 'transparent',
          borderRightWidth: 13,
          borderRightColor: 'transparent',
          borderTopWidth: 22,
          borderTopColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 6,
          alignSelf: 'center',
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#0B0906',
        }}
      />
    </View>
  );
}

/**
 * Le back stocke profile_picture au format `/uploads/profiles/xxx.png`.
 * En mobile il faut préfixer par la baseURL. Détecte aussi les URL absolues.
 */
function buildProfileUri(pp: string): string {
  if (/^https?:\/\//i.test(pp)) return pp;
  // Fallback conservateur : on prend l'origin de l'API sans le suffixe /api.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { API_URL } = require('@/config');
  const origin = String(API_URL || '').replace(/\/api\/?$/, '');
  return `${origin}${pp}`;
}

export const AppHeader = memo(AppHeaderBase);
export default AppHeader;

const styles = StyleSheet.create({
  wrap: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 20,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'sans-serif',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  avatar: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'sans-serif',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cornersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
