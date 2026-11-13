import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ValidationCode, ValidationResult } from '../../src/shared/errors';
import {
  FORM_DATA_MAX,
  GENERATED_TEXT_MAX,
  validateLegalDraftInput,
  type LegalDraftInput,
} from '../../src/shared/validation';
import { createMockAiProvider } from '../../src/server/adapters/ai/mock';
import type { AiProvider } from '../../src/server/adapters/ai/provider';
import type { LawTrackDatabase } from '../../src/server/db/client';
import { createInMemoryDatabase } from '../../src/server/db/memory';
import { createRepositories, type Repositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { createFixedClock } from '../../src/server/lib/clock';
import { AppError } from '../../src/server/lib/errors';
import { createDraftsService, type DraftService } from '../../src/server/modules/drafts/service';
import type { DraftAnswers } from '../../src/shared/validation';
import { createValidationContext, withoutField } from '../helpers/validation';

const baseDraft: Record<string, unknown> = {
  citizen_id: 12,
  draft_type: 'Complaint',
  form_data: 'Name, address and grievance details',
  generated_text: 'Generated complaint text',
  status: 'Pending Review',
  version: 3,
  created_at: '2026-11-10 12:00:00',
};

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...baseDraft, ...overrides };
}

function firstIssue(result: ValidationResult<unknown>, field: string): ValidationCode | undefined {
  return result.ok ? undefined : result.errors.find((error) => error.field === field)?.code;
}

function expectIssue(result: ValidationResult<unknown>, field: string, code: ValidationCode): void {
  expect(result.ok, `expected ${field} to fail with ${code}`).toBe(false);
  expect(firstIssue(result, field), JSON.stringify(result)).toBe(code);
}

function expectValue(result: ValidationResult<LegalDraftInput>): LegalDraftInput {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
}

describe('Legal draft validation (UT_DFT)', () => {
  const context = createValidationContext();

  it('UT_DFT_01 citizen_id accepts an existing citizen', async () => {
    expect(expectValue(await validateLegalDraftInput(input({ citizen_id: 12 }), context)).citizen_id).toBe(
      12,
    );
  });

  it('UT_DFT_02 citizen_id rejects 9999 with FK_NOT_FOUND', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ citizen_id: 9999 }), context),
      'citizen_id',
      'FK_NOT_FOUND',
    );
  });

  it('UT_DFT_03 citizen_id rejects an empty value with REQUIRED', async () => {
    expectIssue(
      await validateLegalDraftInput(withoutField(input(), 'citizen_id'), context),
      'citizen_id',
      'REQUIRED',
    );
  });

  it('UT_DFT_04 draft_type accepts Complaint', async () => {
    expect(
      expectValue(await validateLegalDraftInput(input({ draft_type: 'Complaint' }), context)).draft_type,
    ).toBe('Complaint');
  });

  it('UT_DFT_05 draft_type rejects a blank value with REQUIRED', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ draft_type: '' }), context),
      'draft_type',
      'REQUIRED',
    );
  });

  it('UT_DFT_06 draft_type rejects Will with ENUM', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ draft_type: 'Will' }), context),
      'draft_type',
      'ENUM',
    );
  });

  it('UT_DFT_07 form_data accepts a serialised answer set', async () => {
    const formData = 'Name, address and grievance details';
    expect(
      expectValue(await validateLegalDraftInput(input({ form_data: formData }), context)).form_data,
    ).toBe(formData);
  });

  it('UT_DFT_08 form_data rejects an empty value with REQUIRED', async () => {
    expectIssue(await validateLegalDraftInput(input({ form_data: '' }), context), 'form_data', 'REQUIRED');
  });

  it('UT_DFT_09 form_data rejects 5001 characters with LENGTH', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ form_data: 'x'.repeat(FORM_DATA_MAX + 1) }), context),
      'form_data',
      'LENGTH',
    );
  });

  it('UT_DFT_10 generated_text accepts generated text', async () => {
    expect(
      expectValue(
        await validateLegalDraftInput(input({ generated_text: 'Generated complaint text' }), context),
      ).generated_text,
    ).toBe('Generated complaint text');
  });

  it('UT_DFT_11 generated_text rejects an empty value with REQUIRED', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ generated_text: '' }), context),
      'generated_text',
      'REQUIRED',
    );
  });

  it('UT_DFT_12 generated_text rejects 20001 characters with LENGTH', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ generated_text: 'x'.repeat(GENERATED_TEXT_MAX + 1) }), context),
      'generated_text',
      'LENGTH',
    );
  });

  it('UT_DFT_13 status accepts Pending Review', async () => {
    expect(
      expectValue(await validateLegalDraftInput(input({ status: 'Pending Review' }), context)).status,
    ).toBe('Pending Review');
  });

  it('UT_DFT_14 status rejects a blank value with REQUIRED', async () => {
    expectIssue(await validateLegalDraftInput(input({ status: '' }), context), 'status', 'REQUIRED');
  });

  it('UT_DFT_15 status rejects Done with ENUM', async () => {
    expectIssue(await validateLegalDraftInput(input({ status: 'Done' }), context), 'status', 'ENUM');
  });

  it('UT_DFT_16 version accepts 3', async () => {
    expect(expectValue(await validateLegalDraftInput(input({ version: 3 }), context)).version).toBe(3);
  });

  it('UT_DFT_17 version rejects 0 with FORMAT', async () => {
    expectIssue(await validateLegalDraftInput(input({ version: 0 }), context), 'version', 'FORMAT');
  });

  it('UT_DFT_18 version rejects 1.5 with TYPE', async () => {
    expectIssue(await validateLegalDraftInput(input({ version: 1.5 }), context), 'version', 'TYPE');
  });

  it('UT_DFT_19 created_at accepts now', async () => {
    expect(
      expectValue(await validateLegalDraftInput(input({ created_at: '2026-11-10 12:00:00' }), context))
        .created_at,
    ).toBe('2026-11-10 12:00:00');
  });

  it('UT_DFT_20 created_at rejects tomorrow with FUTURE_DATE', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ created_at: '2026-11-11 12:00:00' }), context),
      'created_at',
      'FUTURE_DATE',
    );
  });

  it('UT_DFT_21 created_at rejects an impossible date with INVALID_DATE', async () => {
    expectIssue(
      await validateLegalDraftInput(input({ created_at: '2026-13-45 10:00:00' }), context),
      'created_at',
      'INVALID_DATE',
    );
  });

  it('UT_DFT_25 form_data accepts exactly 5000 characters', async () => {
    const formData = 'x'.repeat(FORM_DATA_MAX);
    expect(
      expectValue(await validateLegalDraftInput(input({ form_data: formData }), context)).form_data,
    ).toBe(formData);
  });

  it('UT_DFT_26 generated_text accepts exactly 20000 characters', async () => {
    const generated = 'x'.repeat(GENERATED_TEXT_MAX);
    expect(
      expectValue(await validateLegalDraftInput(input({ generated_text: generated }), context))
        .generated_text,
    ).toBe(generated);
  });

  it('UT_DFT_27 created_at defaults to the system clock when omitted', async () => {
    expect(
      expectValue(await validateLegalDraftInput(withoutField(input(), 'created_at'), context)).created_at,
    ).toBe('2026-11-10 06:30:00');
  });
});

/* ------------------------------------------------------------------------- */
/* Draft lifecycle (Phase 5): authoritative service behaviour.               */
/* ------------------------------------------------------------------------- */

const serviceClock = createFixedClock('2026-11-10 12:00:00');

const complaintAnswers: DraftAnswers = {
  complainantName: 'Ananya Sharma',
  complainantAddress: '14, Civil Lines, Jaipur',
  oppositeParty: 'Sharma Electronics',
  incidentDate: '2026-11-01',
  incidentPlace: 'Jaipur',
  facts: 'I bought a washing machine on 1 November and it stopped working the same day.',
  lossImpact: 'I paid Rs 25,000 and have no working machine.',
  reliefSought: 'A full refund or a replacement machine.',
  documents: 'Invoice copy and delivery receipt',
};

const rejectRemarks = 'Please add the invoice number and the date of the written complaint.';

let serviceHandle: LawTrackDatabase | undefined;
let serviceRepos: Repositories;
let drafts: DraftService;
let citizenId = 0;
let otherCitizenId = 0;
let lawyerId = 0;

function draftInput(type: 'Complaint' | 'RTI' | 'Legal Notice' = 'Complaint') {
  return { draft_type: type, form_data: complaintAnswers };
}

async function createOwned(locale: 'en' | 'hi' = 'en') {
  return drafts.createDraft(citizenId, draftInput(), locale);
}

async function expectAppError(promise: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.code).toBe(code);
    return appError;
  }
  throw new Error(`expected AppError ${code}`);
}

beforeAll(async () => {
  serviceHandle = createInMemoryDatabase();
  await runSeed({ handle: serviceHandle, clock: serviceClock, includeDemoAccounts: true });
  serviceRepos = createRepositories(serviceHandle);

  const citizen = await serviceRepos.users.findByEmail('citizen@lawtrack.demo');
  const lawyer = await serviceRepos.users.findByEmail('lawyer@lawtrack.demo');
  if (!citizen || !lawyer) throw new Error('seed missing demo accounts');
  citizenId = citizen.user_id;
  lawyerId = lawyer.user_id;

  const second = await serviceRepos.users.insert({
    name: 'Second Citizen',
    email: 'drafts.second@lawtrack.test',
    passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    role: 'Citizen',
    language: 'English',
    isVerified: true,
  });
  await serviceRepos.users.insertCitizen(second.user_id, { state: 'Rajasthan' });
  otherCitizenId = second.user_id;

  drafts = createDraftsService({
    repos: serviceRepos,
    clock: serviceClock,
    ai: createMockAiProvider(),
  });
});

afterAll(async () => {
  await serviceHandle?.close();
  serviceHandle = undefined;
});

describe('Draft lifecycle (UT_DFT)', () => {
  it('UT_DFT_22 create then submitForReview twice keeps one queue entry', async () => {
    const draft = await createOwned();
    expect(draft.status).toBe('Pending Review');
    expect(draft.version).toBe(1);

    const first = await drafts.submitForReview(citizenId, draft.id, 'en');
    expect(first.status).toBe('Pending Review');
    const second = await drafts.submitForReview(citizenId, draft.id, 'en');
    expect(second.status).toBe('Pending Review');

    const queue = await drafts.queue(lawyerId);
    expect(queue.filter((item) => item.id === draft.id)).toHaveLength(1);
  });

  it('UT_DFT_23 reject with remarks regenerates to version + 1 and returns to the queue', async () => {
    const draft = await createOwned();
    const result = await drafts.reject(lawyerId, draft.id, { remarks: rejectRemarks }, 'en');

    expect(result.regenerationFailed).toBe(false);
    expect(result.draft.status).toBe('Pending Review');
    expect(result.draft.version).toBe(draft.version + 1);
    expect(result.draft.generatedText).toBeNull();

    const queue = await drafts.queue(lawyerId);
    expect(queue.some((item) => item.id === draft.id && item.version === 2)).toBe(true);

    const timeline = result.draft.timeline.map((entry) => entry.kind);
    expect(timeline).toContain('rejected');
    expect(timeline).toContain('regenerated');
  });

  it('UT_DFT_24 exportPDF on a Pending Review draft rejects with "Draft is not approved"', async () => {
    const draft = await createOwned();
    const error = await expectAppError(drafts.exportPDF(citizenId, draft.id, 'en'), 'DRAFT_NOT_APPROVED');
    expect(error.message).toBe('Draft is not approved');
  });

  it('UT_DFT_28 a new draft starts at version 1 and hides its text from the citizen', async () => {
    const draft = await createOwned();
    expect(draft.version).toBe(1);
    expect(draft.generatedText).toBeNull();
    expect(draft.pdfAvailable).toBe(false);

    const list = await drafts.listForCitizen(citizenId);
    expect(list.some((item) => item.id === draft.id)).toBe(true);
  });

  it('UT_DFT_29 an Approved draft is terminal: submitForReview is an invalid transition', async () => {
    const draft = await createOwned();
    await drafts.approve(lawyerId, draft.id, 'en');

    const error = await expectAppError(
      drafts.submitForReview(citizenId, draft.id, 'en'),
      'INVALID_TRANSITION',
    );
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('UT_DFT_30 reject without remarks is rejected and keeps the draft Pending Review', async () => {
    const draft = await createOwned();

    const missing = await drafts.reject(lawyerId, draft.id, {}, 'en').catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(AppError);
    expect((missing as AppError).code).toBe('VALIDATION_FAILED');
    expect((missing as AppError).fields?.[0]?.code).toBe('REQUIRED');

    const short = await drafts
      .reject(lawyerId, draft.id, { remarks: 'too short' }, 'en')
      .catch((error: unknown) => error);
    expect((short as AppError).code).toBe('VALIDATION_FAILED');
    expect((short as AppError).fields?.[0]?.code).toBe('LENGTH');

    const stored = await serviceRepos.drafts.findById(draft.id);
    expect(stored?.status).toBe('Pending Review');
    expect(stored?.version).toBe(1);
    expect(await serviceRepos.drafts.reviewCount(draft.id)).toBe(0);
  });

  it('UT_DFT_31 another citizen cannot read or export an owned draft', async () => {
    const draft = await createOwned();

    const readError = await expectAppError(
      drafts.getForCitizen(otherCitizenId, draft.id, 'en'),
      'NOT_FOUND',
    );
    expect(readError.message).toBe('Draft not found');

    await expectAppError(drafts.submitForReview(otherCitizenId, draft.id, 'en'), 'NOT_FOUND');
    await expectAppError(drafts.exportPDF(otherCitizenId, draft.id, 'en'), 'NOT_FOUND');
  });

  it('UT_DFT_32 an AI failure saves nothing and leaves the answers to the client', async () => {
    const failing: AiProvider = {
      ...createMockAiProvider(),
      generateDraft: async () => {
        throw new AppError('AI_UNAVAILABLE', 'AI is offline');
      },
    };
    const failingService = createDraftsService({
      repos: serviceRepos,
      clock: serviceClock,
      ai: failing,
    });

    const before = await serviceRepos.drafts.listForCitizen(citizenId);
    const error = await expectAppError(
      failingService.createDraft(citizenId, draftInput(), 'en'),
      'AI_UNAVAILABLE',
    );
    expect(error.message.length).toBeGreaterThan(0);
    const after = await serviceRepos.drafts.listForCitizen(citizenId);
    expect(after).toHaveLength(before.length);
  });

  it('UT_DFT_33 approving unlocks the generated text and a real PDF', async () => {
    const draft = await createOwned();
    await drafts.approve(lawyerId, draft.id, 'en');

    const approved = await drafts.getForCitizen(citizenId, draft.id, 'en');
    expect(approved.status).toBe('Approved');
    expect(approved.generatedText).toContain('COMPLAINT');
    expect(approved.approval?.lawyerName).toBe('Rohit Mehta');
    expect(approved.pdfAvailable).toBe(true);

    const exported = await drafts.exportPDF(citizenId, draft.id, 'en');
    expect(exported.fileName).toMatch(/^lawtrack-draft-\d+-v1-\d+\.pdf$/);
    expect(new TextDecoder().decode(exported.bytes.slice(0, 5))).toBe('%PDF-');
  });
});
