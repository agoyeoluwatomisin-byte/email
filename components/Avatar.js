import { colorFromString, initialsFromAddress } from '../lib/mailbox';

export default function Avatar({ address, size = 'md' }) {
  return (
    <span
      className={`mail-avatar mail-avatar-${size}`}
      style={{ '--avatar-color': colorFromString(address) }}
      aria-hidden="true"
    >
      {initialsFromAddress(address)}
    </span>
  );
}
