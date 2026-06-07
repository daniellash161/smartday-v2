import { useState } from 'react';
import type { CalendarEvent } from '../types';

interface ManualEventModalProps {
  onClose: () => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
}

const ManualEventModal = ({ onClose, onAddEvent }: ManualEventModalProps) => {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    date: today,
    startTime: '09:00',
    endTime: '',
    category: 'academic' as const,
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'שם האירוע נדרש';
    }
    if (!formData.date) {
      newErrors.date = 'תאריך נדרש';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'שעת התחלה נדרשת';
    }
    if (formData.endTime && formData.endTime <= formData.startTime) {
      newErrors.endTime = 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const categoryMap: Record<string, any> = {
      academic: 'academic',
      personal: 'personal',
      holidays: 'holiday',
      work: 'work',
    };

    const event: Omit<CalendarEvent, 'id'> = {
      title: formData.title.trim(),
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime || undefined,
      category: categoryMap[formData.category],
      importance: 'normal',
      source: 'manual',
      description: formData.description.trim() || undefined,
    };

    onAddEvent(event);
    onClose();
  };

  return (
    <div className="manualEventModalOverlay">
      <div className="manualEventModalPanel">
        <div className="manualEventModalHeader">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#172033' }}>
            הוספת אירוע ללוח הזמנים
          </h2>
          <button
            type="button"
            className="manualEventModalClose"
            onClick={onClose}
            aria-label="סגור"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#7c8798',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div className="manualEventModalBody">
          <form className="manualEventForm" onSubmit={handleSubmit}>
            {/* Title */}
            <div className="manualEventField">
              <label htmlFor="title" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                שם האירוע
              </label>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="לדוגמה: משמרת ערב / שיעור השלמה / קניות"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {errors.title && <div style={{ color: '#e05a7a', fontSize: '12px', marginTop: '4px' }}>{errors.title}</div>}
            </div>

            {/* Date */}
            <div className="manualEventField">
              <label htmlFor="date" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                תאריך
              </label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {errors.date && <div style={{ color: '#e05a7a', fontSize: '12px', marginTop: '4px' }}>{errors.date}</div>}
            </div>

            {/* Start Time */}
            <div className="manualEventField">
              <label htmlFor="startTime" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                שעת התחלה
              </label>
              <input
                id="startTime"
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {errors.startTime && <div style={{ color: '#e05a7a', fontSize: '12px', marginTop: '4px' }}>{errors.startTime}</div>}
            </div>

            {/* End Time */}
            <div className="manualEventField">
              <label htmlFor="endTime" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                שעת סיום (אופציונלי)
              </label>
              <input
                id="endTime"
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {errors.endTime && <div style={{ color: '#e05a7a', fontSize: '12px', marginTop: '4px' }}>{errors.endTime}</div>}
            </div>

            {/* Category */}
            <div className="manualEventField">
              <label htmlFor="category" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                קטגוריה
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="academic">לו״ז אקדמי</option>
                <option value="personal">אישי</option>
                <option value="holidays">חגים ומועדים</option>
                <option value="work">עבודה</option>
              </select>
            </div>

            {/* Description */}
            <div className="manualEventField">
              <label htmlFor="description" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, color: '#172033' }}>
                תיאור / מיקום (אופציונלי)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="פרטים נוספים..."
                style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px' }}
              />
            </div>

            {/* Buttons */}
            <div className="manualEventActions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button
                type="submit"
                className="manualEventButtonSave"
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '10px 20px',
                  background: '#7db7e8',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                שמור אירוע
              </button>
              <button
                type="button"
                onClick={onClose}
                className="manualEventButtonCancel"
                style={{
                  border: '1px solid #dbe5ee',
                  borderRadius: '999px',
                  padding: '10px 20px',
                  background: '#ffffff',
                  color: '#4f8fc6',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualEventModal;
