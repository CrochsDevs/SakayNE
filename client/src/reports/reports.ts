import { apiRequest } from '@/src/config/api';

export const REPORT_REASONS = ['Unsafe driving', 'Harassment or rude behavior', 'Overcharging', 'Refused pickup or drop-off', 'Vehicle condition', 'Other'] as const;
export const REPORT_STATUSES = { open: 'Open', in_review: 'In review', resolved: 'Resolved', dismissed: 'Dismissed' } as const;
export type ReportStatus = keyof typeof REPORT_STATUSES;
export interface DriverReport {
  id: string; rideId: string; driverName: string; vehicle: string; fromName: string; toName: string;
  reason: string; details: string; status: ReportStatus; adminResponse: string; createdAt: string; updatedAt?: string;
  passengerName?: string; passengerEmail?: string;
}
export interface ReportPage { reports: DriverReport[]; nextCursor: string | null; }
export const getReports = (query = '', admin = false) => apiRequest<ReportPage>(`${admin ? '/admin' : ''}/reports${query ? '?' + query : ''}`);
export const submitReport = (rideId: string, reason: string, details: string) => apiRequest<{ report: DriverReport }>('/reports', { method: 'POST', body: JSON.stringify({ rideId, reason, details }) });
export const reviewReport = (id: string, status: ReportStatus, response: string) => apiRequest<{ report: DriverReport }>('/admin/reports/' + id, { method: 'PATCH', body: JSON.stringify({ status, response }) });
