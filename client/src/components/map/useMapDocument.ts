import { useEffect, useMemo, useState } from 'react';
import { buildMapHtml, type MapCoord, type MapStop, type MapTown } from './maplibreHtml';
import { getRoadRoute, type RoadRoute } from '@/src/ride/maps.service';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { resolveMapStyle, type MapStyleChoice } from '@/src/store/map-style';

export interface MapDocumentProps {
  stops: MapStop[]; towns?: MapTown[]; isDark?: boolean; servicePath?: MapCoord[];
  routingWaypoints?: MapCoord[]; showRouteDetails?: boolean; driverMode?: boolean; followDriver?: boolean; vehicleType?: 'jeep' | 'bus';
  mapStyle?: MapStyleChoice; mapStyleRevision?: number;
}
export function useMapDocument({ stops, towns = [], isDark = false, servicePath = [], routingWaypoints, showRouteDetails = true, driverMode = false, followDriver = false, vehicleType = 'bus', mapStyle = 'auto', mapStyleRevision = 0 }: MapDocumentProps) {
  const translate = useInterfaceText();
  const visibleStops = showRouteDetails ? stops : stops.filter(stop => stop.isLivePickup);
  const visiblePath = showRouteDetails ? servicePath : [];
  const stopKey = JSON.stringify(visibleStops), townKey = JSON.stringify(towns), pathKey = JSON.stringify(visiblePath);
  const valid = (point: MapCoord) => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
  const waypoints = (routingWaypoints || stops.map(stop => stop.coord)).filter(valid);
  const waypointKey = JSON.stringify(waypoints);
  const enabled = showRouteDetails && !(visiblePath.length > 1 && visiblePath.every(valid)) && waypoints.length >= 2 && waypoints.length <= 25;
  const [result, setResult] = useState<{ key: string; value: RoadRoute | null; status: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getRoadRoute(JSON.parse(waypointKey)).then(value => { if (active) setResult({ key: waypointKey, value, status: 'ready' }); }).catch(() => { if (active) setResult({ key: waypointKey, value: null, status: 'unavailable' }); });
    return () => { active = false; };
  }, [enabled, waypointKey]);
  const labels = Object.fromEntries(['Loading map…', 'Retry map', 'Map unavailable. Check your connection or device graphics support.', 'Map tiles unavailable. Locations are still visible.', 'Verified service route', 'Loading road route…', 'Road route preview', 'Road route unavailable', 'Driver GPS', 'Your location', 'You', 'Bus stop', 'Mapped bus stop. Confirm boarding with your driver.'].map(label => [label, translate(label)]));
  const labelKey = JSON.stringify(labels);
  const html = useMemo(() => buildMapHtml(JSON.parse(stopKey), JSON.parse(townKey), isDark, JSON.parse(pathKey), driverMode, { routingExpected: enabled, showRouteDetails, labels: JSON.parse(labelKey), followDriver, vehicleType }), [stopKey, townKey, pathKey, isDark, driverMode, followDriver, vehicleType, enabled, showRouteDetails, labelKey]);
  const roadMessage = useMemo(() => ({ type: 'setRoadRoute', value: enabled && result?.key === waypointKey ? result.value : null, status: enabled ? result?.key === waypointKey ? result.status : 'loading' : 'idle' }), [enabled, result, waypointKey]);
  const styleId = resolveMapStyle(mapStyle, isDark);
  const styleMessage = useMemo(() => ({ type: 'setMapStyle', value: styleId, revision: mapStyleRevision }), [styleId, mapStyleRevision]);
  return { html, roadMessage, styleMessage };
}
