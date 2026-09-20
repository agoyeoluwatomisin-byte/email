import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  open,
  title = 'Confirm action',
  message,
  onConfirm,
  onClose,
  confirmLabel = 'Confirm',
  danger = false,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
