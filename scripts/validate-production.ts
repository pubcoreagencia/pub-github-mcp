const BASE_URL = process.env.WORKER_URL || 'https://pub-github-mcp.contato-pubcore.workers.dev';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

async function run() {
  console.log(`\n========================================`);
  console.log(`PUB GITHUB MCP — Production Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`========================================\n`);

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

  // 2. Auth Rejection (Missing Token)
  await test('POST /mcp rejects missing auth', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 3. Auth Rejection (Invalid Token)
  await test('POST /mcp rejects invalid auth token', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-dummy-token',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  if (!AUTH_TOKEN) {
    console.error('\n⚠️ MCP_AUTH_TOKEN environment variable not set. Skipping authenticated live MCP tests.');
    return;
  }

  async function mcpCall(method: string, params?: any) {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `test-${Date.now()}`,
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

  // 4. MCP Initialize
  await test('MCP initialize protocol handshake', async () => {
    const data = await mcpCall('initialize', { protocolVersion: '2024-11-05' });
    if (!data.result || data.result.serverInfo.name !== 'pub-github-mcp') {
      throw new Error(`Invalid initialize result: ${JSON.stringify(data)}`);
    }
  });

  // 5. MCP tools/list
  await test('MCP tools/list returns all 20 tools', async () => {
    const data = await mcpCall('tools/list');
    if (!data.result || !Array.isArray(data.result.tools) || data.result.tools.length !== 20) {
      throw new Error(`Expected 20 tools, got ${data.result?.tools?.length}`);
    }
  });

  // 6. Real GitHub Read: list_repositories
  await test('Tool: list_repositories on pubcoreagencia', async () => {
    const data = await mcpCall('tools/call', {
      name: 'list_repositories',
      arguments: { per_page: 5 },
    });
    if (data.result.isError) {
      throw new Error(data.result.content[0].text);
    }
    const repos = JSON.parse(data.result.content[0].text);
    if (!Array.isArray(repos) || repos.length === 0) {
      throw new Error('No repositories returned');
    }
    const orgNames = repos.map((r: any) => r.owner?.login?.toLowerCase());
    if (!orgNames.every((org: string) => org === 'pubcoreagencia')) {
      throw new Error(`Found repos not owned by pubcoreagencia: ${orgNames.join(', ')}`);
    }
  });

  // 7. Real GitHub Read: get_repository
  await test('Tool: get_repository (pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_repository',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom' },
    });
    if (data.result.isError) {
      throw new Error(data.result.content[0].text);
    }
    const repo = JSON.parse(data.result.content[0].text);
    if (repo.name !== 'pub-ecom' || repo.owner?.login?.toLowerCase() !== 'pubcoreagencia') {
      throw new Error(`Unexpected repo payload: ${repo.full_name}`);
    }
  });

  // 8. Real GitHub Read: get_file
  await test('Tool: get_file (package.json in pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_file',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom', path: 'package.json' },
    });
    if (data.result.isError) {
      throw new Error(data.result.content[0].text);
    }
    const file = JSON.parse(data.result.content[0].text);
    if (!file.content || !file.content.includes('name')) {
      throw new Error('File content was not properly read or decoded');
    }
  });

  // 9. Real GitHub Read: list_branches
  await test('Tool: list_branches (pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'list_branches',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom' },
    });
    if (data.result.isError) {
      throw new Error(data.result.content[0].text);
    }
    const branches = JSON.parse(data.result.content[0].text);
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error('No branches returned');
    }
  });

  // 10. Real GitHub Read: get_commits
  await test('Tool: get_commits (pubcoreagencia/pub-ecom)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_commits',
      arguments: { owner: 'pubcoreagencia', repo: 'pub-ecom', per_page: 3 },
    });
    if (data.result.isError) {
      throw new Error(data.result.content[0].text);
    }
    const commits = JSON.parse(data.result.content[0].text);
    if (!Array.isArray(commits) || commits.length === 0) {
      throw new Error('No commits returned');
    }
  });

  // 11. Security Test: Reject External Repository
  await test('Security: Reject external repo (octocat/Hello-World)', async () => {
    const data = await mcpCall('tools/call', {
      name: 'get_repository',
      arguments: { owner: 'octocat', repo: 'Hello-World' },
    });
    if (!data.result.isError) {
      throw new Error('Expected tool to fail for external repository, but it succeeded!');
    }
    if (!data.result.content[0].text.includes("Only repositories in the 'pubcoreagencia' organization are permitted")) {
      throw new Error(`Unexpected error message: ${data.result.content[0].text}`);
    }
  });

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
