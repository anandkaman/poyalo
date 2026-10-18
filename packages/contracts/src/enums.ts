/** Domain enums shared by api, web, admin (docs/D2 §9). Keep in sync with prisma/schema.prisma. */
export const ACTORS = ['rider', 'driver', 'admin', 'system'] as const;
export type Actor = (typeof ACTORS)[number];

export const SERVICE_TYPES = ['city', 'outstation'] as const;
export type ServiceTypeCode = (typeof SERVICE_TYPES)[number];

export const TRIP_KINDS = ['one_way', 'round_trip'] as const;
export type TripKind = (typeof TRIP_KINDS)[number];

export const TRIP_STATUSES = [
  'SCHEDULED',
  'SEARCHING',
  'DRIVER_CONFIRMED',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_DRIVER',
  'CANCELLED_BY_ADMIN',
  'NO_DRIVER_FOUND',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'wallet'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
