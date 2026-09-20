import MailIcon from '../MailIcon';

export default function EmptyState({ title = 'Nothing here', message, icon = 'mail', action }) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-icon">
        <MailIcon name={icon} size={24} />
      </div>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
