import type { NetworkMap } from '../../api/generated';

export type MapFilter = {
  mode: 'all' | 'train' | 'bus';
  lineCode?: string;
  hiddenLineCodes?: string[];
  search: string;
};
export type TransitMapProps = {
  network: NetworkMap;
  filter: MapFilter;
  onSelectStop: (id: string) => void;
  onSelectLine: (code: string) => void;
  onTileError: () => void;
};

export function handleMapMessage(raw: unknown, props: TransitMapProps) {
  if (!raw || typeof raw !== 'object') return;
  const value = raw as { source?: unknown; type?: unknown; stopId?: unknown; lineCode?: unknown };
  if (value.source !== 'transitflow-map') return;
  if (value.type === 'select-stop' && props.network.stops.some((stop) => stop.id === value.stopId))
    props.onSelectStop(value.stopId as string);
  if (
    value.type === 'select-line' &&
    props.network.lines.some((line) => line.code === value.lineCode)
  )
    props.onSelectLine(value.lineCode as string);
  if (value.type === 'tile-error') props.onTileError();
}

export function attributionUrl(value: unknown) {
  if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string')
    return null;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' &&
      ['www.openstreetmap.org', 'openstreetmap.org', 'leafletjs.com'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
