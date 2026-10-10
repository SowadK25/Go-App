import { Pressable, RefreshControl, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { Screen } from '../components/layout/Screen';
import { TripPlanner } from '../components/transit/TripPlanner';
import { NetworkStatus } from '../components/transit/NetworkStatus';
import { ServiceAlertSummary } from '../components/transit/ServiceAlertSummary';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Icon, type IconName } from '../components/ui/Icon';
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
  const links: { title: string; icon: IconName; onPress: () => void }[] = [
    {
      title: 'Find a Station',
      icon: 'map-pin',
      onPress: () => navigation.navigate('Main', { screen: 'Stations' }),
    },
    {
      title: 'Union Departures',
      icon: 'train',
      onPress: () =>
        navigation.navigate('Departures', { stopCode: 'UN', stopName: 'Union Station' }),
    },
    { title: 'Service Alerts', icon: 'bell', onPress: () => navigation.navigate('Alerts') },
  ];
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
          <Pressable
            accessibilityRole="button"
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', { screen: 'Stations' })}
          >
            <View style={styles.icon}>
              <Icon name="map" />
            </View>
            <View style={styles.grow}>
              <Text style={styles.actionTitle}>Stations</Text>
              <Text style={styles.actionCaption}>Find your stop</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.quickAction}
            onPress={() => navigation.navigate('Main', { screen: 'Schedules' })}
          >
            <View style={styles.icon}>
              <Icon name="clock" />
            </View>
            <View style={styles.grow}>
              <Text style={styles.actionTitle}>Schedules</Text>
              <Text style={styles.actionCaption}>Departure times</Text>
            </View>
          </Pressable>
        </View>
        <ServiceAlertSummary />
        <NetworkStatus />
        <Card>
          <SectionHeading title="Useful Links" />
          <View style={styles.linkGrid}>
            {links.map((link) => (
              <Pressable
                key={link.title}
                accessibilityRole="button"
                style={styles.link}
                onPress={link.onPress}
              >
                <View style={styles.linkIcon}>
                  <Icon name={link.icon} />
                </View>
                <Text style={styles.linkText}>{link.title}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
