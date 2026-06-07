/**
 * Payment analysis utilities for Israeli credit-card statement text.
 *
 * Privacy: all analysis runs locally in the browser.
 * We do NOT store raw text, card numbers, IDs or any sensitive PII.
 * Only processed, minimal insights are persisted.
 */

import {
  type StatementProvider,
  detectStatementProvider,
  extractTransactionRelevantText,
} from './statementProviders';

// Re-export provider types / helpers so callers only need one import
export type { StatementProvider };
export { detectStatementProvider, extractTransactionRelevantText };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InsightConfidence = 'high' | 'medium' | 'low';
export type InsightType = 'standingOrder' | 'subscription' | 'installment' | 'unusual' | 'upcoming';

export interface InsightItem {
  merchant: string;
  amount?: number;
  date?: string;
  reason: string;
  confidence: InsightConfidence;
  /** Exact (or truncated) source line — in memory only, stripped before localStorage. */
  sourceLine?: string;
  insightType?: InsightType;
  /** Installment progress fields */
  paymentIndex?: number;
  paymentTotal?: number;
  paymentCount?: number;
  /** Total transaction amount for installments (סכום העסקה) */
  originalAmount?: number;
  /** Estimated remaining payment sum = remainingPayments × currentCharge */
  estimatedRemainingTotal?: number;
  /** Provider that issued this insight */
  provider?: StatementProvider;
}

/** Smart payment reminder derived from recurring / installment insights. */
export interface PaymentReminder {
  id: string;
  merchant: string;
  amount: number;
  /** ISO yyyy-mm-dd — estimated next charge date */
  chargeDate: string;
  /** ISO yyyy-mm-dd — one day before chargeDate */
  reminderDate: string;
  /** ISO yyyy-mm-dd — the previous transaction date this estimate is based on */
  previousDate?: string;
  type: 'standingOrder' | 'subscription' | 'installment';
  confidence: InsightConfidence;
  /** Installment progress for display */
  paymentIndex?: number;
  paymentTotal?: number;
  /** Source evidence line — memory only, stripped before localStorage */
  sourceLine?: string;
}

export interface PaymentRow {
  date?: string;
  merchant: string;
  amount?: number;
  rawLine: string;
  /** = isStandingOrder (kept for backward compat) */
  isRecurring: boolean;
  isStandingOrder: boolean;
  isInstallment: boolean;
  paymentIndex?: number;
  paymentTotal?: number;
  paymentCount?: number;
  recurringEvidence: string[];
  rowConfidence: InsightConfidence;
}

export interface StatementAnalysis {
  /** Explicitly flagged standing orders / fixed charges (הוראת קבע, הו״ק, חיוב חודשי…) */
  fixedPayments:  InsightItem[];
  /** Confirmed recurring subscription services (known brands or repeated merchant) */
  subscriptions:  InsightItem[];
  installments:   InsightItem[];
  /** Unusual / high-value charges — only generated when ≥10 valid rows */
  anomalies:      InsightItem[];
  /** Smart reminders — next estimated charge date, one-day-before reminder */
  reminders:      PaymentReminder[];
  /** ISO date — detected statement billing date, if found */
  billingDate?:   string;
  totalRows:      number;
  charCount:      number;
  confidence:     InsightConfidence;
  provider:       StatementProvider;
}

// ---------------------------------------------------------------------------
// Standing-order keyword patterns
// ---------------------------------------------------------------------------

const STANDING_ORDER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /הוראת[\s ]*קבע/i,                     label: 'הוראת קבע' },
  { re: /הו[״'"]\s*ק/i,                          label: 'הו״ק' },
  { re: /הו"ק/i,                                  label: 'הו"ק' },
  { re: /חיוב[\s ]*חודשי/i,                      label: 'חיוב חודשי' },
  { re: /חיוב[\s ]*קבוע/i,                       label: 'חיוב קבוע' },
  { re: /חשבונית[\s ]*חודשית/i,                  label: 'חשבונית חודשית' },
  { re: /דמי[\s ]*חבר/i,                         label: 'דמי חבר' },
  { re: /מנויים?/i,                               label: 'מנוי' },
  { re: /subscription/i,                          label: 'Subscription' },
  { re: /recurring/i,                             label: 'Recurring' },
  { re: /monthly\s+(?:charge|payment|fee)/i,      label: 'Monthly charge' },
  { re: /standing\s+order/i,                      label: 'Standing order' },
  { re: /direct\s+debit/i,                        label: 'Direct debit' },
  { re: /auto\s*pay/i,                            label: 'Auto pay' },
  { re: /auto\s*renew/i,                          label: 'Auto renew' },
];

// ---------------------------------------------------------------------------
// Installment patterns
// ---------------------------------------------------------------------------

const INSTALLMENT_KEYWORD_RE = /עסקה[\s ]*בתשלומים|installments/i;
const INSTALLMENT_INDEX_RE   = /תשלום[\s ]*(\d+)[\s ]*מתוך[\s ]*(\d+)/i;
const INSTALLMENT_INDEX_EN   = /payment[\s]+(\d+)[\s]+of[\s]+(\d+)/i;
const PAYMENT_COUNT_LABEL_RE = /(?:כמות|מספר|מס[׳']|מס')\s*תשלומים\s*:?\s*(\d+)/i;
const PAYMENT_COUNT_PLAIN_RE = /(\d+)\s*תשלומים|תשלומים\s*:?\s*(\d+)/i;

// ---------------------------------------------------------------------------
// Misc line filters
// ---------------------------------------------------------------------------

/** Lines that are NOT transaction rows (boring / summary / totals / platform labels) */
const BORING_LINE_RE =
  /זיכוי|refund|החזר|אשראי\s*זר|המרת\s*מטבע|exchange\s*fee|יתרה\s*לתשלום|יתרה\s*לחיוב|סה[״"]כ|סך\s*(?:הכל|חיובים|העסקאות)|total\s*(?:due|amount|charges)|billing\s*total|statement\s*total|balance|שיעורי?\s*ריבית|ריבית\s*(?:שנתית|חודשית|מתואמת|תעריפית)|מסגרת(?:\s*אשראי)?|חיוב\s*(?:מינימלי|כולל)|תשלום\s*מינימלי|minimum\s*payment|כולל\s*חיובים|חיוב\s*לתשלום|הגבלת\s*אשראי|מגבלת\s*אשראי|עמלת|קנס\s*פיגורים|דמי\s*כרטיס|apple\s*pay|google\s*pay|samsung\s*pay|פירוט\s*(?:ה)?חיובים|התחייבויות\s*(?:בכרטיס)?|חיובים\s*(?:ב)?תאריך/i;

/**
 * Payment-platform / statement-summary patterns for anomaly pre-filter.
 * These are matched against the raw source line — more permissive than BORING_LINE_RE.
 */
const ANOMALY_EXCLUDE_RE =
  /apple\s*pay|google\s*pay|samsung\s*pay|bit\s*(?:pay|transfer|העברה)|paybox|פירוט\s*(?:ה)?חיובים|התחייבויות|סך\s*(?:הכל|חיובים|העסקאות)|סה[״"]כ\s*חיובים|total\s*(?:due|charges|amount|statement)|statement\s*total|billing\s*total|מסגרת|חיוב\s*(?:מינימלי|כולל)|תשלום\s*מינימלי|חיובים\s*(?:ב)?תאריך|יתרה\s*לתשלום|יתרה\s*לחיוב/i;

/** Known subscription services — used for merchant-name matching (medium confidence) */
const SUBSCRIPTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /netflix|נטפליקס/i,                     label: 'Netflix' },
  { re: /spotify|ספוטיפיי/i,                    label: 'Spotify' },
  { re: /apple\s*(?:com|store|itunes|one)|אפל/i, label: 'Apple' },
  { re: /google\s*(?:play|one|storage)?|גוגל/i,  label: 'Google' },
  { re: /amazon\s*(?:prime|video)?|אמזון/i,      label: 'Amazon Prime' },
  { re: /microsoft|office\s*365|מיקרוסופט/i,    label: 'Microsoft' },
  { re: /youtube\s*premium/i,                   label: 'YouTube Premium' },
  { re: /hbo|max\.com/i,                        label: 'HBO Max' },
  { re: /disney\s*(?:\+|plus)?/i,               label: 'Disney+' },
  { re: /canva/i,                               label: 'Canva' },
  { re: /adobe/i,                               label: 'Adobe' },
  { re: /dropbox/i,                             label: 'Dropbox' },
  { re: /github/i,                              label: 'GitHub' },
  { re: /zoom/i,                                label: 'Zoom' },
  { re: /wix/i,                                 label: 'Wix' },
  { re: /slack/i,                               label: 'Slack' },
  { re: /figma/i,                               label: 'Figma' },
  { re: /notion/i,                              label: 'Notion' },
  { re: /chatgpt|openai/i,                      label: 'ChatGPT / OpenAI' },
  { re: /cellcom|סלקום/i,                       label: 'Cellcom' },
  { re: /partner|פרטנר/i,                       label: 'Partner' },
  { re: /pelephone|פלאפון/i,                    label: 'Pelephone' },
  { re: /hot(?:\s|$)|הוט/i,                     label: 'HOT' },
  { re: /yes(?:\s|$)|יס(?:\s|$)/i,              label: 'Yes' },
  { re: /bezeq|בזק/i,                           label: 'Bezeq' },
  { re: /icloud/i,                              label: 'iCloud' },
];

const UNUSUAL_KEYWORDS =
  /חריג|עמלה|ריבית|קנס|penalty|fee|interest|אוברדראפט|חריגה|late\s*charge/i;

/**
 * Interest / credit-rate lines must NEVER appear in reminders, fixed payments,
 * subscriptions or anomalies. Covers: ריבית, קרן, חיוב ע"ח ריבית/קרן,
 * rate percentages, prime, אחוז, etc.
 */
const INTEREST_LINE_RE =
  /ריבית|חיוב\s+ע[״"']\s*ח\s*(?:ריבית|קרן)|קרן\b|שיעורי?\s*ריבית|שעורי?\s*ריבית|תעריפית|מתואמת|פריים|prime\s*\+?|אחוז|\b\d+(?:[.,]\d+)?%/i;

// ---------------------------------------------------------------------------
// Public helper functions
// ---------------------------------------------------------------------------

const TODAY_ISO = new Date().toISOString().split('T')[0];

export function normalizeMerchantName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^א-תװ-״‏‎ a-zA-Z0-9\s\-&'".,()/]/g, '')
    .slice(0, 45);
}

export function parseAmountFromLine(line: string): number | undefined {
  const s = line.replace(/ש[״"']ח|שח|NIS/gi, '');

  const patterns: RegExp[] = [
    /₪\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/,
    /([\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*₪/,
    /\b(\d{1,6}[.,]\d{2})\b/,
    /\b(\d{1,3}(?:,\d{3})+)\b/,
  ];

  for (const re of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const raw = m[1];
    let num: number;
    if (/[,.](\d{2})$/.test(raw)) {
      num = parseFloat(raw.replace(/,/g, '').replace(/\./, '.'));
      if (isNaN(num)) num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    } else {
      num = parseFloat(raw.replace(/,/g, ''));
    }
    if (!isNaN(num) && num >= 1 && num <= 150_000) {
      return Math.round(num * 100) / 100;
    }
  }
  return undefined;
}

export function parseDateFromLine(line: string): string | undefined {
  let m = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(line);
  if (m) {
    const d    = m[1].padStart(2, '0');
    const mo   = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12) return `${yyyy}-${mo}-${d}`;
  }
  m = /(\d{1,2})[\/](\d{4})/.exec(line);
  if (m) {
    const mo = m[1].padStart(2, '0');
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12) return `${m[2]}-${mo}-01`;
  }
  return undefined;
}

/**
 * Return true when a line looks like an interest-rate / meta row rather than
 * a real transaction. Used as an extra safety filter inside extractPaymentRows.
 */
function isInterestRateLine(line: string): boolean {
  // A line that is ONLY a decimal number followed by % (e.g. "14.50%")
  if (/^\d+[.,]\d+%$/.test(line.trim())) return true;
  // Line with % AND an interest/rate keyword
  if (/%/.test(line) && /ריבית|שיעור|interest|prime|פריים|תעריף|מתואמת|שנתית/i.test(line)) return true;
  return false;
}

export function lineLooksLikeTransaction(line: string): boolean {
  if (!/\d/.test(line)) return false;
  if (BORING_LINE_RE.test(line)) return false;
  if (isInterestRateLine(line)) return false;
  return parseAmountFromLine(line) !== undefined;
}

// ---------------------------------------------------------------------------
// Installment + standing-order detection helpers
// ---------------------------------------------------------------------------

interface InstallmentInfo {
  isInstallment: boolean;
  paymentIndex?: number;
  paymentTotal?: number;
  paymentCount?: number;
  evidence: string[];
}

function parseInstallmentInfo(lineCtx: string): InstallmentInfo {
  const evidence: string[] = [];
  let paymentIndex: number | undefined;
  let paymentTotal: number | undefined;
  let paymentCount: number | undefined;

  // 1. "תשלום X מתוך Y"
  const m1 = INSTALLMENT_INDEX_RE.exec(lineCtx);
  if (m1) { paymentIndex = parseInt(m1[1]); paymentTotal = parseInt(m1[2]); evidence.push(m1[0].trim()); }

  // 2. "payment X of Y"
  if (paymentIndex === undefined) {
    const m1e = INSTALLMENT_INDEX_EN.exec(lineCtx);
    if (m1e) { paymentIndex = parseInt(m1e[1]); paymentTotal = parseInt(m1e[2]); evidence.push(m1e[0].trim()); }
  }

  // 3. "כמות/מספר/מס׳ תשלומים N"
  if (paymentCount === undefined) {
    const m2 = PAYMENT_COUNT_LABEL_RE.exec(lineCtx);
    if (m2) { const n = parseInt(m2[1]); if (!isNaN(n) && n > 1) { paymentCount = n; evidence.push(m2[0].trim()); } }
  }

  // 4. "N תשלומים" or "תשלומים: N"
  if (paymentCount === undefined && paymentIndex === undefined) {
    const m3 = PAYMENT_COUNT_PLAIN_RE.exec(lineCtx);
    if (m3) { const n = parseInt(m3[1] ?? m3[2]); if (!isNaN(n) && n > 1 && n <= 72) { paymentCount = n; evidence.push(m3[0].trim()); } }
  }

  // 5. "עסקה בתשלומים" keyword
  if (paymentIndex === undefined && paymentCount === undefined && INSTALLMENT_KEYWORD_RE.test(lineCtx)) {
    evidence.push('עסקה בתשלומים');
  }

  // 6. X/Y fraction — only when "תשלומים" keyword also present (avoids date confusion)
  if (paymentIndex === undefined && /תשלומים/i.test(lineCtx)) {
    const noDate = lineCtx.replace(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g, '');
    const m4 = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(noDate);
    if (m4) {
      const x = parseInt(m4[1]), y = parseInt(m4[2]);
      if (y >= 2 && y <= 36 && x >= 1 && x <= y) { paymentIndex = x; paymentTotal = y; evidence.push(m4[0].trim()); }
    }
  }

  const isInstallment =
    (paymentIndex !== undefined && paymentTotal !== undefined) ||
    (paymentCount !== undefined && paymentCount > 1) ||
    evidence.length > 0;

  return { isInstallment, paymentIndex, paymentTotal, paymentCount, evidence };
}

interface StandingOrderInfo { isStandingOrder: boolean; evidence: string[]; }

function parseStandingOrderInfo(lineCtx: string): StandingOrderInfo {
  const evidence: string[] = [];
  for (const { re, label } of STANDING_ORDER_PATTERNS) {
    if (re.test(lineCtx)) evidence.push(label);
  }
  return { isStandingOrder: evidence.length > 0, evidence };
}

// ---------------------------------------------------------------------------
// Row confidence scoring
// ---------------------------------------------------------------------------

function scoreRowConfidence(
  merchant: string, amount: number | undefined, date: string | undefined,
): InsightConfidence {
  const hasMeaningfulMerchant = /[א-תa-zA-Z]{2,}/.test(merchant);
  if (!hasMeaningfulMerchant) return 'low';
  if (amount !== undefined && date !== undefined && merchant.length >= 4) return 'high';
  if (amount !== undefined && merchant.length >= 3) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[​-‍﻿]/g, '').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
}

function splitToLines(text: string): string[] {
  return normalizeText(text).split('\n').map(l => l.trim()).filter(l => l.length > 2);
}

// ---------------------------------------------------------------------------
// Date-chunk-based transaction parsing
// ---------------------------------------------------------------------------
// Handles messy RTL Hebrew PDF tables where a single transaction may span
// several extracted lines (date on one line, merchant on the next, etc.).

/**
 * Statement-specific keywords stripped when reconstructing a merchant name
 * from a multi-line transaction chunk.
 */
const TX_KEYWORD_REMOVAL_RE =
  /תשלומים|קרדיט|רגילה|הוראת[\s]*קבע|הו["״]\s*ק|חיוב[\s]*חודשי|חשבונית[\s]*חודשית|מנויים?|תשלום\s*\d*\s*מתוך\s*\d*|תשלום|מתוך/gi;

/**
 * Normalise Hebrew/RTL text extracted from a PDF.
 * Removes bidi control characters, normalises quotation marks, collapses spaces.
 */
function normalizeExtractedStatementText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‏‪-‮﻿­]/g, '')
    .replace(/[״""]/g, '"')
    .replace(/[׳''`]/g, "'")
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Extract all monetary amounts from a text snippet in the order they appear.
 * Date patterns are removed first so their numeric components are not mistaken
 * for amounts. Duplicate values are skipped.
 */
function extractAllAmountsFromText(text: string): number[] {
  let s = text.replace(/ש[״"']ח|שח|NIS/gi, '');
  // Remove date patterns before scanning for amounts
  s = s.replace(/\d{1,2}[/]\d{1,2}[/]\d{2,4}/g, '')
        .replace(/\d{2}\.\d{2}\.\d{4}/g, '');

  const found: number[] = [];
  const seen  = new Set<number>();
  const add   = (raw: string) => {
    const n = parseFloat(raw.replace(/,/g, ''));
    if (!isNaN(n) && n >= 1 && n <= 150_000 && !seen.has(n)) {
      seen.add(n);
      found.push(Math.round(n * 100) / 100);
    }
  };

  let m: RegExpExecArray | null;

  // ₪-prefixed
  const re1 = /₪\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;
  while ((m = re1.exec(s)) !== null) add(m[1]);
  if (found.length) return found;

  // ₪-suffixed
  const re2 = /([\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*₪/g;
  while ((m = re2.exec(s)) !== null) add(m[1]);
  if (found.length) return found;

  // Decimal amounts: up to 6 digits with exactly 2 decimal places
  const re3 = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
  while ((m = re3.exec(s)) !== null) add(m[1]);
  if (found.length) return found;

  // Comma-grouped integers (e.g. 3,509)
  const re4 = /\b(\d{1,3}(?:,\d{3})+)\b/g;
  while ((m = re4.exec(s)) !== null) add(m[1]);

  return found;
}

interface DateChunk {
  date:     string;   // ISO yyyy-mm-dd
  body:     string;   // text between this date and the next date
  rawChunk: string;   // date + body combined (for rawLine / sourceLine)
}

/**
 * Split statement text into per-transaction chunks, each anchored to a date.
 * Recognises DD/MM/YY, DD/MM/YYYY (slash-separated) and DD.MM.YYYY (4-digit year,
 * dot-separated — the longer year prevents matching decimal amounts like 292.42).
 */
function splitIntoDateChunks(text: string): DateChunk[] {
  const norm = normalizeExtractedStatementText(text);

  // Two alternative date formats in one alternation:
  //   Group 1/2/3 → DD/MM/YY(YY)
  //   Group 4/5/6 → DD.MM.YYYY  (4-digit year only, avoids matching decimal amounts)
  const DATE_RE =
    /(?<!\d)(\d{1,2})[/](\d{1,2})[/](\d{2,4})(?!\d)|(?<!\d)(\d{2})\.(\d{2})\.(\d{4})(?!\d)/g;

  const dms: { index: number; raw: string; parsed: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = DATE_RE.exec(norm)) !== null) {
    const [d, mo, yr] = m[1] !== undefined
      ? [m[1], m[2], m[3]]
      : [m[4], m[5], m[6]];
    const moN = parseInt(mo, 10);
    if (moN < 1 || moN > 12) continue;
    const yyyy = yr.length === 2 ? `20${yr}` : yr;
    dms.push({
      index:  m.index,
      raw:    m[0],
      parsed: `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`,
    });
  }

  if (dms.length === 0) return [];

  return dms
    .map((dm, i) => {
      const bodyStart = dm.index + dm.raw.length;
      const bodyEnd   = i + 1 < dms.length ? dms[i + 1].index : norm.length;
      const body      = norm.slice(bodyStart, bodyEnd).trim();
      const rawChunk  = norm.slice(dm.index, bodyEnd).trim();
      return { date: dm.parsed, body, rawChunk };
    })
    .filter(c => c.body.replace(/\s/g, '').length >= 2);
}

/**
 * Parse payment rows by date-chunk strategy.
 *
 * Every date in the text anchors a new transaction chunk. All lines between two
 * consecutive dates are treated as fields of the same transaction, making this
 * strategy robust to multi-line RTL PDF table output.
 *
 * For installment transactions the smaller of two amounts is the monthly charge
 * (סכום החיוב); the larger is the transaction total (סכום העסקה).
 */
function parseTransactionsByDateChunks(text: string): PaymentRow[] {
  const chunks = splitIntoDateChunks(text);
  if (chunks.length === 0) return [];

  const rows: PaymentRow[] = [];
  const seen  = new Set<string>();

  for (const { date, body, rawChunk } of chunks) {
    const flat      = body.replace(/\n/g, ' ');
    const flatChunk = rawChunk.replace(/\n/g, ' ');

    if (isInterestRateLine(flat)) continue;

    const instInfo = parseInstallmentInfo(flatChunk);
    const soInfo   = parseStandingOrderInfo(flatChunk);

    const amounts = extractAllAmountsFromText(flat);
    if (amounts.length === 0) continue;

    // Installment tx: smaller amount = current charge, larger = total
    const chargeAmount = (instInfo.isInstallment && amounts.length >= 2)
      ? Math.min(...amounts)
      : amounts[amounts.length - 1];

    // Build merchant name: strip all numeric/keyword tokens from the body
    const merchantRaw = flat
      .replace(/\d{1,2}[/]\d{1,2}[/]\d{2,4}/g, '')
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '')
      .replace(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g, '')   // decimal amounts
      .replace(/\b\d{1,3}(?:,\d{3})+\b/g, '')            // comma-grouped integers
      .replace(/\b\d{1,5}\b/g, '')                        // plain small integers
      .replace(TX_KEYWORD_REMOVAL_RE, '')
      .replace(/₪/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const merchant = normalizeMerchantName(merchantRaw || flatChunk.slice(0, 40));
    if (!merchant || merchant.length < 2) continue;
    if (BORING_LINE_RE.test(merchant)) continue;

    const key = `${merchant.toLowerCase().slice(0, 30)}|${chargeAmount}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      date,
      merchant,
      amount:            chargeAmount,
      rawLine:           flatChunk.slice(0, 120),
      isRecurring:       soInfo.isStandingOrder,
      isStandingOrder:   soInfo.isStandingOrder,
      isInstallment:     instInfo.isInstallment,
      paymentIndex:      instInfo.paymentIndex,
      paymentTotal:      instInfo.paymentTotal,
      paymentCount:      instInfo.paymentCount,
      recurringEvidence: [...soInfo.evidence, ...instInfo.evidence],
      rowConfidence:     scoreRowConfidence(merchant, chargeAmount, date),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Row extraction
// ---------------------------------------------------------------------------

/**
 * Single-line fallback: each line that looks like a transaction is parsed
 * independently. Used when date-chunk parsing produces too few rows.
 */
function extractPaymentRowsSingleLine(text: string): PaymentRow[] {
  const lines = splitToLines(text);
  const rows: PaymentRow[] = [];
  const seen  = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!lineLooksLikeTransaction(line)) continue;

    const amount = parseAmountFromLine(line)!;
    if (amount < 1) continue;

    const date = parseDateFromLine(line) ?? parseDateFromLine(lines[i - 1] ?? '');

    const lineCtx  = [lines[i - 1] ?? '', line, lines[i + 1] ?? ''].join(' ');
    const soInfo   = parseStandingOrderInfo(lineCtx);
    const instInfo = parseInstallmentInfo(lineCtx);

    let merchantRaw = line
      .replace(/\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}/g, '')
      .replace(/₪\s*[\d,]+\.?\d*/g, '')
      .replace(/[\d,]+\.?\d*\s*₪/g, '')
      .replace(/\b[\d,]+\.?\d*\b/g, '')
      .replace(/תשלום\s*\d+\s*מתוך\s*\d+/gi, '')
      .trim();

    const merchant = normalizeMerchantName(merchantRaw || line.slice(0, 40));
    if (!merchant || BORING_LINE_RE.test(merchant)) continue;

    const key = `${merchant.toLowerCase()}|${amount}|${date ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      date,
      merchant,
      amount,
      rawLine:           line,
      isRecurring:       soInfo.isStandingOrder,
      isStandingOrder:   soInfo.isStandingOrder,
      isInstallment:     instInfo.isInstallment,
      paymentIndex:      instInfo.paymentIndex,
      paymentTotal:      instInfo.paymentTotal,
      paymentCount:      instInfo.paymentCount,
      recurringEvidence: [...soInfo.evidence, ...instInfo.evidence],
      rowConfidence:     scoreRowConfidence(merchant, amount, date),
    });
  }

  return rows;
}

/**
 * Extract payment rows from statement text.
 *
 * Uses a two-strategy approach:
 *  1. **Date-chunk parsing** — groups all text between consecutive dates into one
 *     transaction chunk. Works for messy RTL PDF output where fields are on
 *     separate lines.
 *  2. **Single-line parsing** — classic fallback for well-formatted text where
 *     each line contains merchant + amount.
 *
 * The strategy that produces more rows wins; date-chunk rows are preferred when
 * it returns at least 3 rows.
 */
export function extractPaymentRows(text: string): PaymentRow[] {
  const chunkRows = parseTransactionsByDateChunks(text);
  if (chunkRows.length >= 3) return chunkRows;

  const lineRows = extractPaymentRowsSingleLine(text);

  if (chunkRows.length === 0) return lineRows;
  if (lineRows.length <= chunkRows.length) return chunkRows;
  return lineRows;
}

// ---------------------------------------------------------------------------
// detectFixedPayments
// Only rows with EXPLICIT standing-order keywords (הוראת קבע, הו״ק, חיוב חודשי…).
// Subscription brand names alone do NOT qualify here — they go to detectConfirmedSubscriptions.
// ---------------------------------------------------------------------------

export function detectFixedPayments(rows: PaymentRow[], provider: StatementProvider = 'unknown'): InsightItem[] {
  const items: InsightItem[] = [];
  const seen  = new Set<string>();

  for (const row of rows) {
    if (!row.isStandingOrder) continue;
    // Never include interest/rate/credit lines as fixed payments
    if (INTEREST_LINE_RE.test(row.rawLine)) continue;
    const hasExplicit = row.recurringEvidence.some(e =>
      STANDING_ORDER_PATTERNS.some(p => p.label === e),
    );
    if (!hasExplicit) continue;

    const k = row.merchant.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);

    const evidenceText = row.recurringEvidence
      .filter(e => STANDING_ORDER_PATTERNS.some(p => p.label === e))
      .join(', ') || 'הוראת קבע';

    items.push({
      merchant:    row.merchant.slice(0, 45),
      amount:      row.amount,
      date:        row.date,
      reason:      evidenceText,
      confidence:  'high',
      sourceLine:  row.rawLine.slice(0, 90),
      insightType: 'standingOrder',
      provider,
    });
  }

  return items.slice(0, 10);
}

/** Backward-compat alias */
export const detectStandingOrders = detectFixedPayments;

// ---------------------------------------------------------------------------
// detectConfirmedSubscriptions
// A) Known subscription brand found in any non-installment row → medium confidence
// B) Same merchant ≥ 2 times, similar amount (≤20% variance), non-installment
// Rows with explicit הוראת קבע evidence are NOT included here (they are in fixedPayments).
// ---------------------------------------------------------------------------

export function detectConfirmedSubscriptions(rows: PaymentRow[], provider: StatementProvider = 'unknown'): InsightItem[] {
  const items: InsightItem[] = [];
  const seen  = new Set<string>();

  const add = (item: InsightItem) => {
    const k = item.merchant.toLowerCase();
    if (!seen.has(k)) { seen.add(k); items.push(item); }
  };

  // A: known subscription brands
  const foundLabels = new Set<string>();
  for (const row of rows) {
    if (row.isInstallment) continue;
    const txt = `${row.merchant} ${row.rawLine}`;
    for (const { re, label } of SUBSCRIPTION_PATTERNS) {
      if (re.test(txt) && !foundLabels.has(label)) {
        foundLabels.add(label);
        // Count how many times this brand appears → confirmed vs possible
        const brandRows = rows.filter(r => !r.isInstallment && re.test(`${r.merchant} ${r.rawLine}`));
        const isConfirmed = brandRows.length >= 2;
        add({
          merchant:    label,
          amount:      row.amount,
          date:        row.date,
          reason:      isConfirmed
            ? `מנוי מאושר — זוהה ${brandRows.length} פעמים`
            : 'מנוי אפשרי — שירות מנוי ידוע',
          confidence:  isConfirmed ? 'high' : 'medium',
          sourceLine:  row.rawLine.slice(0, 90),
          insightType: 'subscription',
          provider,
        });
        break;
      }
    }
  }

  // B: same merchant + similar amount ≥ 2 times, non-installment, non-explicit-standing-order.
  //    Key includes rounded amount so Apple 5.90 and Apple 11.90 stay separate candidates.
  //    Interest / rate lines are excluded.
  const merchantMap = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    if (row.rowConfidence === 'low' || row.isInstallment || row.isStandingOrder) continue;
    if (INTEREST_LINE_RE.test(row.rawLine)) continue;   // never treat interest lines as recurring
    // Amount bucket: round to nearest integer (keeps 5.90 → 6, 11.90 → 12 separate)
    const amtBucket = row.amount !== undefined ? Math.round(row.amount) : 'x';
    const key = `${row.merchant.toLowerCase().slice(0, 20)}|${amtBucket}`;
    if (!merchantMap.has(key)) merchantMap.set(key, []);
    merchantMap.get(key)!.push(row);
  }
  for (const [, group] of merchantMap) {
    if (group.length < 2) continue;
    const amounts = group.map(r => r.amount).filter((a): a is number => a !== undefined);
    if (amounts.length < 2) continue;
    const maxA = Math.max(...amounts);
    const minA = Math.min(...amounts);
    // Allow up to 20% variance within the bucket (to catch minor rounding differences)
    if (maxA === 0 || (maxA - minA) / maxA > 0.2) continue;
    // Must span different dates (same-day duplicates are not recurring)
    const dates = [...new Set(group.map(r => r.date).filter(Boolean))];
    if (dates.length < 2) continue;
    const rep = group[0];
    add({
      merchant:    rep.merchant.slice(0, 45),
      amount:      rep.amount,
      date:        rep.date,
      reason:      `חויב ${group.length} פעמים — ייתכן חיוב חוזר`,
      confidence:  'medium',
      sourceLine:  rep.rawLine.slice(0, 90),
      insightType: 'subscription',
      provider,
    });
  }

  return items.slice(0, 8);
}

// ---------------------------------------------------------------------------
// detectInstallments — enhanced with estimatedRemainingTotal
// ---------------------------------------------------------------------------

export function detectInstallments(rows: PaymentRow[], provider: StatementProvider = 'unknown'): InsightItem[] {
  const items: InsightItem[] = [];
  const seen  = new Set<string>();

  for (const row of rows) {
    if (!row.isInstallment) continue;
    const key = `${row.merchant.toLowerCase()}|${row.paymentIndex ?? ''}|${row.paymentTotal ?? row.paymentCount ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let reason: string;
    let confidence: InsightConfidence;
    let estimatedRemainingTotal: number | undefined;

    if (row.paymentIndex !== undefined && row.paymentTotal !== undefined) {
      const remaining = row.paymentTotal - row.paymentIndex;
      if (remaining > 0 && row.amount !== undefined) {
        estimatedRemainingTotal = Math.round(remaining * row.amount * 100) / 100;
      }
      reason     = `תשלום ${row.paymentIndex} מתוך ${row.paymentTotal}`;
      if (remaining > 0) reason += ` — נותרו ${remaining} תשלומים`;
      confidence = 'high';
    } else if (row.paymentCount !== undefined && row.paymentCount > 1) {
      reason     = `עסקה ב-${row.paymentCount} תשלומים`;
      confidence = 'high';
    } else {
      reason     = 'עסקה בתשלומים';
      confidence = 'medium';
    }

    items.push({
      merchant:               row.merchant.slice(0, 45),
      amount:                 row.amount,
      date:                   row.date,
      reason,
      confidence,
      sourceLine:             row.rawLine.slice(0, 90),
      insightType:            'installment',
      paymentIndex:           row.paymentIndex,
      paymentTotal:           row.paymentTotal,
      paymentCount:           row.paymentCount,
      estimatedRemainingTotal,
      provider,
    });
  }

  return items.slice(0, 8);
}

// ---------------------------------------------------------------------------
// detectAnomalies
// Requires ≥10 valid rows to establish a baseline.
// Threshold: amount > median × 3  AND  amount > 250.
// Excludes installment charges and explicit standing orders from the baseline.
// ---------------------------------------------------------------------------

const MIN_ANOMALY_ROWS   = 10;
const ANOMALY_MULTIPLIER = 3;
const MIN_ANOMALY_FLOOR  = 250;

export function detectAnomalies(rows: PaymentRow[], provider: StatementProvider = 'unknown'): InsightItem[] {
  if (rows.length < MIN_ANOMALY_ROWS) return [];

  const baseline = rows
    .filter(r => r.amount !== undefined && r.rowConfidence !== 'low' && !r.isInstallment && !r.isStandingOrder)
    .map(r => r.amount!)
    .sort((a, b) => a - b);

  if (baseline.length < MIN_ANOMALY_ROWS) return [];

  const median    = baseline[Math.floor(baseline.length / 2)];
  const threshold = median * ANOMALY_MULTIPLIER;
  const items: InsightItem[] = [];

  for (const row of rows) {
    if (row.rowConfidence === 'low' || row.isInstallment || row.isStandingOrder) continue;
    // Require a date — real transaction rows almost always have one; summary lines rarely do
    if (!row.date) continue;
    // Skip rows whose raw line looks like a statement summary, total, or payment platform label
    if (BORING_LINE_RE.test(row.rawLine) || BORING_LINE_RE.test(row.merchant)) continue;
    if (ANOMALY_EXCLUDE_RE.test(row.rawLine) || ANOMALY_EXCLUDE_RE.test(row.merchant)) continue;
    // Skip if merchant is too short or looks like a code/number (not a real business name)
    if (!/[א-תa-zA-Z]{3,}/.test(row.merchant)) continue;
    const isKeyword = UNUSUAL_KEYWORDS.test(row.rawLine) || UNUSUAL_KEYWORDS.test(row.merchant);
    const isHighAmt = row.amount !== undefined
      && row.amount > threshold
      && row.amount > MIN_ANOMALY_FLOOR;
    if (!isKeyword && !isHighAmt) continue;

    const mult = row.amount !== undefined && median > 0
      ? (row.amount / median).toFixed(1)
      : undefined;

    items.push({
      merchant:    row.merchant.slice(0, 45),
      amount:      row.amount,
      date:        row.date,
      reason:      isKeyword
        ? 'זוהה כחיוב חריג'
        : `סכום גבוה פי ${mult} מהחציון (${median.toFixed(0)} ₪)`,
      confidence:  isKeyword ? 'high' : 'medium',
      sourceLine:  row.rawLine.slice(0, 90),
      insightType: 'unusual',
      provider,
    });
  }

  items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return items.slice(0, 5);
}

/** Backward-compat alias */
export const detectUnusualCharges = detectAnomalies;

// ---------------------------------------------------------------------------
// detectBillingDate — extract statement billing date from header text
// ---------------------------------------------------------------------------

export function detectBillingDate(text: string): string | undefined {
  // MAX: "פירוט החיובים בחשבון לתאריך 10/05/26"
  const m1 = /לתאריך\s+(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/i.exec(text);
  if (m1) {
    const [, d, mo, yr] = m1;
    const yyyy = yr.length === 2 ? `20${yr}` : yr;
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12)
      return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Generic: "תאריך חיוב / פירעון / הפקה: DD/MM/YY"
  const m2 = /תאריך\s+(?:חיוב|פירעון|הפקה)[\s:]+(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/i.exec(text);
  if (m2) {
    const [, d, mo, yr] = m2;
    const yyyy = yr.length === 2 ? `20${yr}` : yr;
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12)
      return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Smart reminders
// ---------------------------------------------------------------------------

/**
 * Add exactly one calendar month to a Date, preserving the day-of-month where
 * possible and clamping to the last day of the month when necessary.
 * Example: Jan 31 + 1 month = Feb 28/29 (not Mar 2/3).
 */
function addOneMonthSafe(d: Date): Date {
  const day = d.getDate();
  const result = new Date(d);
  result.setDate(1);                           // avoid month-overflow during setMonth
  result.setMonth(result.getMonth() + 1);
  const daysInNewMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInNewMonth));
  return result;
}

/**
 * Starting from `previousDate`, advance by one-month increments until the
 * result is strictly in the future (> today). Returns undefined if no future
 * date is reachable within 12 steps or the result would be > 3 months away
 * (to avoid generating far-future noise from a stale statement).
 *
 * Math:
 *   expectedChargeDate = previousDate + N months  (smallest N where date > today)
 */
function computeNextChargeDate(dateStr: string): string | undefined {
  const today = new Date(TODAY_ISO);
  today.setHours(0, 0, 0, 0);
  let d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  if (isNaN(d.getTime())) return undefined;

  let attempts = 0;
  while (d <= today && attempts < 12) {
    d = addOneMonthSafe(d);
    attempts++;
  }

  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 3);
  if (d <= today || d > limit) return undefined;
  return d.toISOString().split('T')[0];
}

/** Return the ISO date for one calendar day before `dateStr`. */
function oneDayBefore(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Generate smart payment reminders from fixed payments, subscriptions and
 * installments with remaining payments. Each reminder estimates the next
 * monthly charge date and places the reminder one day before.
 *
 * Strict rules:
 * - Fixed payments: always eligible if they have a date (explicit הוראת קבע evidence)
 * - Subscriptions: ONLY confidence === 'high' (appeared ≥2 times on different dates)
 * - Installments: ONLY explicit תשלום X מתוך Y with remaining > 0 and confidence === 'high'
 * - Interest / rate / credit lines are NEVER included
 * - Hard cap: maximum 3 reminders total (prioritise fixed > subscriptions > installments)
 */
export function detectSmartReminders(
  fixedPayments: InsightItem[],
  subscriptions: InsightItem[],
  installments:  InsightItem[],
): PaymentReminder[] {
  const MAX_REMINDERS = 3;
  const reminders: PaymentReminder[] = [];
  const seen = new Set<string>();
  let n = 0;

  const tryAdd = (
    item: InsightItem,
    type: PaymentReminder['type'],
    extra?: { paymentIndex?: number; paymentTotal?: number },
  ) => {
    if (reminders.length >= MAX_REMINDERS) return;
    if (!item.date || item.amount === undefined) return;
    // Never create a reminder from an interest / rate / credit line
    if (item.sourceLine && INTEREST_LINE_RE.test(item.sourceLine)) return;
    if (INTEREST_LINE_RE.test(item.merchant)) return;
    const chargeDate = computeNextChargeDate(item.date);
    if (!chargeDate) return;
    const k = `${item.merchant.toLowerCase().slice(0, 25)}|${chargeDate}`;
    if (seen.has(k)) return;
    seen.add(k);
    reminders.push({
      id:           `rem-${n++}`,
      merchant:     item.merchant.slice(0, 45),
      amount:       item.amount,
      chargeDate,
      reminderDate: oneDayBefore(chargeDate),
      previousDate: item.date,          // for "משוער לפי חיוב קודם ב-DD/MM"
      type,
      confidence:   item.confidence,
      sourceLine:   item.sourceLine,
      ...extra,
    });
  };

  // Priority 1: explicit standing orders / fixed payments
  for (const item of fixedPayments) {
    tryAdd(item, 'standingOrder');
  }

  // Priority 2: confirmed recurring subscriptions (appeared ≥2 times → confidence 'high')
  for (const item of subscriptions) {
    if (item.confidence === 'high') tryAdd(item, 'subscription');
  }

  // Priority 3: installments with explicit תשלום X מתוך Y and remaining > 0
  for (const item of installments) {
    if (
      item.confidence === 'high' &&
      item.paymentIndex !== undefined &&
      item.paymentTotal !== undefined &&
      item.paymentTotal - item.paymentIndex > 0
    ) {
      tryAdd(item, 'installment', {
        paymentIndex: item.paymentIndex,
        paymentTotal: item.paymentTotal,
      });
    }
  }

  reminders.sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));
  return reminders;
}

/** Backward-compat — kept for external callers */
export function detectUpcomingPayments(rows: PaymentRow[], provider: StatementProvider = 'unknown'): InsightItem[] {
  const today  = new Date(TODAY_ISO);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 14);
  const items: InsightItem[] = [];
  for (const row of rows) {
    if (!row.date) continue;
    const d = new Date(row.date);
    if (d >= today && d <= cutoff) {
      items.push({
        merchant:    row.merchant.slice(0, 45),
        amount:      row.amount,
        date:        row.date,
        reason:      'תשלום צפוי ב-14 הימים הקרובים',
        confidence:  'medium',
        sourceLine:  row.rawLine.slice(0, 90),
        insightType: 'upcoming',
        provider,
      });
    }
  }
  items.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return items.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Overall confidence
// ---------------------------------------------------------------------------

function computeConfidence(rows: PaymentRow[], charCount: number): InsightConfidence {
  if (charCount < 200) return 'low';
  const highConf = rows.filter(r =>
    (r.isStandingOrder && !r.isInstallment) ||
    (r.isInstallment && r.paymentIndex !== undefined),
  ).length;
  if (highConf >= 2 || rows.length >= 10) return 'high';
  if (rows.length >= 3) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// analyzePaymentRows — main analysis entry point
// ---------------------------------------------------------------------------

export function analyzePaymentRows(
  rows: PaymentRow[],
  charCount: number,
  provider: StatementProvider = 'unknown',
  rawText?: string,
): StatementAnalysis {
  const fixedPayments = detectFixedPayments(rows, provider);
  const subscriptions = detectConfirmedSubscriptions(rows, provider);
  const installments  = detectInstallments(rows, provider);
  const anomalies     = detectAnomalies(rows, provider);
  const reminders     = detectSmartReminders(fixedPayments, subscriptions, installments);
  const billingDate   = rawText ? detectBillingDate(rawText) : undefined;
  return {
    fixedPayments, subscriptions, installments, anomalies, reminders, billingDate,
    totalRows:  rows.length,
    charCount,
    confidence: computeConfidence(rows, charCount),
    provider,
  };
}

// ---------------------------------------------------------------------------
// analyzeCreditStatement — convenience wrapper (text → analysis)
// ---------------------------------------------------------------------------

export function analyzeCreditStatement(text: string): StatementAnalysis {
  const provider  = detectStatementProvider(text);
  const filtered  = extractTransactionRelevantText(text, provider);
  const charCount = text.replace(/\s/g, '').length;
  const rows      = extractPaymentRows(filtered);
  return analyzePaymentRows(rows, charCount, provider, text);
}
