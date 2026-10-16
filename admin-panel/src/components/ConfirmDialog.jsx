import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', onConfirm, onCancel, destructive = false }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} description={description} size="small">
      <div className="confirm-actions">
        <button className="button button-secondary" onClick={onCancel}>Cancel</button>
        <button className={`button ${destructive ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
