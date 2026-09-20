export default function Tabs({ items, value, onChange }) {
  return <div className="ui-tabs" role="tablist">{items.map((item) => <button className="ui-tab" type="button" role="tab" aria-selected={value === item.value} key={item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}
