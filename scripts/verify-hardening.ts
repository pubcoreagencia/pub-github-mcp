const BASE_URL = process.env.WORKER_URL || 'https://pub-github-mcp.contato-pubcore.workers.dev';
const OLD_TOKEN = process.env.OLD_MCP_AUTH_TOKEN || '';
const NEW_TOKEN = process.env.NEW_MCP_AUTH_TOKEN || '';

async function run() {
  console.log(`\n======================================================`);
  console.log(`PUB GITHUB MCP — Production Hardening & Auth Audit`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passCount = 0;
  let failCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    process.stdout.write(`• Testing [${name}] ... `);
    try {
      await fn();
      console.log(`✅ PASS`);
      passCount++;
    } catch (err: any) {
      console.log(`❌ FAIL: ${err.message}`);
      failCount++;
    }
  }

  // 1. Healthcheck
  await test('GET /health endpoint', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as any;
    if (!data.ok || data.service !== 'pub-github-mcp' || data.allowed_org !== 'pubcoreagencia') {
      throw new Error(`Unexpected payload: ${JSON.stringify(data)}`);
    }
  });

  // 2. Missing Token
  await test('POST /mcp rejects missing auth header (401)', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 3. Old Compromised Token MUST BE INVALIDATED
  if (OLD_TOKEN) {
    await test('POST /mcp rejects OLD compromised token (401)', async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OLD_TOKEN}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      });
      if (res.status !== 401) {
        throw new Error(`CRITICAL: Old token was NOT rejected! Status: ${res.status}`);
      }
    });
  }

  // 4. New Cryptographic Token Validation
  if (!NEW_TOKEN) {
    throw new Error('NEW_MCP_AUTH_TOKEN is required for live verification');
  }

  async function mcpCall(method: string, params?: any) {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NEW_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `hardening-${Date.now()}`,
        method,
        params,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errBody}`);
    }
    return res.json() as any;
  }

  // 5. New Token Handshake
  await test('POST /mcp accepts NEW token (initialize handshake)', async () => {
    const data = await mcpCall('initialize', { protocolVersion: '2024-11-05' });
    if (!data.result || data.result.serverInfo.name !== 'pub-github-mcp') {
      throw new Error(`Invalid result: ${JSON.stringify(data)}`);
    }
  });

  // 6. Tools List
  await test('tools/list with NEW token returns all 20 tools', async () => {
    const data = await mcpCall('tools/list');
    if (!data.result || !Array.isArray(data.result.tools) || data.result.tools.length !== 20) {
      throw new Error(`Expected 20 tools, got ${data.result?.tools?.length}`);
    }
  });

  // 7. Live Read: list_repositories
  await test('Live Read: list_repositories on pubcoreagencia', async () => {
    const data = await mcpCall('tools/call', {
      name: 'list_repositories',
      arguments: { per_page: 5 },
    });
    if (data.result.isError) throw new Error(data.result.content[0].text);
    const repos = JSON.parse(data.result.content[0].text);
    if (!Array.isArray(repos) || repos.length === 0) throw new Error('No repos returned');
  });

  // 8. Live Read: get_repository
  await test('Live Read: get_repository (pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_repository',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom' },
    });
    if (data.result.isError) throw new Error(data.result.content[0].text);
    const repo = JSON.parse(data.result.content[0].text);
    if (repo.name !== 'pub-ecom') throw new Error(`Unexpected repo: ${repo.name}`);
  });

  // 9. Live Read: get_file
  await test('Live Read: get_file (package.json in pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_file',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom', path: 'package.json' },
    });
    if (data.result.isError) throw new Error(data.result.content[0].text);
    const file = JSON.parse(data.result.content[0].text);
    if (!file.content || !file.content.includes('name')) throw new Error('File content missing');
  });

  // 10. Security: Reject External Repository
  await test('Security Allowlist: Reject external repo (octocat/Hello-World)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_repository',
      arguments: { owner: 'octocat', repo: 'Hello-World' },
    });
    if (!data.result.isError) {
      throw new Error('Expected access denied for external repository');
    }
    if (!data.result.content[0].text.includes("Only repositories in the 'pubcoreagencia' organization are permitted")) {
      throw new Error(`Unexpected error: ${data.result.content[0].text}`);
    }
  });

  console.log(`\n======================================================`);
  console.log(`HARDENING SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal hardening test error:', err);
  process.exit(1);
});
