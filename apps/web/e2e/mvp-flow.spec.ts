import { test, expect } from '@playwright/test';

const equifaxConflictFixture = `
Accounts Summary
Account Name: Summit Rewards Visa
Account Type: Revolving
Ownership: Individual
Account Status: Open
Current Balance: $2,400
Credit Limit: $5,000
Date Opened: 2019-05
Date Reported: 2024-02

Account Name: Summit Rewards Visa
Account Type: Revolving
Ownership: Individual
Account Status: Open
Current Balance: $2,950
Credit Limit: $4,800
Date Opened: 2019-05
Date Reported: 2024-02
`.trim();

type SavedItem = {
  item_id: string;
  type: string;
  template_id: string;
  payload_no_pii: Record<string, unknown>;
  engine_version: string;
  created_at: string;
  updated_at: string;
  stale: boolean;
};

const baseActions = [
  {
    id: 'action-apr-reduction',
    type: 'apr_reduction',
    title: 'Request an APR reduction',
    summary: 'Call your issuer to review the rate and cite your history.',
    estimatedSavingsUsd: 620,
    probabilityOfSuccess: 0.58,
    scenarioRange: { low: 480, high: 940 },
    nextSteps: [
      'Call the number on the back of the card.',
      'Ask for a rate review and remind them balances are trending down.',
      'Escalate politely if the first rep cannot assist.'
    ],
    metadata: {
      cashNeededUsd: 0,
      timeToEffectMonths: 2,
      scoreImpact: 'medium',
      whyThis: [
        'Approximately $2,950 outstanding across revolving lines.',
        'Utilization around 60% boosts the impact of a rate cut.',
        'Ev projection assumes a 58% success rate for this profile.'
      ]
    }
  },
  {
    id: 'action-balance-transfer',
    type: 'balance_transfer',
    title: 'Move balances to a 0% promo card',
    summary: 'Shift a portion of the balance to a no-interest promotion.',
    estimatedSavingsUsd: 880,
    probabilityOfSuccess: 0.52,
    scenarioRange: { low: 640, high: 1120 },
    nextSteps: [
      'Compare 0% intro APR offers with fees at or below 3%.',
      'Submit transfer requests the same day once approved.',
      'Set reminders to pay off the promo before it expires.'
    ],
    metadata: {
      cashNeededUsd: 90,
      timeToEffectMonths: 3,
      scoreImpact: 'high',
      whyThis: [
        'Balance transfer of roughly $2,000 modeled with a 3% fee.',
        'Weighted APR estimated near 26%.',
        'Ev haircut already applied for missing limit data.'
      ]
    }
  },
  {
    id: 'action-late-fee',
    type: 'late_fee_reversal',
    title: 'Ask for a late-fee refund',
    summary: 'Request a goodwill credit on the latest $40 fee.',
    estimatedSavingsUsd: 40,
    probabilityOfSuccess: 0.75,
    scenarioRange: { low: 30, high: 40 },
    nextSteps: [
      'Lead with appreciation for the account history.',
      'Explain the slip and mention autopay adjustments.',
      'Confirm the credit posts before ending the call.'
    ],
    metadata: {
      cashNeededUsd: 0,
      timeToEffectMonths: 0.25,
      scoreImpact: 'low',
      whyThis: [
        'Issuers usually waive one late fee every 12 months.',
        'Projected refund assumes 75% odds based on profile.',
        'Refund resets goodwill eligibility for the next 12 months.'
      ]
    }
  }
];

test('end-to-end MVP slice', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      (window as unknown as { __printCalled?: boolean }).__printCalled = true;
    };
  });

  const savedItems: SavedItem[] = [];
  let analyzeCallCount = 0;

  await page.route('**/analyze', async (route) => {
    if (route.request().method() === 'POST') {
      analyzeCallCount += 1;
      const engineVersion = analyzeCallCount === 1 ? 'v1.0.0' : 'v1.1.0';
      if (analyzeCallCount >= 2) {
        savedItems.forEach((item) => {
          if (item.engine_version !== engineVersion) {
            item.stale = true;
          }
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          actions: baseActions,
          warnings: [],
          audit: { engineVersion, computeMs: 37 }
        })
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/items**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'POST') {
      const now = new Date().toISOString();
      const payload = JSON.parse(request.postData() ?? '{}');
      const newItem: SavedItem = {
        item_id: `item-${savedItems.length + 1}`,
        type: payload.type ?? 'script',
        template_id: 'apr-reduction-script',
        payload_no_pii: {
          ...(payload.payload_no_pii ?? {}),
          script:
            'APR reduction call plan — introduce yourself, cite payment history, and escalate politely if needed.'
        },
        engine_version: payload.engine_version ?? 'v1.0.0',
        created_at: now,
        updated_at: now,
        stale: false
      };
      savedItems.push(newItem);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ item_id: newItem.item_id })
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: savedItems })
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.continue();
  });

  await page.goto('/');

  await page.getByRole('checkbox', { name: /I agree/i }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/upload$/);

  await page.fill('#report-text', equifaxConflictFixture);
  await page.getByRole('button', { name: 'Continue to review' }).click();

  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole('heading', { name: 'Merged tradelines' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conflicts' })).toBeVisible();
  await expect(
    page.getByText(/Keeping Equifax \$2,950/i)
  ).toBeVisible();

  await page.getByRole('link', { name: 'Actions' }).click();
  await expect(page).toHaveURL(/\/actions$/);

  await page
    .getByLabel('Late fee charged in the last two statements?')
    .check();
  await page.getByRole('button', { name: 'Generate actions' }).click();

  await expect(
    page.getByRole('article', { name: /Request an APR reduction/i })
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: /Move balances to a 0% promo card/i })
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: /Ask for a late-fee refund/i })
  ).toBeVisible();
  await expect(page.getByText(/\(\$\d{2,4}\s–\s\$\d{2,4}\)/)).toBeVisible();
  await expect(page.getByText('Why this', { exact: false })).toBeVisible();

  await page.goto('/letter/print');
  await page.getByRole('button', { name: 'Save call script' }).click();
  await expect(page.getByText(/Saved!/i)).toBeVisible();

  await page.getByRole('link', { name: 'Saved' }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByText(/APR-REDUCTION-SCRIPT/i)).toBeVisible();
  await expect(
    page.getByText(/APR reduction call plan — introduce yourself/i)
  ).toBeVisible();

  await page.getByRole('link', { name: 'Actions' }).click();
  await page.getByRole('button', { name: 'Generate actions' }).click();

  await page.getByRole('link', { name: 'Saved' }).click();
  await expect(page.getByText('Stale')).toBeVisible();

  await page.goto('/letter/print');
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  const printCalled = await page.evaluate(
    () => Boolean((window as unknown as { __printCalled?: boolean }).__printCalled)
  );
  expect(printCalled).toBe(true);
});
