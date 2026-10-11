import { RefreshControl, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { Screen } from '../components/layout/Screen';
import { TripPlanner } from '../components/transit/TripPlanner';
import { NetworkStatus } from '../components/transit/NetworkStatus';
import { ServiceAlertSummary } from '../components/transit/ServiceAlertSummary';
import { ShortcutCard } from '../components/ui/ShortcutCard';
import { colors } from '../theme/tokens';
import { styles } from './HomeScreen.styles';
import { useState } from 'react';
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        ['alerts', 'lines'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Screen
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <Text style={styles.heroDate}>
          {new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Toronto',
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.heroTitle}>Where Would You{'\n'}Like to GO?</Text>
      </LinearGradient>
      <View style={styles.body}>
        <TripPlanner />
        <View style={styles.quickActions}>
          <ShortcutCard
            title="Stations"
            subtitle="Find your stop"
            icon="map"
            style={styles.grow}
            onPress={() => navigation.navigate('Main', { screen: 'Stations' })}
          />
          <ShortcutCard
            title="Schedules"
            subtitle="Departure times"
            icon="clock"
            style={styles.grow}
            onPress={() => navigation.navigate('Main', { screen: 'Schedules' })}
          />
        </View>
        <ShortcutCard
          title="Union Departures"
          subtitle="Live times & platforms"
          icon="train"
          showChevron
          onPress={() => navigation.navigate('UnionDepartures')}
        />
        <ServiceAlertSummary />
        <NetworkStatus />
      </View>
    </Screen>
  );
}
