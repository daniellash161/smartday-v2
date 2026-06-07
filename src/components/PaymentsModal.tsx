/**
 * PaymentsModal — Full payment insights analysis overlay
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when user clicks "פתח תובנות תשלומים" from the compact dashboard card.
 * Shows full payment analysis with all sections, details, and actions.
 * This is a simple overlay wrapper; the actual card is rendered in full mode.
 */

interface PaymentsModalProps {
  onClose:      () => void;
  children:     React.ReactNode;
}

const PaymentsModal = ({
  onClose,
  children,
}: PaymentsModalProps) => {
  return (
    <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm-modal" dir="rtl">
        {/* Modal header with title and close button */}
        <div className="pm-header">
          <div className="pm-title-section">
            <h2 className="pm-title">תובנות תשלומים</h2>
            <p className="pm-subtitle">פירוט התובנות שזוהו מתוך קובץ האשראי</p>
          </div>
          <button className="pm-close-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        {/* Full payment insights view — rendered as children */}
        <div className="pm-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PaymentsModal;
