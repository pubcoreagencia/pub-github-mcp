import { StructuredLog } from './types';

const SENSITIVE_PATTERNS = [
  /ghp_[a-zA-Z0-9_]{30,}/gi,
  /gho_[a-zA-Z0-9_]{30,}/gi,
  /github_pat_[a-zA-Z0-9_]{30,}/gi,
  /Bearer\s+[a-zA-Z0-9_.-]{10,}/gi,
  /"token"\s*:\s*"[^"]+"/gi,
  /"password"\s*:\s*"[^"]+"/gi,
  /"secret"\s*:\s*"[^"]+"/gi,
  /"authorization"\s*:\s*"[^"]+"/gi,
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
  console.log(JSON.stringify(safeLog));
}
