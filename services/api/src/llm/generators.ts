import { callOpenAI, type ApprovedChatPayload } from './openai.js';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

type AprReductionScriptInput = {
  creditor: string;
  balance: number;
  apr: number;
  callerName?: string;
};

type LateFeeScriptInput = {
  creditor: string;
  feeAmount: number;
  statementMonth: string;
  callerName?: string;
};

type PenaltyAprScriptInput = {
  creditor: string;
  originalApr: number;
  penaltyApr: number;
  monthsDelinquent: number;
  callerName?: string;
};

type DisputeLetterInput = {
  bureauName: string;
  accountName: string;
  disputeReason: string;
};

const aprReductionPrompt = (input: AprReductionScriptInput): ApprovedChatPayload => ({
  model: DEFAULT_MODEL,
  temperature: 0.4,
  max_tokens: 600,
  messages: [
    {
      role: 'system',
      content:
        'You are a financial coach who writes concise, conversational phone scripts. Keep the script to 60 seconds, include numbered bullet points, and end with a polite escalation line.'
    },
    {
      role: 'user',
      content: [
        `Create a 60-second APR reduction call script for ${input.creditor}.`,
        `Balance: ${formatCurrency(input.balance)}.`,
        `Current APR: ${input.apr.toFixed(2)}%.`,
        'Structure:',
        'Intro (approx. 10 seconds).',
        'Three numbered bullets citing payment history, relationship length, and future plans.',
        'Direct ask for a rate reduction.',
        'An escalation line requesting a supervisor if no direct offer is available.',
        'Output plain text with section headers: Intro, Bullet Points, Ask, Escalation.'
      ].join(' ')
    }
  ]
});

const lateFeePrompt = (input: LateFeeScriptInput): ApprovedChatPayload => ({
  model: DEFAULT_MODEL,
  temperature: 0.4,
  max_tokens: 520,
  messages: [
    {
      role: 'system',
      content:
        'You craft short retention scripts. Keep responses human and under 60 seconds, with clear section headers and actionable language.'
    },
    {
      role: 'user',
      content: [
        `Write a late-fee refund call script for ${input.creditor}.`,
        `The caller was charged a ${formatCurrency(input.feeAmount)} late fee on the ${input.statementMonth} statement.`,
        'Include:',
        'Intro (10 seconds).',
        'Three numbered bullets: acknowledge the miss, highlight on-time history, and mention autopay or budgeting adjustments.',
        'Specific ask for a courtesy refund.',
        'Escalation line asking for a supervisor or retention team.',
        'Return plain text with Intro, Bullet Points, Ask, Escalation headings.'
      ].join(' ')
    }
  ]
});

const penaltyAprPrompt = (input: PenaltyAprScriptInput): ApprovedChatPayload => ({
  model: DEFAULT_MODEL,
  temperature: 0.45,
  max_tokens: 580,
  messages: [
    {
      role: 'system',
      content:
        'You provide confident, empathetic scripts for negotiating credit card relief. Keep things actionable and under 60 seconds.'
    },
    {
      role: 'user',
      content: [
        `Draft a penalty APR reversal script for ${input.creditor}.`,
        `Original APR: ${input.originalApr.toFixed(2)}%. Penalty APR: ${input.penaltyApr.toFixed(
          2
        )}%.`,
        `Account has been delinquent for ${input.monthsDelinquent} month(s) but is now current.`,
        'Include intro, three numbered bullets (payment catch-up, financial plan, loyalty), explicit ask to restore the original APR, and an escalation line.',
        'Return plain text with Intro, Bullet Points, Ask, Escalation headings.'
      ].join(' ')
    }
  ]
});

const buildAprReductionFallback = (input: AprReductionScriptInput): string => {
  const caller = input.callerName ?? '{{CALLER_NAME}}';
  return [
    `60-Second Call Script – APR Reduction (${input.creditor})`,
    '',
    'Intro (0–10s):',
    `"Hi, this is ${caller}. I'm calling about my account ending in {{ACCOUNT_SUFFIX}}. I appreciate your time today."`,
    '',
    'Bullet Points (10–40s):',
    `1. "I carry about ${formatCurrency(input.balance)} right now and have kept the account in good standing aside from this recent uptick."`,
    '2. "I have paid on time for the past {{ON_TIME_MONTHS}} months and intend to keep doing so."',
    '3. "I rely on this card for everyday spending and plan to consolidate more balances if we can make the rate more sustainable."',
    '',
    'Ask (40–50s):',
    `"Could you review my profile and lower the APR from the current ${input.apr.toFixed(
      2
    )}%? Even a few points would make a big difference."`,
    '',
    'Escalation (50–60s):',
    '"If there is no promotional offer available, could you connect me with a supervisor or retention specialist who might have additional discretion?"'
  ].join('\n');
};

const buildLateFeeFallback = (input: LateFeeScriptInput): string => {
  const caller = input.callerName ?? '{{CALLER_NAME}}';
  return [
    `60-Second Call Script – Late Fee Refund (${input.creditor})`,
    '',
    'Intro (0–10s):',
    `"Hi, this is ${caller}. I noticed a ${formatCurrency(
      input.feeAmount
    )} late fee on my ${input.statementMonth} statement and wanted to talk through it."`,
    '',
    'Bullet Points (10–40s):',
    '1. "It was an honest slip — I usually pay as soon as the bill posts."',
    '2. "My payment history has been strong, and I value keeping the account in great standing."',
    '3. "I just enabled autopay and budget reminders so this will not happen again."',
    '',
    'Ask (40–50s):',
    `"Would you be able to offer a one-time courtesy refund of the ${formatCurrency(
      input.feeAmount
    )} fee?"`,
    '',
    'Escalation (50–60s):',
    '"If that is outside of your authority, could you connect me with a supervisor or retention team member who might approve it?"'
  ].join('\n');
};

const buildPenaltyAprFallback = (input: PenaltyAprScriptInput): string => {
  const caller = input.callerName ?? '{{CALLER_NAME}}';
  return [
    `60-Second Call Script – Penalty APR Reversal (${input.creditor})`,
    '',
    'Intro (0–10s):',
    `"Hi, this is ${caller}. I'm calling about my account that moved from ${input.originalApr.toFixed(
      2
    )}% to ${input.penaltyApr.toFixed(2)}% APR."`,
    '',
    'Bullet Points (10–40s):',
    `1. "I brought the account current after ${input.monthsDelinquent} month(s) and made the most recent payment early."`,
    '2. "I have a written plan — including autopay — to make sure payments stay on time going forward."',
    '3. "I have been a loyal customer and want to continue using the card responsibly."',
    '',
    'Ask (40–50s):',
    `"Could you restore my original ${input.originalApr.toFixed(
      2
    )}% APR now that the account is current?"`,
    '',
    'Escalation (50–60s):',
    '"If a supervisor or retention specialist has additional flexibility, I would appreciate being connected."'
  ].join('\n');
};

const buildDisputeLetterFallback = (input: DisputeLetterInput): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Dispute Letter Template</title>
    <style>
      body { font-family: 'Times New Roman', serif; color: #0b0b0b; line-height: 1.5; }
      .header { margin-bottom: 1.5rem; }
      .salutation { margin-top: 1rem; }
      .exhibits { margin-top: 1.5rem; }
      .signature { margin-top: 2rem; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>{{CURRENT_DATE}}</div>
      <div>{{CONSUMER_NAME}}</div>
      <div>{{CONSUMER_ADDRESS_LINE1}}</div>
      <div>{{CONSUMER_ADDRESS_LINE2}}</div>
    </div>
    <div>
      <div>${input.bureauName}</div>
      <div>Consumer Relations Department</div>
      <div>{{BUREAU_ADDRESS_LINE}}</div>
    </div>
    <div class="salutation">
      <p>Re: Investigation Request – ${input.accountName}</p>
      <p>To whom it may concern:</p>
    </div>
    <p>
      I am writing to dispute the reporting of <strong>${input.accountName}</strong>.
      The current entry appears inaccurate or incomplete. Specifically, I observed that
      {{DISPUTED_FIELD}} is reported as {{DISPUTED_VALUE}}, which does not align with my records.
    </p>
    <p>
      Under the Fair Credit Reporting Act, I request that you investigate this matter and update your records
      to reflect accurate information. My basis for the dispute is as follows: ${input.disputeReason}.
    </p>
    <p>
      Once the investigation is complete, please provide written confirmation of the outcome to the address listed above.
    </p>
    <div class="exhibits">
      <p>Enclosed exhibits:</p>
      <ul>
        <li>Exhibit A – Billing statement highlighting {{STATEMENT_REFERENCE}}</li>
        <li>Exhibit B – Payment confirmation dated {{PAYMENT_DATE}}</li>
        <li>Exhibit C – Supporting correspondence with ${input.accountName}</li>
      </ul>
    </div>
    <div class="signature">
      <p>Sincerely,</p>
      <p>{{CONSUMER_SIGNATURE_LINE}}</p>
    </div>
  </body>
</html>`;

export const generateAprReductionScript = async (
  input: AprReductionScriptInput
): Promise<string> => {
  try {
    return await callOpenAI(aprReductionPrompt(input));
  } catch (error) {
    return buildAprReductionFallback(input);
  }
};

export const generateLateFeeScript = async (
  input: LateFeeScriptInput
): Promise<string> => {
  try {
    return await callOpenAI(lateFeePrompt(input));
  } catch (error) {
    return buildLateFeeFallback(input);
  }
};

export const generatePenaltyAprScript = async (
  input: PenaltyAprScriptInput
): Promise<string> => {
  try {
    return await callOpenAI(penaltyAprPrompt(input));
  } catch (error) {
    return buildPenaltyAprFallback(input);
  }
};

export const generateDisputeLetterTemplate = async (
  input: DisputeLetterInput
): Promise<string> => {
  try {
    return await callOpenAI({
      model: DEFAULT_MODEL,
      temperature: 0.25,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content:
            'You write formal HTML dispute letters (Style A). Use placeholders like {{CONSUMER_NAME}} instead of any PII. Include an exhibits checklist.'
        },
        {
          role: 'user',
          content: [
            `Draft a credit dispute letter template to ${input.bureauName}.`,
            `Reference account: ${input.accountName}.`,
            `Dispute focus: ${input.disputeReason}.`,
            'Return valid HTML5 with inline CSS, a salutation, paragraphs, an exhibits list, and a signature placeholder.'
          ].join(' ')
        }
      ]
    });
  } catch (error) {
    return buildDisputeLetterFallback(input);
  }
};

