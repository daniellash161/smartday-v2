// @ts-nocheck
import { useState, useEffect } from 'react';
import type { ImportantEmail, EmailStatus, Task, CalendarEvent } from '../types';
import {
  connectGmail,
  disconnectGmail,
  fetchImportantEmails,
  restoreGmailSession,
  gmailIsConnected,
} from '../services/gmailService';
import ImportantEmailsModal from './ImportantEmailsModal';

const EMAIL_STATUS_KEY = 'smartday-email-status';

function loadStatuses(): Record<string, EmailStatus> {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_STATUS_KEY) ?? '{}') as Record<string, EmailStatus>;
  } catch {
    return {};
  }
}

function saveStatuses(s: Record<string, EmailStatus>) {
  localStorage.setItem(EMAIL_STATUS_KEY, JSON.stringify(s));
}

interface Props {
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  existingTaskTitles: Set<string>;
}

const ImportantEmailsCard = ({ onAddTask, onAddEvent, existingTaskTitles }: Props) => {
  const [isConnected, setIsConnected] = useState(() => {
    try { restoreGmailSession(); return gmailIsConnected(); } catch { return false; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedEmails, setFetchedEmails] = useState<ImportantEmail[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EmailStatus>>(loadStatuses);
  const [addedFromEmailIds, setAddedFromEmailIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // visible emails = unread only (not handled/ignored)
  const visibleEmails = fetchedEmails.filter(e => {
    const s = statuses[e.id] ?? e.status;
    return s === 'unread' || s === 'read' || s === 'starred';
  });

  useEffect(() => {
    if (gmailIsConnected()) _doFetch();
  }, []);

  const _doFetch = async () => {
    setIsLoading(true);
    setGmailError(null);
    try {
      const emails = await fetchImportantEmails();
      setFetchedEmails(emails);
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'שגיאה בטעינת המיילים.');
      if (!gmailIsConnected()) { setIsConnected(false); setFetchedEmails([]); }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await connectGmail();
      setIsConnected(true);
      await _doFetch();
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'שגיאת התחברות ל-Gmail.');
      setIsLoading(false);
    }
  };

  const handleMarkHandled = (emailId: string) => {
    const next = { ...statuses, [emailId]: 'handled' as EmailStatus };
    setStatuses(next);
    saveStatuses(next);
  };

  const handleAddTask = (task: Omit<Task, 'id' | 'createdAt'>, emailId: string) => {
    onAddTask(task);
    setAddedFromEmailIds(prev => new Set(prev).add(emailId));
  };

  const urgentCount = visibleEmails.filter(
    e => e.importance === 'urgent' || e.importance === 'high'
  ).length;

  return (
    <>
      <div className="card important-emails-compact-card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon">📬</span>
            <h2 className="card-title">מיילים חשובים</h2>
            {isConnected && visibleEmails.length > 0 && (
              <span className="badge badge-red">{visibleEmails.length}</span>
            )}
          </div>
        </div>

        <div className="important-emails-compact-body">
          {!isConnected ? (
            <p className="empty-state">לא מחובר ל-Gmail. לחצי "פתח מיילים חשובים" כדי להתחבר.</p>
          ) : isLoading ? (
            <p className="empty-state">טוען מיילים...</p>
          ) : visibleEmails.length === 0 ? (
            <p className="empty-state">אין מיילים חשובים כרגע.</p>
          ) : (
            <p className="important-emails-compact-summary">
              {urgentCount > 0
                ? `${urgentCount} מיילים דחופים מתוך ${visibleEmails.length} מיילים חשובים`
                : `${visibleEmails.length} מיילים חשובים ממתינים לטיפול`}
            </p>
          )}

          {gmailError && (
            <p className="important-emails-compact-error">⚠️ {gmailError}</p>
          )}

          <button
            className="important-emails-open-btn"
            onClick={() => setShowModal(true)}
          >
            פתח מיילים חשובים
          </button>
        </div>
      </div>

      {showModal && (
        <ImportantEmailsModal
          onClose={() => setShowModal(false)}
          emails={visibleEmails}
          isConnected={isConnected}
          isLoading={isLoading}
          onConnect={handleConnect}
          existingTaskTitles={existingTaskTitles}
          addedFromEmailIds={addedFromEmailIds}
          onAddTask={handleAddTask}
          onMarkHandled={handleMarkHandled}
        />
      )}
    </>
  );
};

export default ImportantEmailsCard;
