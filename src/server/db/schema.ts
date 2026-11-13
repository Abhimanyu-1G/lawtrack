import type { ColumnType, Generated } from 'kysely';

import type {
  AdminLevel,
  CaseStatus,
  DraftDecision,
  DraftStatus,
  DraftType,
  GuideStatus,
  IntegrationStatus,
  Language,
  LawyerStatus,
  NotificationChannel,
  NotificationStatus,
  UserRole,
} from '../../shared/enums';

/**
 * Kysely table typings for the LawTrack SQLite schema.
 *
 * Column names and table names mirror the SQL migrations exactly (AGENTS.md §4).
 * `Generated` marks server-assigned columns (auto-increment ids, clock-filled
 * defaults) so inserts may omit them — clients never supply primary keys.
 */

type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;
type AutoId = Generated<number>;
type Timestamp = string;
type DateOnly = string;

export interface UserTable {
  user_id: AutoId;
  name: string;
  email: string;
  phone_number: Nullable<string>;
  password_hash: string;
  role: UserRole;
  language: Language;
  is_verified: Generated<number>;
}

export interface CitizenTable {
  user_id: number;
  address: Nullable<string>;
  state: Nullable<string>;
  last_viewed_guide_id: Nullable<number>;
}

export interface LegalAidLawyerTable {
  user_id: number;
  bar_council_id: string;
  specialization: Nullable<string>;
  experience_years: Nullable<number>;
  status: Generated<LawyerStatus>;
}

export interface ContentCuratorTable {
  user_id: number;
  expertise: Nullable<string>;
  validated_count: Generated<number>;
}

export interface SystemAdministratorTable {
  user_id: number;
  admin_level: Generated<AdminLevel>;
  last_login: Nullable<Timestamp>;
}

export interface ApiIntegrationManagerTable {
  user_id: number;
  managed_services: Nullable<string>;
  on_call_status: Generated<string>;
}

export interface LegalGuideTable {
  guide_id: AutoId;
  curator_id: Nullable<number>;
  title: string;
  category: string;
  plain_summary: string;
  source_statute: string;
  language: Language;
  validation_status: Generated<GuideStatus>;
  last_updated: Generated<Timestamp>;
  source_excerpt: Nullable<string>;
  /** Groups the English and Hindi versions of the same topic (Phase 3). */
  topic_key: Nullable<string>;
}

export interface ChatSessionTable {
  session_id: AutoId;
  citizen_id: number;
  start_time: Generated<Timestamp>;
  end_time: Nullable<Timestamp>;
  language: Language;
}

export interface ChatMessageTable {
  message_id: AutoId;
  session_id: number;
  question: string;
  answer: string;
  sources_cited: Nullable<string>;
  timestamp: Generated<Timestamp>;
}

export interface LegalDraftTable {
  draft_id: AutoId;
  citizen_id: number;
  draft_type: DraftType;
  form_data: string;
  generated_text: string;
  status: DraftStatus;
  version: number;
  created_at: Timestamp;
}

export interface DraftReviewTable {
  review_id: AutoId;
  draft_id: number;
  lawyer_id: number;
  decision: DraftDecision;
  remarks: Nullable<string>;
  reviewed_at: Generated<Timestamp>;
}

export interface CourtCaseTable {
  case_id: AutoId;
  integration_id: number;
  cnr_number: string;
  case_title: string;
  court_name: string;
  status: CaseStatus;
  next_hearing_date: Nullable<DateOnly>;
  last_synced_at: Timestamp;
}

export interface HearingTable {
  hearing_id: AutoId;
  case_id: number;
  hearing_date: DateOnly;
  purpose: string;
  order_summary: Nullable<string>;
  order_url: Nullable<string>;
}

export interface ApiIntegrationTable {
  integration_id: AutoId;
  manager_id: number;
  service_name: string;
  status: Generated<IntegrationStatus>;
  last_sync_time: Nullable<Timestamp>;
  error_count: Generated<number>;
}

export interface NotificationTable {
  notification_id: AutoId;
  user_id: number;
  case_id: Nullable<number>;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  timestamp: Generated<Timestamp>;
}

export interface AuditLogTable {
  log_id: AutoId;
  performed_by: number;
  action: string;
  details: Nullable<string>;
  timestamp: Generated<Timestamp>;
}

export interface CaseTrackingTable {
  citizen_id: number;
  case_id: number;
  subscribed_at: Generated<Timestamp>;
}

export interface GuideViewTable {
  citizen_id: number;
  guide_id: number;
  viewed_at: Generated<Timestamp>;
}

export interface OtpCodeTable {
  otp_id: AutoId;
  user_id: number;
  code_hash: string;
  purpose: 'verify' | 'login';
  expires_at: Timestamp;
  attempts: Generated<number>;
  consumed_at: Nullable<Timestamp>;
  created_at: Timestamp;
}

export interface SystemSettingTable {
  key: string;
  value: string;
}

export interface MetricEventTable {
  metric_id: AutoId;
  metric: string;
  value: number;
  ref_id: Nullable<string>;
  created_at: Generated<Timestamp>;
}

export interface GuideEmbeddingTable {
  guide_id: number;
  model: string;
  vector: string;
  updated_at: Generated<Timestamp>;
}

export interface Database {
  User: UserTable;
  Citizen: CitizenTable;
  Legal_Aid_Lawyer: LegalAidLawyerTable;
  Content_Curator: ContentCuratorTable;
  System_Administrator: SystemAdministratorTable;
  API_Integration_Manager: ApiIntegrationManagerTable;
  Legal_Guide: LegalGuideTable;
  Chat_Session: ChatSessionTable;
  Chat_Message: ChatMessageTable;
  Legal_Draft: LegalDraftTable;
  Draft_Review: DraftReviewTable;
  Court_Case: CourtCaseTable;
  Hearing: HearingTable;
  API_Integration: ApiIntegrationTable;
  Notification: NotificationTable;
  Audit_Log: AuditLogTable;
  Case_Tracking: CaseTrackingTable;
  Guide_View: GuideViewTable;
  Otp_Code: OtpCodeTable;
  System_Setting: SystemSettingTable;
  Metric_Event: MetricEventTable;
  Guide_Embedding: GuideEmbeddingTable;
}
