/**
 * PaymentsModal — Isolated modal with new class names to avoid CSS conflicts
 */

interface PaymentsModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const PaymentsModal = ({ onClose, children }: PaymentsModalProps) => {
  return (
    <div
      className="paymentDetailsModalOverlay"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="paymentDetailsModalPanel">
        <header className="paymentDetailsModalHeader">
          <div>
            <h2>תובנות תשלומים</h2>
            <p>פירוט התובנות שזוהו מתוך קובץ האשראי</p>
          </div>
          <button
            type="button"
            className="paymentDetailsModalClose"
            onClick={onClose}
            aria-label="סגור"
          >
            ×
          </button>
        </header>

        <main className="paymentDetailsModalBody">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PaymentsModal;
