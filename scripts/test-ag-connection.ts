const BASE_URL = 'https://pub-github-mcp.contato-pubcore.workers.dev/mcp';
const TOKEN = process.env.PUB_MCP_AUTH_TOKEN || '';

async function run() {
  console.log(`\n======================================================`);
  console.log(`AG Remote Connection Verification — PUB GITHUB MCP`);
  console.log(`Endpoint: ${BASE_URL}`);
  console.log(`======================================================\n`);

  if (!TOKEN) {
    throw new Error('Environment variable PUB_MCP_AUTH_TOKEN is not set.');
  }

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

  async function callMcp(name: string, args: Record<string, any> = {}) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `ag-test-${Date.now()}`,
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    if (data.error) {
      throw new Error(`JSON-RPC Error: ${data.error.message}`);
    }
    if (data.result?.isError) {
      throw new Error(data.result.content?.[0]?.text || 'Tool returned error');
    }
    return JSON.parse(data.result.content[0].text);
  }

  // 1. list_repositories
  await test('1. list_repositories on pubcoreagencia', async () => {
    const repos = await callMcp('list_repositories', { per_page: 10 });
    if (!Array.isArray(repos) || repos.length === 0) {
      throw new Error('No repositories returned');
    }
    console.log(` (Found ${repos.length} repos)`);
  });

  // 2. get_repository pubcoreagencia/pub-ecom
  await test('2. get_repository pubcoreagencia/pub-ecom', async () => {
    const repo = await callMcp('get_repository', { owner: 'pubcoreagencia', repo: 'pub-ecom' });
    if (repo.name !== 'pub-ecom' || repo.owner?.login?.toLowerCase() !== 'pubcoreagencia') {
      throw new Error(`Invalid repo data: ${repo.full_name}`);
    }
  });

  // 3. get_repository pubcoreagencia/pubecomhub
  await test('3. get_repository pubcoreagencia/pubecomhub', async () => {
    const repo = await callMcp('get_repository', { owner: 'pubcoreagencia', repo: 'pubecomhub' });
    if (repo.name !== 'pubecomhub' || repo.owner?.login?.toLowerCase() !== 'pubcoreagencia') {
      throw new Error(`Invalid repo data: ${repo.full_name}`);
    }
  });

  // 4. list_branches pubcoreagencia/pub-ecom
  await test('4. list_branches pubcoreagencia/pub-ecom', async () => {
    const branches = await callMcp('list_branches', { owner: 'pubcoreagencia', repo: 'pub-ecom' });
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error('No branches returned');
    }
    const branchNames = branches.map((b: any) => b.name).join(', ');
    console.log(` (Branches: ${branchNames})`);
  });

  // 5. get_commits pubcoreagencia/pub-ecom
  await test('5. get_commits pubcoreagencia/pub-ecom', async () => {
    const commits = await callMcp('get_commits', { owner: 'pubcoreagencia', repo: 'pub-ecom', per_page: 3 });
    if (!Array.isArray(commits) || commits.length === 0) {
      throw new Error('No commits returned');
    }
    console.log(` (Fetched ${commits.length} commits)`);
  });

  // 6. get_file pubcoreagencia/pub-ecom/package.json
  await test('6. get_file pubcoreagencia/pub-ecom/package.json', async () => {
    const file = await callMcp('get_file', {
      owner: 'pubcoreagencia',
      repo: 'pub-ecom',
      path: 'package.json',
    });
    if (!file.content || !file.content.includes('name')) {
      throw new Error('File content was not properly decoded or empty');
    }
  });

  // 7. Security: Block external repository
  await test('7. External Repository Block (octocat/Hello-World)', async () => {
    try {
      await callMcp('get_repository', { owner: 'octocat', repo: 'Hello-World' });
      throw new Error('Security failure: External repo access was allowed!');
    } catch (err: any) {
      if (err.message.includes("Only repositories in the 'pubcoreagencia' organization are permitted")) {
        // Expected security error
        return;
      }
      throw err;
    }
  });

  console.log(`\n======================================================`);
  console.log(`VERIFICATION SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
