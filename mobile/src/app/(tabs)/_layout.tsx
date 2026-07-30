import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7c3aed',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🃏</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: 'Decks',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📚</Text>
          ),
        }}
      />
    </Tabs>
  );
}
