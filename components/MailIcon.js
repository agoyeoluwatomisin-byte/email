export default function MailIcon({ name = 'mail', size = 18 }) {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M4 13h4l2 3h4l2-3h4" />
      </>
    ),
    star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.7l6.2-.9L12 3Z" />,
    archive: (
      <>
        <path d="M4 7h16v13H4z" />
        <path d="M3 4h18v3H3zM9 12h6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    filter: <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-4L4 9" />
        <path d="M4 5v4h4M4 13a8 8 0 0 0 14 4l2-2" />
        <path d="M20 19v-4h-4" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    back: (
      <>
        <path d="m15 5-7 7 7 7" />
      </>
    ),
    send: (
      <>
        <path d="m4 4 16 8-16 8 3-8-3-8Z" />
        <path d="M7 12h13" />
      </>
    ),
    paperclip: <path d="m8 12 5-5a3 3 0 0 1 4 4l-7 7a5 5 0 0 1-7-7l7-7" />,
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.mail}
    </svg>
  );
}
