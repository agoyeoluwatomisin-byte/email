import { requireSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: { id: session.user.id, email: session.user.email, displayName: session.user.display_name, role: session.user.role } });
}
