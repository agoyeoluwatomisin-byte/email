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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [inboundRes, outboundRes] = await Promise.all([
          fetch('/api/emails?direction=inbound&limit=200'),
          fetch('/api/emails?direction=outbound&limit=200'),
        ]);

        const [inboundData, outboundData] = await Promise.all([inboundRes.json(), outboundRes.json()]);
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
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Received', value: stats.inbound, accent: '#2563eb' },
      { label: 'Sent', value: stats.outbound, accent: '#16a34a' },
      { label: 'Unread', value: stats.unread, accent: '#f59e0b' },
      { label: 'Response rate', value: `${stats.responseRate}%`, accent: '#7c3aed' },
    ],
    [stats]
  );

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Overview</p>
          <h1 style={styles.title}>Analytics dashboard</h1>
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

          <section style={styles.twoColumn}>
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

const styles = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '8px 0 32px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  kicker: { margin: 0, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 12 },
  title: { margin: '4px 0 0', fontSize: 32, color: '#f1f5f9' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 },
  twoColumn: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 },
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