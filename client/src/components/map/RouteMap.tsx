import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
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
  const ref = useRef<WebView>(null);
  const location = useRef(driverLocation); location.current = driverLocation;

  useEffect(() => {
    ref.current?.postMessage(JSON.stringify({ type: 'setLocation', value: driverLocation }));
  }, [driverLocation]);

  useEffect(() => {
    if (recenterKey) ref.current?.postMessage(JSON.stringify({ type: 'recenter' }));
  }, [recenterKey]);

  return (
    <WebView
      ref={ref}
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      applicationNameForUserAgent="SakayNE/1.0"
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === 'loaded') ref.current?.postMessage(JSON.stringify({ type: 'setLocation', value: location.current }));
          if (msg.type === 'ready' && onReady) onReady(msg);
        } catch {
          //
        }
      }}
    />
  );
}
