import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAdminToken(secret) {
  const payload = encode(JSON.stringify({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminToken(token, secret) {
  if (!token || !token.includes('.')) return false;
  const [payload, suppliedSignature] = token.split('.');
  const expectedSignature = signature(payload, secret);

  if (suppliedSignature.length !== expectedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'admin' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function safePasswordEqual(candidate, configured) {
  const left = crypto.createHash('sha256').update(candidate).digest();
  const right = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(left, right);
}
