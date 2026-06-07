import { Task, CalendarEvent, Alert } from '../types';

export const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'הגשת עבודה סמינריונית',
    description: 'לסיים את הפרק השלישי ולשלוח למנחה',
    priority: 'high',
    dueDate: '2026-06-08',
    completed: false,
    category: 'אקדמי',
  },
  {
    id: 't2',
    title: 'תשלום שכר לימוד',
    description: 'לשלם את המחצית השנייה לפני קנס',
    priority: 'high',
    dueDate: '2026-06-09',
    completed: false,
    category: 'כספי',
  },
  {
    id: 't3',
    title: 'קריאת מאמר לשיעור מחר',
    description: 'מאמר של פורטר על אסטרטגיה תחרותית',
    priority: 'medium',
    dueDate: '2026-06-08',
    completed: false,
    category: 'אקדמי',
  },
  {
    id: 't4',
    title: 'הכנת מצגת לעבודת קבוצה',
    description: 'להכין 8 שקפים עד יום שישי',
    priority: 'medium',
    dueDate: '2026-06-12',
    completed: false,
    category: 'אקדמי',
  },
  {
    id: 't5',
    title: 'ענות על אימייל מרצה',
    description: 'אישור השתתפות בסמינר',
    priority: 'low',
    dueDate: '2026-06-10',
    completed: true,
    category: 'כללי',
  },
  {
    id: 't6',
    title: 'עדכון קורות חיים',
    description: 'להוסיף את ניסיון הסטאז׳ האחרון',
    priority: 'low',
    dueDate: '2026-06-15',
    completed: false,
    category: 'קריירה',
  },
];

export const mockEvents: CalendarEvent[] = [
  // ── היום (2026-06-07) ──────────────────────────────────────
  {
    id: 'e1',
    title: 'הרצאה: ניהול מוצר בעידן ה-AI',
    description: 'חובה להגיע עם המחשב — מטלה תוגש בסוף השיעור',
    date: '2026-06-07',
    startTime: '10:00',
    endTime: '11:30',
    location: 'בניין גוטמן, אולם 301',
    category: 'academic',
    importance: 'normal',
    source: 'demo',
  },
  {
    id: 'e3',
    title: 'פגישת קבוצת לימוד',
    description: 'חזרה על חומר לבחינה בשיווק דיגיטלי — כולם מביאים סיכומים',
    date: '2026-06-07',
    startTime: '09:00',
    endTime: '11:00',
    location: 'ספרייה מרכזית',
    category: 'meeting',
    importance: 'important',
    source: 'demo',
  },
  {
    id: 'e2',
    title: 'משמרת בעבודה',
    description: 'משמרת ערב בסניף — כניסה דרך הכניסה האחורית',
    date: '2026-06-07',
    startTime: '16:00',
    endTime: '21:00',
    location: 'סניף תל אביב',
    category: 'work',
    importance: 'important',
    source: 'demo',
  },

  // ── מחר (2026-06-08) ──────────────────────────────────────
  {
    id: 'e6',
    title: 'יום הולדת — אמא',
    description: 'לא לשכוח לקנות מתנה מראש!',
    date: '2026-06-08',
    startTime: '00:00',
    category: 'personal',
    importance: 'important',
    source: 'demo',
  },
  {
    id: 'e8',
    title: 'חזרה לפני הבחינה',
    description: 'סשן חזרה אחרון לפני בחינת שיווק דיגיטלי — להכין סיכומים',
    date: '2026-06-08',
    startTime: '10:00',
    endTime: '12:30',
    location: 'ספרייה מרכזית',
    category: 'exam',
    importance: 'urgent',
    source: 'demo',
  },
  {
    id: 'e9',
    title: 'משמרת בוקר',
    description: 'משמרת פתיחה — כניסה דרך הכניסה הראשית',
    date: '2026-06-08',
    startTime: '08:00',
    endTime: '13:00',
    location: 'סניף תל אביב',
    category: 'work',
    importance: 'normal',
    source: 'demo',
  },

  // ── הקרוב ──────────────────────────────────────────────────
  {
    id: 'e4',
    title: 'בחינה: שיווק דיגיטלי',
    description: 'בחינה סופית — חובה להגיע עם תעודה מזהה, אין ספרים פתוחים',
    date: '2026-06-10',
    startTime: '14:00',
    endTime: '16:00',
    location: 'אולם בחינות מרכזי',
    category: 'exam',
    importance: 'urgent',
    source: 'demo',
  },
  {
    id: 'e5',
    title: 'הגשת פרויקט SmartDay',
    description: 'הגשה אלקטרונית בלבד דרך מערכת המכללה — לא מאחרים',
    date: '2026-06-12',
    startTime: '23:59',
    category: 'academic',
    importance: 'important',
    source: 'demo',
  },
  {
    id: 'e7',
    title: 'פגישת קבוצת מחקר',
    description: 'דיון בממצאים של פרויקט הדוקטורט',
    date: '2026-06-15',
    startTime: '15:00',
    endTime: '17:00',
    location: 'משרד הפרופ׳',
    category: 'meeting',
    importance: 'normal',
    source: 'demo',
  },
];

// Alerts are populated from real data sources only (uploads, email, calendar)
// No fake/demo alerts in mockData
export const mockAlerts: Alert[] = [];

export const aiDailySummary = `שלום! היום יש לך יום עמוס. בבוקר תתחיל עם פגישת לימוד ב-09:00, הרצאה בניהול מוצר ב-10:00, ובאחר הצהריים משמרת בעבודה מ-16:00.
חשוב במיוחד: יש לך 2 משימות דחופות — הגשת עבודה סמינריונית בעוד יום וקריאת מאמר לשיעור.
הייתי ממליץ להקדיש שעה הערב לכתיבת העבודה, ולקרוא את המאמר לפני השיעור.`;

export const aiResponses: Record<string, string> = {
  default:
    'בוא נסתכל על הנתונים שלך: יש לך 5 משימות פתוחות, 3 אירועים להיום, ו-4 התראות חכמות. איך אני יכול לעזור?',
  משימות:
    'יש לך 5 משימות פתוחות. 2 בעדיפות גבוהה: הגשת עבודה סמינריונית (8/06) וקריאת מאמר (8/06). ממליץ להתחיל בהן!',
  אירועים:
    'היום: הרצאה ב-10:00 וקבוצה ב-09:00. משמרת בערב ב-16:00. מחר: יום הולדת אמא וחזרה לבחינה ב-10:00.',
  תשלום:
    'יש תשלום שכר לימוד שפג תוקפו בעוד יומיים (9/06). אם לא ישולם, תצטרף קנס של 150₪. מומלץ לשלם בקרוב!',
  בחינה:
    'הבחינה בשיווק דיגיטלי היא ב-10/06 בשעה 14:00 באולם הבחינות המרכזי. נותרו לך 3 ימים לחזרה אינטנסיבית.',
  עבודה:
    'עבודת הסמינר צריכה להיות מוגשת בעוד יום! צריך לסיים את הפרק השלישי ולשלוח למנחה. זו משימה בעדיפות גבוהה.',
  עזרה:
    'אני יכול לעזור לך עם: "משימות", "אירועים", "תשלום", "בחינה", "עבודה". פשוט כתוב את הנושא!',
};
