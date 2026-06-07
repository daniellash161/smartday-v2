/**
 * Provider detection and transaction-section extraction for Israeli credit-card
 * statements.
 *
 * Supports: MAX, Isracard (ישראכרט), Cal (כאל), and unknown/generic providers.
 * The parser is generic — provider adapters only control which portions of the
 * extracted PDF text are passed to the transaction-row parser.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatementProvider = 'max' | 'isracard' | 'cal' | 'unknown';

export interface ProviderConfig {
  displayName: string;
  /**
   * Lines whose text matches one of these phrases mark the START of a
   * transaction section. Lines following are INCLUDED until an ignore
   * section begins.
   */
  transactionSectionStarts: string[];
  /**
   * Lines matching one of these phrases mark the start of a NON-transaction
   * section (interest rates, marketing, legal, etc.). Lines following are
   * EXCLUDED until a transaction section starts again.
   */
  ignoreSectionStarts: string[];
  /** Column header keywords (informational — not used for parsing) */
  columnKeywords?: string[];
}

// ---------------------------------------------------------------------------
// Provider configs
// ---------------------------------------------------------------------------

export const PROVIDER_CONFIGS: Record<StatementProvider, ProviderConfig> = {
  max: {
    displayName: 'MAX',
    transactionSectionStarts: [
      'עסקות בארץ',          // MAX domestic section
      'עסקות בחו',           // covers בחו"ל / בחו״ל
      'עסקאות בארץ',         // alternate spelling
      'עסקאות בחו',
    ],
    ignoreSectionStarts: [
      'שעורי ריבית',
      'שיעורי ריבית',
      'שיעור ריבית',
      'ריבית',
      'כמות הפינוקים',
      'מידע שיווקי',
      'פרסומת',
      'תנאי שימוש',
      'הסבר',
      'הודעה',
    ],
    columnKeywords: [
      'תאריך העסקה',
      'שם בית העסק',
      'סוג העסקה',
      'סכום העסקה',
      'סכום החיוב',
      'הערות',
    ],
  },

  isracard: {
    displayName: 'ישראכרט',
    transactionSectionStarts: [
      'פירוט עסקאות',
      'עסקאות בארץ',
      'עסקאות בחו',
      'חיובים',
    ],
    ignoreSectionStarts: [
      'הודעות',
      'ריבית',
      'פרסומות',
      'מידע נוסף',
      'שיעורי',
      'תנאי',
    ],
  },

  cal: {
    displayName: 'כאל',
    transactionSectionStarts: [
      'פירוט חיובים',
      'עסקאות',
      'עסקאות בארץ',
      'עסקאות בחו',
    ],
    ignoreSectionStarts: [
      'ריבית',
      'הודעות',
      'מידע שיווקי',
      'שיעורי',
      'תנאי',
    ],
  },

  unknown: {
    displayName: 'ספק לא ידוע',
    // For unknown providers we start INCLUSIVE and only exclude known
    // non-transaction sections.
    transactionSectionStarts: [
      'עסקאות',
      'עסקות',
      'פירוט עסקאות',
      'פירוט חיובים',
      'חיובים',
      'transactions',
    ],
    ignoreSectionStarts: [
      'שיעורי ריבית',
      'שעורי ריבית',
      'ריבית',
      'interest',
      'פרסומת',
      'מידע שיווקי',
      'הודעות',
      'שיעורי',
      'תנאי שימוש',
    ],
  },
};

export const PROVIDER_DISPLAY_NAMES: Record<StatementProvider, string> = {
  max:      'MAX',
  isracard: 'ישראכרט',
  cal:      'כאל',
  unknown:  'ספק לא ידוע',
};

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/**
 * Detect the credit-card provider from the full extracted text.
 * Returns 'unknown' when no strong signal is found.
 */
export function detectStatementProvider(text: string): StatementProvider {
  // MAX — "עסקות בארץ" is the most distinctive MAX phrase.
  // Also match MAX brand name when combined with financial terminology.
  if (
    /עסקות\s+בארץ/i.test(text) ||
    (/\bmax\b/i.test(text) && /(?:חיוב|עסקה|כרטיס|פירוט)/i.test(text)) ||
    /פירוט[\s]+החיובים.*max|max.*פירוט[\s]+החיובים/i.test(text)
  ) {
    return 'max';
  }

  // Isracard
  if (/ישראכרט/i.test(text) || /\bisracard\b/i.test(text)) {
    return 'isracard';
  }

  // Cal / Diners
  if (/\bכאל\b/.test(text) || /\bcal\b/i.test(text) || /דיינרס/i.test(text)) {
    return 'cal';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

/**
 * Normalize quotation marks to a single canonical form for loose matching.
 * Handles Hebrew ״ / " / " / ' and similar variants.
 */
function normalizeQuotes(s: string): string {
  return s
    .replace(/[״"''`]/g, '"')
    .replace(/[׳']/g, "'");
}

/**
 * Return true when a line looks like an interest-rate table row rather than
 * a transaction.
 *
 * Catches:
 *  - "קרדיט פלוס 30 פלוס ריבית מתואמת שנתית 16.50%"
 *  - Pure percentage lines like "14.50%"
 */
function isInterestOrMetaLine(line: string): boolean {
  // A line with a %-sign AND an interest/rate keyword
  if (/%/.test(line) && /ריבית|שיעור|interest|prime|פריים|תעריף|מתואמת|שנתית/i.test(line)) {
    return true;
  }
  // A line that is ONLY a decimal number followed by %
  if (/^\d+[.,]\d+%$/.test(line.trim())) {
    return true;
  }
  return false;
}

/**
 * Extract only the transaction-relevant portions of a statement's text.
 *
 * Algorithm (state machine over lines):
 *  - For known providers: start EXCLUDED, switch to INCLUDED when a transaction
 *    section header is seen, switch back to EXCLUDED on an ignore-section header.
 *  - For 'unknown': start INCLUDED, only switch to EXCLUDED on ignore-section
 *    headers.
 *  - In both cases, filter out interest-rate / meta lines regardless of state.
 *
 * Fallback: if fewer than 5 lines are collected for a known provider, retry
 * with 'unknown' config. If still empty, return the full text minus meta lines.
 */
export function extractTransactionRelevantText(
  text: string,
  provider: StatementProvider,
): string {
  const config = PROVIDER_CONFIGS[provider];
  const lines  = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const result: string[] = [];
  // For unknown, start in "included" mode
  let included      = provider === 'unknown';
  let foundSection  = false;

  for (const line of lines) {
    const norm = normalizeQuotes(line.toLowerCase());

    const hitsIgnore = config.ignoreSectionStarts.some(kw =>
      norm.includes(normalizeQuotes(kw.toLowerCase())),
    );
    const hitsTransaction = config.transactionSectionStarts.some(kw =>
      norm.includes(normalizeQuotes(kw.toLowerCase())),
    );

    if (hitsIgnore) {
      included = false;
      continue; // skip the section-header line itself
    }

    if (hitsTransaction) {
      included     = true;
      foundSection = true;
      continue; // skip the section-header line itself
    }

    if (!included) continue;
    if (isInterestOrMetaLine(line)) continue;

    result.push(line);
  }

  // Fallback A: known provider found nothing → retry as 'unknown'
  if (result.length < 5 && provider !== 'unknown') {
    return extractTransactionRelevantText(text, 'unknown');
  }

  // Fallback B: 'unknown' provider and no section header found
  // → return full text minus meta/interest lines
  if (result.length === 0 || (!foundSection && provider === 'unknown')) {
    return lines.filter(l => !isInterestOrMetaLine(l)).join('\n');
  }

  return result.join('\n');
}
