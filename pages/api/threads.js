import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { requireSession } from '../../lib/auth';
import { Resend } from 'resend';
import { createCsatToken } from '../../lib/csat';

const statuses = ['new', 'in progress', 'closed'];

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { data: emails, error: emailError } = await supabaseAdmin
      .from('emails')
      .select('thread_id, subject, from_address, to_address, received_at, read, direction')
      .order('received_at', { ascending: false })
      .limit(1000);

    const { data: threadRows, error: threadError } = await supabaseAdmin
      .from('threads')
      .select('thread_id, status, claimed_by');

    if (emailError || threadError) {
      console.error('Failed to load threads:', emailError || threadError);
      return res.status(500).json({ error: 'Failed to load threads' });
    }

    const threadState = new Map((threadRows || []).map((thread) => [thread.thread_id, thread]));
    const threads = new Map();
    for (const email of emails || []) {
      const state = threadState.get(email.thread_id) || { status: 'new', claimed_by: null };
      const current = threads.get(email.thread_id);
      if (!current) {
        threads.set(email.thread_id, {
          threadId: email.thread_id,
          status: state.status || 'new',
          claimedBy: state.claimed_by || null,
          subject: email.subject || '(no subject)',
          contact: email.direction === 'inbound' ? email.from_address : email.to_address,
          latestAt: email.received_at,
          unread: email.direction === 'inbound' && !email.read,
          messageCount: 1,
        });
        continue;
      }

      current.messageCount += 1;
      current.unread = current.unread || (email.direction === 'inbound' && !email.read);
      if (new Date(email.received_at) > new Date(current.latestAt)) {
        current.latestAt = email.received_at;
        current.subject = email.subject || current.subject;
        current.contact = email.direction === 'inbound' ? email.from_address : email.to_address;
        current.status = state.status || current.status;
        current.claimedBy = state.claimed_by || current.claimedBy;
      }
    }

    return res.status(200).json({ threads: [...threads.values()] });
  }

  if (req.method === 'PATCH') {
    const { threadId, status, claim } = req.body || {};
    const claimedBy = session.email;
    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' });
    }

    if (claim === true || claim === false) {
      if (claim === true) {
        const { data: current, error: readError } = await supabaseAdmin
          .from('threads')
          .select('claimed_by')
          .eq('thread_id', threadId)
          .maybeSingle();

        if (readError) return res.status(500).json({ error: 'Failed to read thread ownership' });
        if (current?.claimed_by && current.claimed_by !== claimedBy) {
          return res.status(409).json({ error: `Thread is already claimed by ${current.claimed_by}`, claimedBy: current.claimed_by });
        }

        const { error } = await supabaseAdmin.from('threads').update({ claimed_by: claimedBy, updated_at: new Date().toISOString() }).eq('thread_id', threadId).is('claimed_by', null);
        if (error) return res.status(500).json({ error: 'Failed to claim thread' });
        return res.status(200).json({ success: true, threadId, claimedBy });
      }

      const { error } = await supabaseAdmin.from('threads').update({ claimed_by: null, updated_at: new Date().toISOString() }).eq('thread_id', threadId).eq('claimed_by', claimedBy);
      if (error) return res.status(500).json({ error: 'Failed to release thread' });
      return res.status(200).json({ success: true, threadId, claimedBy: null });
    }

    if (!statuses.includes(status)) {
      return res.status(400).json({ error: 'A valid status is required' });
    }

    const { error } = await supabaseAdmin
      .from('threads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('thread_id', threadId);

    if (error) {
      console.error('Failed to update thread status:', error);
      return res.status(500).json({ error: 'Failed to update thread status' });
    }

    if (status === 'closed' && process.env.CSAT_ENABLED === 'true' && process.env.RESEND_FROM_ADDRESS && process.env.RESEND_API_KEY) {
      const { data: inbound } = await supabaseAdmin.from('emails').select('from_address, subject').eq('thread_id', threadId).eq('direction', 'inbound').order('received_at', { ascending: false }).limit(1).maybeSingle();
      if (inbound) {
        const token = createCsatToken(threadId, inbound.from_address);
        const baseUrl = process.env.APP_URL || `https://${req.headers.host}`;
        const links = [1, 2, 3, 4, 5].map((rating) => `${baseUrl}/csat?token=${encodeURIComponent(token)}&rating=${rating}`).join('\n');
        await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM_ADDRESS, to: [inbound.from_address], subject: 'How did we do?', text: `Please rate your support experience from 1 to 5:\n\n${links}` });
      }
    }

    return res.status(200).json({ success: true, threadId, status });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
}
