import { useEffect, useRef } from 'react';
import { useMapDocument } from './useMapDocument';
import type { MapStyleChoice, MapStyleStatus } from '@/src/store/map-style';

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
  isLivePickup?: boolean;
}

export interface MapTown {
  name: string;
  coord: MapCoord;
}

interface RouteMapProps {
  driverMode?: boolean;
  followDriver?: boolean;
  vehicleType?: 'jeep' | 'bus';
  servicePath?: MapCoord[];
  routingWaypoints?: MapCoord[];
  showRouteDetails?: boolean;
  stops: MapStop[];
  towns?: MapTown[];
  isDark?: boolean;
  driverLocation?: MapCoord | null;
  userLocation?: MapCoord | null;
  showPeopleKey?: number;
  recenterKey?: number;
  onReady?: (info: { durationMin: number; distanceKm: number }) => void;
  mapStyle?: MapStyleChoice;
  mapStyleRevision?: number;
  onStyleStatus?: (status: MapStyleStatus) => void;
}

export default function RouteMap({
  stops,
  towns = [],
  isDark = false,
  onReady,
  driverLocation,
  userLocation,
  showPeopleKey = 0,
  recenterKey = 0,
  servicePath,
  routingWaypoints,
  showRouteDetails = true,
  driverMode = false,
  followDriver = false,
  vehicleType = 'bus',
  mapStyle,
  mapStyleRevision,
  onStyleStatus,
}: RouteMapProps) {
  const { html, roadMessage, styleMessage } = useMapDocument({ stops, towns, isDark, servicePath, routingWaypoints, showRouteDetails, driverMode, followDriver, vehicleType, mapStyle, mapStyleRevision });
  const ref = useRef<HTMLIFrameElement>(null);
  const location = useRef(driverLocation);
  const viewerLocation = useRef(userLocation);
  const road = useRef(roadMessage);
  const selectedStyle = useRef(styleMessage);
  useEffect(() => { selectedStyle.current = styleMessage; ref.current?.contentWindow?.postMessage(JSON.stringify(styleMessage), '*'); }, [styleMessage]);
  useEffect(() => { road.current = roadMessage; ref.current?.contentWindow?.postMessage(JSON.stringify(roadMessage), '*'); }, [roadMessage]);

  useEffect(() => {
    location.current = driverLocation;
    ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setLocation', value: driverLocation }), '*');
  }, [driverLocation]);

  useEffect(() => {
    viewerLocation.current = userLocation;
    ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setUserLocation', value: userLocation }), '*');
  }, [userLocation]);

  useEffect(() => {
    if (showPeopleKey) ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'showPeople' }), '*');
  }, [showPeopleKey]);

  useEffect(() => {
    if (recenterKey) ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'recenter' }), '*');
  }, [recenterKey]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg?.type === 'loaded') {
          ref.current?.contentWindow?.postMessage(JSON.stringify(selectedStyle.current), '*');
          ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setLocation', value: location.current }), '*');
          ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setUserLocation', value: viewerLocation.current }), '*');
          ref.current?.contentWindow?.postMessage(JSON.stringify(road.current), '*');
        }
        if (msg?.type === 'ready') onReady?.(msg);
        if (msg?.type === 'styleStatus') onStyleStatus?.(msg.value);
      } catch {
        //
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onReady, onStyleStatus]);

  return <iframe ref={ref} srcDoc={html} title="route-map"
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    style={{ border: 'none', width: '100%', height: '100%', display: 'block' }} />;
}
