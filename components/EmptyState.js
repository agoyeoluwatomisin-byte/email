import MailIcon from './MailIcon';

export default function EmptyState({
  title = 'Nothing here',
  message = 'Try another folder or search.',
  icon = 'mail',
  action,
}) {
  return (
    <div className="mail-reading-empty">
      <div>
        <div className="mail-empty-icon">
          <MailIcon name={icon} size={24} />
        </div>
        <h2 className="mail-empty-title">{title}</h2>
        <p className="mail-empty-message">{message}</p>
        {action}
      </div>
    </div>
  );
}
