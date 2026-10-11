import type { NavigatorScreenParams } from '@react-navigation/native';
import type { JourneyService, JourneyStop } from '../api/generated';
import type { JourneySearchMode } from '../utils/journeys';

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
    searchMode?: JourneySearchMode;
  };
  Preferences: undefined;
  SystemMap: undefined;
  JourneyDetails: { journey: JourneyService; fromName: string; toName: string; date: string };
  Alerts: { lineCodes?: string[] } | undefined;
  UnionDepartures: undefined;
  ScheduleTripDetails: {
    tripNumber: string;
    title: string;
    date: string;
    lineCode?: string;
    scheduledStops?: JourneyStop[];
  };
};
