/**
 * Shared validation layer (AGENTS.md §5). Pure functions used by both client
 * forms and route handlers; the only inputs are the parsed payload, a
 * `ValidationContext` (clock + existence/uniqueness probes) and options.
 */

export type { ValidationContext, ValidationTable, ValidationUniqueField } from './context';
export { VALIDATION_TABLES, VALIDATION_UNIQUE_FIELDS } from './context';
export { asRecord, charCount, readNumber, readString } from './fields';
export { isRealDate, parseStorageTimestamp } from './dates';
export { describe, fieldLabel, invalid, invalidLabel, localeOf } from './messages';
export type { ValidationField } from './messages';
export { fail, fieldError, firstError, ok } from './result';
export {
  normalizePhoneNumber,
  validateProfileInput,
  validateUserInput,
  type ProfileInput,
  type UserInput,
  type UserValidationOptions,
} from './user';
export {
  FORM_DATA_MAX,
  GENERATED_TEXT_MAX,
  validateLegalDraftInput,
  type LegalDraftInput,
} from './legalDraft';
export {
  DRAFT_DEADLINE_MAX,
  DRAFT_DEADLINE_MIN,
  DRAFT_FORM_FIELDS,
  DRAFT_REMARKS_MAX,
  DRAFT_REMARKS_MIN,
  canDecide,
  validateDraftFormInput,
  validateReviewRemarks,
  type DraftAnswers,
  type DraftField,
  type DraftFieldKind,
  type DraftFieldOption,
  type DraftTransitionDecision,
  type ValidDraftForm,
} from './draftForm';
export {
  CHAT_HISTORY_QUERY_MAX,
  CHAT_QUESTION_MAX,
  CHAT_RATING_MAX,
  CHAT_RATING_MIN,
  sanitizeChatText,
  validateChatHistoryQuery,
  validateChatQuestion,
  validateChatRatingInput,
  validateChatSessionInput,
  type ChatQuestionInput,
  type ChatRatingInput,
  type ChatSessionInput,
} from './chat';
export {
  validateAdminUserInput,
  validateAdminUserUpdate,
  type AdminUserInput,
  type AdminUserUpdateInput,
} from './adminUser';
export {
  validateLegislativeChangeInput,
  type LegislativeChangeInput,
} from './legislativeChange';
export {
  validateCategoryListInput,
  type CategoryListInput,
} from './adminCategories';
export {
  CASE_TITLE_MAX,
  COURT_NAME_MAX,
  normalizeCnr,
  validateCnrLookup,
  validateCourtCaseInput,
  type CnrLookupInput,
  type CourtCaseInput,
  type CourtCaseSource,
  type CourtCaseValidationOptions,
} from './courtCase';
export {
  GUIDE_CATEGORY_MAX,
  GUIDE_EXCERPT_MAX,
  GUIDE_REASON_MIN,
  GUIDE_STATUTE_MAX,
  GUIDE_SUMMARY_MAX,
  GUIDE_TITLE_MAX,
  canTransitionGuide,
  isGuideStatus,
  validateGuideFlagInput,
  validateGuideUpdate,
  type GuideFlagInput,
  type GuideUpdateInput,
} from './guide';
