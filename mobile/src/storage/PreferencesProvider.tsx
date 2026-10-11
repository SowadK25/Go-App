import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  isTrackedTrip,
  readPreferences,
  trackingExpired,
  type SavedStop,
  type TrackedTrip,
  type Preferences,
} from './preferences';
type PreferencesContextValue = Preferences & {
  ready: boolean;
  storageError: string | null;
  toggleFavorite: (stop: SavedStop) => void;
  setCommuteStop: (kind: 'home' | 'work', stop: SavedStop | null) => void;
  trackTrip: (trip: TrackedTrip | null) => void;
};
const empty: Preferences = {
  favorites: [],
  home: null,
  work: null,
  trackedTrip: null,
};
const storageKey = 'transitflow.preferences.v1';
const PreferencesContext = createContext<PreferencesContextValue | null>(null);
export function PreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<Preferences>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw || !active) return;
        setPreferences(readPreferences(JSON.parse(raw)));
      })
      .catch(() => {
        if (active) setStorageError('Stations and tracked trip could not be loaded.');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || revision === 0) return;
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(preferences)))
      .then(() => setStorageError(null))
      .catch(() =>
        setStorageError('Changes are available for this session, but could not be saved.'),
      );
  }, [preferences, ready, revision]);
  const toggleFavorite = (stop: SavedStop) => {
    if (!ready) return;
    setPreferences((current) => ({
      ...current,
      favorites: current.favorites.some((item) => item.id === stop.id)
        ? current.favorites.filter((item) => item.id !== stop.id)
        : [...current.favorites, stop],
    }));
    setRevision((current) => current + 1);
  };
  const setCommuteStop = (kind: 'home' | 'work', stop: SavedStop | null) => {
    if (!ready) return;
    setPreferences((current) => ({ ...current, [kind]: stop }));
    setRevision((current) => current + 1);
  };
  const trackTrip = (trip: TrackedTrip | null) => {
    if (!ready || (trip && (!isTrackedTrip(trip) || trackingExpired(trip)))) return;
    setPreferences((current) => ({ ...current, trackedTrip: trip }));
    setRevision((current) => current + 1);
  };
  return (
    <PreferencesContext.Provider
      value={{
        ...preferences,
        ready,
        storageError,
        toggleFavorite,
        setCommuteStop,
        trackTrip,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing');
  return context;
}
