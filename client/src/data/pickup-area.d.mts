import type { Town, RouteDef } from './sakay';
export function nearestPickupArea(position: { latitude: number; longitude: number }, towns: Town[]): { town: Town; distanceMeters: number } | null;
export function findPickupArea(position: { latitude: number; longitude: number }, towns: Town[]): Town | null;
export function findRoutePickupArea(position: { latitude: number; longitude: number }, towns: Town[], route?: RouteDef): Town | null;
