import { createElement, useEffect, useMemo, useRef } from 'react';
import { buildMapHtml } from './mapHtml';

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

interface RouteMapProps {
  servicePath?: MapCoord[];
  stops: MapStop[];
  towns?: MapTown[];
  isDark?: boolean;
  driverLocation?: MapCoord | null;
  recenterKey?: number;
  onReady?: (info: { durationMin: number; distanceKm: number }) => void;
}

export default function RouteMap({
  stops,
  towns = [],
  isDark = false,
  onReady,
  driverLocation,
  recenterKey = 0,
  servicePath,
}: RouteMapProps) {
  const stopKey = JSON.stringify(stops), townKey = JSON.stringify(towns);
  const pathKey = JSON.stringify(servicePath);
  const html = useMemo(() => buildMapHtml(JSON.parse(stopKey), JSON.parse(townKey), isDark, pathKey ? JSON.parse(pathKey) : undefined), [stopKey, townKey, isDark, pathKey]);
  const ref = useRef<HTMLIFrameElement>(null);
  const location = useRef(driverLocation); location.current = driverLocation;

  useEffect(() => {
    ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setLocation', value: driverLocation }), '*');
  }, [driverLocation]);

  useEffect(() => {
    if (recenterKey) ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'recenter' }), '*');
  }, [recenterKey]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg?.type === 'loaded') ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'setLocation', value: location.current }), '*');
        if (msg?.type === 'ready') onReady?.(msg);
      } catch {
        //
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onReady]);

  return createElement('iframe', {
    ref,
    srcDoc: html,
    title: 'route-map',
    sandbox: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    style: { border: 'none', width: '100%', height: '100%', display: 'block' },
  });
}
