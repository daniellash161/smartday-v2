/**
 * PersonalWidget — Customizable personal space widget
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows user to choose between: note, shopping list, drawing, or hidden
 * Persists selections and content to localStorage
 * Smart shopping list detection based on calendar events
 */
// @ts-nocheck

import { useState, useEffect, useRef } from 'react';
import type { Task, CalendarEvent } from '../types';
import { mockEvents } from '../data/mockData';

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────

const WIDGET_TYPE_KEY = 'smartday-personal-widget-type';
const WIDGET_COLLAPSED_KEY = 'smartday-personal-widget-collapsed';
const QUICK_NOTE_KEY = 'smartday-quick-note';
const SHOPPING_LIST_KEY = 'smartday-shopping-list';
const DRAWING_PAD_KEY = 'smartday-drawing-pad';
const IGNORED_SHOPPING_EVENTS_KEY = 'smartday-ignored-shopping-events';

const SHOPPING_KEYWORDS = [
  'קניות', 'סופר', 'סופרמרקט', 'רשימת קניות', 'לקנות', 'קניון',
  'shopping', 'supermarket', 'grocery', 'groceries', 'buy'
];

type WidgetType = 'note' | 'shopping' | 'drawing' | 'hidden';

interface ShoppingItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  calendarEvents?: CalendarEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const PersonalWidget = ({ onAddTask, calendarEvents }: Props) => {
  const [widgetType, setWidgetType] = useState<WidgetType>('note');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasShoppingEvent, setHasShoppingEvent] = useState(false);
  const [dismissedShoppingEvent, setDismissedShoppingEvent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noteTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Detect shopping events in calendar
  const detectShoppingEvents = (events?: CalendarEvent[]) => {
    try {
      // Use passed calendar events or fallback to mockEvents
      const eventsToCheck = events || calendarEvents || mockEvents;
      if (!eventsToCheck || eventsToCheck.length === 0) return false;

      const today = new Date().toISOString().split('T')[0];
      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      const cutoff = in3Days.toISOString().split('T')[0];

      const ignoredEvents = localStorage.getItem(IGNORED_SHOPPING_EVENTS_KEY);
      const ignoredIds = ignoredEvents ? (JSON.parse(ignoredEvents) as string[]) : [];

      for (const event of eventsToCheck) {
        if (!event.date) continue;
        if (ignoredIds.includes(event.id)) continue;
        if (event.date < today || event.date > cutoff) continue;

        const text = `${event.title || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
        if (SHOPPING_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))) {
          return true;
        }
      }
    } catch {
      // ignore errors
    }
    return false;
  };

  // Load preferences on mount
  useEffect(() => {
    const savedType = localStorage.getItem(WIDGET_TYPE_KEY) as WidgetType | null;
    setWidgetType(savedType || 'note');

    const savedCollapsed = localStorage.getItem(WIDGET_COLLAPSED_KEY);
    setIsCollapsed(savedCollapsed === 'true');

    const savedNote = localStorage.getItem(QUICK_NOTE_KEY);
    if (savedNote) setNoteText(savedNote);

    const savedList = localStorage.getItem(SHOPPING_LIST_KEY);
    if (savedList) {
      try {
        const items = JSON.parse(savedList);
        setShoppingItems(items);
      } catch {
        // ignore parse errors
      }
    }

    // Load drawing
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const saved = localStorage.getItem(DRAWING_PAD_KEY);
        if (saved) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = saved;
        }
      }
    }
  }, []);

  // Check for shopping events when calendar events change
  useEffect(() => {
    const hasEvent = detectShoppingEvents();
    setHasShoppingEvent(hasEvent);
  }, [calendarEvents]);

  // Change widget type
  const handleChangeType = (type: WidgetType) => {
    setWidgetType(type);
    localStorage.setItem(WIDGET_TYPE_KEY, type);
  };

  // Toggle collapse/expand
  const handleToggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem(WIDGET_COLLAPSED_KEY, String(newCollapsed));
  };

  // Note handling
  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setNoteSaved(false);

    // Debounced save
    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(QUICK_NOTE_KEY, text);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }, 500);
  };

  // Shopping list handling
  const addShoppingItem = () => {
    if (!newItemText.trim()) return;
    const item: ShoppingItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...shoppingItems, item];
    setShoppingItems(updated);
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(updated));
    setNewItemText('');
  };

  const toggleShoppingItem = (id: string) => {
    const updated = shoppingItems.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setShoppingItems(updated);
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(updated));
  };

  const deleteShoppingItem = (id: string) => {
    const updated = shoppingItems.filter(item => item.id !== id);
    setShoppingItems(updated);
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(updated));
  };

  const addShoppingToTasks = (item: ShoppingItem) => {
    if (!onAddTask) return;
    onAddTask({
      title: `קניות: ${item.text}`,
      category: 'personal',
      urgency: 'medium',
      deadlineDate: new Date().toISOString().split('T')[0],
      status: 'open',
      source: 'manual',
    });
  };

  // Drawing handlers
  const getCanvasCoords = (e: MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if (e instanceof TouchEvent) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    } else {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#222833';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
    // Save drawing
    const dataUrl = canvasRef.current.toDataURL('image/png');
    localStorage.setItem(DRAWING_PAD_KEY, dataUrl);
  };

  const clearDrawing = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    localStorage.removeItem(DRAWING_PAD_KEY);
  };

  const openShoppingMode = () => {
    setWidgetType('shopping');
    localStorage.setItem(WIDGET_TYPE_KEY, 'shopping');
    setDismissedShoppingEvent(true);
  };

  const dismissShoppingEvent = () => {
    setDismissedShoppingEvent(true);
    setHasShoppingEvent(false);
    // Save ignored event
    try {
      const ignored = localStorage.getItem(IGNORED_SHOPPING_EVENTS_KEY);
      const ignoredIds = ignored ? JSON.parse(ignored) : [];
      // Mark a placeholder - in real app would be specific event id
      if (!ignoredIds.includes('shopping-suggestion')) {
        ignoredIds.push('shopping-suggestion');
        localStorage.setItem(IGNORED_SHOPPING_EVENTS_KEY, JSON.stringify(ignoredIds));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="card personal-widget">
      {/* Collapsed state */}
      {isCollapsed && (
        <div className="personal-collapsed">
          <div className="personal-collapsed-header">
            <h3 className="personal-collapsed-title">פינה אישית</h3>
            <p className="personal-collapsed-text">הווידג׳ט מכווץ</p>
          </div>
          <button className="personal-expand-btn" onClick={handleToggleCollapsed}>
            פתח
          </button>
        </div>
      )}

      {/* Expanded state */}
      {!isCollapsed && (
        <>
          {/* Header */}
          <div className="card-header">
            <div className="card-title-row">
              <span className="card-icon">⭐</span>
              <h2 className="card-title">פינה אישית</h2>
            </div>
            <button
              className="personal-collapse-btn"
              onClick={handleToggleCollapsed}
              title="כווץ"
            >
              כווץ
            </button>
          </div>
          <p className="personal-subtitle-expanded">פתק, קניות או ציור קטן ליום שלך</p>

          {/* Shopping event suggestion */}
          {hasShoppingEvent && !dismissedShoppingEvent && (
            <div className="personal-shopping-suggestion">
              <p className="personal-suggestion-text">
                זיהינו אירוע קניות בלוח הזמנים. רוצה לפתוח רשימת קניות?
              </p>
              <div className="personal-suggestion-buttons">
                <button
                  className="personal-suggestion-btn personal-suggestion-btn--primary"
                  onClick={openShoppingMode}
                >
                  פתח רשימת קניות
                </button>
                <button
                  className="personal-suggestion-btn personal-suggestion-btn--secondary"
                  onClick={dismissShoppingEvent}
                >
                  התעלם
                </button>
              </div>
            </div>
          )}

          {/* Type selector */}
          <div className="personal-selector">
            {(['note', 'shopping', 'drawing'] as const).map(type => (
              <button
                key={type}
                className={`personal-selector-chip${widgetType === type ? ' personal-selector-chip--active' : ''}`}
                onClick={() => handleChangeType(type)}
              >
                {type === 'note' && 'פתק'}
                {type === 'shopping' && 'קניות'}
                {type === 'drawing' && 'ציור'}
              </button>
            ))}
          </div>

          {/* Note mode */}
          {widgetType === 'note' && (
            <div className="personal-content">
              <textarea
                className="personal-note-input"
                placeholder="כתבי כאן פתק קצר ליום..."
                value={noteText}
                onChange={e => handleNoteChange(e.target.value)}
              />
              {noteSaved && <p className="personal-saved">✓ נשמר מקומית</p>}
              <p className="personal-privacy">נשמר מקומית בדפדפן שלך</p>
            </div>
          )}

          {/* Shopping list mode */}
          {widgetType === 'shopping' && (
            <div className="personal-content">
              <div className="personal-shopping-input">
                <input
                  type="text"
                  className="personal-shopping-field"
                  placeholder="הוסיפי פריט לרשימה..."
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addShoppingItem();
                  }}
                />
                <button className="personal-shopping-btn" onClick={addShoppingItem}>
                  הוסף
                </button>
              </div>

              {shoppingItems.length > 0 && (
                <div className="personal-shopping-list">
                  {shoppingItems.slice(0, 4).map(item => (
                    <div key={item.id} className="personal-shopping-item">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleShoppingItem(item.id)}
                        className="personal-shopping-check"
                      />
                      <span className={`personal-shopping-text${item.completed ? ' personal-shopping-text--done' : ''}`}>
                        {item.text}
                      </span>
                      <button
                        className="personal-shopping-delete"
                        onClick={() => deleteShoppingItem(item.id)}
                      >
                        ✕
                      </button>
                      {onAddTask && (
                        <button
                          className="personal-shopping-task"
                          onClick={() => addShoppingToTasks(item)}
                          title="הוסף למשימות"
                        >
                          +
                        </button>
                      )}
                    </div>
                  ))}
                  {shoppingItems.length > 4 && (
                    <p className="personal-shopping-more">ועוד {shoppingItems.length - 4} פריטים</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Drawing mode */}
          {widgetType === 'drawing' && (
            <div className="personal-content">
              <canvas
                ref={canvasRef}
                className="personal-canvas"
                width={280}
                height={160}
                onMouseDown={(e: React.MouseEvent) => startDrawing(e.nativeEvent)}
                onMouseMove={(e: React.MouseEvent) => draw(e.nativeEvent)}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e: React.TouchEvent) => startDrawing(e.nativeEvent)}
                onTouchMove={(e: React.TouchEvent) => draw(e.nativeEvent)}
                onTouchEnd={stopDrawing}
              />
              <button className="personal-clear-btn" onClick={clearDrawing}>
                נקה
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PersonalWidget;
