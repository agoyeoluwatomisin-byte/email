export default function Skeleton({ rows = 4 }) {
  return <div className="ui-skeleton-list" aria-label="Loading" aria-live="polite">{Array.from({ length: rows }, (_, index) => <div className="ui-skeleton-row" key={index} />)}</div>;
}
