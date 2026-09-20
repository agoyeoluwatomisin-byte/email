import { useEffect, useMemo, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    inbound: 0,
    outbound: 0,
    unread: 0,
    total: 0,
    recent: [],
    responseRate: 0,
    dailyTrend: [],
    topContacts: [],
  });
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const analyticsQuery = new URLSearchParams();
        if (dateRange.from) analyticsQuery.set('from', `${dateRange.from}T00:00:00.000Z`);
        if (dateRange.to) analyticsQuery.set('to', `${dateRange.to}T23:59:59.999Z`);
        const [inboundRes, outboundRes, threadsRes, analyticsRes] = await Promise.all([
          fetch('/api/emails?direction=inbound&limit=200'),
          fetch('/api/emails?direction=outbound&limit=200'),
          fetch('/api/threads'),
          fetch(`/api/analytics?${analyticsQuery.toString()}`),
        ]);

        const [inboundData, outboundData, threadsData, analyticsData] = await Promise.all([
          inboundRes.json(),
          outboundRes.json(),
          threadsRes.json(),
          analyticsRes.json(),
        ]);
        setAnalytics(analyticsData);
        const inbound = inboundData.emails || [];
        const outbound = outboundData.emails || [];
        const unread = inbound.filter((email) => !email.read).length;

        const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const end = new Date(start.getTime() + 86400000);

          const inboundCount = inbound.filter((email) => {
            const time = new Date(email.received_at);
            return time >= start && time < end;
          }).length;

          const outboundCount = outbound.filter((email) => {
            const time = new Date(email.received_at);
            return time >= start && time < end;
          }).length;

          return { label, inboundCount, outboundCount };
        });

        const contactMap = {};
        [...inbound, ...outbound].forEach((email) => {
          const target = email.direction === 'inbound' ? email.from_address : email.to_address;
          if (!target) return;
          contactMap[target] = (contactMap[target] || 0) + 1;
        });

        const topContacts = Object.entries(contactMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([address, count]) => ({ address, count }));

        const responseRate = inbound.length
          ? Math.round(
              (outbound.filter((email) => inbound.some((message) => message.from_address === email.to_address)).length / inbound.length) * 100
            )
          : 0;

        setStats({
          inbound: inbound.length,
          outbound: outbound.length,
          unread,
          total: inbound.length + outbound.length,
          recent: [...inbound, ...outbound].sort((a, b) => new Date(b.received_at) - new Date(a.received_at)).slice(0, 8),
          responseRate,
          dailyTrend: lastSevenDays,
          topContacts,
        });
        setThreads(Array.isArray(threadsData.threads) ? threadsData.threads : []);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [dateRange]);

  const updateThreadStatus = async (threadId, status) => {
    const response = await fetch('/api/threads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, status }),
    });

    if (!response.ok) return;
    setThreads((current) => current.map((thread) => thread.threadId === threadId ? { ...thread, status } : thread));
  };

  const statusColumns = [
    { value: 'new', label: 'New' },
    { value: 'in progress', label: 'In progress' },
    { value: 'closed', label: 'Closed' },
  ];

  const cards = useMemo(
    () => [
      { label: 'Received', value: stats.inbound, accent: '#2563eb' },
      { label: 'Sent', value: stats.outbound, accent: '#16a34a' },
      { label: 'Unread', value: stats.unread, accent: '#f59e0b' },
      { label: 'Response rate', value: `${stats.responseRate}%`, accent: '#7c3aed' },
      { label: 'Overdue', value: analytics?.overdueCount ?? 0, accent: '#dc2626' },
      { label: 'CSAT average', value: analytics?.csatAverage ? analytics.csatAverage.toFixed(1) : '—', accent: '#f59e0b' },
    ],
    [stats]
  );

  return (
    <main className="dashboard-page" style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Overview</p>
          <h1 style={styles.title}>Analytics dashboard</h1>
        </div>
        <div style={styles.dateFilters}>
          <label>From <input type="date" value={dateRange.from} onChange={(event) => setDateRange({ ...dateRange, from: event.target.value })} /></label>
          <label>To <input type="date" value={dateRange.to} onChange={(event) => setDateRange({ ...dateRange, to: event.target.value })} /></label>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.loadingCard} />
          <div style={styles.loadingCard} />
          <div style={styles.loadingCard} />
          <div style={styles.loadingCard} />
        </div>
      ) : (
        <>
          <section style={styles.grid}>
            {cards.map((card) => (
              <div key={card.label} style={{ ...styles.card, borderTop: `4px solid ${card.accent}` }}>
                <div style={styles.cardLabel}>{card.label}</div>
                <div style={styles.cardValue}>{card.value}</div>
              </div>
            ))}
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Thread board</h2>
            <div className="dashboard-board" style={styles.board}>
              {statusColumns.map((column) => (
                <div key={column.value} className="boardColumn" style={styles.boardColumn}>
                  <div style={styles.boardHeading}>
                    <span>{column.label}</span>
                    <strong>{threads.filter((thread) => thread.status === column.value).length}</strong>
                  </div>
                  <div style={styles.boardItems}>
                    {threads.filter((thread) => thread.status === column.value).map((thread) => (
                      <div key={thread.threadId} style={styles.threadCard}>
                        <div style={styles.threadCardSubject}>{thread.subject}</div>
                        <div style={styles.threadCardContact}>{thread.contact || 'Unknown contact'}</div>
                        <div style={styles.threadCardMeta}>
                          {thread.unread ? 'Unread' : 'Read'} · {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                        </div>
                        <div style={styles.statusActions}>
                          {statusColumns.filter((option) => option.value !== thread.status).map((option) => (
                            <button key={option.value} type="button" style={styles.statusButton} onClick={() => updateThreadStatus(thread.threadId, option.value)}>
                              Move to {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {threads.filter((thread) => thread.status === column.value).length === 0 && (
                      <p style={styles.empty}>No threads.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {analytics && <section className="dashboard-two-column" style={styles.twoColumn}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Volume over time</h2>
              <VolumeChart volume={analytics.volume || {}} />
            </div>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>By label</h2>
              <BarChart values={analytics.labels || {}} color="#60a5fa" />
            </div>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Agent performance</h2>
              {(analytics.agents || []).length === 0 ? <p style={styles.empty}>No replies in this range.</p> : analytics.agents.map((agent) => <div key={agent.email} style={styles.tagRow}><span>{agent.email}</span><strong>{agent.replies} replies · {agent.resolved} resolved</strong></div>)}
              <p style={styles.chartMeta}>Median resolution: {analytics.medianResolutionMinutes ?? '—'} min · Avg first response: {analytics.averageFirstResponseMinutes ?? '—'} min</p>
            </div>
          </section>}

          <section className="dashboard-two-column" style={styles.twoColumn}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Weekly trend</h2>
              <div style={styles.trendList}>
                {stats.dailyTrend.map((day) => {
                  const maxValue = Math.max(...stats.dailyTrend.flatMap((item) => [item.inboundCount, item.outboundCount]), 1);
                  return (
                    <div key={day.label} style={styles.trendItem}>
                      <div style={styles.trendLabel}>{day.label}</div>
                      <div style={styles.trendBars}>
                        <span style={{ ...styles.trendBar, height: `${(day.inboundCount / maxValue) * 100}%`, background: '#60a5fa' }} />
                        <span style={{ ...styles.trendBar, height: `${(day.outboundCount / maxValue) * 100}%`, background: '#34d399' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Top contacts</h2>
              {stats.topContacts.length === 0 ? (
                <p style={styles.empty}>No contact activity yet.</p>
              ) : (
                <div style={styles.tagList}>
                  {stats.topContacts.map((contact) => (
                    <div key={contact.address} style={styles.tagRow}>
                      <span>{contact.address}</span>
                      <strong>{contact.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Recent activity</h2>
            {stats.recent.length === 0 ? (
              <p style={styles.empty}>No activity yet.</p>
            ) : (
              <div style={styles.tableWrap}>
                {stats.recent.map((item) => (
                  <div key={item.id || `${item.thread_id}-${item.received_at}`} style={styles.row}>
                    <div>
                      <div style={styles.rowTitle}>{item.subject || '(no subject)'}</div>
                      <div style={styles.rowMeta}>
                        {item.direction === 'inbound' ? item.from_address : item.to_address} · {item.direction}
                      </div>
                    </div>
                    <div style={styles.rowDate}>{new Date(item.received_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function VolumeChart({ volume }) {
  const values = Object.entries(volume).sort(([left], [right]) => left.localeCompare(right)).slice(-30);
  const maximum = Math.max(...values.map(([, value]) => value), 1);
  const points = values.map(([, value], index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - (value / maximum) * 90}`).join(' ');
  return <svg viewBox="0 0 100 110" role="img" aria-label="Message volume chart" style={styles.chart}><polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="2" vectorEffect="non-scaling-stroke" />{values.map(([day, value], index) => <text key={day} x={`${(index / Math.max(values.length - 1, 1)) * 100}`} y="108" textAnchor="middle" fontSize="3" fill="#9fb2c6">{day.slice(5)}</text>)}<text x="2" y="8" fontSize="4" fill="#9fb2c6">{maximum}</text></svg>;
}

function BarChart({ values, color }) {
  const entries = Object.entries(values).sort(([, left], [, right]) => right - left).slice(0, 8);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  return <div style={styles.barChart}>{entries.map(([label, value]) => <div key={label} style={styles.barRow}><span style={styles.barLabel}>{label}</span><span style={styles.barTrack}><span style={{ ...styles.barFill, width: `${(value / maximum) * 100}%`, background: color }} /></span><strong>{value}</strong></div>)}</div>;
}

const styles = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '8px 0 32px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateFilters: { display: 'flex', gap: 8, color: '#9fb2c6', fontSize: 12 },
  kicker: { margin: 0, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 12 },
  title: { margin: '4px 0 0', fontSize: 32, color: '#f1f5f9' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 },
  twoColumn: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 },
  board: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, overflowX: 'auto' },
  boardColumn: { minWidth: 220, background: '#0b1220', borderRadius: 12, padding: 12 },
  boardHeading: { display: 'flex', justifyContent: 'space-between', color: '#dbeafe', fontSize: 13, fontWeight: 700, marginBottom: 10 },
  boardItems: { display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 },
  threadCard: { background: '#132337', border: '1px solid #29415b', borderRadius: 10, padding: 10 },
  threadCardSubject: { color: '#f1f5f9', fontWeight: 700, fontSize: 13, overflowWrap: 'anywhere' },
  threadCardContact: { color: '#b7c7d8', fontSize: 11, marginTop: 5, overflowWrap: 'anywhere' },
  threadCardMeta: { color: '#9fb2c6', fontSize: 10, marginTop: 6 },
  statusActions: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  statusButton: { border: '1px solid #36536e', background: '#17283b', color: '#d7e5f2', borderRadius: 6, padding: '5px 6px', cursor: 'pointer', fontSize: 10 },
  card: {
    background: '#102033',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
    padding: 20,
  },
  cardLabel: { color: '#9fb2c6', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  cardValue: { marginTop: 12, fontSize: 32, fontWeight: 700, color: '#f1f5f9' },
  sectionTitle: { margin: '0 0 16px', color: '#f1f5f9', fontSize: 20 },
  chart: { width: '100%', height: 170, overflow: 'visible' },
  barChart: { display: 'flex', flexDirection: 'column', gap: 10 },
  barRow: { display: 'grid', gridTemplateColumns: '90px 1fr 30px', gap: 8, alignItems: 'center', color: '#dbeafe', fontSize: 12 },
  barLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { height: 10, borderRadius: 999, background: '#1e293b', overflow: 'hidden' },
  barFill: { display: 'block', height: '100%', borderRadius: 999 },
  chartMeta: { color: '#9fb2c6', fontSize: 12, marginBottom: 0 },
  loadingWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  loadingCard: { height: 110, borderRadius: 16, background: 'linear-gradient(90deg, #132337 25%, #1a2d42 50%, #132337 75%)', backgroundSize: '200% 100%', animation: 'pulse 1.2s ease-in-out infinite' },
  empty: { color: '#9fb2c6', margin: 0 },
  trendList: { display: 'flex', alignItems: 'end', gap: 12, minHeight: 150 },
  trendItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  trendLabel: { color: '#9fb2c6', fontSize: 11 },
  trendBars: { display: 'flex', alignItems: 'end', justifyContent: 'center', gap: 4, width: '100%', height: 100 },
  trendBar: { display: 'block', width: 10, borderRadius: 999, minHeight: 6 },
  tagList: { display: 'flex', flexDirection: 'column', gap: 10 },
  tagRow: { display: 'flex', justifyContent: 'space-between', gap: 12, border: '1px solid #29415b', borderRadius: 10, padding: '8px 10px', color: '#dbeafe' },
  tableWrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid #29415b',
    borderRadius: 12,
    padding: '12px 14px',
    background: '#132337',
  },
  rowTitle: { fontWeight: 600, color: '#e5eef8' },
  rowMeta: { color: '#9fb2c6', fontSize: 12, marginTop: 4 },
  rowDate: { color: '#b7c7d8', fontSize: 12, whiteSpace: 'nowrap' },
};