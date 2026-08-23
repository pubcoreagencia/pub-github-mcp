import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import { Env } from '../src/types';
import { redactSensitive } from '../src/logger';
import { GitHubClient } from '../src/github';
import { handleToolCall } from '../src/tools/handlers';

const mockEnv: Env = {
  SERVICE_NAME: 'pub-github-mcp',
  ALLOWED_ORG: 'pubcoreagencia',
  ENVIRONMENT: 'test',
  GITHUB_TOKEN: 'gho_mock_secret_token_123456789012345',
  MCP_AUTH_TOKEN: 'test-mcp-bearer-token-987654321',
};

const mockExecutionContext: any = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe('PUB GITHUB MCP Worker Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Healthcheck Test
  it('GET /health returns 200 with service info and no secrets', async () => {
    const req = new Request('https://pub-github-mcp.workers.dev/health', {
      method: 'GET',
    });

    const res = await worker.fetch(req, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.service).toBe('pub-github-mcp');
    expect(body.allowed_org).toBe('pubcoreagencia');
    expect(body.environment).toBe('test');

    // Ensure no secrets are leaked
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(mockEnv.GITHUB_TOKEN);
    expect(bodyStr).not.toContain(mockEnv.MCP_AUTH_TOKEN);
  });

  // 2. Auth Tests
  it('POST /mcp rejects missing Authorization header with 401', async () => {
    const req = new Request('https://pub-github-mcp.workers.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });

    const res = await worker.fetch(req, mockEnv, mockExecutionContext);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.message).toContain('Missing Bearer token');
  });

  it('POST /mcp rejects invalid Bearer token with 401', async () => {
    const req = new Request('https://pub-github-mcp.workers.dev/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-token-value',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });

    const res = await worker.fetch(req, mockEnv, mockExecutionContext);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.message).toContain('Invalid authentication token');
  });

  it('POST /mcp accepts valid Bearer token and handles initialize', async () => {
    const req = new Request('https://pub-github-mcp.workers.dev/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockEnv.MCP_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe('init-1');
    expect(body.result.serverInfo.name).toBe('pub-github-mcp');
    expect(body.result.protocolVersion).toBe('2024-11-05');
  });

  // 3. Tools Listing Test
  it('POST /mcp handles tools/list and returns all 20 tools', async () => {
    const req = new Request('https://pub-github-mcp.workers.dev/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockEnv.MCP_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-1',
        method: 'tools/list',
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.result.tools).toBeDefined();
    expect(body.result.tools.length).toBe(20);

    const toolNames = body.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('list_repositories');
    expect(toolNames).toContain('get_repository');
    expect(toolNames).toContain('get_file');
    expect(toolNames).toContain('list_directory');
    expect(toolNames).toContain('search_code');
    expect(toolNames).toContain('get_branch');
    expect(toolNames).toContain('list_branches');
    expect(toolNames).toContain('get_commits');
    expect(toolNames).toContain('get_commit');
    expect(toolNames).toContain('get_issue');
    expect(toolNames).toContain('list_issues');
    expect(toolNames).toContain('create_issue');
    expect(toolNames).toContain('update_issue');
    expect(toolNames).toContain('get_pull_request');
    expect(toolNames).toContain('list_pull_requests');
    expect(toolNames).toContain('create_pull_request');
    expect(toolNames).toContain('get_pull_request_diff');
    expect(toolNames).toContain('create_branch');
    expect(toolNames).toContain('create_or_update_file');
    expect(toolNames).toContain('create_commit');
  });

  // 4. Security: Scope & Allowlist Test
  it('Rejects any repository outside pubcoreagencia with clear MCP error', async () => {
    const client = new GitHubClient(mockEnv);

    const result = await handleToolCall(
      'get_repository',
      { owner: 'other-owner', repo: 'some-repo' },
      client
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Only repositories in the 'pubcoreagencia' organization are permitted");
  });

  // 5. GitHub Client Read Operations (Mocked)
  it('get_file decodes base64 content properly', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('/contents/README.md')) {
        return new Response(
          JSON.stringify({
            name: 'README.md',
            path: 'README.md',
            sha: 'abcdef1234567890',
            size: 26,
            type: 'file',
            content: btoa('# PUB Core Repository\n'),
            encoding: 'base64',
          }),
          { status: 200 }
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await handleToolCall(
      'get_file',
      { owner: 'pubcoreagencia', repo: 'pub-ecom', path: 'README.md' },
      client
    );

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe('README.md');
    expect(data.content).toBe('# PUB Core Repository\n');
  });

  it('list_directory returns files list', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify([
          { name: 'src', path: 'src', sha: '111', size: 0, type: 'dir' },
          { name: 'package.json', path: 'package.json', sha: '222', size: 100, type: 'file' },
        ]),
        { status: 200 }
      );
    });

    const result = await handleToolCall(
      'list_directory',
      { owner: 'pubcoreagencia', repo: 'pub-ecom', path: '' },
      client
    );

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBe(2);
    expect(data[0].name).toBe('src');
    expect(data[1].name).toBe('package.json');
  });

  it('list_branches returns branch details', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify([
          { name: 'main', commit: { sha: 'sha-main' }, protected: true },
          { name: 'dev', commit: { sha: 'sha-dev' }, protected: false },
        ]),
        { status: 200 }
      );
    });

    const result = await handleToolCall(
      'list_branches',
      { owner: 'pubcoreagencia', repo: 'pub-ecom' },
      client
    );

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBe(2);
    expect(data[0].name).toBe('main');
  });

  it('search_code injects org prefix and returns matching items', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      expect(url.toString()).toContain('user%3Apubcoreagencia');
      return new Response(
        JSON.stringify({
          total_count: 1,
          items: [{ name: 'index.ts', path: 'src/index.ts' }],
        }),
        { status: 200 }
      );
    });

    const result = await handleToolCall(
      'search_code',
      { query: 'handleToolCall' },
      client
    );

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.total_count).toBe(1);
  });

  // 6. Write operations (Unit tests with mocks)
  it('create_issue sends POST with correct payload', async () => {
    const client = new GitHubClient(mockEnv);

    let requestBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, opts: any) => {
      requestBody = JSON.parse(opts.body);
      return new Response(
        JSON.stringify({ id: 101, number: 1, title: requestBody.title, state: 'open' }),
        { status: 201 }
      );
    });

    const result = await handleToolCall(
      'create_issue',
      {
        owner: 'pubcoreagencia',
        repo: 'pub-ecom',
        title: 'New Feature Issue',
        body: 'Issue description text',
        labels: ['enhancement'],
      },
      client
    );

    expect(result.isError).toBeFalsy();
    expect(requestBody.title).toBe('New Feature Issue');
    expect(requestBody.labels).toEqual(['enhancement']);
  });

  it('create_or_update_file encodes base64 and calls contents API', async () => {
    const client = new GitHubClient(mockEnv);

    let requestBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, opts: any) => {
      requestBody = JSON.parse(opts.body);
      return new Response(
        JSON.stringify({ content: { name: 'config.json', path: 'config.json', sha: 'new-sha' } }),
        { status: 200 }
      );
    });

    const result = await handleToolCall(
      'create_or_update_file',
      {
        owner: 'pubcoreagencia',
        repo: 'pub-ecom',
        path: 'config.json',
        message: 'Update config',
        content: '{"key": "value"}',
      },
      client
    );

    expect(result.isError).toBeFalsy();
    expect(requestBody.message).toBe('Update config');
    expect(atob(requestBody.content)).toBe('{"key": "value"}');
  });

  it('get_pull_request_diff returns diff text correctly', async () => {
    const client = new GitHubClient(mockEnv);

    const sampleDiff = `diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(sampleDiff, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    const result = await handleToolCall(
      'get_pull_request_diff',
      { owner: 'pubcoreagencia', repo: 'pub-ecom', pull_number: 1 },
      client
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('-old');
    expect(result.content[0].text).toContain('+new');
  });

  // 7. Error status code handlers (401, 403, 404, 429)
  it('Handles GitHub 401 error gracefully', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    });

    const result = await handleToolCall(
      'list_repositories',
      { type: 'all' },
      client
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('GitHub authentication failed');
  });

  it('Handles GitHub 403 & 429 rate limit error gracefully', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 429 });
    });

    const result = await handleToolCall(
      'list_repositories',
      { type: 'all' },
      client
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('rate limit exceeded');
  });

  it('Handles GitHub 404 resource not found error gracefully', async () => {
    const client = new GitHubClient(mockEnv);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    });

    const result = await handleToolCall(
      'get_file',
      { owner: 'pubcoreagencia', repo: 'pub-ecom', path: 'non-existent.txt' },
      client
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('resource not found');
  });

  // 8. Secret Redaction Tests
  it('Redacts sensitive tokens from logs and outputs', () => {
    const logWithToken = `Error connecting with token gho_1234567890abcdef1234567890abcdef and Bearer secret-mcp-key-12345678`;
    const redacted = redactSensitive(logWithToken);
    expect(redacted).not.toContain('gho_1234567890abcdef1234567890abcdef');
    expect(redacted).not.toContain('secret-mcp-key-12345678');
    expect(redacted).toContain('[REDACTED]');
  });
});
