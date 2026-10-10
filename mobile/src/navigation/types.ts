import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParams = {
  Home: undefined;
  Stations: undefined;
  Schedules: { lineCode?: string } | undefined;
  AlertsTab: undefined;
};
export type RootStackParams = {
  Main: NavigatorScreenParams<MainTabParams> | undefined;
  Departures: { stopCode: string; stopName: string };
  TripResults: {
    fromCode: string;
    fromName: string;
    toCode: string;
    toName: string;
    date: string;
    time: string;
  };
  Preferences: undefined;
  Alerts: undefined;
};
