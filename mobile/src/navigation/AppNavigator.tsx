import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '../components/ui/Icon';
import { HomeScreen } from '../screens/HomeScreen';
import { StationsScreen } from '../screens/StationsScreen';
import { SchedulesScreen } from '../screens/SchedulesScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { DeparturesScreen } from '../screens/DeparturesScreen';
import { TripResultsScreen } from '../screens/TripResultsScreen';
import { JourneyDetailsScreen } from '../screens/JourneyDetailsScreen';
import { ScheduleTripDetailsScreen } from '../screens/ScheduleTripDetailsScreen';
import { UnionDeparturesScreen } from '../screens/UnionDeparturesScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { SystemMapScreen } from '../screens/SystemMapScreen';
import type { MainTabParams, RootStackParams } from './types';
import { stackOptions, tabOptions } from './navigation.styles';
const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<MainTabParams>();
const icons: Record<keyof MainTabParams, IconName> = {
  Home: 'home',
  Stations: 'map',
  Schedules: 'clock',
  AlertsTab: 'bell',
};
function AlertDetails({ route }: NativeStackScreenProps<RootStackParams, 'Alerts'>) {
  return <AlertsScreen header={false} initialLineCodes={route.params?.lineCodes} />;
}
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        ...tabOptions,
        tabBarIcon: ({ color, size }) => (
          <Icon name={icons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Stations" component={StationsScreen} />
      <Tabs.Screen name="Schedules" component={SchedulesScreen} />
      <Tabs.Screen name="AlertsTab" component={AlertsScreen} options={{ title: 'Alerts' }} />
    </Tabs.Navigator>
  );
}
export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Main" screenOptions={stackOptions}>
        <Stack.Screen
          name="ScheduleTripDetails"
          component={ScheduleTripDetailsScreen}
          options={{ title: 'Trip Details' }}
        />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="SystemMap"
          component={SystemMapScreen}
          options={{ title: 'System Map' }}
        />
        <Stack.Screen
          name="UnionDepartures"
          component={UnionDeparturesScreen}
          options={{ title: 'Union Departures' }}
        />
        <Stack.Screen
          name="Departures"
          component={DeparturesScreen}
          options={({ route }) => ({ title: route.params.stopName })}
        />
        <Stack.Screen
          name="TripResults"
          component={TripResultsScreen}
          options={{ title: 'Your Journey' }}
        />
        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{ title: 'Saved Stations' }}
        />
        <Stack.Screen
          name="JourneyDetails"
          component={JourneyDetailsScreen}
          options={{ title: 'Trip Details' }}
        />
        <Stack.Screen
          name="Alerts"
          component={AlertDetails}
          options={{ title: 'Service Alerts' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
