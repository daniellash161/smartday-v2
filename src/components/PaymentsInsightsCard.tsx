// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { extractTextFromPdf } from '../utils/pdfTextExtractor';
import {
  analyzePaymentRows,
  extractPaymentRows,
  normalizeMerchantName,
  parseAmountFromLine,
  detectStatementProvider,
  extractTransactionRelevantText,
  type InsightItem,
  type InsightConfidence,
  type InsightType,
  type PaymentRow,
  type StatementAnalysis,
  type StatementProvider,
  type PaymentReminder,
} from '../utils/paymentsAnalysis';
import { PROVIDER_DISPLAY_NAMES } from '../utils/statementProviders';
import type { Task, CalendarEvent } from '../types/index';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PaymentsInsightsCardProps {
  onAddTask?:  (task:  Omit<Task,          'id' | 'createdAt'>) => void;
  onAddEvent?: (event: Omit<CalendarEvent, 'id'>)               => void;
  compact?:    boolean;
  onOpenModal?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow steps
// ─────────────────────────────────────────────────────────────────────────────

type FlowStep = 'upload' | 'extracting' | 'review' | 'insights';

// ─────────────────────────────────────────────────────────────────────────────
// EditableRow — wraps a PaymentRow for the review table
// ─────────────────────────────────────────────────────────────────────────────

type RowType = 'regular' | 'standingOrder' | 'installment';

interface EditableRow {
  id:               string;
  date:             string;
  merchant:         string;
  amount:           string;
  rowType:          RowType;
  paymentIndex?:    number;
  paymentTotal?:    number;
  paymentCount?:    number;
  recurringEvidence: string[];
  rawLine:          string;
  rowConfidence:    InsightConfidence;
}

function toPaymentRow(r: EditableRow): PaymentRow {
  const raw = r.amount.replace(/[₪\s,]/g, '');
  const amt = parseFloat(raw);
  return {
    date:              r.date || undefined,
    merchant:          normalizeMerchantName(r.merchant),
    amount:            (!isNaN(amt) && amt >= 1) ? Math.round(amt * 100) / 100 : undefined,
    rawLine:           r.rawLine,
    isRecurring:       r.rowType === 'standingOrder',
    isStandingOrder:   r.rowType === 'standingOrder',
    isInstallment:     r.rowType === 'installment',
    paymentIndex:      r.paymentIndex,
    paymentTotal:      r.paymentTotal,
    paymentCount:      r.paymentCount,
    recurringEvidence: r.recurringEvidence,
    rowConfidence:     r.rowConfidence,
  };
}

function rowsFromPaymentRows(paymentRows: PaymentRow[]): EditableRow[] {
  return paymentRows.map((r, i) => {
    let rowType: RowType = 'regular';
    if (r.isInstallment)      rowType = 'installment';
    else if (r.isStandingOrder) rowType = 'standingOrder';
    return {
      id:                `row-${i}`,
      date:              r.date ?? '',
      merchant:          r.merchant,
      amount:            r.amount !== undefined ? String(r.amount) : '',
      rowType,
      paymentIndex:      r.paymentIndex,
      paymentTotal:      r.paymentTotal,
      paymentCount:      r.paymentCount,
      recurringEvidence: r.recurringEvidence,
      rawLine:           r.rawLine,
      rowConfidence:     r.rowConfidence,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY              = 'smartday-payment-insights';
const REMINDER_TASK_LINKS_KEY  = 'smartday-payment-reminder-task-links';
const REMINDER_EVENT_LINKS_KEY = 'smartday-payment-reminder-event-links';

function loadReminderLinks(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveReminderLinks(key: string, ids: Set<string>): void {
  try { localStorage.setItem(key, JSON.stringify([...ids])); } catch { /* quota */ }
}

interface SavedInsightsData {
  analyzedAt:       string;
  fileName:         string;
  extractionMethod: 'direct' | 'ocr';
  provider:         StatementProvider;
  billingDate?:     string;
  transactionCount: number;
  charCount:        number;
  confidence:       InsightConfidence;
  insights: {
    fixedPayments: InsightItem[];
    subscriptions: InsightItem[];
    installments:  InsightItem[];
    anomalies:     InsightItem[];
    reminders:     PaymentReminder[];
  };
}

function stripSourceLines(items: InsightItem[]): InsightItem[] {
  return items.map(item => ({ ...item, sourceLine: undefined }));
}

function stripReminderSourceLines(reminders: PaymentReminder[]): PaymentReminder[] {
  return reminders.map(r => ({ ...r, sourceLine: undefined }));
}

function loadSavedInsights(): SavedInsightsData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = JSON.parse(raw);
    // Migrate legacy shapes
    if (data.insights?.recurring !== undefined || data.insights?.standingOrders !== undefined) {
      data.insights.fixedPayments = [
        ...(data.insights.recurring     ?? []),
        ...(data.insights.standingOrders ?? []),
      ];
      data.insights.subscriptions = data.insights.subscriptions ?? [];
      data.insights.anomalies     = data.insights.unusual ?? [];
      data.insights.reminders     = [];
      delete data.insights.recurring;
      delete data.insights.standingOrders;
      delete data.insights.unusual;
      delete data.insights.upcoming;
    }
    if (!data.provider)                data.provider = 'unknown';
    if (!data.insights.subscriptions)  data.insights.subscriptions = [];
    if (!data.insights.anomalies)      data.insights.anomalies = [];
    if (!data.insights.reminders)      data.insights.reminders = [];
    if (!data.insights.fixedPayments)  data.insights.fixedPayments = [];
    return data as SavedInsightsData;
  } catch { return null; }
}

function persistInsights(data: SavedInsightsData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function clearSavedInsights(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtAmount(n?: number): string {
  if (n === undefined) return '';
  return `${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`;
}

function fmtDateShort(s?: string): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }); }
  catch { return s; }
}

function fmtDate(s?: string): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return s; }
}

function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Label maps (kept for ReviewPanel + legacy compatibility)
// ─────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<InsightConfidence, string> = {
  high: 'גבוהה', medium: 'בינונית', low: 'נמוכה',
};

// Suppress unused-variable lint for label maps used only in ReviewPanel
const _INSIGHT_TYPE_BADGE: Record<InsightType, string> = {
  standingOrder: 'הוראת קבע', subscription: 'מנוי',
  installment: 'בתשלומים', unusual: 'חיוב חריג', upcoming: 'תשלום קרוב',
};
void _INSIGHT_TYPE_BADGE;

const REMINDER_TYPE_LABEL: Record<PaymentReminder['type'], string> = {
  standingOrder: 'הוראת קבע', subscription: 'מנוי', installment: 'תשלום בתשלומים',
};

// ─────────────────────────────────────────────────────────────────────────────
// Summary sentence
// ─────────────────────────────────────────────────────────────────────────────

function buildSummaryLine(a: StatementAnalysis): string {
  const parts: string[] = [];
  if (a.fixedPayments.length > 0) parts.push(`${a.fixedPayments.length} חיובים קבועים`);
  if (a.installments.length  > 0) parts.push(`${a.installments.length} עסקאות בתשלומים`);
  if (a.reminders.length     > 0) parts.push(`${a.reminders.length} תזכורות חכמות`);
  if (parts.length === 0) {
    return a.totalRows === 0
      ? 'לא זוהו עסקאות בקובץ זה.'
      : 'לא זוהו תשלומים קבועים או חיובים שדורשים תשומת לב.';
  }
  return `זוהו ${parts.join(', ')}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── COMPACT INSIGHT WIDGET COMPONENTS ────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── SourceReveal ─────────────────────────────────────────────────────────────

function SourceReveal({ sourceLine }: { sourceLine?: string }) {
  const [open, setOpen] = useState(false);
  if (!sourceLine) return null;
  return (
    <div className="pi-source">
      <button className="pi-source-btn" onClick={() => setOpen(v => !v)}>
        שורת מקור {open ? '▲' : '▼'}
      </button>
      {open && (
        <code className="pi-source-text">
          {sourceLine.slice(0, 90)}{sourceLine.length > 90 ? '…' : ''}
        </code>
      )}
    </div>
  );
}

// ── CompactFixedCard ──────────────────────────────────────────────────────────

function CompactFixedCard({ item }: { item: InsightItem }) {
  return (
    <div className="pi-card pi-card--fixed">
      <div className="pi-card-main">
        <span className="pi-card-merchant">{item.merchant}</span>
        <span className="pi-card-amount">{fmtAmount(item.amount)}</span>
      </div>
      <div className="pi-card-meta">
        <span className="pi-badge pi-badge--fixed">{item.reason}</span>
        {item.date && <span className="pi-card-hint">ב-{fmtDateShort(item.date)}</span>}
      </div>
      <SourceReveal sourceLine={item.sourceLine} />
    </div>
  );
}

// ── CompactInstallmentCard ────────────────────────────────────────────────────

function CompactInstallmentCard({ item }: { item: InsightItem }) {
  const pct       = (item.paymentIndex !== undefined && item.paymentTotal !== undefined)
    ? Math.min(item.paymentIndex / item.paymentTotal, 1) : undefined;
  const remaining = (item.paymentIndex !== undefined && item.paymentTotal !== undefined)
    ? item.paymentTotal - item.paymentIndex : undefined;

  return (
    <div className="pi-card pi-card--install">
      <div className="pi-card-main">
        <span className="pi-card-merchant">{item.merchant}</span>
        {item.amount !== undefined && (
          <span className="pi-card-amount">
            {fmtAmount(item.amount)}<span className="pi-amount-sub">/חודש</span>
          </span>
        )}
      </div>
      {pct !== undefined && item.paymentIndex !== undefined && item.paymentTotal !== undefined && (
        <div className="pi-install-row">
          <div className="pi-progress-track">
            <div className="pi-progress-fill" style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="pi-install-label">
            {item.paymentIndex}/{item.paymentTotal}
            {remaining !== undefined && remaining > 0 && ` · נותרו ${remaining}`}
          </span>
        </div>
      )}
      {item.estimatedRemainingTotal !== undefined && item.estimatedRemainingTotal > 0 && (
        <div className="pi-card-hint">יתרה משוערת: {fmtAmount(item.estimatedRemainingTotal)}</div>
      )}
      <SourceReveal sourceLine={item.sourceLine} />
    </div>
  );
}

// ── CompactAnomalyCard ────────────────────────────────────────────────────────

function CompactAnomalyCard({ item }: { item: InsightItem }) {
  return (
    <div className="pi-card pi-card--anomaly">
      <div className="pi-card-main">
        <span className="pi-card-merchant">{item.merchant}</span>
        <span className="pi-card-amount pi-card-amount--warn">{fmtAmount(item.amount)}</span>
      </div>
      <div className="pi-card-meta">
        <span className="pi-badge pi-badge--anomaly">{item.reason}</span>
        {item.date && <span className="pi-card-hint">{fmtDateShort(item.date)}</span>}
      </div>
      <SourceReveal sourceLine={item.sourceLine} />
    </div>
  );
}

// ── CompactSubscriptionCard ───────────────────────────────────────────────────

function CompactSubscriptionCard({ item }: { item: InsightItem }) {
  return (
    <div className="pi-card pi-card--sub">
      <div className="pi-card-main">
        <span className="pi-card-merchant">{item.merchant}</span>
        {item.amount !== undefined && (
          <span className="pi-card-amount">{fmtAmount(item.amount)}</span>
        )}
      </div>
      <div className="pi-card-meta">
        <span className="pi-badge pi-badge--sub">{item.reason}</span>
      </div>
    </div>
  );
}

// ── CompactSection — section with optional "ראה עוד" ─────────────────────────

interface CompactSectionProps {
  icon:        string;
  title:       string;
  items:       InsightItem[];
  emptyLabel?: string;
  maxVisible?: number;
  renderCard:  (item: InsightItem, idx: number) => React.ReactNode;
}

function CompactSection({
  icon, title, items, emptyLabel, maxVisible = 2, renderCard,
}: CompactSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, maxVisible);
  const overflow = items.length - maxVisible;

  return (
    <section className="pi-section">
      <h3 className="pi-section-title">
        <span className="pi-section-icon">{icon}</span>
        {title}
        {items.length > 0 && <span className="pi-section-count">{items.length}</span>}
      </h3>
      {items.length === 0 && emptyLabel ? (
        <p className="pi-section-empty">{emptyLabel}</p>
      ) : (
        <>
          <div className="pi-cards-grid">
            {visible.map((item, idx) => renderCard(item, idx))}
          </div>
          {overflow > 0 && !expanded && (
            <button className="pi-see-more" onClick={() => setExpanded(true)}>
              ראה עוד ({overflow} נוספים) ›
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ── SmartReminderCard — one card per reliable reminder ────────────────────────

const REMINDER_TYPE_BADGE_CLASS: Record<PaymentReminder['type'], string> = {
  standingOrder: 'pi-reminder-badge--fixed',
  subscription:  'pi-reminder-badge--sub',
  installment:   'pi-reminder-badge--install',
};

const REMINDER_TYPE_TITLE: Record<PaymentReminder['type'], string> = {
  standingOrder: 'חיוב קבוע',
  subscription:  'מנוי חוזר',
  installment:   'תשלום בתשלומים',
};

interface SmartReminderCardProps {
  reminder:    PaymentReminder;
  taskAdded:   boolean;
  calAdded:    boolean;
  onAddTask?:  () => void;
  onAddEvent?: () => void;
}

function SmartReminderCard({ reminder, taskAdded, calAdded, onAddTask, onAddEvent }: SmartReminderCardProps) {
  const remaining = (reminder.paymentIndex !== undefined && reminder.paymentTotal !== undefined)
    ? reminder.paymentTotal - reminder.paymentIndex : undefined;

  // Build the subtext explaining both the expected charge date and the evidence date
  const chargeDateStr   = fmtDateShort(reminder.chargeDate);
  const previousDateStr = reminder.previousDate ? fmtDateShort(reminder.previousDate) : null;
  const subtextParts: string[] = [];
  if (chargeDateStr)   subtextParts.push(`צפוי לרדת ב-${chargeDateStr}`);
  if (previousDateStr) subtextParts.push(`לפי חיוב קודם ב-${previousDateStr}`);
  const subtext = subtextParts.join(', ') || 'משוער לפי דפוס החיובים הקודם';

  return (
    <div className="pi-reminder-card">
      {/* Row 1: reminder-date pill (one day before charge) · merchant · amount */}
      <div className="pi-reminder-card-header">
        <span className="pi-reminder-pill">תזכורת ב-{fmtDateShort(reminder.reminderDate)}</span>
        <span className="pi-reminder-merchant">
          צפוי {REMINDER_TYPE_TITLE[reminder.type]}: {reminder.merchant}
        </span>
        <span className="pi-reminder-amount">{fmtAmount(reminder.amount)}</span>
      </div>

      {/* Row 2: type badge · confidence · charge/previous date subtext */}
      <div className="pi-reminder-card-meta">
        <span className={`pi-reminder-badge ${REMINDER_TYPE_BADGE_CLASS[reminder.type]}`}>
          {REMINDER_TYPE_LABEL[reminder.type]}
        </span>
        <span className="pi-reminder-conf">
          ודאות {reminder.confidence === 'high' ? 'גבוהה' : 'בינונית'}
        </span>
      </div>
      <div className="pi-reminder-hint">{subtext}</div>

      {/* Installment detail row */}
      {remaining !== undefined && reminder.paymentIndex !== undefined && reminder.paymentTotal !== undefined && (
        <div className="pi-reminder-install-row">
          תשלום {reminder.paymentIndex + 1} מתוך {reminder.paymentTotal} ·{' '}
          נותרו {remaining} תשלומים
        </div>
      )}

      {/* Row 3: source link (hidden by default) + action buttons */}
      <div className="pi-reminder-card-actions">
        <SourceReveal sourceLine={reminder.sourceLine} />
        <div className="pi-reminder-action-group">
          {onAddTask && (
            <button
              className={`pi-action-btn${taskAdded ? ' pi-action-btn--done' : ''}`}
              onClick={onAddTask}
              disabled={taskAdded}
              title={taskAdded ? 'כבר נוסף למשימות' : 'הוסף תזכורת זו למשימות'}
            >
              {taskAdded ? '✓ נוסף למשימות' : '+ הוסף למשימות'}
            </button>
          )}
          {onAddEvent && (
            <button
              className={`pi-action-btn pi-action-btn--cal${calAdded ? ' pi-action-btn--done' : ''}`}
              onClick={onAddEvent}
              disabled={calAdded}
              title={calAdded ? 'כבר נוסף ללוח הזמנים' : 'הוסף תזכורת זו ללוח הזמנים'}
            >
              {calAdded ? '✓ נוסף ללוח הזמנים' : '📅 הוסף ללוח הזמנים'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SmartRemindersWidget — max 3, individual cards, always rendered ────────────

interface SmartRemindersWidgetProps {
  reminders:     PaymentReminder[];
  addedTaskIds:  Set<string>;
  addedEventIds: Set<string>;
  onAddTask?:    (r: PaymentReminder[]) => void;
  onAddEvent?:   (r: PaymentReminder[]) => void;
}

function SmartRemindersWidget({
  reminders, addedTaskIds, addedEventIds, onAddTask, onAddEvent,
}: SmartRemindersWidgetProps) {
  // Reminders are already capped at 3 in detectSmartReminders; show all of them
  return (
    <section className="pi-section pi-section--reminders">
      <h3 className="pi-section-title">
        <span className="pi-section-icon">🔔</span>
        תזכורות חכמות
        {reminders.length > 0 && <span className="pi-section-count">{reminders.length}</span>}
      </h3>

      {reminders.length === 0 ? (
        <div className="pi-reminder-empty">
          <p className="pi-reminder-empty-title">אין תזכורות חכמות אמינות כרגע.</p>
          <p className="pi-reminder-empty-sub">
            תזכורות מוצגות רק עבור הוראות קבע, מנויים חוזרים מאושרים ועסקאות בתשלומים עם מקור ברור.
          </p>
        </div>
      ) : (
        <div className="pi-reminders-list">
          {reminders.map(r => (
            <SmartReminderCard
              key={r.id}
              reminder={r}
              taskAdded={addedTaskIds.has(r.id)}
              calAdded={addedEventIds.has(r.id)}
              onAddTask={onAddTask ? () => onAddTask([r]) : undefined}
              onAddEvent={onAddEvent ? () => onAddEvent([r]) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── AnomaliesSection ─────────────────────────────────────────────────────────

function AnomaliesSection({ items }: { items: InsightItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible  = expanded ? items : items.slice(0, 1);
  const overflow = items.length - 1;

  return (
    <section className="pi-section">
      <h3 className="pi-section-title">
        <span className="pi-section-icon">⚠️</span>
        חיובים חריגים
        {items.length > 0 && <span className="pi-section-count">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="pi-section-empty">לא זוהו חיובים חריגים אמינים.</p>
      ) : (
        <>
          <div className="pi-cards-grid">
            {visible.map((item, idx) => <CompactAnomalyCard key={idx} item={item} />)}
          </div>
          {overflow > 0 && !expanded && (
            <button className="pi-see-more" onClick={() => setExpanded(true)}>
              ראה עוד ({overflow} נוספים) ›
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ── CollapsedSection — generic accordion ─────────────────────────────────────

function CollapsedSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pi-collapsed">
      <button className="pi-collapsed-toggle" onClick={() => setOpen(v => !v)}>
        <span className="pi-collapsed-chevron">{open ? '▲' : '▼'}</span>
        {title}
      </button>
      {open && <div className="pi-collapsed-body">{children}</div>}
    </div>
  );
}

// ── SummaryChips ──────────────────────────────────────────────────────────────

function SummaryChips({ a }: { a: StatementAnalysis }) {
  return (
    <div className="pi-chips">
      {a.reminders.length     > 0 && <span className="pi-chip pi-chip--reminder">🔔 {a.reminders.length} תזכורות</span>}
      {a.fixedPayments.length > 0 && <span className="pi-chip pi-chip--fixed">🔁 {a.fixedPayments.length} קבועים</span>}
      {a.installments.length  > 0 && <span className="pi-chip pi-chip--install">📦 {a.installments.length} תשלומים</span>}
      {a.anomalies.length     > 0 && <span className="pi-chip pi-chip--anomaly">⚠️ {a.anomalies.length} חריגים</span>}
      {a.subscriptions.length > 0 && <span className="pi-chip pi-chip--sub">📱 {a.subscriptions.length} מנויים</span>}
    </div>
  );
}

// ── QualityStats ──────────────────────────────────────────────────────────────

function QualityStats({
  transactionCount, charCount, confidence, provider,
}: {
  transactionCount: number; charCount: number;
  confidence: InsightConfidence; provider: StatementProvider;
}) {
  return (
    <div className="payments-quality-row payments-quality-row--debug">
      <span className="payments-quality-chip">📊 {transactionCount} תנועות</span>
      <span className="payments-quality-chip">📝 {charCount.toLocaleString('he-IL')} תווים</span>
      <span className={`payments-quality-chip payments-quality-conf--${confidence}`}>
        ודאות: {CONFIDENCE_LABEL[confidence]}
      </span>
      <span className={`payments-quality-chip payments-provider-badge payments-provider--${provider}`}>
        🏦 {PROVIDER_DISPLAY_NAMES[provider]}
      </span>
    </div>
  );
}

// ── AllTransactionsList ───────────────────────────────────────────────────────

function AllTransactionsList({ rows }: { rows: EditableRow[] }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return (
    <ul className="payments-all-tx-list">
      {sorted.map(r => (
        <li key={r.id} className="payments-all-tx-item">
          <span className="payments-all-tx-date">{fmtDateShort(r.date) || '—'}</span>
          <span className="payments-all-tx-merchant">{r.merchant || '—'}</span>
          <span className="payments-all-tx-amount">
            {r.amount ? fmtAmount(parseFloat(r.amount)) : '—'}
          </span>
          {r.rowType !== 'regular' && (
            <span className={`payments-type-badge payments-type--${r.rowType}`} style={{ fontSize: '0.7rem' }}>
              {r.rowType === 'standingOrder' ? 'קבע' : 'תשלומים'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReviewPanel (power-user: edit rows → re-analyze)
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewPanelProps {
  fileName:         string;
  extractionMethod: 'direct' | 'ocr';
  provider:         StatementProvider;
  charCount:        number;
  goodRows:         EditableRow[];
  unclearRows:      EditableRow[];
  rawText:          string;
  onUpdateRow:      (id: string, field: keyof EditableRow, value: string | boolean) => void;
  onConfirm:        () => void;
  onBack:           () => void;
}

function ReviewPanel({
  fileName, extractionMethod, provider, charCount,
  goodRows, unclearRows, rawText, onUpdateRow, onConfirm, onBack,
}: ReviewPanelProps) {
  const [showUnclear, setShowUnclear] = useState(false);
  const [showRaw,     setShowRaw]     = useState(false);
  const [copied,      setCopied]      = useState(false);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(rawText); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  return (
    <div className="payments-review">
      <div className="payments-review-stats">
        <span className={`payments-stat-item payments-provider-badge payments-provider--${provider}`}>
          🏦 {PROVIDER_DISPLAY_NAMES[provider]}
        </span>
        <span className="payments-stat-item" title={fileName}>
          📄 {fileName.slice(0, 28)}{fileName.length > 28 ? '…' : ''}
        </span>
        <span className="payments-stat-item">{extractionMethod === 'ocr' ? '🔍 OCR' : '📋 טקסט ישיר'}</span>
        <span className="payments-stat-item">📝 {charCount.toLocaleString('he-IL')} תווים</span>
        <span className="payments-stat-item">📊 {goodRows.length} שורות</span>
      </div>

      <h3 className="payments-review-title">עריכת נתונים לפני ניתוח מחדש</h3>
      <p className="payments-review-sub">
        תוכל לתקן שדות שגויים ולשנות את סוג העסקה לפני הניתוח.
        {provider === 'unknown' && (
          <span className="payments-review-sub-warn"> הספק לא זוהה — בדוק את השורות לפני המשך.</span>
        )}
      </p>

      {goodRows.length === 0 ? (
        <div className="payments-no-candidates">
          <p>לא זוהו עסקאות בצורה אמינה מהקובץ הזה.</p>
          <p className="payments-no-candidates-sub">
            {unclearRows.length > 0
              ? `זוהו ${unclearRows.length} שורות בעלות ודאות נמוכה — ראה להלן.`
              : 'ייתכן שהקובץ מוגן, סרוק בצורה לא ברורה, או שאין בו נתוני עסקאות.'}
          </p>
        </div>
      ) : (
        <>
          <div className="payments-table-wrap">
            <table className="payments-candidate-table" dir="rtl">
              <thead>
                <tr>
                  <th>תאריך</th><th>בית עסק</th><th>סכום</th>
                  <th>תשלום</th><th>סה"כ</th><th>סוג</th><th>ודאות</th><th>מקור</th>
                </tr>
              </thead>
              <tbody>
                {goodRows.map(row => (
                  <tr key={row.id} className={`payments-candidate-row payments-row-conf--${row.rowConfidence}`}>
                    <td>
                      <input className="payments-candidate-input" type="text" value={row.date}
                        placeholder="לא זוהה" dir="ltr"
                        onChange={e => onUpdateRow(row.id, 'date', e.target.value)} />
                    </td>
                    <td>
                      <input className="payments-candidate-input payments-input-merchant" type="text"
                        value={row.merchant} placeholder="לא זוהה"
                        onChange={e => onUpdateRow(row.id, 'merchant', e.target.value)} />
                    </td>
                    <td>
                      <input className="payments-candidate-input payments-input-amount" type="text"
                        value={row.amount} placeholder="לא זוהה" dir="ltr"
                        onChange={e => onUpdateRow(row.id, 'amount', e.target.value)} />
                    </td>
                    <td className="payments-td-center">
                      {row.paymentIndex !== undefined && row.paymentTotal !== undefined
                        ? <span className="payments-install-badge">{row.paymentIndex}/{row.paymentTotal}</span>
                        : <span className="payments-td-na">—</span>}
                    </td>
                    <td className="payments-td-center">
                      {(row.paymentCount ?? row.paymentTotal) !== undefined
                        ? <span className="payments-install-badge">{row.paymentCount ?? row.paymentTotal}</span>
                        : <span className="payments-td-na">—</span>}
                    </td>
                    <td>
                      <select className="payments-candidate-select" value={row.rowType}
                        onChange={e => onUpdateRow(row.id, 'rowType', e.target.value)}>
                        <option value="regular">חיוב רגיל</option>
                        <option value="standingOrder">הוראת קבע</option>
                        <option value="installment">בתשלומים</option>
                      </select>
                      {row.recurringEvidence.length > 0 && (
                        <span className="payments-evidence-hint" title={row.recurringEvidence.join(', ')}>ℹ</span>
                      )}
                    </td>
                    <td>
                      <span className={`payments-confidence-badge payments-confidence--${row.rowConfidence}`}>
                        {CONFIDENCE_LABEL[row.rowConfidence]}
                      </span>
                    </td>
                    <td>
                      <span className="payments-raw-cell" title={row.rawLine}>
                        {row.rawLine.slice(0, 30)}{row.rawLine.length > 30 ? '…' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="payments-confirm-btn" onClick={onConfirm}>
            ✓ נתח מחדש ({goodRows.length} שורות)
          </button>
        </>
      )}

      {unclearRows.length > 0 && (
        <div className="payments-unclear-section">
          <button className="payments-collapsible-toggle" onClick={() => setShowUnclear(v => !v)}>
            {showUnclear ? '▲' : '▼'} שורות בעלות ודאות נמוכה ({unclearRows.length})
          </button>
          {showUnclear && (
            <ul className="payments-unclear-list">
              {unclearRows.map(row => (
                <li key={row.id} className="payments-unclear-item">
                  <span className="payments-raw-text">{row.rawLine.slice(0, 90)}{row.rawLine.length > 90 ? '…' : ''}</span>
                  <span className="payments-unclear-amount">{row.amount ? fmtAmount(parseAmountFromLine(row.rawLine)) : '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="payments-raw-section">
        <button className="payments-collapsible-toggle" onClick={() => setShowRaw(v => !v)}>
          {showRaw ? '▲' : '▼'} הצגת הטקסט שחולץ
        </button>
        {showRaw && (
          <div className="payments-raw-preview">
            <div className="payments-raw-toolbar">
              <span className="payments-raw-note">הטקסט מוצג לצורך בדיקה בלבד ואינו נשמר.</span>
              <button className="payments-copy-btn" onClick={handleCopy}>{copied ? '✓ הועתק' : '📋 העתק'}</button>
            </div>
            <pre className="payments-raw-box">{rawText}</pre>
          </div>
        )}
      </div>

      <button className="payments-back-btn" onClick={onBack}>← חזרה לתובנות</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentsInsightsCard — main component
// ─────────────────────────────────────────────────────────────────────────────

const PaymentsInsightsCard = ({ onAddTask, onAddEvent, compact = false, onOpenModal }: PaymentsInsightsCardProps) => {
  const [step,             setStep]             = useState<FlowStep>('upload');
  const [file,             setFile]             = useState<File | null>(null);
  const [rawText,          setRawText]          = useState<string>('');
  const [charCount,        setCharCount]        = useState<number>(0);
  const [extractionMethod, setExtractionMethod] = useState<'direct' | 'ocr'>('direct');
  const [provider,         setProvider]         = useState<StatementProvider>('unknown');
  const [goodRows,         setGoodRows]         = useState<EditableRow[]>([]);
  const [unclearRows,      setUnclearRows]      = useState<EditableRow[]>([]);
  const [analysis,         setAnalysis]         = useState<StatementAnalysis | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [progress,         setProgress]         = useState<string>('');
  const [isOcrMode,        setIsOcrMode]        = useState(false);
  const [showSlowHint,     setShowSlowHint]     = useState(false);
  const [savedData,        setSavedData]        = useState<SavedInsightsData | null>(null);
  const [showingSaved,     setShowingSaved]     = useState(false);
  // Persist which reminders have been added — survive page refresh
  const [addedTaskIds,  setAddedTaskIds]  = useState<Set<string>>(
    () => loadReminderLinks(REMINDER_TASK_LINKS_KEY),
  );
  const [addedEventIds, setAddedEventIds] = useState<Set<string>>(
    () => loadReminderLinks(REMINDER_EVENT_LINKS_KEY),
  );

  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = loadSavedInsights();
    if (saved) setSavedData(saved);
  }, []);

  useEffect(() => () => {
    if (slowTimer.current) clearTimeout(slowTimer.current);
  }, []);

  // ── Full reset ───────────────────────────────────────────────────────────────
  const fullReset = useCallback(() => {
    setStep('upload'); setFile(null); setRawText(''); setCharCount(0);
    setExtractionMethod('direct'); setProvider('unknown');
    setGoodRows([]); setUnclearRows([]); setAnalysis(null);
    setError(null); setProgress(''); setIsOcrMode(false);
    setShowSlowHint(false); setShowingSaved(false);
    // addedTaskIds / addedEventIds intentionally NOT reset — they persist across analyses
    if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; }
  }, []);

  // ── File → extract → auto-analyze → insights ────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;

    // Validate PDF file type
    if (!picked.type.includes('pdf') && !picked.name.toLowerCase().endsWith('.pdf')) {
      setError('ניתן להעלות קובץ PDF בלבד');
      setFile(null);
      return;
    }

    fullReset();
    setFile(picked);
    setStep('extracting');
    setProgress('מחלצים טקסט מהקובץ...');

    let usedOcr = false;

    try {
      const text = await extractTextFromPdf(picked, (msg) => {
        setProgress(msg);
        if (msg.includes('OCR') || msg.includes('עמוד')) {
          usedOcr = true;
          setIsOcrMode(true);
          if (slowTimer.current) clearTimeout(slowTimer.current);
          slowTimer.current = setTimeout(() => setShowSlowHint(true), 4_000);
        }
      });

      if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; }
      setShowSlowHint(false);

      const detectedProvider = detectStatementProvider(text);
      const filtered         = extractTransactionRelevantText(text, detectedProvider);
      const cc               = text.replace(/\s/g, '').length;

      setRawText(text);
      setCharCount(cc);
      setExtractionMethod(usedOcr ? 'ocr' : 'direct');
      setProvider(detectedProvider);

      const allRows         = extractPaymentRows(filtered);
      const goodPaymentRows = allRows.filter(r => r.rowConfidence !== 'low');
      setGoodRows(rowsFromPaymentRows(goodPaymentRows));
      setUnclearRows(rowsFromPaymentRows(allRows.filter(r => r.rowConfidence === 'low')));

      // Auto-analyze — skip mandatory review, go directly to insights
      const result = analyzePaymentRows(goodPaymentRows, cc, detectedProvider, text);
      setAnalysis(result);

      const toSave: SavedInsightsData = {
        analyzedAt: new Date().toISOString(), fileName: picked.name,
        extractionMethod: usedOcr ? 'ocr' : 'direct',
        provider: result.provider, billingDate: result.billingDate,
        transactionCount: result.totalRows, charCount: cc, confidence: result.confidence,
        insights: {
          fixedPayments: stripSourceLines(result.fixedPayments),
          subscriptions: stripSourceLines(result.subscriptions),
          installments:  stripSourceLines(result.installments),
          anomalies:     stripSourceLines(result.anomalies),
          reminders:     stripReminderSourceLines(result.reminders),
        },
      };
      persistInsights(toSave);
      setSavedData(toSave);
      setStep('insights');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes('password') || errorMsg.includes('סיסמה')) {
        setError('לא הצלחנו לקרוא את ה-PDF. ודאי שהקובץ אינו סרוק כתמונה או מוגן בסיסמה.');
      } else {
        setError(errorMsg || 'לא הצלחנו לקרוא את ה-PDF. ודאי שהקובץ אינו סרוק כתמונה או מוגן בסיסמה.');
      }
      setStep('upload');
      setFile(null);
    }
  };

  // ── Row editing (review panel) ───────────────────────────────────────────────
  const updateRow = useCallback((id: string, field: keyof EditableRow, value: string | boolean) => {
    setGoodRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  // ── Manual re-analyze (from review panel) ────────────────────────────────────
  const handleConfirm = () => {
    const paymentRows = goodRows.map(toPaymentRow).filter(r => r.merchant.length >= 1);
    const result      = analyzePaymentRows(paymentRows, charCount, provider, rawText);
    setAnalysis(result);
    setStep('insights');
    const toSave: SavedInsightsData = {
      analyzedAt: new Date().toISOString(), fileName: file?.name ?? '',
      extractionMethod, provider: result.provider, billingDate: result.billingDate,
      transactionCount: result.totalRows, charCount: result.charCount,
      confidence: result.confidence,
      insights: {
        fixedPayments: stripSourceLines(result.fixedPayments),
        subscriptions: stripSourceLines(result.subscriptions),
        installments:  stripSourceLines(result.installments),
        anomalies:     stripSourceLines(result.anomalies),
        reminders:     stripReminderSourceLines(result.reminders),
      },
    };
    persistInsights(toSave);
    setSavedData(toSave);
  };

  // ── Clear saved ──────────────────────────────────────────────────────────────
  const handleClearSaved = () => {
    clearSavedInsights();
    setSavedData(null);
    setShowingSaved(false);
    if (step === 'insights' && !analysis) fullReset();
  };

  // ── Add reminders to tasks ───────────────────────────────────────────────────
  const handleAddRemindersToTasks = useCallback((reminders: PaymentReminder[]) => {
    if (!onAddTask) return;
    const typeLabel: Record<PaymentReminder['type'], string> = {
      standingOrder: 'הוראת קבע',
      subscription:  'מנוי חוזר',
      installment:   'תשלום בתשלומים',
    };
    for (const r of reminders) {
      if (addedTaskIds.has(r.id)) continue;
      const urgency = r.amount > 250 ? 'high' : 'medium';
      const prevNote = r.previousDate
        ? `תחזית לפי חיוב קודם מתאריך ${fmtDate(r.previousDate)}.`
        : 'תחזית לפי דפוס החיובים הקודם.';
      onAddTask({
        title:        `לבדוק חיוב צפוי: ${r.merchant} — ${r.amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`,
        description:  `${prevNote} סוג: ${typeLabel[r.type]}.`,
        category:     'payment',
        urgency,
        deadlineDate: r.reminderDate,
        status:       'open',
        source:       'paymentInsight',
      });
    }
    setAddedTaskIds(prev => {
      const n = new Set(prev);
      reminders.forEach(r => n.add(r.id));
      saveReminderLinks(REMINDER_TASK_LINKS_KEY, n);
      return n;
    });
  }, [onAddTask, addedTaskIds]);

  // ── Add reminders to calendar ────────────────────────────────────────────────
  const handleAddRemindersToCalendar = useCallback((reminders: PaymentReminder[]) => {
    if (!onAddEvent) return;
    const typeLabel: Record<PaymentReminder['type'], string> = {
      standingOrder: 'הוראת קבע',
      subscription:  'מנוי חוזר',
      installment:   'תשלום בתשלומים',
    };
    for (const r of reminders) {
      if (addedEventIds.has(r.id)) continue;
      onAddEvent({
        title:       `תזכורת חיוב: ${r.merchant} — ${r.amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`,
        description: `צפי חיוב לפי דפוס החיובים הקודם. סוג: ${typeLabel[r.type]}. צפוי ב-${fmtDate(r.chargeDate)}.`,
        date:        r.reminderDate,
        startTime:   '09:00',
        allDay:      true,
        category:    'personal',
        importance:  'normal',
        source:      'manual',
      });
    }
    setAddedEventIds(prev => {
      const n = new Set(prev);
      reminders.forEach(r => n.add(r.id));
      saveReminderLinks(REMINDER_EVENT_LINKS_KEY, n);
      return n;
    });
  }, [onAddEvent, addedEventIds]);

  // ── Derived display state ────────────────────────────────────────────────────
  const displayAnalysis: StatementAnalysis | null = analysis ?? (
    showingSaved && savedData ? {
      fixedPayments:  savedData.insights.fixedPayments,
      subscriptions:  savedData.insights.subscriptions,
      installments:   savedData.insights.installments,
      anomalies:      savedData.insights.anomalies,
      reminders:      savedData.insights.reminders,
      billingDate:    savedData.billingDate,
      totalRows:      savedData.transactionCount,
      charCount:      savedData.charCount,
      confidence:     savedData.confidence,
      provider:       savedData.provider,
    } : null
  );

  const hasAnyInsight = displayAnalysis !== null && (
    displayAnalysis.fixedPayments.length  > 0 ||
    displayAnalysis.subscriptions.length  > 0 ||
    displayAnalysis.installments.length   > 0 ||
    displayAnalysis.anomalies.length      > 0 ||
    displayAnalysis.reminders.length      > 0
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="card payments-card">

      {/* Header */}
      <div className="card-header">
        <div>
          <div className="card-title-row">
            <span className="card-icon">💳</span>
            <h2 className="card-title">תשלומים ודפוסי הוצאות</h2>
          </div>
          <p className="payments-subtitle">העלי פירוט אשראי כדי לזהות חיובים קבועים, תשלומים ותזכורות</p>
        </div>
      </div>

      {/* ═══ Upload ═══ */}
      {step === 'upload' && !showingSaved && (
        <div className="payments-upload-section">
          <div className="payments-helper-text">
            ניתן להעלות פירוט אשראי כדי לזהות הוראות קבע, תשלומים ומנויים חוזרים.
          </div>

          <label className="payments-upload-zone">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="payments-file-input"
              onChange={handleFileChange}
            />
            <div className="payments-upload-content">
              <span className="payments-upload-icon">📄</span>
              <span className="payments-upload-text">העלאת פירוט אשראי PDF</span>
            </div>
          </label>

          {file && !error && (
            <div className="payments-file-selected">
              <span className="payments-file-icon">✓</span>
              <span className="payments-file-name">{file.name}</span>
            </div>
          )}

          {savedData && (
            <button className="payments-view-saved-btn" onClick={() => setShowingSaved(true)}>
              📂 הצג ניתוח קודם ({fmtDateTime(savedData.analyzedAt)})
            </button>
          )}

          <p className="payments-privacy-note">🔒 הניתוח מקומי בלבד — הקובץ אינו נשלח לשרת.</p>

          {error && (
            <div className="payments-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ Extracting ═══ */}
      {step === 'extracting' && (
        <div className="payments-file-section">
          <div className="payments-file-row">
            <span className="payments-file-icon">📄</span>
            <span className="payments-file-name">{file?.name}</span>
          </div>
          <div className="payments-progress-block">
            <p className="payments-loading">{progress || 'מעבד...'}</p>
            {isOcrMode && <p className="payments-ocr-note">הקריאה מתבצעת מקומית בדפדפן. הקובץ לא נשלח לשרת.</p>}
            {showSlowHint && <p className="payments-slow-hint">⏳ זה עשוי לקחת עד דקה בקבצים סרוקים.</p>}
          </div>
        </div>
      )}

      {/* ═══ Review (power-user) ═══ */}
      {step === 'review' && file && (
        <ReviewPanel
          fileName={file.name} extractionMethod={extractionMethod}
          provider={provider} charCount={charCount}
          goodRows={goodRows} unclearRows={unclearRows} rawText={rawText}
          onUpdateRow={updateRow} onConfirm={handleConfirm}
          onBack={() => analysis ? setStep('insights') : fullReset()}
        />
      )}

      {/* ═══ Compact Mode ═══ */}
      {compact && (step === 'insights' || showingSaved) && displayAnalysis !== null && (
        <div className="pi-compact-summary">
          <div className="pi-summary">
            <p className="pi-summary-line">{buildSummaryLine(displayAnalysis)}</p>
            <SummaryChips a={displayAnalysis} />
          </div>
          {displayAnalysis.reminders.length > 0 && (
            <div className="pi-compact-reminders">
              <p className="pi-compact-label">תזכורות חכמות:</p>
              <p className="pi-compact-count">{displayAnalysis.reminders.length} תזכורות</p>
            </div>
          )}
          {onOpenModal && (
            <button className="pi-compact-open-btn" onClick={onOpenModal}>
              פתח תובנות תשלומים ›
            </button>
          )}
        </div>
      )}

      {/* ═══ Insights ═══ */}
      {!compact && (step === 'insights' || showingSaved) && displayAnalysis !== null && (
        <div className="pi-results">

          {/* Saved note */}
          {showingSaved && savedData && !analysis && (
            <div className="pi-saved-note">
              <span>💾</span>
              <span>
                ניתוח קודם · {savedData.fileName.slice(0, 24)}{savedData.fileName.length > 24 ? '…' : ''} ·{' '}
                {PROVIDER_DISPLAY_NAMES[savedData.provider]} · {fmtDateTime(savedData.analyzedAt)}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="pi-summary">
            <p className="pi-summary-line">{buildSummaryLine(displayAnalysis)}</p>
            <SummaryChips a={displayAnalysis} />
          </div>

          {/* Empty state */}
          {!hasAnyInsight && (
            <p className="pi-empty">
              לא זוהו תשלומים קבועים, מנויים או חיובים שדורשים תשומת לב.
            </p>
          )}

          {/* Insight sections */}
          {hasAnyInsight && (
            <div className="pi-insights">

              {/* 1. Smart reminders */}
              <SmartRemindersWidget
                reminders={displayAnalysis.reminders}
                addedTaskIds={addedTaskIds}
                addedEventIds={addedEventIds}
                onAddTask={onAddTask ? handleAddRemindersToTasks : undefined}
                onAddEvent={onAddEvent ? handleAddRemindersToCalendar : undefined}
              />

              {/* 2. Fixed payments */}
              {displayAnalysis.fixedPayments.length > 0 && (
                <CompactSection
                  icon="🔁" title="חיובים קבועים"
                  items={displayAnalysis.fixedPayments}
                  renderCard={(item, idx) => <CompactFixedCard key={idx} item={item} />}
                />
              )}

              {/* 3. Installments */}
              {displayAnalysis.installments.length > 0 && (
                <CompactSection
                  icon="📦" title="עסקאות בתשלומים"
                  items={displayAnalysis.installments}
                  renderCard={(item, idx) => <CompactInstallmentCard key={idx} item={item} />}
                />
              )}

              {/* 4. Anomalies — always show section (empty state if none) */}
              <AnomaliesSection items={displayAnalysis.anomalies} />

              {/* 5. Possible subscriptions — collapsed */}
              {displayAnalysis.subscriptions.length > 0 && (
                <div className="pi-section pi-section--collapsed-sub">
                  <CollapsedSection title={`עוד תובנות אפשריות · ${displayAnalysis.subscriptions.length} מנויים`}>
                    <div className="pi-cards-grid pi-cards-grid--sub">
                      {displayAnalysis.subscriptions.map((item, idx) => (
                        <CompactSubscriptionCard key={idx} item={item} />
                      ))}
                    </div>
                  </CollapsedSection>
                </div>
              )}

            </div>
          )}

          {/* ── Single collapsed debug accordion ── */}
          <div className="pi-collapsed-group">
            <CollapsedSection title="פרטי ניתוח מתקדמים">
              <QualityStats
                transactionCount={displayAnalysis.totalRows}
                charCount={displayAnalysis.charCount}
                confidence={displayAnalysis.confidence}
                provider={displayAnalysis.provider}
              />
              {goodRows.length > 0 && (
                <div className="pi-debug-subsection">
                  <p className="pi-debug-label">כל העסקאות שזוהו ({goodRows.length})</p>
                  <AllTransactionsList rows={goodRows} />
                </div>
              )}
              {rawText.length > 0 && (
                <div className="pi-debug-subsection">
                  <p className="pi-debug-label">טקסט שחולץ</p>
                  <pre className="payments-raw-box payments-raw-box--compact">
                    {rawText.slice(0, 2000)}{rawText.length > 2000 ? '\n…' : ''}
                  </pre>
                </div>
              )}
            </CollapsedSection>
          </div>

          {/* Actions */}
          <div className="pi-actions">
            <label className="payments-reanalyze-btn">
              <input type="file" accept="application/pdf,.pdf"
                className="payments-file-input" onChange={handleFileChange} />
              📄 נתח קובץ חדש
            </label>
            {rawText.length > 0 && (
              <button className="payments-edit-data-btn" onClick={() => setStep('review')}>
                ✏️ ערוך נתונים
              </button>
            )}
            {savedData && (
              <button className="payments-clear-saved-btn" onClick={handleClearSaved}>🗑</button>
            )}
          </div>

          <p className="pi-disclaimer">
            📌 הזיהוי מבוסס על ניתוח טקסט ועשוי לא להיות מדויק. מומלץ לאמת מול פירוט האשראי המקורי.
          </p>
        </div>
      )}

    </div>
  );
};

export default PaymentsInsightsCard;
