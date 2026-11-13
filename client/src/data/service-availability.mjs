// Keep the app and API aligned while bus service is being prepared.
export const BUS_SERVICE_ENABLED = false;
export const BUS_COMING_SOON = 'Bus service is coming soon. Jeepney service is available now.';
export function isServiceAvailable(type) {
  return ['jeep', 'jeepney'].includes(type) || type === 'bus' && BUS_SERVICE_ENABLED;
}
