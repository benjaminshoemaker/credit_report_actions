const moneyRegex = /\$?\s*(-?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|-?[0-9]+(?:\.[0-9]{2})?)/;
const monthRegex = /(?:(\d{4})[-/](\d{2}))|(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4}))/i;
const statusRegex = /(open|closed|paid|charge ?off|delinquent|current|late)/i;
const ownershipRegex = /(individual|joint|authorized user|business)/i;

export const parseMoney = (input: string): { value: number; confidence: number } | null => {
  const match = input.match(moneyRegex);
  if (!match) return null;

  const normalized = match[1].replace(/[$,\s]/g, '');
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return null;
  return { value, confidence: 0.95 };
};

export const parseMonth = (input: string): { value: string; confidence: number } | null => {
  const match = input.match(monthRegex);
  if (!match) return null;

  if (match[1] && match[2]) {
    return { value: `${match[1]}-${match[2]}`, confidence: 0.9 };
  }

  if (match[3] && match[4]) {
    const monthLookup: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12'
    };
    const month = monthLookup[match[3].slice(0, 3).toLowerCase()];
    if (!month) return null;
    return { value: `${match[4]}-${month}`, confidence: 0.8 };
  }

  return null;
};

export const parseStatus = (input: string): { value: string; confidence: number } | null => {
  const match = input.match(statusRegex);
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, '_').toLowerCase();
  return { value: normalized, confidence: 0.8 };
};

export const parseOwnership = (input: string): { value: string; confidence: number } | null => {
  const match = input.match(ownershipRegex);
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, '_').toLowerCase();
  return { value: normalized, confidence: 0.9 };
};
