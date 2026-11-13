import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as listDrafts, POST as createDraft } from '../../src/app/api/drafts/route';
import { GET as getDraft } from '../../src/app/api/drafts/[id]/route';
import { GET as exportPdf } from '../../src/app/api/drafts/[id]/pdf/route';
import { POST as submitDraft } from '../../src/app/api/drafts/[id]/submit/route';
import { POST as regenerateDraft } from '../../src/app/api/drafts/[id]/regenerate/route';
import { GET as getQueue } from '../../src/app/api/lawyer/queue/route';
import { GET as getForReview } from '../../src/app/api/lawyer/drafts/[id]/route';
import { POST as approveDraft } from '../../src/app/api/lawyer/drafts/[id]/approve/route';
import { POST as rejectDraft } from '../../src/app/api/lawyer/drafts/[id]/reject/route';
import { PATCH as updateStatus } from '../../src/app/api/lawyer/status/route';
import { GET as helpRequests } from '../../src/app/api/lawyer/help-requests/route';
import { closeDb, getDb } from '../../src/server/db/client';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { createSessionToken } from '../../src/server/lib/tokens';
import { resetDraftsService } from '../../src/server/modules/drafts';

/**
 * Draft flow API (Phase 5, AGENTS.md §6, §9, §17): create → lawyer reject →
 * automatic regeneration → approve → PDF, with RBAC and ownership. Route
 * handlers are called directly; Mock AI keeps everything offline.
 */

const ORIGIN = 'http://localhost:3000';
const CSRF_TOKEN = 'api-drafts-csrf-token';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
  csrf?: boolean;
}

function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { origin: ORIGIN, 'accept-language': 'en' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) {
    headers.cookie = `lawtrack_session=${encodeURIComponent(options.token)}; lawtrack_csrf=${CSRF_TOKEN}`;
  }
  if (options.csrf) headers['x-csrf-token'] = CSRF_TOKEN;

  return new Request(`${ORIGIN}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function idContext(id: number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) };
}

const answers = {
  complainantName: 'Ananya Sharma',
  complainantAddress: '14, Civil Lines, Jaipur',
  oppositeParty: 'Sharma Electronics',
  incidentDate: '2026-11-01',
  incidentPlace: 'Jaipur',
  facts: 'I bought a washing machine on 1 November and it stopped working the same day.',
  lossImpact: 'I paid Rs 25,000 and have no working machine.',
  reliefSought: 'A full refund or a replacement machine.',
  documents: 'Invoice copy',
};

interface DraftBody {
  draft: {
    id: number;
    status: string;
    version: number;
    generatedText: string | null;
    pdfAvailable: boolean;
  };
  demo?: boolean;
}

let citizenToken = '';
let lawyerToken = '';
let otherCitizenToken = '';
let curatorToken = '';

async function tokenFor(email: string, role: 'Citizen' | 'Lawyer' | 'Curator'): Promise<string> {
  const repos = createRepositories(getDb());
  const user = await repos.users.findByEmail(email);
  if (!user) throw new Error(`missing seeded account ${email}`);

  return createSessionToken({
    sub: String(user.user_id),
    role,
    email: user.email,
    name: user.name,
    language: 'English',
  });
}

beforeAll(async () => {
  await runSeed({ handle: getDb(), includeDemoAccounts: true });
  resetDraftsService();

  citizenToken = await tokenFor('citizen@lawtrack.demo', 'Citizen');
  lawyerToken = await tokenFor('lawyer@lawtrack.demo', 'Lawyer');
  curatorToken = await tokenFor('curator@lawtrack.demo', 'Curator');

  const repos = createRepositories(getDb());
  const second = await repos.users.insert({
    name: 'Draft API Citizen',
    email: 'drafts.api.second@lawtrack.test',
    passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    role: 'Citizen',
    language: 'English',
    isVerified: true,
  });
  await repos.users.insertCitizen(second.user_id, { state: 'Rajasthan' });
  otherCitizenToken = await createSessionToken({
    sub: String(second.user_id),
    role: 'Citizen',
    email: second.email,
    name: second.name,
    language: 'English',
  });
});

afterAll(async () => {
  resetDraftsService();
  await closeDb();
});

describe('draft API', () => {
  it('UT_DFT_API_01 runs create → reject → regenerate → approve → PDF', async () => {
    const anonymous = await listDrafts(apiRequest('/api/drafts'));
    expect(anonymous.status).toBe(401);

    const created = await createDraft(
      apiRequest('/api/drafts', {
        method: 'POST',
        body: { draft_type: 'Complaint', form_data: answers },
        token: citizenToken,
        csrf: true,
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as DraftBody;
    const draftId = createdBody.draft.id;
    expect(createdBody.draft.status).toBe('Pending Review');
    expect(createdBody.draft.version).toBe(1);
    expect(createdBody.draft.generatedText).toBeNull();
    expect(createdBody.demo).toBe(true);

    const detail = await getDraft(
      apiRequest(`/api/drafts/${draftId}`, { token: citizenToken }),
      idContext(draftId),
    );
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as DraftBody).draft.generatedText).toBeNull();

    const queue = await getQueue(apiRequest('/api/lawyer/queue', { token: lawyerToken }));
    expect(queue.status).toBe(200);
    const queueBody = (await queue.json()) as { queue: { id: number; overdue: boolean }[] };
    expect(queueBody.queue.some((item) => item.id === draftId)).toBe(true);

    const review = await getForReview(
      apiRequest(`/api/lawyer/drafts/${draftId}`, { token: lawyerToken }),
      idContext(draftId),
    );
    expect(review.status).toBe(200);
    const reviewBody = (await review.json()) as {
      draft: { generatedText: string; citizenName: string; answers: Record<string, unknown> };
    };
    expect(reviewBody.draft.generatedText).toContain('COMPLAINT');
    expect(reviewBody.draft.citizenName).toBe('Ananya Sharma');

    const rejected = await rejectDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/reject`, {
        method: 'POST',
        body: { remarks: 'Please add the invoice number to the facts.' },
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(rejected.status).toBe(200);
    const rejectedBody = (await rejected.json()) as {
      draft: { status: string; version: number };
      regenerationFailed: boolean;
    };
    expect(rejectedBody.regenerationFailed).toBe(false);
    expect(rejectedBody.draft.status).toBe('Pending Review');
    expect(rejectedBody.draft.version).toBe(2);

    const approved = await approveDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/approve`, {
        method: 'POST',
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as DraftBody).draft.status).toBe('Approved');

    const pdf = await exportPdf(
      apiRequest(`/api/drafts/${draftId}/pdf`, { token: citizenToken }),
      idContext(draftId),
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const after = await submitDraft(
      apiRequest(`/api/drafts/${draftId}/submit`, {
        method: 'POST',
        token: citizenToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(after.status).toBe(409);

    const again = await exportPdf(
      apiRequest(`/api/drafts/${draftId}/pdf`, { token: citizenToken }),
      idContext(draftId),
    );
    expect(again.status).toBe(200);
  });

  it('UT_DFT_API_02 enforces RBAC on the lawyer and citizen endpoints', async () => {
    const citizenQueue = await getQueue(apiRequest('/api/lawyer/queue', { token: citizenToken }));
    expect(citizenQueue.status).toBe(403);

    const curatorCreate = await createDraft(
      apiRequest('/api/drafts', {
        method: 'POST',
        body: { draft_type: 'Complaint', form_data: answers },
        token: curatorToken,
        csrf: true,
      }),
    );
    expect(curatorCreate.status).toBe(403);

    const lawyerCreate = await createDraft(
      apiRequest('/api/drafts', {
        method: 'POST',
        body: { draft_type: 'Complaint', form_data: answers },
        token: lawyerToken,
        csrf: true,
      }),
    );
    expect(lawyerCreate.status).toBe(403);
  });

  it('UT_DFT_API_03 keeps drafts private to their owner', async () => {
    const created = await createDraft(
      apiRequest('/api/drafts', {
        method: 'POST',
        body: {
          draft_type: 'RTI',
          form_data: {
            applicantName: 'Ananya Sharma',
            applicantAddress: '14, Civil Lines, Jaipur',
            publicAuthority: 'Municipal Corporation, Jaipur',
            pio: 'Public Information Officer',
            level: 'State',
            information: 'Copies of the sanctioned budget for ward 12.',
            period: '2025-26',
            bpl: false,
            replyMode: 'Post',
          },
        },
        token: citizenToken,
        csrf: true,
      }),
    );
    const draftId = ((await created.json()) as DraftBody).draft.id;

    const foreign = await getDraft(
      apiRequest(`/api/drafts/${draftId}`, { token: otherCitizenToken }),
      idContext(draftId),
    );
    expect(foreign.status).toBe(404);

    const foreignPdf = await exportPdf(
      apiRequest(`/api/drafts/${draftId}/pdf`, { token: otherCitizenToken }),
      idContext(draftId),
    );
    expect(foreignPdf.status).toBe(404);

    const list = await listDrafts(apiRequest('/api/drafts', { token: otherCitizenToken }));
    const listBody = (await list.json()) as { drafts: { id: number }[] };
    expect(listBody.drafts.some((draft) => draft.id === draftId)).toBe(false);
  });

  it('UT_DFT_API_04 validates rejection remarks and notifies the citizen', async () => {
    const created = await createDraft(
      apiRequest('/api/drafts', {
        method: 'POST',
        body: { draft_type: 'Legal Notice', form_data: {
          ...answers,
          senderName: 'Ananya Sharma',
          senderAddress: '14, Civil Lines, Jaipur',
          recipientName: 'Sharma Electronics',
          recipientAddress: '22, MI Road, Jaipur',
          relationship: 'Purchase of a washing machine',
          demand: 'Refund of Rs 25,000',
          deadlineDays: 15,
          consequence: 'I will file a consumer complaint.',
        } },
        token: citizenToken,
        csrf: true,
      }),
    );
    const draftId = ((await created.json()) as DraftBody).draft.id;

    const short = await rejectDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/reject`, {
        method: 'POST',
        body: { remarks: 'too short' },
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(short.status).toBe(422);
    const shortBody = (await short.json()) as { error: { fields: { field: string; code: string }[] } };
    expect(shortBody.error.fields[0]).toMatchObject({ field: 'remarks', code: 'LENGTH' });

    const remarks = 'Please add the date on which you last contacted the seller.';
    const rejected = await rejectDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/reject`, {
        method: 'POST',
        body: { remarks },
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(rejected.status).toBe(200);

    const repos = createRepositories(getDb());
    const citizen = await repos.users.findByEmail('citizen@lawtrack.demo');
    const notifications = await repos.notifications.listForUser(citizen?.user_id ?? 0, {
      pageSize: '50',
    });
    expect(notifications.items.some((item) => /changes/i.test(item.message))).toBe(true);

    const approved = await approveDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/approve`, {
        method: 'POST',
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(approved.status).toBe(200);

    // Approved is terminal: a second decision is an invalid transition.
    const rejectAgain = await rejectDraft(
      apiRequest(`/api/lawyer/drafts/${draftId}/reject`, {
        method: 'POST',
        body: { remarks },
        token: lawyerToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(rejectAgain.status).toBe(409);

    // The manual retry endpoint is only valid for a Rejected draft.
    const regenerate = await regenerateDraft(
      apiRequest(`/api/drafts/${draftId}/regenerate`, {
        method: 'POST',
        token: citizenToken,
        csrf: true,
      }),
      idContext(draftId),
    );
    expect(regenerate.status).toBe(409);
  });

  it('UT_DFT_API_05 updates lawyer availability and lists help requests', async () => {
    const status = await updateStatus(
      apiRequest('/api/lawyer/status', {
        method: 'PATCH',
        body: { status: 'Busy' },
        token: lawyerToken,
        csrf: true,
      }),
    );
    expect(status.status).toBe(200);
    expect(((await status.json()) as { status: string }).status).toBe('Busy');

    const invalid = await updateStatus(
      apiRequest('/api/lawyer/status', {
        method: 'PATCH',
        body: { status: 'On holiday' },
        token: lawyerToken,
        csrf: true,
      }),
    );
    expect(invalid.status).toBe(422);

    const requests = await helpRequests(
      apiRequest('/api/lawyer/help-requests', { token: lawyerToken }),
    );
    expect(requests.status).toBe(200);
    expect(Array.isArray(((await requests.json()) as { requests: unknown[] }).requests)).toBe(true);

    await updateStatus(
      apiRequest('/api/lawyer/status', {
        method: 'PATCH',
        body: { status: 'Available' },
        token: lawyerToken,
        csrf: true,
      }),
    );
  });
});
