import 'server-only';

import { CATEGORY_NAMES } from '../../../shared/enums';

/**
 * System_Setting defaults. Seeding only writes a key when it is missing, so an
 * administrator's later change survives a re-seed.
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  otp_expiry_minutes: '10',
  otp_max_attempts: '5',
  otp_resend_seconds: '60',
  case_sync_interval_minutes: '5',
  hearing_reminder_interval_minutes: '15',
  integration_health_interval_minutes: '2',
  review_lock_cleanup_interval_minutes: '5',
  rag_similarity_threshold: '0.35',
  rag_lexical_threshold: '3',
  demo_ai_mode: 'auto',
  guide_categories: JSON.stringify(CATEGORY_NAMES),
};
