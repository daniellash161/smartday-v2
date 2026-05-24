import { useState, useRef, useEffect } from 'react';
import type { AiMessage } from '../types';
import { aiResponses } from '../data/mockData';

const SUGGESTIONS = ['משימות', 'אירועים', 'תשלום', 'בחינה', 'עבודה', 'עזרה'];

function getResponse(input: string): string {
  const lower = input.trim();
  for (const key of Object.keys(aiResponses)) {
    if (key !== 'default' && lower.includes(key)) {
      return aiResponses[key];
    }
  }
  return aiResponses['default'];
}

const AiAssistant = () => {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      text: 'שלום! אני העוזר החכם של SmartDay 🤖 אשמח לעזור לך עם המשימות, האירועים, וההתראות שלך. מה תרצה לדעת?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: AiMessage = { id: Date.now().toString(), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const reply: AiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: getResponse(text),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="card ai-card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon">🤖</span>
          <h2 className="card-title">עוזר חכם</h2>
          <span className="ai-live-badge">LIVE</span>
        </div>
      </div>

      <div className="ai-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-bubble ${msg.role === 'user' ? 'ai-bubble-user' : 'ai-bubble-bot'}`}>
            {msg.role === 'assistant' && <span className="ai-avatar">🤖</span>}
            <p>{msg.text}</p>
          </div>
        ))}
        {isTyping && (
          <div className="ai-bubble ai-bubble-bot">
            <span className="ai-avatar">🤖</span>
            <div className="ai-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="ai-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
            {s}
          </button>
        ))}
      </div>

      <form className="ai-input-row" onSubmit={handleSubmit}>
        <input
          className="ai-input"
          type="text"
          placeholder="שאל אותי משהו..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="rtl"
        />
        <button className="ai-send-btn" type="submit" disabled={!input.trim()}>
          שלח
        </button>
      </form>
    </div>
  );
};

export default AiAssistant;
