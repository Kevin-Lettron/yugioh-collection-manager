import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

const ICONS = {
  collection: require('@/assets/images/tabIcons/tab-collection.png'),
  decks: require('@/assets/images/tabIcons/tab-decks.png'),
  social: require('@/assets/images/tabIcons/tab-social.png'),
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

export default function TabsLayout() {
  const { colors, type } = useAppTheme();

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
          height: 62,
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
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <TabIcon name="social" color={color} />,
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
