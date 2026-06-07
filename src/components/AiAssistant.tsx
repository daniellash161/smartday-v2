import { useState } from 'react';

type InsightType = 'urgent' | 'delay' | 'prepare' | null;

interface InsightContent {
  title: string;
  content: string;
}

const INSIGHTS: Record<'urgent' | 'delay' | 'prepare', InsightContent> = {
  urgent: {
    title: 'מה דחוף היום?',
    content: 'היום כדאי להתמקד במשימות עם דדליין קרוב ובהתראות תשלום. התחילי מהמשימות המסומנות כדחופות.',
  },
  delay: {
    title: 'מה אפשר לדחות?',
    content: 'משימות ללא דדליין קרוב או ללא תלות באירוע היום יכולות לעבור להמשך השבוע.',
  },
  prepare: {
    title: 'איך להתכונן ליום?',
    content: 'בדקי את לוח הזמנים, סגרי משימה אחת דחופה, ועברי על תזכורות תשלום או מיילים שמחכים לטיפול.',
  },
};

const AiAssistant = () => {
  const [selectedInsight, setSelectedInsight] = useState<InsightType>(null);

  return (
    <section className="quick-insights-card">
      <header className="quick-insights-header">
        <div>
          <h3>תובנות מהירות</h3>
          <p>סיכומים קצרים שיעזרו לך להבין מה חשוב עכשיו</p>
        </div>
        <span className="quick-insights-icon">✦</span>
      </header>

      <div className="quick-insights-actions">
        <button
          className={`quick-insight-btn ${selectedInsight === 'urgent' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => setSelectedInsight('urgent')}
        >
          מה דחוף היום?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'delay' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => setSelectedInsight('delay')}
        >
          מה אפשר לדחות?
        </button>
        <button
          className={`quick-insight-btn ${selectedInsight === 'prepare' ? 'quick-insight-btn--active' : ''}`}
          onClick={() => setSelectedInsight('prepare')}
        >
          איך להתכונן ליום?
        </button>
      </div>

      {selectedInsight && selectedInsight in INSIGHTS ? (
        <div className="quick-insights-result">
          <p>{INSIGHTS[selectedInsight as keyof typeof INSIGHTS].content}</p>
        </div>
      ) : (
        <div className="quick-insights-empty">
          בחרי שאלה מהירה כדי לקבל תובנה על היום שלך.
        </div>
      )}
    </section>
  );
};

export default AiAssistant;
