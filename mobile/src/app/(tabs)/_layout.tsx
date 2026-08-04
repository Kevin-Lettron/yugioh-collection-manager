import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/ThemeContext';

const ICONS = {
  collection: require('@/assets/images/tabIcons/tab-collection.png'),
  decks: require('@/assets/images/tabIcons/tab-decks.png'),
  // TODO(mobile): remplacer par un vrai visuel « 2 epees croisees » ou « VS ».
  // Actuellement on reutilise tab-decks.png comme placeholder (voir AGENTS.md
  // + rapport de portage duels : aucun outil de generation PNG cote agent).
  duels: require('@/assets/images/tabIcons/tab-decks.png'),
  social: require('@/assets/images/tabIcons/tab-social.png'),
  // Placeholder : pas d'icone dediee pour Actualites, on reutilise l'icone
  // Social en attendant qu'un asset tab-news.png soit fourni.
  news: require('@/assets/images/tabIcons/tab-social.png'),
  profile: require('@/assets/images/tabIcons/tab-profile.png'),
} as const;

type IconName = keyof typeof ICONS;

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <Image
      source={ICONS[name]}
      style={{ width: 24, height: 24, tintColor: color }}
      resizeMode="contain"
    />
  );
}

/** Hauteur de la barre elle-même, hors zone système. */
const TAB_BAR_HEIGHT = 62;

export default function TabsLayout() {
  const { colors, type } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Android dessine sa barre système (3 boutons ou trait de geste) PAR-DESSUS
  // l'app en mode edge-to-edge. Une hauteur fixe passait donc dessous et rendait
  // les onglets intouchables : on ajoute l'inset bas à la hauteur, et on
  // repousse le contenu de la barre d'autant.
  const bottomInset = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElev,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: TAB_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: type.tracking,
          marginBottom: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color }) => <TabIcon name="collection" color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: 'Decks',
          tabBarIcon: ({ color }) => <TabIcon name="decks" color={color} />,
        }}
      />
      <Tabs.Screen
        name="duels"
        options={{
          title: 'Duels',
          tabBarIcon: ({ color }) => <TabIcon name="duels" color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <TabIcon name="social" color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Actualités',
          tabBarIcon: ({ color }) => <TabIcon name="news" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
