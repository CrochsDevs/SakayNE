import { apiRequest } from '@/src/config/api';
import { PositionMetadata, PickupLocation } from './location';
export type RideStatus = 'pending' | 'accepted' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
export interface RideBooking {
 id: string; routeId: string; driverId: string; driverName: string; driverPhone?: string; passengerName?: string;
 vehicle: string; type: 'jeep' | 'bus'; fromId: string; toId: string; fromName: string; toName: string;
 fare: number; unitFare: number; minutes: number; seats: number; boardingCode: string;
 paymentMethod: 'cash'; paymentStatus: 'unpaid' | 'paid'; status: RideStatus; progress: number; rating?: number; cancellationReason?: string;
 driverLocation?: { latitude: number; longitude: number; updatedAt: string } | null; createdAt: number;
 occupancyStatus?: 'waiting' | 'onboard' | 'alighted'; geoTrackingEnabled?: boolean;
 boardingSource?: 'code' | 'geolocation'; alightingSource?: 'geolocation'; seatsReleasedAt?: string;
 geoDetection?: { state: string; distanceMeters?: number; minimumSeparationMeters?: number; samples?: number; updatedAt: string };
 pickupLocation?: PickupLocation;
}
export const isActiveRide = (ride: RideBooking) => !['completed', 'cancelled'].includes(ride.status);
export async function getActiveRide(): Promise<RideBooking | null> { return (await apiRequest('/rides/active')).ride; }
export async function getRide(id: string): Promise<RideBooking> { return (await apiRequest('/rides/' + id)).ride; }
export async function getRides(): Promise<RideBooking[]> { return (await apiRequest('/rides')).rides; }
export async function bookRide(input: { routeId: string; driverId: string; fromId: string; toId: string; seats: number; requestId: string; pickupLocation?: PickupLocation }): Promise<RideBooking> {
 return (await apiRequest('/rides', { method: 'POST', body: JSON.stringify(input) })).ride;
}
export async function changeRideStatus(id: string, status: RideStatus, boardingCode?: string): Promise<RideBooking> {
 return (await apiRequest('/rides/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status, boardingCode }) })).ride;
}
export async function rateRide(id: string, rating: number) { return apiRequest('/rides/' + id + '/rating', { method: 'POST', body: JSON.stringify({ rating }) }); }
export const setSeatDetection = (id: string, enabled: boolean) => apiRequest('/rides/' + id + '/geolocation', { method: 'PUT', body: JSON.stringify({ enabled }) });
export const publishPassengerLocation = (id: string, latitude: number, longitude: number, metadata: PositionMetadata) => apiRequest('/rides/' + id + '/location', { method: 'POST', body: JSON.stringify({ latitude, longitude, ...metadata }) });
