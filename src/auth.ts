import { Env } from './types';

export function validateAuth(request: Request, env: Env): { authorized: boolean; error?: string } {
  const expectedToken = (env.MCP_AUTH_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  if (!expectedToken) {
    return { authorized: false, error: 'Server authentication configuration missing' };
  }

  const authHeader = request.headers.get('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    // Fallback: Check for ?token= query parameter (useful for SSE streams)
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      token = queryToken.trim();
    }
  }

  const cleanToken = token.trim().replace(/^["']|["']$/g, '');

  if (!cleanToken) {
    return { authorized: false, error: 'Missing Bearer token in Authorization header' };
  }

  if (!timingSafeEqual(cleanToken, expectedToken)) {
    return { authorized: false, error: 'Invalid authentication token' };
  }

  return { authorized: true };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
