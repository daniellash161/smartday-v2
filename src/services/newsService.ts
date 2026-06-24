/**
 * newsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches real morning news headlines from Google News RSS.
 * Uses AllOrigins (https://api.allorigins.win) as a CORS proxy for the browser.
 *
 * Note for production:
 *   Replace AllOrigins with a dedicated backend proxy endpoint to avoid
 *   relying on a public proxy service and improve performance/reliability.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NewsCategory =
  | 'general' | 'business' | 'technology'
  | 'transport' | 'weather' | 'emergency';

export type NewsImportance = 'high' | 'medium' | 'low';

export interface NewsItem {
  id:          string;
  title:       string;
  summary:     string;
  source:      string;
  url:         string;
  publishedAt: string;         // ISO timestamp
  category:    NewsCategory;
  importance:  NewsImportance;
  isDemo?:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags from a string, collapse whitespace, and limit length.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')           // remove HTML tags
    .replace(/&[a-z]+;/gi, ' ')        // replace HTML entities with spaces
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim()
    .slice(0, 180);                    // limit to 180 chars
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMERGENCY_RE =
  /חירום|ביטחון|אזעקה|מלחמה|ירי|פיגוע|טרור|נפגעים|emergency|security|war|alert/i;

const TRANSPORT_RE =
  /תחבורה|פקקים|רכבת|אוטובוס|כביש|תחנה|עיכובים|traffic|train|bus|delay/i;

const WEATHER_RE =
  /מזג[\s_]*אוויר|גשם|שרב|סערה|חום|קור|שלג|הצפות|weather|storm|rain|heat/i;

const BUSINESS_RE =
  /ריבית|בנק|כלכלה|אינפלציה|שוק|מניות|הון|GDP|inflation|economy|market|bank/i;

const TECH_RE =
  /טכנולוגיה|הייטק|סייבר|AI|tech|cyber|אינטרנט|תוכנה|סטארטאפ|software/i;

const HIGH_IMPORTANCE_RE =
  /שביתה|תחבורה|פקקים|מזג[\s_]*אוויר|ביטחון|חירום|לימודים|בחירות|ריבית|בנק[\s_]*ישראל|מלחמה|אזעקה|עומסים|סגירה|ביטול|התרעה|strike|traffic|weather|emergency|security|interest[\s_]*rate|central[\s_]*bank|war|alert|delays|cancellation/i;

export function categorizeNewsItem(title: string, summary: string): NewsCategory {
  const t = `${title} ${summary}`;
  if (EMERGENCY_RE.test(t)) return 'emergency';
  if (TRANSPORT_RE.test(t)) return 'transport';
  if (WEATHER_RE.test(t))   return 'weather';
  if (BUSINESS_RE.test(t))  return 'business';
  if (TECH_RE.test(t))      return 'technology';
  return 'general';
}

export function scoreNewsImportance(title: string, summary: string): NewsImportance {
  return HIGH_IMPORTANCE_RE.test(`${title} ${summary}`) ? 'high' : 'medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// RSS parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse RSS XML and extract news items.
 * Uses DOMParser to handle XML safely.
 */
function parseRssXml(xmlText: string): NewsItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Check for XML parse errors
    if (doc.documentElement.tagName === 'parsererror') {
      throw new Error('Failed to parse RSS XML');
    }

    const items = Array.from(doc.querySelectorAll('item'));
    return items.map((item, idx) => {
      const title   = item.querySelector('title')?.textContent?.trim() || 'עדכון חדשות';
      const link    = item.querySelector('link')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
      const desc    = item.querySelector('description')?.textContent?.trim() || '';
      const source  = item.querySelector('source')?.textContent?.trim() || 'Google News';

      // Clean description
      const summary = stripHtml(desc);

      // Parse published date
      let publishedAt = new Date().toISOString();
      try {
        const parsed = new Date(pubDate);
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed.toISOString();
        }
      } catch { /* use current time */ }

      return {
        id:          link || `${title}-${idx}`,
        title,
        summary,
        source,
        url:         link,
        publishedAt,
        category:    categorizeNewsItem(title, summary),
        importance:  scoreNewsImportance(title, summary),
      };
    });
  } catch (err) {
    console.error('RSS parse error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google News RSS via AllOrigins
// ─────────────────────────────────────────────────────────────────────────────

const RSS_URL = 'https://news.google.com/rss?hl=he&gl=IL&ceid=IL:he';
const ALLORIGINS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Fetch Google News RSS through AllOrigins CORS proxy.
 */
export async function fetchGoogleNewsRss(bustCache = false): Promise<NewsItem[]> {
  try {
    const url = bustCache ? `${RSS_URL}&_t=${Date.now()}` : RSS_URL;
    const proxyUrl = ALLORIGINS_PROXY + encodeURIComponent(url);
    const res = await fetch(proxyUrl, bustCache ? { cache: 'no-store' } : undefined);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xmlText = await res.text();
    const items = parseRssXml(xmlText);

    // Return max 5 items for dashboard
    return items.slice(0, 5);
  } catch (err) {
    console.error('Failed to fetch Google News RSS:', err);
    throw err;
  }
}

/**
 * Fetch morning news headlines (public API).
 */
export async function fetchMorningNews(bustCache = false): Promise<NewsItem[]> {
  return fetchGoogleNewsRss(bustCache);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo data (only shown when user explicitly enables demo mode)
// ─────────────────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

export const DEMO_NEWS: NewsItem[] = [
  {
    id: 'demo-1', isDemo: true,
    title:   'בנק ישראל: הריבית נשארת ללא שינוי ב-4.5%',
    summary: 'הוועדה המוניטרית של בנק ישראל החליטה פה אחד להותיר את הריבית ללא שינוי, בשיעור של 4.5% לשנה, על רקע ירידה מסוימת באינפלציה.',
    source: 'כלכליסט', url: '#', publishedAt: ago(1),
    category: 'business', importance: 'high',
  },
  {
    id: 'demo-2', isDemo: true,
    title:   'עיכובים ברכבת ישראל בקו תל אביב-ירושלים',
    summary: 'הרכבת מדווחת על עיכובים של עד 20 דקות בקו המהיר תל אביב-ירושלים בשל תקלה טכנית. הנוסעים מתבקשים לקחת מסלולים חלופיים.',
    source: 'ynet', url: '#', publishedAt: ago(2),
    category: 'transport', importance: 'high',
  },
  {
    id: 'demo-3', isDemo: true,
    title:   'תחזית מזג אוויר: חמסין צפוי בסוף השבוע',
    summary: 'שירות המטאורולוגי צופה עליית טמפרטורות חדה ורוחות חמות החל מיום שישי. מומלץ להגביל פעילות חיצונית בשעות הצהריים.',
    source: 'השירות המטאורולוגי', url: '#', publishedAt: ago(3),
    category: 'weather', importance: 'high',
  },
  {
    id: 'demo-4', isDemo: true,
    title:   'גל פיטורים חדש בחברות הייטק ישראליות',
    summary: 'מספר חברות טכנולוגיה הודיעו על קיצוצים משמעותיים על רקע ירידה בגיוסים ולחץ מהמשקיעים.',
    source: 'The Marker', url: '#', publishedAt: ago(4),
    category: 'technology', importance: 'medium',
  },
  {
    id: 'demo-5', isDemo: true,
    title:   'כנסת ישראל: הצבעה על חוק חדש השבוע',
    summary: 'הכנסת צפויה להצביע השבוע על מספר הצעות חוק בנושאי תעסוקה ורווחה חברתית.',
    source: 'ערוץ 12 חדשות', url: '#', publishedAt: ago(5),
    category: 'general', importance: 'medium',
  },
];
