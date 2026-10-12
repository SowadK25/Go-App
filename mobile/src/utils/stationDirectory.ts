import type { Stop } from '../api/generated';

export function filterStationDirectory(catalog: Stop[], search: string, lineMembers?: Stop[]) {
  const current = new Map(catalog.map((stop) => [stop.id, stop]));
  const source = lineMembers ? lineMembers.map((stop) => current.get(stop.id) ?? stop) : catalog;
  const query = search.trim().toLowerCase();
  return source
    .filter((stop) => `${stop.name} ${stop.id}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
}
