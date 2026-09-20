export default function Skeleton({ count = 6 }) {
  return <div aria-label="Loading messages" aria-live="polite">{Array.from({ length: count }, (_, index) => <div className="mail-skeleton" key={index} />)}</div>;
}
