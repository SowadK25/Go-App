import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Stop } from '../api/generated';
type SavedStop = Pick<Stop, 'id' | 'name' | 'type'>;
type Preferences = { favorites: SavedStop[]; home: SavedStop | null; work: SavedStop | null };
type PreferencesContextValue = Preferences & {
  ready: boolean;
  storageError: string | null;
  toggleFavorite: (stop: SavedStop) => void;
  setCommuteStop: (kind: 'home' | 'work', stop: SavedStop | null) => void;
};
const empty: Preferences = { favorites: [], home: null, work: null };
const storageKey = 'transitflow.preferences.v1';
const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const isStop = (value: unknown): value is SavedStop =>
  !!value &&
  typeof value === 'object' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'name' in value &&
  typeof value.name === 'string' &&
  'type' in value &&
  typeof value.type === 'string';
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
        const value = JSON.parse(raw) as Partial<Preferences>;
        setPreferences({
          favorites: Array.isArray(value.favorites) ? value.favorites.filter(isStop) : [],
          home: isStop(value.home) ? value.home : null,
          work: isStop(value.work) ? value.work : null,
        });
      })
      .catch(() => {
        if (active) setStorageError('Saved stations could not be loaded.');
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
  return (
    <PreferencesContext.Provider
      value={{ ...preferences, ready, storageError, toggleFavorite, setCommuteStop }}
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
