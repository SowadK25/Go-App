import type { NetworkMap } from '../api/generated';
import type { MapFilter } from '../components/map/mapTypes';

export function visibleMapLines(network: NetworkMap, filter: MapFilter) {
  const hidden = new Set(filter.hiddenLineCodes ?? []);
  return network.lines.filter(
    (line) =>
      (filter.mode === 'all' || line.vehicle_type.toLowerCase() === filter.mode) &&
      (!filter.lineCode || line.code === filter.lineCode) &&
      !hidden.has(line.code),
  );
}

export function visibleMapStops(network: NetworkMap, filter: MapFilter) {
  const lines = new Set(visibleMapLines(network, filter).map((line) => line.code));
  const query = filter.search.trim().toLowerCase();
  return network.stops.filter((stop) => {
    const codes = stop.line_codes ?? [];
    return (
      (codes.some((code) => lines.has(code)) ||
        (!codes.length &&
          filter.mode === 'all' &&
          !filter.lineCode &&
          !filter.hiddenLineCodes?.length)) &&
      (!query || `${stop.name} ${stop.id}`.toLowerCase().includes(query))
    );
  });
}

export function toggleMapLine(hidden: string[], code: string) {
  return hidden.includes(code) ? hidden.filter((item) => item !== code) : [...hidden, code];
}
