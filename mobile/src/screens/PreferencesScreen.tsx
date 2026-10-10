import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../components/layout/Screen';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { ActionButton } from '../components/ui/ActionButton';
import { StationPicker } from '../components/transit/StationPicker';
import { usePreferences } from '../storage/PreferencesProvider';
import { styles } from './screens.styles';
export function PreferencesScreen() {
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
      <Card>
        <SectionHeading title="Favorite stations" />
        <Text style={styles.subtitle}>
          Tap the star beside a station to save it. Your favorites appear at the top of Stations.
        </Text>
        <Text style={styles.label}>{preferences.favorites.length} saved stations</Text>
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
