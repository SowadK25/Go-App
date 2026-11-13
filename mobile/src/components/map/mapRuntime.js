(function () {
  'use strict';
  const network = window.TRANSIT_NETWORK;
  const layout = window.TransitMapLayout;
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
  map.createPane('live-trains').style.zIndex = '640';
  const trains = L.layerGroup().addTo(map);
  const trainMarkers = new Map();
  let trainPositions = [];
  let visibleLineCodes = new Set();
  let searching = false;
  let clusterPopup;
  let clusterPopupId;
  let fitted = false;
  let lastQuery;
  let stationMarkers = [];
  const trainIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 10h14M9 3v7M15 3v7M8 21l2-3M16 21l-2-3"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>';
  const busIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 10h16M12 3v7M7 19v2M17 19v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>';
  function updateStationLabels() {
    const occupied = [];
    const size = map.getSize();
    const zoom = map.getZoom();
    trainMarkers.forEach((marker) => {
      const point = map.latLngToContainerPoint(marker.getLatLng());
      occupied.push({ left: point.x - 28, right: point.x + 28, top: point.y - 26, bottom: point.y + 26 });
    });
    stationMarkers.forEach((record) => {
      if (!stations.hasLayer(record.marker)) return;
      const point = map.latLngToContainerPoint(record.marker.getLatLng());
      const width = Math.min(200, record.stop.name.length * 7 + 20);
      let direction = 'right';
      let visible = false;
      if (searching || zoom >= (record.isMajor ? 8 : record.isTrain ? 10 : 14)) {
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
  function updateStations() {
    const bounds = map.getBounds().pad(0.2);
    stationMarkers.forEach((record) => {
      const visible = bounds.contains(record.marker.getLatLng()) && layout.stationIsVisible(record, map.getZoom(), searching);
      if (visible && !stations.hasLayer(record.marker)) {
        record.marker.addTo(stations);
        keyboardAction(record.marker, 'Station: ' + record.stop.name, () => record.marker.openPopup());
      } else if (!visible && stations.hasLayer(record.marker)) stations.removeLayer(record.marker);
    });
    updateStationLabels();
  }
  map.on('zoomend moveend', () => { renderTrains(); updateStations(); });
  const modeMatches = (line, mode) => mode === 'all' || line.vehicle_type.toLowerCase() === mode;
  const keyboardAction = (layer, label, action) => {
    const element = layer.getElement();
    if (!element) return;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', label);
    if (element.dataset.keyboardReady) return;
    element.dataset.keyboardReady = 'true';
    element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
  };
  function trainGroupPopup(group) {
    const popup = document.createElement('div'); popup.className = 'station-card';
    const title = document.createElement('strong'); title.className = 'station-name'; title.textContent = group.length + ' GO trains';
    const hint = document.createElement('p'); hint.className = 'station-hint'; hint.textContent = 'Choose a train for stops and times.';
    const list = document.createElement('div'); list.className = 'train-group-list';
    group.forEach(({ train, line }) => {
      const button = document.createElement('button'); button.className = 'train-group-item';
      const badge = document.createElement('span'); badge.className = 'station-line-badge'; badge.style.backgroundColor = line.color; badge.textContent = line.code;
      const name = document.createElement('span'); name.textContent = 'Trip ' + train.trip_number + ' · ' + train.display;
      button.append(badge, name);
      button.addEventListener('click', () => send({ type: 'select-train', trainId: train.id }));
      list.append(button);
    });
    popup.append(title, hint, list);
    return popup;
  }
  function canZoomGroup(group) {
    const spread = Math.max(...group.map((a) => Math.max(...group.map((b) => Math.hypot(a.x - b.x, a.y - b.y)))));
    return map.getZoom() < map.getMaxZoom() && (map.getZoom() < 16 || spread >= 24);
  }
  function expandTrains(marker) {
    const group = marker.trainGroup;
    if (!canZoomGroup(group)) {
      clusterPopupId = marker.groupId;
      clusterPopup = L.popup({ className: 'station-popup train-popup', maxWidth: 270, autoPanPadding: [20,20] })
        .setLatLng(marker.getLatLng()).setContent(trainGroupPopup(group)).openOn(map);
      return;
    }
    map.fitBounds(group.map(({ train }) => [train.latitude, train.longitude]), { padding: [70,70], maxZoom: Math.min(map.getZoom() + 2, map.getMaxZoom()), animate: false });
  }
  function renderTrains() {
    const visible = new Set();
    const points = [];
    trainPositions.forEach((train) => {
      const age = Date.now() - Date.parse(train.updated_at);
      const line = network.lines.find((item) => item.code === train.line_code && item.vehicle_type === 'Train' && item.code !== 'UP');
      if (!line || !visibleLineCodes.has(line.code) || !Number.isFinite(age) || age < -60000 || age > 180000 ||
          !Number.isFinite(train.latitude) || !Number.isFinite(train.longitude) || train.latitude < 42 || train.latitude > 46 || train.longitude < -83 || train.longitude > -76) return;
      const point = map.latLngToContainerPoint([train.latitude, train.longitude]);
      points.push({ id: train.id, x: point.x, y: point.y, train, line });
    });
    layout.groupNearbyTrains(points).forEach((group) => {
      const clustered = group.length > 1;
      const { train, line } = group[0];
      const direction = clustered ? null : layout.trainDirection(train, network.stops);
      const id = clustered ? 'group:' + group.map((item) => item.id).join('|') : train.id;
      visible.add(id);
      let marker = trainMarkers.get(id);
      const label = line.name + ' train ' + train.trip_number + ': ' + train.display;
      if (!marker) {
        const symbol = document.createElement('span'); symbol.className = 'live-train-symbol';
        symbol.style.setProperty('--train-color', group.every((item) => item.line.code === line.code) ? line.color : '#3d6a2b');
        const pulse = document.createElement('span'); pulse.className = 'live-train-pulse';
        pulse.setAttribute('aria-hidden', 'true');
        symbol.append(pulse);
        const icon = document.createElement('span'); icon.className = 'live-train-icon'; icon.innerHTML = trainIcon;
        if (clustered) {
          const count = document.createElement('span'); count.className = 'live-train-count'; count.textContent = group.length;
          icon.append(count);
        }
        symbol.append(icon);
        const arrow = document.createElement('span'); arrow.className = 'live-train-direction';
        arrow.setAttribute('aria-hidden', 'true'); arrow.hidden = true;
        symbol.append(arrow);
        marker = L.marker([train.latitude, train.longitude], {
          pane: 'live-trains', keyboard: false, title: label,
          icon: L.divIcon({ className: 'live-train-marker' + (clustered ? ' train-cluster' : ''), html: symbol, iconSize: [44,44], iconAnchor: [22,22], popupAnchor: [0,-20] }),
        }).addTo(trains);
        if (clustered) {
          marker.on('click', () => expandTrains(marker));
          keyboardAction(marker, group.length + ' trains; tap to zoom in', () => expandTrains(marker));
        } else {
          marker.bindPopup('', { className: 'station-popup train-popup', minWidth: 220, maxWidth: 270, autoPanPadding: [20,20] });
          keyboardAction(marker, label, () => marker.openPopup());
        }
        trainMarkers.set(id, marker);
      }
      marker.trainGroup = group;
      marker.groupId = id;
      const centre = clustered ? map.containerPointToLatLng([group.reduce((sum, item) => sum + item.x, 0) / group.length, group.reduce((sum, item) => sum + item.y, 0) / group.length]) : [train.latitude, train.longitude];
      marker.setLatLng(centre);
      const element = marker.getElement();
      const markerLabel = clustered ? group.length + ' trains; ' + (canZoomGroup(group) ? 'tap to zoom in' : 'choose a train') : label + (direction ? '; approximately ' + direction.compass + ' toward ' + direction.stopName : '');
      if (element) { element.setAttribute('title', markerLabel); element.setAttribute('aria-label', markerLabel); }
      const arrow = element && element.querySelector('.live-train-direction');
      if (arrow) {
        arrow.hidden = !direction;
        if (direction) arrow.style.transform = 'rotate(' + direction.bearing + 'deg)';
      }
      if (clustered) {
        if (clusterPopup && clusterPopupId === id && map.hasLayer(clusterPopup)) clusterPopup.setContent(trainGroupPopup(group));
        return;
      }
      const popup = document.createElement('div'); popup.className = 'station-card';
      const type = document.createElement('span'); type.className = 'station-type'; type.textContent = line.name + ' · GO train ' + train.trip_number;
      const name = document.createElement('strong'); name.className = 'station-name'; name.textContent = train.display;
      const status = document.createElement('p'); status.className = 'station-hint';
      const stop = network.stops.find((item) => item.id === train.stop_code);
      status.textContent = train.status === 'stopped' ? 'Stopped' : train.status === 'approaching' ? 'Approaching a stop' : train.status === 'moving' ? 'In transit' : 'Reported position';
      if (stop && train.status !== 'reported') status.textContent = (train.status === 'stopped' ? 'At ' : 'Towards ') + stop.name;
      const updated = document.createElement('p'); updated.className = 'train-updated';
      updated.textContent = 'Reported ' + new Date(train.updated_at).toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit', hour12: true });
      const button = document.createElement('button'); button.className = 'station-departures'; button.textContent = 'Stops & times';
      button.addEventListener('click', () => send({ type: 'select-train', trainId: train.id }));
      popup.append(type, name, status, updated, button);
      marker.setPopupContent(popup);
    });
    trainMarkers.forEach((marker, id) => {
      if (!visible.has(id)) { trains.removeLayer(marker); trainMarkers.delete(id); }
    });
    if (clusterPopup && !visible.has(clusterPopupId)) {
      map.closePopup(clusterPopup); clusterPopup = undefined; clusterPopupId = undefined;
    }
    updateStationLabels();
  }
  function setTrains(positions, reducedMotion) {
    trainPositions = Array.isArray(positions) ? positions : [];
    document.body.classList.toggle('map-reduced-motion', !!reducedMotion);
    renderTrains();
  }
  function setFilter(filter) {
    const mode = filter.mode || 'all';
    const query = (filter.search || '').trim().toLowerCase();
    searching = !!query;
    const shouldFit = !fitted || query !== lastQuery;
    lastQuery = query;
    const hidden = new Set(filter.hiddenLineCodes || []);
    const lines = network.lines.filter((line) => modeMatches(line, mode) && (!filter.lineCode || line.code === filter.lineCode) && !hidden.has(line.code));
    const codes = new Set(lines.map((line) => line.code));
    visibleLineCodes = codes;
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
      const isMajor = layout.isMajorStation(stop, network.lines);
      const symbol = document.createElement('span'); symbol.className = 'station-marker-symbol';
      symbol.style.setProperty('--station-color', color);
      const marker = L.marker(point, {
        icon: L.divIcon({ className: 'station-marker' + (isMajor ? ' major-station' : ''), html: symbol, iconSize: [44,44], iconAnchor: [22,22], popupAnchor: [0,-12] }),
        keyboard: false, title: stop.name,
      });
      const label = document.createElement('span'); label.textContent = stop.name;
      stationMarkers.push({ marker, stop, isTrain, isMajor, label });
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
    stationMarkers.sort((a,b) => Number(b.isMajor) - Number(a.isMajor) || Number(b.isTrain) - Number(a.isTrain) || a.stop.name.localeCompare(b.stop.name));
    if (shouldFit && bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: query ? 15 : 12, animate: false });
      fitted = true;
    }
    renderTrains();
    updateStations();
  }
  window.TransitMap = { setFilter, setTrains };
  // Expire reported positions even if a later request never completes.
  setInterval(renderTrains, 15000);
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || event.data.source !== 'transitflow-app') return;
    if (event.data.type === 'filter') setFilter(event.data.filter);
    if (event.data.type === 'trains') setTrains(event.data.trains, event.data.reducedMotion);
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
