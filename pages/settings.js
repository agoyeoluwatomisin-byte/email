import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, Tabs, Textarea, Toggle } from '../components/ui';
import { useAppSession } from '../context/AppSessionProvider';
import { useToast } from '../components/ui/Toast';

const sections = [
  ['profile', 'Profile & signature'],
  ['notifications', 'Notifications'],
  ['security', 'Security'],
  ['canned', 'Canned responses'],
  ['automation', 'Automation & hours'],
  ['weekly', 'Weekly report'],
  ['admin', 'Admin tools'],
];

export default function Settings() {
  const router = useRouter();
  const { role } = useAppSession();
  const section = typeof router.query.section === 'string' ? router.query.section : 'profile';
  const visibleSections = role === 'admin' ? sections : sections.filter(([value]) => value !== 'admin');
  const activeSection = visibleSections.some(([value]) => value === section) ? section : 'profile';
  const setSection = (value) => router.push({ pathname: '/settings', query: { section: value } }, undefined, { shallow: true });

  return (
    <div className="content-page settings-page">
      <PageHeader title="Settings" description="Tune the workspace to fit the way your team works." />
      <div className="settings-tabs"><Tabs items={visibleSections.map(([value, label]) => ({ value, label }))} value={activeSection} onChange={setSection} /></div>
      {activeSection === 'profile' && <ProfileSection />}
      {activeSection === 'notifications' && <NotificationsSection />}
      {activeSection === 'security' && <SecuritySection />}
      {activeSection === 'canned' && <CannedSection />}
      {activeSection === 'automation' && <AutomationSection />}
      {activeSection === 'weekly' && <WeeklySection />}
      {activeSection === 'admin' && <AdminSection />}
    </div>
  );
}

function ProfileSection() {
  const { toast } = useToast();
  const [signature, setSignature] = useState({ signature_html: '', signature_text: '' });
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/signature').then((response) => response.json()).then((data) => setSignature(data.signature || signature)).finally(() => setLoading(false)); }, []);
  const save = async (event) => { event.preventDefault(); const response = await fetch('/api/signature', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signature) }); toast(response.ok ? 'Signature saved.' : 'Unable to save signature.', response.ok ? 'success' : 'error'); };
  return <SettingsCard title="Profile and signature" description="Your signature is appended to outbound replies.">{loading ? <Skeleton /> : <form className="settings-form" onSubmit={save}><Textarea label="Signature HTML" value={signature.signature_html || ''} onChange={(event) => setSignature({ ...signature, signature_html: event.target.value })} /><Textarea label="Plain-text fallback" value={signature.signature_text || ''} onChange={(event) => setSignature({ ...signature, signature_text: event.target.value })} /><SaveButton /></form>}</SettingsCard>;
}

function NotificationsSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ webhook_url: '', browser_notifications: false });
  useEffect(() => { fetch('/api/integrations').then((response) => response.json()).then((data) => setSettings(data.settings || settings)); }, []);
  const save = async (event) => { event.preventDefault(); const response = await fetch('/api/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookUrl: settings.webhook_url, browserNotifications: settings.browser_notifications }) }); toast(response.ok ? 'Notification settings saved.' : 'Unable to save settings.', response.ok ? 'success' : 'error'); };
  return <SettingsCard title="Notifications" description="Choose where new activity should surface."><form className="settings-form" onSubmit={save}><Toggle checked={Boolean(settings.browser_notifications)} onChange={(value) => setSettings({ ...settings, browser_notifications: value })} label="Browser notifications" /><Input label="Outbound webhook URL" type="url" value={settings.webhook_url || ''} onChange={(event) => setSettings({ ...settings, webhook_url: event.target.value })} placeholder="https://example.com/webhooks/mail" /><SaveButton /></form></SettingsCard>;
}

function SecuritySection() {
  const { toast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const save = async (event) => { event.preventDefault(); if (form.newPassword !== form.confirmPassword) return toast('New passwords do not match.', 'error'); const response = await fetch('/api/security/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) }); toast(response.ok ? 'Password changed.' : (await response.json().catch(() => ({}))).error || 'Unable to change password.', response.ok ? 'success' : 'error'); };
  return <SettingsCard title="Security" description="Change your password and review account protection."><form className="settings-form settings-form-narrow" onSubmit={save}><Input label="Current password" type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /><Input label="New password" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} minLength={12} required /><Input label="Confirm new password" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required /><SaveButton label="Change password" /></form><div className="settings-link-grid"><a className="ui-button ui-button-secondary" href="/api/security/sessions">Active sessions</a><span className="ui-muted">Two-factor setup is available through your account security provider.</span></div></SettingsCard>;
}

function CannedSection() {
  const { toast } = useToast();
  const [responses, setResponses] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'General', body: '' });
  const load = () => fetch('/api/canned-responses').then((response) => response.json()).then((data) => setResponses(data.responses || []));
  useEffect(() => { load(); }, []);
  const save = async (event) => { event.preventDefault(); const response = await fetch('/api/canned-responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (response.ok) { setForm({ title: '', category: 'General', body: '' }); await load(); toast('Canned response saved.', 'success'); } else toast('Unable to save canned response.', 'error'); };
  const remove = async (id) => { await fetch(`/api/canned-responses?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); await load(); toast('Canned response deleted.'); };
  return <SettingsCard title="Canned responses" description="Create reusable replies with variables such as {{customer_name}}."><form className="settings-form" onSubmit={save}><Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /><Input label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /><Textarea label="Response" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /><SaveButton label="Add response" /></form><div className="settings-record-list">{responses.length ? responses.map((response) => <div className="settings-record" key={response.id}><span><strong>{response.title}</strong><small>{response.category}</small></span><Button variant="danger" onClick={() => remove(response.id)}>Delete</Button></div>) : <EmptyState title="No canned responses" message="Add a response above to speed up common replies." />}</div></SettingsCard>;
}

function AutomationSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ businessHours: [], slaTargets: [], mailboxSettings: [] });
  useEffect(() => { fetch('/api/automation-settings').then((response) => response.json()).then(setSettings); }, []);
  const save = async (event) => { event.preventDefault(); const response = await fetch('/api/automation-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); toast(response.ok ? 'Automation settings saved.' : 'Unable to save automation settings.', response.ok ? 'success' : 'error'); };
  return <SettingsCard title="Automation and hours" description="Set the operating window used by SLA calculations."><form className="settings-form" onSubmit={save}><Input label="Timezone" value={settings.businessHours?.[0]?.timezone || 'Africa/Lagos'} onChange={(event) => setSettings({ ...settings, businessHours: settings.businessHours.map((item) => ({ ...item, timezone: event.target.value })) })} /><div className="settings-info-grid"><span><strong>{settings.businessHours?.length || 0}</strong><small>business hour rules</small></span><span><strong>{settings.slaTargets?.length || 0}</strong><small>SLA targets</small></span><span><strong>{settings.mailboxSettings?.length || 0}</strong><small>mailboxes</small></span></div><SaveButton /></form></SettingsCard>;
}

function WeeklySection() {
  const { toast } = useToast();
  const [report, setReport] = useState({ enabled: false, recipient_emails: [], weekday: 1, hour: 9 });
  useEffect(() => { fetch('/api/reports').then((response) => response.json()).then((data) => setReport(data.settings || report)); }, []);
  const save = async (event) => { event.preventDefault(); const response = await fetch('/api/reports', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...report, recipientEmails: report.recipient_emails }) }); toast(response.ok ? 'Weekly report settings saved.' : 'Unable to save report settings.', response.ok ? 'success' : 'error'); };
  return <SettingsCard title="Weekly report" description="Send a scheduled summary to selected recipients."><form className="settings-form" onSubmit={save}><Toggle checked={Boolean(report.enabled)} onChange={(value) => setReport({ ...report, enabled: value })} label="Send weekly summary" /><Input label="Recipients" value={(report.recipient_emails || []).join(', ')} onChange={(event) => setReport({ ...report, recipient_emails: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="team@example.com" /><Select label="Day" value={report.weekday} onChange={(event) => setReport({ ...report, weekday: Number(event.target.value) })}><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option><option value={0}>Sunday</option></Select><Input label="UTC hour" type="number" min="0" max="23" value={report.hour} onChange={(event) => setReport({ ...report, hour: Number(event.target.value) })} /><SaveButton label="Save report settings" /></form></SettingsCard>;
}

function AdminSection() {
  return <SettingsCard title="Admin tools" description="Manage workspace access and operational controls."><div className="settings-link-grid"><a className="ui-button ui-button-secondary" href="/users">Users</a><a className="ui-button ui-button-secondary" href="/api/audit">Audit log</a><a className="ui-button ui-button-secondary" href="/api/sender-lists">Sender lists</a><a className="ui-button ui-button-secondary" href="/api/widgets">Contact widgets</a></div></SettingsCard>;
}

function SettingsCard({ title, description, children }) {
  return <Card className="settings-card"><div className="settings-card-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="ui-badge">Settings</span></div>{children}</Card>;
}

function SaveButton({ label = 'Save changes' }) {
  return <div className="settings-save-bar"><Button type="submit" variant="primary">{label}</Button></div>;
}
