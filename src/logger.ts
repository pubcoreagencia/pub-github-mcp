import { StructuredLog } from './types';

const SENSITIVE_PATTERNS = [
  /ghp_[a-zA-Z0-9_]{20,}/gi,
  /gho_[a-zA-Z0-9_]{20,}/gi,
  /github_pat_[a-zA-Z0-9_]{20,}/gi,
  /pub_mcp_sec_[a-zA-Z0-9_]{10,}/gi,
  /Bearer\s+[^\s"']+/gi,
  /"(token|password|secret|authorization|key|access_token|refresh_token)"\s*:\s*"[^"]+"/gi,
];

export function redactSensitive(input: string): string {
  let sanitized = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function logStructured(log: StructuredLog): void {
  const safeLog: StructuredLog = {
    ...log,
    error: log.error ? redactSensitive(log.error) : undefined,
  };
  const jsonStr = JSON.stringify(safeLog);
  console.log(redactSensitive(jsonStr));
}
