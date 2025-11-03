import synonyms from './label-synonyms.json' assert { type: 'json' };
import {
  parseMoney,
  parseMonth,
  parseOwnership,
  parseStatus
} from './grammar.ts';

export type ParsedAccount = {
  name: string;
  rawLines: string[];
  balance?: number;
  balanceConfidence?: number;
  creditLimit?: number;
  creditLimitConfidence?: number;
  highCredit?: number;
  highCreditConfidence?: number;
  status?: string;
  statusConfidence?: number;
  ownership?: string;
  ownershipConfidence?: number;
  openDate?: string;
  openDateConfidence?: number;
  reportedDate?: string;
  reportedDateConfidence?: number;
};

export type ParsedInquiry = {
  creditor: string;
  date?: string;
  dateConfidence?: number;
  type?: string;
};

export type EquifaxParseResult = {
  accounts: ParsedAccount[];
  inquiries: ParsedInquiry[];
};

type LabelKey = keyof typeof synonyms;

const synonymIndex = Object.entries(synonyms).reduce<Record<string, LabelKey>>(
  (map, [key, values]) => {
    values.forEach((value) => {
      map[value.toLowerCase()] = key as LabelKey;
    });
    return map;
  },
  {}
);

const normalizeLabel = (label: string): LabelKey | null => {
  const normalized = label.trim().toLowerCase();
  const direct = synonymIndex[normalized];
  if (direct) return direct;

  return (Object.keys(synonyms) as LabelKey[]).find((key) =>
    synonyms[key].some((value) => normalized.includes(value))
  ) as LabelKey | undefined ?? null;
};

const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)!
    .map((line) => line.trim())
    .filter(Boolean);

const isSectionHeader = (line: string): boolean => /^(?:accounts|inquiries)/i.test(line);

const groupSections = (lines: string[]): Record<string, string[]> => {
  const sections: Record<string, string[]> = {};
  let currentKey = 'accounts';
  sections[currentKey] = [];

  lines.forEach((line) => {
    if (isSectionHeader(line)) {
      currentKey = line.toLowerCase().includes('inquiries') ? 'inquiries' : 'accounts';
      if (!sections[currentKey]) sections[currentKey] = [];
    } else {
      sections[currentKey].push(line);
    }
  });

  return sections;
};

const chunkAccounts = (lines: string[]): string[][] => {
  const chunks: string[][] = [];
  let buffer: string[] = [];

  lines.forEach((line) => {
    if (/^account name/i.test(line) && buffer.length) {
      chunks.push(buffer);
      buffer = [];
    }
    buffer.push(line);
  });

  if (buffer.length) {
    chunks.push(buffer);
  }

  return chunks;
};

const parseAccountChunk = (chunk: string[]): ParsedAccount | null => {
  let name = 'Unknown account';
  const result: ParsedAccount = {
    name,
    rawLines: chunk.slice()
  };

  chunk.forEach((line) => {
    const [rawLabel, ...rest] = line.split(':');
    if (!rawLabel || rest.length === 0) {
      return;
    }
    const label = normalizeLabel(rawLabel);
    const value = rest.join(':').trim();
    if (!label || !value) return;

    switch (label) {
      case 'account_name':
        name = value;
        result.name = value;
        break;
      case 'balance': {
        const parsed = parseMoney(value);
        if (parsed) {
          result.balance = parsed.value;
          result.balanceConfidence = parsed.confidence;
        }
        break;
      }
      case 'credit_limit': {
        const parsed = parseMoney(value);
        if (parsed) {
          result.creditLimit = parsed.value;
          result.creditLimitConfidence = parsed.confidence;
        }
        break;
      }
      case 'high_credit': {
        const parsed = parseMoney(value);
        if (parsed) {
          result.highCredit = parsed.value;
          result.highCreditConfidence = parsed.confidence;
        }
        break;
      }
      case 'status': {
        const parsed = parseStatus(value);
        if (parsed) {
          result.status = parsed.value;
          result.statusConfidence = parsed.confidence;
        }
        break;
      }
      case 'ownership': {
        const parsed = parseOwnership(value);
        if (parsed) {
          result.ownership = parsed.value;
          result.ownershipConfidence = parsed.confidence;
        }
        break;
      }
      case 'open_date': {
        const parsed = parseMonth(value);
        if (parsed) {
          result.openDate = parsed.value;
          result.openDateConfidence = parsed.confidence;
        }
        break;
      }
      case 'reported_date': {
        const parsed = parseMonth(value);
        if (parsed) {
          result.reportedDate = parsed.value;
          result.reportedDateConfidence = parsed.confidence;
        }
        break;
      }
      default:
        break;
    }
  });

  const isRevolving = chunk.some((line) => /revolving/i.test(line));
  const isOpen = result.status ? /open|current/.test(result.status) : false;
  if (!isRevolving || !isOpen) {
    return null;
  }

  return result;
};

const parseInquiries = (lines: string[]): ParsedInquiry[] => {
  const inquiries: ParsedInquiry[] = [];
  let current: (ParsedInquiry & { hasSource: boolean }) | null = null;
  const pushCurrent = () => {
    if (!current || !current.hasSource) {
      return;
    }
    inquiries.push({
      creditor: current.creditor,
      date: current.date,
      dateConfidence: current.dateConfidence,
      type: current.type
    });
  };

  lines.forEach((line) => {
    if (!line.trim()) {
      return;
    }

    if (/^inquiry\s*:/i.test(line)) {
      pushCurrent();
      current = {
        creditor: line.replace(/^inquiry\s*:/i, '').trim() || 'Unknown',
        hasSource: true
      };
      return;
    }

    if (!current) {
      return;
    }

    const [rawLabel, ...rest] = line.split(':');
    if (!rawLabel || rest.length === 0) return;
    const label = normalizeLabel(rawLabel);
    const value = rest.join(':').trim();

    switch (label) {
      case 'inquiry_date': {
        const parsed = parseMonth(value);
        if (parsed) {
          current.date = parsed.value;
          current.dateConfidence = parsed.confidence;
        }
        break;
      }
      case 'inquiry_creditor':
        current.creditor = value;
        break;
      case 'inquiry_type':
        current.type = value.toLowerCase();
        break;
      default:
        break;
    }
  });

  pushCurrent();
  return inquiries;
};

export const parseEquifaxText = (text: string): EquifaxParseResult => {
  const lines = splitLines(text);
  const sections = groupSections(lines);
  const accounts = chunkAccounts(sections.accounts ?? [])
    .map(parseAccountChunk)
    .filter((account): account is ParsedAccount => account !== null);

  const inquiries = parseInquiries(sections.inquiries ?? []);

  return { accounts, inquiries };
};
