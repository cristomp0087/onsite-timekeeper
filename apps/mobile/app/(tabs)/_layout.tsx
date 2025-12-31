import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color }) => <TabIcon icon="🗺️" color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Histórico',
            tabBarIcon: ({ color }) => <TabIcon icon="📋" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Config',
            tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={{ opacity: color === colors.primary ? 1 : 0.6 }}>
      <View style={{ fontSize: 24 }}>
        <View>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>
      </View>
    </View>
  );
}

import { Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
