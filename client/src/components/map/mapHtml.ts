export interface MapCoord {
  latitude: number;
  longitude: number;
}

export interface MapStop {
  label: string;
  coord: MapCoord;
  isOrigin?: boolean;
  isDestination?: boolean;
  isOutside?: boolean;
}

export interface MapTown {
  name: string;
  coord: MapCoord;
}

export function buildMapHtml(stops: MapStop[], towns: MapTown[], isDark: boolean, servicePath?: MapCoord[]): string {
  const valid = (coord: MapCoord) => Number.isFinite(coord.latitude) && Math.abs(coord.latitude) <= 90
    && Number.isFinite(coord.longitude) && Math.abs(coord.longitude) <= 180;
  stops = stops.filter(stop => valid(stop.coord));
  towns = towns.filter(town => valid(town.coord));
  const data = stops.map((s) => ({
    lat: s.coord.latitude,
    lng: s.coord.longitude,
    label: s.label,
    o: !!s.isOrigin,
    d: !!s.isDestination,
    x: !!s.isOutside,
  }));

  const stopKeys = new Set(stops.map((s) => `${s.coord.latitude.toFixed(3)},${s.coord.longitude.toFixed(3)}`));
  const townData = towns
    .filter((t) => !stopKeys.has(`${t.coord.latitude.toFixed(3)},${t.coord.longitude.toFixed(3)}`))
    .map((t) => ({ lat: t.coord.latitude, lng: t.coord.longitude, label: t.name }));

  const tile = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const bg = isDark ? '#1A1A2E' : '#E8ECEF';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${bg}; }
  .leaflet-container { background: ${bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .leaflet-tile-pane { filter: ${isDark ? 'invert(1) hue-rotate(180deg) brightness(0.8)' : 'none'}; }
  .leaflet-tooltip.route-label {
    background: ${isDark ? 'rgba(20,20,30,0.9)' : '#ffffff'};
    color: ${isDark ? '#fff' : '#0D1F16'};
    border: none; border-radius: 8px; font-weight: 700; font-size: 11px;
    padding: 3px 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .leaflet-tooltip.route-label:before { display: none; }
  .leaflet-tooltip.town-label {
    background: transparent; border: none; box-shadow: none;
    color: ${isDark ? 'rgba(255,255,255,0.65)' : '#5A6B5E'};
    font-size: 10px; font-weight: 600; padding: 0;
    text-shadow: 0 1px 2px ${isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)'};
  }
  .leaflet-tooltip.town-label:before { display: none; }
  .pin {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 12px;
    border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  }
  .leaflet-div-icon { background: transparent; border: none; }
  .car .body {
    width: 30px; height: 30px; border-radius: 50%; background: #0D1F16;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.4);
  }
  .car .pulse {
    position: absolute; inset: -6px; border-radius: 50%;
    border: 3px solid #3F8451; opacity: 0.7; animation: pulse 1.8s ease-out infinite;
  }
  @keyframes pulse {
    0% { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .eta-badge {
    position: absolute; z-index: 1000; left: 12px; bottom: 12px;
    background: ${isDark ? 'rgba(20,20,30,0.9)' : 'rgba(255,255,255,0.95)'};
    color: ${isDark ? '#fff' : '#0D1F16'};
    border-radius: 12px; padding: 8px 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.25);
    font-size: 12px; line-height: 1.5;
  }
  .eta-badge b { color: #3F8451; font-size: 14px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var stops = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  var towns = ${JSON.stringify(townData).replace(/</g, '\\u003c')};
  var servicePath = ${JSON.stringify((servicePath && servicePath.length > 1 && servicePath.every(valid) ? servicePath : []).map(point => [point.latitude, point.longitude]))};

  if (!window.L) { document.getElementById('map').textContent = 'Map could not load. Check your internet connection.'; throw new Error('Leaflet unavailable'); }
  function label(text) { var node = document.createElement('span'); node.textContent = text; return node; }
  var map = L.map('map', { zoomControl: false, attributionControl: true, scrollWheelZoom: true });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  var tileUrl = ${JSON.stringify(tile).replace(/</g, '\\u003c')};
  var tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>' }).addTo(map);
  tiles.on('tileerror', function () { document.getElementById('map').setAttribute('aria-label', 'Tiles unavailable. Route stops are still visible.'); });

  var latlngs = stops.map(function (s) { return [s.lat, s.lng]; });
  towns.forEach(function (t) {
    L.circleMarker([t.lat, t.lng], { radius: 2.5, color: '#3F8451', weight: 1, fillColor: '#3F8451', fillOpacity: 0.9 }).addTo(map)
      .bindTooltip(label(t.label), { permanent: true, direction: 'right', className: 'town-label', offset: [5, 0] });
  });

  function fit() {
    if (servicePath.length > 1) { map.fitBounds(servicePath, { padding: [60, 60] }); return; }
    if (!latlngs.length) { map.setView([15.5781, 120.9756], 10); return; }
    if (latlngs.length === 1) map.setView(latlngs[0], 13);
    else map.fitBounds(latlngs, { padding: [60, 60] });
  }
  fit();

  function marker(coord, letter, color) {
    var icon = L.divIcon({
      className: '',
      html: '<div class="pin" style="background:' + color + '">' + letter + '</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    return L.marker(coord, { icon: icon }).addTo(map);
  }

  stops.forEach(function (s) {
    var coord = [s.lat, s.lng];
    if (s.o) {
      marker(coord, 'A', '#3F8451').bindTooltip(label(s.label), { permanent: true, direction: 'top', className: 'route-label', offset: [0, -14] });
    } else if (s.d) {
      marker(coord, 'B', '#EF4444').bindTooltip(label(s.label), { permanent: true, direction: 'top', className: 'route-label', offset: [0, -14] });
    } else {
      L.circleMarker(coord, { radius: 6, color: '#fff', weight: 2.5, fillColor: '#6B7280', fillOpacity: 1 }).addTo(map)
        .bindTooltip(label(s.label), { permanent: true, direction: 'right', className: 'route-label', offset: [8, 0] });
    }
  });

  var car = null;
  function setLocation(coord) {
    if (!coord) { if (car) { map.removeLayer(car); car = null; } return; }
    if (!Number.isFinite(coord.latitude) || Math.abs(coord.latitude) > 90 || !Number.isFinite(coord.longitude) || Math.abs(coord.longitude) > 180) return;
    var point = [coord.latitude, coord.longitude];
    if (!car) {
      var icon = L.divIcon({ className: 'car', html: '<div class="body"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2m8-2v2M8 6h8"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
      car = L.marker(point, { icon: icon, zIndexOffset: 1000 }).addTo(map).bindTooltip(label('Driver GPS'));
      if (!latlngs.length) map.setView(point, 14);
    } else car.setLatLng(point);
  }

  function postToHost(msg) {
    try {
      var s = JSON.stringify(msg);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
      else if (window.parent !== window) window.parent.postMessage(s, '*');
    } catch (e) {}
  }

  function receive(e) {
    if (window.parent !== window && e.source !== window.parent) return;
    try {
      var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (msg && msg.type === 'setLocation') setLocation(msg.value);
      if (msg && msg.type === 'recenter') {
        if (car) map.setView(car.getLatLng(), Math.max(map.getZoom(), 14));
        else fit();
      }
    } catch (err) {}
  }
  window.addEventListener('message', receive);
  document.addEventListener('message', receive);
  postToHost({ type: 'loaded' });

  // Follow only the stored service path. Never infer shortcuts between stops.
  if (servicePath.length > 1) {
    L.polyline(servicePath, { color: '#092E26', weight: 5, lineJoin: 'round', lineCap: 'round' }).addTo(map);
  } else {
    var badge = document.createElement('div');
    badge.className = 'eta-badge';
    badge.textContent = 'Service route not yet mapped';
    document.body.appendChild(badge);
  }

  setTimeout(function () { map.invalidateSize(); }, 200);
</script>
</body>
</html>`;
}
