export interface Env {
  SERVICE_NAME?: string;
  ALLOWED_ORG?: string;
  ENVIRONMENT?: string;
  GITHUB_TOKEN: string;
  MCP_AUTH_TOKEN: string;
}

export interface StructuredLog {
  timestamp: string;
  service: string;
  tool?: string;
  owner?: string;
  repo?: string;
  operation?: string;
  status: 'success' | 'error' | 'forbidden' | 'rate_limited';
  statusCode?: number;
  durationMs: number;
  error?: string;
}
