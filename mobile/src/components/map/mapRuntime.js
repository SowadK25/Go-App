(function () {
  'use strict';
  const network = window.TRANSIT_NETWORK;
  const send = (message) => {
    const payload = { source: 'transitflow-map', ...message };
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    else window.parent.postMessage(payload, '*');
  };
  const map = L.map('map', { zoomControl: true, minZoom: 6, maxZoom: 19, zoomAnimation: false, fadeAnimation: false });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, keepBuffer: 1, updateWhenIdle: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  let tileWarning = false;
  tiles.on('tileerror', () => { if (!tileWarning) { tileWarning = true; send({ type: 'tile-error' }); } });
  const routes = L.layerGroup().addTo(map);
  const stations = L.layerGroup().addTo(map);
  let fitted = false;
  let lastQuery;
  let stationMarkers = [];
  const trainIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 10h14M9 3v7M15 3v7M8 21l2-3M16 21l-2-3"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>';
  const busIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 10h16M12 3v7M7 19v2M17 19v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>';
  function updateStationLabels() {
    const occupied = [];
    const size = map.getSize();
    const zoom = map.getZoom();
    stationMarkers.forEach((record) => {
      const point = map.latLngToContainerPoint(record.marker.getLatLng());
      const width = Math.min(200, record.stop.name.length * 7 + 20);
      let direction = 'right';
      let visible = false;
      if (zoom >= (record.isTrain ? 10 : 14)) {
        for (const side of ['right', 'left']) {
          const left = side === 'right' ? point.x + 20 : point.x - width - 20;
          const box = { left, right: left + width, top: point.y - 14, bottom: point.y + 14 };
          if (box.left >= 4 && box.right <= size.x - 4 && box.top >= 4 && box.bottom <= size.y - 4 &&
              !occupied.some((other) => box.left < other.right + 6 && box.right + 6 > other.left && box.top < other.bottom + 4 && box.bottom + 4 > other.top)) {
            occupied.push(box); direction = side; visible = true; break;
          }
        }
      }
      if (record.labelVisible !== visible || record.labelDirection !== direction) {
        record.marker.unbindTooltip().bindTooltip(record.label, {
          permanent: visible, direction, offset: L.point(direction === 'right' ? 16 : -16, 0),
          opacity: 1, className: 'station-label',
        });
        record.labelVisible = visible; record.labelDirection = direction;
      }
    });
  }
  map.on('zoomend moveend', updateStationLabels);
  const modeMatches = (line, mode) => mode === 'all' || line.vehicle_type.toLowerCase() === mode;
  const keyboardAction = (layer, label, action) => {
    const element = layer.getElement();
    if (!element) return;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', label);
    element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
  };
  function setFilter(filter) {
    const mode = filter.mode || 'all';
    const query = (filter.search || '').trim().toLowerCase();
    const shouldFit = !fitted || query !== lastQuery;
    lastQuery = query;
    const hidden = new Set(filter.hiddenLineCodes || []);
    const lines = network.lines.filter((line) => modeMatches(line, mode) && (!filter.lineCode || line.code === filter.lineCode) && !hidden.has(line.code));
    const codes = new Set(lines.map((line) => line.code));
    routes.clearLayers(); stations.clearLayers(); map.closePopup();
    stationMarkers = [];
    const bounds = [];
    lines.forEach((line) => {
      const label = document.createElement('span'); label.textContent = line.code + ' · ' + line.name;
      (line.shapes || []).forEach((shape) => {
        const route = L.polyline(shape, { color: line.color, weight: line.vehicle_type === 'Train' ? 4 : 2, opacity: line.vehicle_type === 'Train' ? 0.85 : 0.55 }).addTo(routes);
        route.bindTooltip(label.cloneNode(true), { sticky: true });
        const select = () => send({ type: 'select-line', lineCode: line.code });
        route.on('click', select);
        keyboardAction(route, 'Line ' + line.code + ': ' + line.name, select);
      });
    });
    network.stops.filter((stop) => {
      const membership = stop.line_codes || [];
      const matches = membership.some((code) => codes.has(code)) || (!membership.length && mode === 'all' && !filter.lineCode && !hidden.size);
      return matches && (!query || (stop.name + ' ' + stop.id).toLowerCase().includes(query));
    }).forEach((stop) => {
      const point = [stop.latitude, stop.longitude]; bounds.push(point);
      const isTrain = (stop.line_codes || []).some((code) => network.lines.some((line) => line.code === code && line.vehicle_type === 'Train'));
      const stationLines = network.lines.filter((line) => (stop.line_codes || []).includes(line.code));
      const markerLines = stationLines.filter((line) => codes.has(line.code) && line.vehicle_type === (isTrain ? 'Train' : 'Bus'));
      const color = markerLines.length === 1 ? markerLines[0].color : (isTrain ? '#4a7c34' : '#576b7c');
      const symbol = document.createElement('span'); symbol.className = 'station-marker-symbol';
      symbol.style.setProperty('--station-color', color); symbol.innerHTML = isTrain ? trainIcon : busIcon;
      const marker = L.marker(point, {
        icon: L.divIcon({ className: 'station-marker', html: symbol, iconSize: [44,44], iconAnchor: [22,22], popupAnchor: [0,-18] }),
        keyboard: false, title: stop.name,
      }).addTo(stations);
      const label = document.createElement('span'); label.textContent = stop.name;
      stationMarkers.push({ marker, stop, isTrain, label });
      const popup = document.createElement('div'); popup.className = 'station-card';
      const heading = document.createElement('div'); heading.className = 'station-heading';
      const icon = document.createElement('span'); icon.className = 'station-card-icon'; icon.innerHTML = isTrain ? trainIcon : busIcon;
      const titles = document.createElement('div'); titles.className = 'station-titles';
      const type = document.createElement('span'); type.className = 'station-type'; type.textContent = isTrain ? 'Train station' : 'Bus stop';
      const name = document.createElement('strong'); name.className = 'station-name'; name.textContent = stop.name;
      titles.append(type,name); heading.append(icon,titles);
      const linesText = document.createElement('div'); linesText.className = 'station-lines';
      stationLines.forEach((line) => {
        const badge = document.createElement('span'); badge.className = 'station-line-badge';
        badge.style.backgroundColor = line.color; badge.textContent = line.code; badge.title = line.name;
        linesText.append(badge);
      });
      const hint = document.createElement('p'); hint.className = 'station-hint'; hint.textContent = 'Departure times, platforms and service updates';
      const button = document.createElement('button'); button.className = 'station-departures'; button.textContent = 'View departures';
      button.addEventListener('click', () => send({ type: 'select-stop', stopId: stop.id }));
      popup.append(heading, linesText, hint, button);
      marker.bindPopup(popup, { className: 'station-popup', minWidth: 220, maxWidth: 270, autoPanPadding: [20,20] });
      keyboardAction(marker, 'Station: ' + stop.name, () => marker.openPopup());
    });
    stationMarkers.sort((a,b) => Number(b.isTrain) - Number(a.isTrain) || a.stop.name.localeCompare(b.stop.name));
    if (shouldFit && bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: query ? 15 : 12, animate: false });
      fitted = true;
    }
    updateStationLabels();
  }
  window.TransitMap = { setFilter };
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || event.data.source !== 'transitflow-app') return;
    if (event.data.type === 'filter') setFilter(event.data.filter);
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a');
    if (link) { event.preventDefault(); send({ type: 'open-url', url: link.href }); }
  });
  new ResizeObserver(() => map.invalidateSize()).observe(document.getElementById('map'));
  // Wait for the app's initial selection before rendering/fitting the network.
  map.setView([43.7, -79.6], 8);
  send({ type: 'ready' });
})();
