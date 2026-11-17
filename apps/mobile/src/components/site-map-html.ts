export type SiteMapInput = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  name: string;
};

/**
 * Leaflet + OpenStreetMap tiles. No API key and no worker coordinates:
 * the map shows the site centre and its geofence only.
 */
export function siteMapHtml({ latitude, longitude, radiusMeters, name }: SiteMapInput): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; background: #EDF1F8; }
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-control-zoom { border: 0; box-shadow: 0 4px 14px rgba(16,29,53,.18); }
  .leaflet-bar a { color: #14213D; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center = [${latitude}, ${longitude}];
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView(center, 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.circle(center, {
    radius: ${Math.max(0, radiusMeters)},
    color: '#2457D6',
    weight: 2,
    fillColor: '#2457D6',
    fillOpacity: 0.12
  }).addTo(map);
  L.circleMarker(center, {
    radius: 7,
    color: '#FFFFFF',
    weight: 3,
    fillColor: '#101D35',
    fillOpacity: 1
  }).addTo(map).bindTooltip(${JSON.stringify(name).replace(/</g, '\\u003c')}, { direction: 'top', offset: [0, -8] });
</script>
</body>
</html>`;
}
