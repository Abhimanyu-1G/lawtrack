/**
 * Domain enums shared by client and server. Pure TypeScript: no Node or browser
 * APIs may be imported here (see AGENTS.md §1.5).
 */

export const USER_ROLES = ['Citizen', 'Lawyer', 'Curator', 'Administrator', 'API Manager'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LANGUAGES = ['English', 'Hindi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const GUIDE_STATUSES = ['Draft', 'Valid', 'Requires AI Update'] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const DRAFT_TYPES = ['Complaint', 'RTI', 'Legal Notice'] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const DRAFT_STATUSES = ['Pending Review', 'Approved', 'Rejected', 'Regenerating'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_DECISIONS = ['Approved', 'Rejected'] as const;
export type DraftDecision = (typeof DRAFT_DECISIONS)[number];

export const CASE_STATUSES = ['Pending', 'Disposed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const LAWYER_STATUSES = ['Available', 'Busy', 'Offline'] as const;
export type LawyerStatus = (typeof LAWYER_STATUSES)[number];

export const INTEGRATION_STATUSES = ['Healthy', 'Degraded', 'Down'] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['In-App', 'Email', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['Unread', 'Delivered', 'Sent', 'Failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ADMIN_LEVELS = ['Super', 'Standard'] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const CATEGORY_NAMES = [
  'Traffic & Motor Vehicles',
  'Landlord–Tenant',
  'Consumer Rights',
  'Labour & Employment',
  'RTI',
  'Cyber & Online Fraud',
  "Women's Safety",
  'Property',
  'Criminal Law (BNS 2023)',
] as const;
export type CategoryName = (typeof CATEGORY_NAMES)[number];

/** Roles that may open each application area. Used by middleware and layouts. */
export const ROLE_HOME: Record<UserRole, string> = {
  Citizen: '/citizen',
  Lawyer: '/lawyer',
  Curator: '/curator',
  Administrator: '/admin',
  'API Manager': '/api-manager',
};
