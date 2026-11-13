import 'server-only';

import type { DraftType, Language } from '../../../shared/enums';
import type { DraftAnswers } from '../../../shared/validation';

/**
 * Deterministic draft templates for Mock AI mode (AGENTS.md §9, §10).
 *
 * The templates follow Indian drafting conventions — addressee block, subject,
 * numbered facts, prayer/relief and a signature block — and use only the
 * answers the citizen supplied, so the offline output never invents a fact.
 * A regeneration appends the reviewer's remarks verbatim in a clearly labelled
 * "revisions made" paragraph instead of silently rewriting the facts.
 */

function value(answers: DraftAnswers, key: string): string {
  const raw = answers[key];
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
}

function lines(valueText: string): string[] {
  return valueText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function numbered(items: string[]): string[] {
  return items.map((item, index) => `${index + 1}. ${item}`);
}

function englishComplaint(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const name = value(answers, 'complainantName') || citizenName;
  const documents = value(answers, 'documents');

  return [
    'COMPLAINT',
    '',
    'To,',
    'The competent authority,',
    value(answers, 'incidentPlace'),
    '',
    `Subject: Complaint against ${value(answers, 'oppositeParty')} regarding the incident on ${value(answers, 'incidentDate')}`,
    '',
    'Respected Sir/Madam,',
    '',
    ...numbered([
      `I, ${name}, residing at ${value(answers, 'complainantAddress')}, am filing this complaint against ${value(answers, 'oppositeParty')}.`,
      `On ${value(answers, 'incidentDate')}, at ${value(answers, 'incidentPlace')}, the following happened: ${value(answers, 'facts')}`,
      `Loss and impact: ${value(answers, 'lossImpact')}`,
      `Relief sought: ${value(answers, 'reliefSought')}`,
      `Documents enclosed: ${documents || 'None'}`,
    ]),
    '',
    'I request you to take cognizance of this complaint and grant the relief sought.',
    '',
    `Place: ${value(answers, 'incidentPlace')}`,
    `Date: ${today}`,
    '',
    'Signature',
    name,
  ];
}

function englishRti(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const name = value(answers, 'applicantName') || citizenName;
  const points = lines(value(answers, 'information')).slice(0, 5);
  const bpl = answers.bpl === true;
  const period = value(answers, 'period');

  return [
    'APPLICATION UNDER THE RIGHT TO INFORMATION ACT, 2005',
    '',
    'To,',
    'The Public Information Officer,',
    value(answers, 'publicAuthority'),
    value(answers, 'pio') ? `Attn: ${value(answers, 'pio')}` : '',
    `${value(answers, 'level')} Government`,
    '',
    `Subject: Request for information under the Right to Information Act, 2005`,
    '',
    'Respected Sir/Madam,',
    '',
    `1. Applicant: ${name}, residing at ${value(answers, 'applicantAddress')}.`,
    '2. Information sought:',
    ...points.map((point, index) => `   (${String.fromCharCode(97 + index)}) ${point}`),
    `3. Period to which the information relates: ${period || 'Not applicable'}.`,
    bpl
      ? '4. I am a person below the poverty line and request exemption from the application fee under the proviso to section 7(5) of the Act.'
      : '4. The prescribed application fee is enclosed.',
    `5. Mode of reply preferred: ${value(answers, 'replyMode')}.`,
    '',
    'I request you to provide the above information within the time limit prescribed by the Act.',
    '',
    `Place: ${value(answers, 'applicantAddress')}`,
    `Date: ${today}`,
    '',
    'Signature',
    name,
  ];
}

function englishNotice(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const sender = value(answers, 'senderName') || citizenName;

  return [
    'LEGAL NOTICE',
    '',
    'To,',
    value(answers, 'recipientName'),
    value(answers, 'recipientAddress'),
    '',
    `Subject: Legal notice in respect of ${value(answers, 'relationship')}`,
    '',
    'Respected Sir/Madam,',
    '',
    ...numbered([
      `Under instructions from and on behalf of ${sender}, residing at ${value(answers, 'senderAddress')}, I serve upon you the following notice.`,
      `Facts: ${value(answers, 'facts')}`,
      `Demand: ${value(answers, 'demand')}`,
      `You are required to comply with this demand within ${value(answers, 'deadlineDays')} days of receiving this notice.`,
      `Consequence of non-compliance: ${value(answers, 'consequence')}`,
    ]),
    '',
    'This notice is issued without prejudice to any other right or remedy available in law.',
    '',
    `Place: ${value(answers, 'senderAddress')}`,
    `Date: ${today}`,
    '',
    'Signature',
    sender,
  ];
}

function hindiComplaint(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const name = value(answers, 'complainantName') || citizenName;
  const documents = value(answers, 'documents');

  return [
    'शिकायत',
    '',
    'सेवा में,',
    'सक्षम प्राधिकारी,',
    value(answers, 'incidentPlace'),
    '',
    `विषय: दिनांक ${value(answers, 'incidentDate')} की घटना के संबंध में ${value(answers, 'oppositeParty')} के विरुद्ध शिकायत`,
    '',
    'महोदय/महोदया,',
    '',
    ...numbered([
      `मैं, ${name}, निवासी ${value(answers, 'complainantAddress')}, ${value(answers, 'oppositeParty')} के विरुद्ध यह शिकायत दर्ज कर रहा/रही हूँ।`,
      `दिनांक ${value(answers, 'incidentDate')} को ${value(answers, 'incidentPlace')} में निम्नलिखित घटना हुई: ${value(answers, 'facts')}`,
      `हानि और प्रभाव: ${value(answers, 'lossImpact')}`,
      `अभीष्ट राहत: ${value(answers, 'reliefSought')}`,
      `संलग्न दस्तावेज़: ${documents || 'कोई नहीं'}`,
    ]),
    '',
    'आपसे अनुरोध है कि इस शिकायत को संज्ञान में लेकर अभीष्ट राहत प्रदान करें।',
    '',
    `स्थान: ${value(answers, 'incidentPlace')}`,
    `दिनांक: ${today}`,
    '',
    'हस्ताक्षर',
    name,
  ];
}

function hindiRti(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const name = value(answers, 'applicantName') || citizenName;
  const points = lines(value(answers, 'information')).slice(0, 5);
  const bpl = answers.bpl === true;
  const period = value(answers, 'period');

  return [
    'सूचना का अधिकार अधिनियम, 2005 के अंतर्गत आवेदन',
    '',
    'सेवा में,',
    'लोक सूचना अधिकारी,',
    value(answers, 'publicAuthority'),
    value(answers, 'pio') ? `ध्यानाकर्षण: ${value(answers, 'pio')}` : '',
    `${value(answers, 'level') === 'Central' ? 'केंद्र' : 'राज्य'} सरकार`,
    '',
    'विषय: सूचना का अधिकार अधिनियम, 2005 के अंतर्गत सूचना का अनुरोध',
    '',
    'महोदय/महोदया,',
    '',
    `1. आवेदक: ${name}, निवासी ${value(answers, 'applicantAddress')}।`,
    '2. अभीष्ट सूचना:',
    ...points.map((point, index) => `   (${String.fromCharCode(2325 + index)}) ${point}`),
    `3. सूचना से संबंधित अवधि: ${period || 'लागू नहीं'}।`,
    bpl
      ? '4. मैं गरीबी रेखा से नीचे रहने वाला व्यक्ति हूँ और अधिनियम की धारा 7(5) के परंतुक के अंतर्गत शुल्क से छूट का अनुरोध करता/करती हूँ।'
      : '4. निर्धारित आवेदन शुल्क संलग्न है।',
    `5. उत्तर का पसंदीदा माध्यम: ${value(answers, 'replyMode')}।`,
    '',
    'आपसे अनुरोध है कि उपरोक्त सूचना अधिनियम में निर्धारित समय-सीमा के भीतर उपलब्ध कराएँ।',
    '',
    `स्थान: ${value(answers, 'applicantAddress')}`,
    `दिनांक: ${today}`,
    '',
    'हस्ताक्षर',
    name,
  ];
}

function hindiNotice(answers: DraftAnswers, citizenName: string, today: string): string[] {
  const sender = value(answers, 'senderName') || citizenName;

  return [
    'कानूनी नोटिस',
    '',
    'सेवा में,',
    value(answers, 'recipientName'),
    value(answers, 'recipientAddress'),
    '',
    `विषय: ${value(answers, 'relationship')} के संबंध में कानूनी नोटिस`,
    '',
    'महोदय/महोदया,',
    '',
    ...numbered([
      `${sender}, निवासी ${value(answers, 'senderAddress')}, की ओर से और उनके निर्देश पर आपको यह नोटिस दिया जाता है।`,
      `तथ्य: ${value(answers, 'facts')}`,
      `माँग: ${value(answers, 'demand')}`,
      `आपको यह नोटिस प्राप्त होने के ${value(answers, 'deadlineDays')} दिनों के भीतर इस माँग का पालन करना होगा।`,
      `पालन न करने का परिणाम: ${value(answers, 'consequence')}`,
    ]),
    '',
    'यह नोटिस कानून में उपलब्ध किसी अन्य अधिकार या उपाय पर प्रतिकूल प्रभाव डाले बिना दिया जा रहा है।',
    '',
    `स्थान: ${value(answers, 'senderAddress')}`,
    `दिनांक: ${today}`,
    '',
    'हस्ताक्षर',
    sender,
  ];
}

const TEMPLATES: Record<
  Language,
  Record<DraftType, (answers: DraftAnswers, citizenName: string, today: string) => string[]>
> = {
  English: {
    Complaint: englishComplaint,
    RTI: englishRti,
    'Legal Notice': englishNotice,
  },
  Hindi: {
    Complaint: hindiComplaint,
    RTI: hindiRti,
    'Legal Notice': hindiNotice,
  },
};

export function composeDraft(context: {
  type: DraftType;
  language: Language;
  answers: DraftAnswers;
  citizenName: string;
  today: string;
  remarks?: string;
  regenerated?: boolean;
}): string {
  const body = TEMPLATES[context.language][context.type](
    context.answers,
    context.citizenName,
    context.today,
  );

  if (!context.regenerated || !context.remarks) return body.join('\n');

  const note =
    context.language === 'Hindi'
      ? ['', '---', `समीक्षा के बाद किए गए संशोधन: ${context.remarks}`]
      : ['', '---', `Revisions made after review: ${context.remarks}`];

  // Keep the signature block last: insert the revision note before it.
  const signatureIndex = body.lastIndexOf('Signature') >= 0
    ? body.lastIndexOf('Signature')
    : body.lastIndexOf('हस्ताक्षर');
  const splitAt = signatureIndex >= 0 ? signatureIndex : body.length;
  return [...body.slice(0, splitAt), ...note, ...body.slice(splitAt)].join('\n');
}
