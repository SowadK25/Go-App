// Shared by the embedded Leaflet runtime and the map layout tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TransitMapLayout = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isMajorStation(stop, lines) {
    const railCodes = new Set(lines.filter((line) => line.vehicle_type === 'Train').map((line) => line.code));
    const memberships = new Set((stop.line_codes || []).filter((code) => railCodes.has(code)));
    return memberships.size > 1 || (memberships.size > 0 &&
      /^(union station|bramalea|kitchener|aldershot|west harbour|hamilton|oshawa|allandale waterfront|richmond hill|old elm|milton|pearson|oakville)\b/i.test(stop.name));
  }

  function stationIsVisible(record, zoom, searching) {
    return searching || record.isMajor || zoom >= (record.isTrain ? 10 : 13);
  }

  function groupNearbyTrains(points, radius = 56) {
    const groups = [];
    // Stable ordering keeps groups from changing just because a feed was reordered.
    [...points].sort((a, b) => a.id.localeCompare(b.id)).forEach((point) => {
      // Every member must be nearby, preventing a long chain becoming one huge group.
      const group = groups.find((members) => members.every((member) =>
        (point.x - member.x) ** 2 + (point.y - member.y) ** 2 < radius ** 2));
      if (group) group.push(point);
      else groups.push([point]);
    });
    return groups;
  }

  function trainDirection(train, stops) {
    if (!['moving', 'approaching'].includes(train.status)) return null;
    const stop = stops.find((item) => item.id === train.stop_code && (item.line_codes || []).includes(train.line_code));
    if (!stop || ![train.latitude, train.longitude, stop.latitude, stop.longitude].every(Number.isFinite)) return null;
    const radians = Math.PI / 180;
    const latitude = train.latitude * radians;
    const targetLatitude = stop.latitude * radians;
    const deltaLongitude = (stop.longitude - train.longitude) * radians;
    const deltaLatitude = targetLatitude - latitude;
    const distance = 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(
      Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(deltaLongitude / 2) ** 2)));
    // At a stop, tiny GPS differences do not establish a useful travel direction.
    if (distance < 150) return null;
    const y = Math.sin(deltaLongitude) * Math.cos(targetLatitude);
    const x = Math.cos(latitude) * Math.sin(targetLatitude) - Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(deltaLongitude);
    const bearing = (Math.atan2(y, x) / radians + 360) % 360;
    const compass = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(bearing / 45) % 8];
    return { bearing, compass, stopName: stop.name };
  }

  return { isMajorStation, stationIsVisible, groupNearbyTrains, trainDirection };
});
