import { apiRequest } from '@/src/config/api';
import { SakayDriver } from '@/src/data/sakay';
import { PositionMetadata } from './location';
export interface DriverProfile {
  id: string; fullName: string; vehicleType: string; plateNo: string;
  capacity?: number; routeId?: string; isAvailable: boolean; reservedSeats?: number; occupiedSeats?: number; availableSeats?: number; waitingSeats?: number;
  location?: { latitude: number; longitude: number; updatedAt?: string; capturedAt?: string } | null;
}
export async function getAvailableDrivers(): Promise<SakayDriver[]> { return (await apiRequest('/drivers')).drivers; }
export async function getDriverProfile(): Promise<DriverProfile> { return (await apiRequest('/drivers/me')).driver; }
export async function setDriverAvailability(isAvailable: boolean, routeId: string, capacity: number): Promise<DriverProfile> {
  return (await apiRequest('/drivers/availability', { method: 'PUT', body: JSON.stringify({ isAvailable, routeId, capacity }) })).driver;
}
export const heartbeat = () => apiRequest('/drivers/heartbeat', { method: 'POST' });
export const publishLocation = (latitude: number, longitude: number, metadata?: PositionMetadata) => apiRequest('/drivers/location', { method: 'POST', body: JSON.stringify({ latitude, longitude, ...metadata }) });
