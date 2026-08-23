import { Env } from './types';
import { validateAuth } from './auth';
import { McpServer, JsonRpcRequest } from './mcp-server';
import { logStructured } from './logger';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Healthcheck endpoint (Public)
    if (path === '/health' || path === '/healthz') {
      return jsonResponse({
        ok: true,
        service: env.SERVICE_NAME || 'pub-github-mcp',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'production',
        allowed_org: env.ALLOWED_ORG || 'pubcoreagencia',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. MCP Endpoint (/mcp or root /)
    if (path === '/mcp' || path === '/') {
      // Validate authentication
      const authResult = validateAuth(request, env);
      if (!authResult.authorized) {
        logStructured({
          timestamp: new Date().toISOString(),
          service: 'pub-github-mcp',
          operation: `${request.method} ${path}`,
          status: 'error',
          statusCode: 401,
          durationMs: 0,
          error: authResult.error || 'Unauthorized',
        });
        return jsonResponse(
          {
            error: {
              code: -32000,
              message: authResult.error || 'Unauthorized. Valid Bearer token required.',
            },
          },
          401
        );
      }

      const server = new McpServer(env);

      // Handle POST: Direct JSON-RPC MCP Requests
      if (request.method === 'POST') {
        try {
          const body = await request.json();

          // Handle batch JSON-RPC requests
          if (Array.isArray(body)) {
            const results = await Promise.all(
              body.map((item) => server.handleJsonRpc(item as JsonRpcRequest))
            );
            const nonNullResults = results.filter((res) => res !== null);
            return jsonResponse(nonNullResults);
          }

          // Handle single JSON-RPC request
          const result = await server.handleJsonRpc(body as JsonRpcRequest);
          if (result === null) {
            // Notification response
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }

          return jsonResponse(result);
        } catch (err: any) {
          logStructured({
            timestamp: new Date().toISOString(),
            service: 'pub-github-mcp',
            operation: 'POST /mcp',
            status: 'error',
            statusCode: 400,
            durationMs: 0,
            error: `Invalid JSON payload: ${err.message}`,
          });

          return jsonResponse(
            {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32700,
                message: 'Parse error: Invalid JSON was received by the server.',
              },
            },
            400
          );
        }
      }

      // Handle GET: SSE (Server-Sent Events) Stream
      if (request.method === 'GET') {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const initEvent = `event: endpoint\ndata: ${url.origin}/mcp\n\n`;
            controller.enqueue(encoder.encode(initEvent));
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            ...CORS_HEADERS,
          },
        });
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    // 4. Default 404
    return jsonResponse(
      {
        error: 'Not Found',
        message: 'Valid endpoints are GET /health and POST /mcp',
      },
      404
    );
  },
};
