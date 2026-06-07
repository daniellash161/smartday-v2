/**
 * PaymentsModal — Simple clean modal for payment insights
 */

interface PaymentsModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const PaymentsModal = ({ onClose, children }: PaymentsModalProps) => {
  return (
    <div className="payments-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="payments-modal-panel">
        <div className="payments-modal-header">
          <div>
            <h2>תובנות תשלומים</h2>
            <p>פירוט התובנות שזוהו מתוך קובץ האשראי</p>
          </div>
          <button type="button" className="payments-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="payments-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PaymentsModal;
