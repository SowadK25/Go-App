import { Pressable, Text, View } from 'react-native';
import type { Stop } from '../../api/generated';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { LineBadge } from '../ui/LineBadge';
import { usePreferences } from '../../storage/PreferencesProvider';
import { colors } from '../../theme/tokens';
import { styles } from './transit.styles';
export function StationRow({
  stop,
  onPress,
  lineCode,
  favoriteAction = true,
}: {
  stop: Stop;
  onPress: () => void;
  lineCode?: string;
  favoriteAction?: boolean;
}) {
  const { favorites, toggleFavorite, ready } = usePreferences();
  const favorite = favorites.some((item) => item.id === stop.id);
  return (
    <View style={styles.listRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${stop.name}`}
        onPress={onPress}
        style={styles.row}
      >
        <View style={styles.iconCircle}>
          <Icon name={stop.type.toLowerCase().includes('train') ? 'train' : 'truck'} size={18} />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Departures from ${stop.name}`}
        onPress={onPress}
        style={styles.grow}
      >
        <Text style={styles.title}>{stop.name}</Text>
        <View style={styles.tags}>
          {lineCode && <LineBadge code={lineCode} />}
          <Text style={styles.subtitle}>
            {stop.type || 'Station'} · {stop.id}
          </Text>
        </View>
      </Pressable>
      {favoriteAction && (
        <IconButton
          name="star"
          label={`${favorite ? 'Remove' : 'Add'} ${stop.name} ${favorite ? 'from' : 'to'} favorites`}
          selected={favorite}
          disabled={!ready}
          color={favorite ? colors.favorite : colors.subtle}
          onPress={() => toggleFavorite(stop)}
        />
      )}
      <IconButton
        name="chevron-right"
        label={`Open ${stop.name}`}
        color={colors.subtle}
        onPress={onPress}
      />
    </View>
  );
}
