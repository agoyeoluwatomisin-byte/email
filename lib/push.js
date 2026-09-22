import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken = null;
let cachedTokenExpiry = 0;

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase service account env vars are not configured');
  }

  return { projectId, clientEmail, privateKey };
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) {
    return cachedToken;
  }

  const { clientEmail, privateKey } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsignedJwt), privateKey).toString('base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Failed to get FCM access token: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function sendToToken(token, { title, body, data = {} }) {
  const { projectId } = getServiceAccount();
  const accessToken = await getAccessToken();

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high' } },
      },
    }),
  });

  const result = await response.json();
  return { ok: response.ok, status: response.status, result };
}

// Sends a notification to every device registered for a user, and prunes
// tokens FCM reports as no longer valid (uninstalled app, expired token, etc).
export async function sendPushToUser(userId, notification) {
  const { data: tokens, error } = await supabaseAdmin
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to load device tokens:', error);
    return;
  }
  if (!tokens?.length) return;

  await Promise.all(
    tokens.map(async ({ token }) => {
      try {
        const { ok, result } = await sendToToken(token, notification);
        const errorCode = result?.error?.status;
        if (!ok && (errorCode === 'UNREGISTERED' || errorCode === 'NOT_FOUND' || errorCode === 'INVALID_ARGUMENT')) {
          await supabaseAdmin.from('device_tokens').delete().eq('token', token);
        } else if (!ok) {
          console.error('FCM send failed:', result);
        }
      } catch (sendError) {
        console.error('FCM send error:', sendError);
      }
    }),
  );
}

export async function sendPushToUsers(userIds, notification) {
  await Promise.all([...new Set(userIds)].filter(Boolean).map((userId) => sendPushToUser(userId, notification)));
}