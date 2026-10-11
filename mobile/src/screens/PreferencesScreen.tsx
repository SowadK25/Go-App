import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ActionButton } from '../components/ui/ActionButton';
import { StationPicker } from '../components/transit/StationPicker';
import { StationRow } from '../components/transit/StationRow';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { usePreferences } from '../storage/PreferencesProvider';
import { styles } from './screens.styles';
import { styles as preferenceStyles } from './PreferencesScreen.styles';
export function PreferencesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const preferences = usePreferences();
  const [picker, setPicker] = useState<'home' | 'work' | null>(null);
  return (
    <Screen header={false}>
      <Card>
        <SectionHeading title="Home & Work" />
        <Text style={styles.subtitle}>Save your regular stations for a quicker trip search.</Text>
        {(['home', 'work'] as const).map((kind) => (
          <View key={kind} style={styles.column}>
            <Text style={styles.label}>{kind === 'home' ? 'Home station' : 'Work station'}</Text>
            <ActionButton
              title={preferences[kind]?.name ?? `Choose ${kind} station`}
              icon={kind === 'home' ? 'home' : 'briefcase'}
              secondary
              disabled={!preferences.ready}
              onPress={() => setPicker(kind)}
            />
            {preferences[kind] && (
              <ActionButton
                title="Clear station"
                secondary
                onPress={() => preferences.setCommuteStop(kind, null)}
              />
            )}
          </View>
        ))}
        {!!preferences.storageError && (
          <Text style={styles.subtitle}>{preferences.storageError}</Text>
        )}
      </Card>
      <Card padded={false} style={preferenceStyles.favoritesCard}>
        <View style={preferenceStyles.favoritesHeading}>
          <SectionHeading title="Favorite stations" />
          <Text style={styles.subtitle}>
            {!preferences.ready
              ? 'Loading favorite stations...'
              : preferences.favorites.length
                ? 'Tap a station for departures. Tap its star to remove it from favorites.'
                : 'No favorite stations yet. Tap the star beside a station in Stations to save it.'}
          </Text>
        </View>
        {[...preferences.favorites]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((stop) => (
            <StationRow
              key={stop.id}
              stop={stop}
              onPress={() =>
                navigation.navigate('Departures', { stopCode: stop.id, stopName: stop.name })
              }
            />
          ))}
      </Card>
      <StationPicker
        visible={picker !== null}
        title={`Choose ${picker ?? 'home'} station`}
        onClose={() => setPicker(null)}
        onSelect={(stop) => {
          if (picker) preferences.setCommuteStop(picker, stop);
        }}
      />
    </Screen>
  );
}
