import { Env } from './types';
import { GitHubClient } from './github';
import { TOOL_DEFINITIONS, handleToolCall } from './tools';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class McpServer {
  private github: GitHubClient;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.github = new GitHubClient(env);
  }

  public async handleJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const { id, method, params } = request;

    // Handle notifications (no id)
    if (id === undefined && method === 'notifications/initialized') {
      return null;
    }

    try {
      switch (method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: this.env.SERVICE_NAME || 'pub-github-mcp',
                version: '1.0.0',
              },
              instructions: 'PUB Core GitHub MCP Server for pubcoreagencia organization repositories.',
            },
          };
        }

        case 'ping': {
          return {
            jsonrpc: '2.0',
            id,
            result: {},
          };
        }

        case 'tools/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: TOOL_DEFINITIONS,
            },
          };
        }

        case 'tools/call': {
          if (!params || typeof params.name !== 'string') {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32602,
                message: 'Invalid params: "name" is required for tools/call',
              },
            };
          }

          const toolResult = await handleToolCall(params.name, params.arguments || {}, this.github);
          return {
            jsonrpc: '2.0',
            id,
            result: toolResult,
          };
        }

        default: {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
        }
      }
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message || 'Internal JSON-RPC error',
          data: err.details,
        },
      };
    }
  }
}
