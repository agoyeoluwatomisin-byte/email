import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../lib/auth';

const statuses = ['new', 'in progress', 'closed'];

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('emails')
      .select('thread_id, status, claimed_by, subject, from_address, to_address, received_at, read, direction')
      .order('received_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Failed to load threads:', error);
      return res.status(500).json({ error: 'Failed to load threads' });
    }

    const threads = new Map();
    for (const email of data || []) {
      const current = threads.get(email.thread_id);
      if (!current) {
        threads.set(email.thread_id, {
          threadId: email.thread_id,
          status: email.status || 'new',
          claimedBy: email.claimed_by || null,
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
        current.status = email.status || current.status;
        current.claimedBy = email.claimed_by || current.claimedBy;
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
          .from('emails')
          .select('claimed_by')
          .eq('thread_id', threadId)
          .limit(1)
          .maybeSingle();

        if (readError) return res.status(500).json({ error: 'Failed to read thread ownership' });
        if (current?.claimed_by && current.claimed_by !== claimedBy) {
          return res.status(409).json({ error: `Thread is already claimed by ${current.claimed_by}`, claimedBy: current.claimed_by });
        }

        const { error } = await supabaseAdmin.from('emails').update({ claimed_by: claimedBy }).eq('thread_id', threadId).is('claimed_by', null);
        if (error) return res.status(500).json({ error: 'Failed to claim thread' });
        return res.status(200).json({ success: true, threadId, claimedBy });
      }

      const { error } = await supabaseAdmin.from('emails').update({ claimed_by: null }).eq('thread_id', threadId).eq('claimed_by', claimedBy);
      if (error) return res.status(500).json({ error: 'Failed to release thread' });
      return res.status(200).json({ success: true, threadId, claimedBy: null });
    }

    if (!statuses.includes(status)) {
      return res.status(400).json({ error: 'A valid status is required' });
    }

    const { error } = await supabaseAdmin
      .from('emails')
      .update({ status })
      .eq('thread_id', threadId);

    if (error) {
      console.error('Failed to update thread status:', error);
      return res.status(500).json({ error: 'Failed to update thread status' });
    }

    return res.status(200).json({ success: true, threadId, status });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
}
