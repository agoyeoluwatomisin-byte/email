import MailIcon from './MailIcon';

const icons = {
  inbox: 'inbox',
  starred: 'star',
  sent: 'send',
  drafts: 'mail',
  archive: 'archive',
  spam: 'mail',
  all: 'inbox',
};

export default function FolderRail({
  folders,
  mailboxes,
  selectedFolder,
  selectedMailbox,
  onFolder,
  onMailbox,
  collapsed,
}) {
  return (
    <nav className="mail-rail" aria-label="Mailbox folders">
      <div className="mail-rail-header">
        <span className="mail-rail-title">Mail</span>
      </div>
      <div className="mail-rail-section">
        <div className="mail-rail-label">Folders</div>
        {folders.map((folder) => (
          <button
            className="mail-folder"
            type="button"
            key={folder.value}
            aria-current={selectedFolder === folder.value ? 'page' : undefined}
            onClick={() => onFolder(folder.value)}
            title={collapsed ? folder.label : undefined}
          >
            <span className="mail-folder-icon">
              <MailIcon name={icons[folder.value] || 'mail'} size={17} />
            </span>
            <span className="mail-folder-label">{folder.label}</span>
            {folder.count > 0 && <span className="mail-count">{folder.count}</span>}
          </button>
        ))}
      </div>
      <div className="mail-rail-section">
        <div className="mail-rail-label">Mailboxes</div>
        <button
          className="mail-folder"
          type="button"
          aria-current={selectedMailbox === 'all' ? 'page' : undefined}
          onClick={() => onMailbox('all')}
          title={collapsed ? 'All mailboxes' : undefined}
        >
          <span className="mail-folder-icon">
            <MailIcon name="inbox" size={17} />
          </span>
          <span className="mail-folder-label">All mailboxes</span>
        </button>
        {mailboxes.map((mailbox) => (
          <button
            className="mail-folder"
            type="button"
            key={mailbox.value}
            aria-current={selectedMailbox === mailbox.value ? 'page' : undefined}
            onClick={() => onMailbox(mailbox.value)}
            title={collapsed ? mailbox.label : undefined}
          >
            <span className="mail-folder-icon">
              <span className="mail-mailbox-dot" style={{ '--mailbox-color': mailbox.color }} />
            </span>
            <span className="mail-folder-label">{mailbox.label}</span>
            <span className="mail-count">{mailbox.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}