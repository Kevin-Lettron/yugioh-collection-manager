import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7c3aed',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Collection' }} />
    </Tabs>
  );
}
