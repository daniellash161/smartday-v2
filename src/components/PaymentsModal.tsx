/**
 * PaymentsModal — Full payment insights analysis overlay
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when user clicks "פתח תובנות תשלומים" from the compact dashboard card.
 * Shows full payment analysis with all sections, details, and actions.
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
    <div className="payments-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="payments-modal-panel" dir="rtl">
        {/* Single header - part of modal, not floating */}
        <header className="payments-modal-header">
          <div className="payments-modal-title-section">
            <h2 className="payments-modal-title">תובנות תשלומים</h2>
            <p className="payments-modal-subtitle">פירוט התובנות שזוהו מתוך קובץ האשראי</p>
          </div>
          <button className="payments-modal-close" onClick={onClose} aria-label="סגור">×</button>
        </header>

        {/* Single scrollable content area */}
        <div className="payments-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PaymentsModal;
