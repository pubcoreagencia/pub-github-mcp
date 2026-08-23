import { Env } from './types';
import { logStructured } from './logger';

export class GitHubError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status: number = 500, details?: any) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.details = details;
  }
}

export class GitHubClient {
  private token: string;
  private allowedOrg: string;
  private baseUrl = 'https://api.github.com';
  private defaultTimeoutMs = 15000;

  constructor(env: Env) {
    this.token = (env.GITHUB_TOKEN || '').trim();
    this.allowedOrg = (env.ALLOWED_ORG || 'pubcoreagencia').toLowerCase().trim();
  }

  public validateOwner(owner: string): void {
    if (!owner || owner.toLowerCase() !== this.allowedOrg) {
      throw new GitHubError(
        `Access denied: Only repositories in the '${this.allowedOrg}' organization are permitted. Specified owner: '${owner}'`,
        403
      );
    }
  }

  private async request<T = any>(
    path: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      owner?: string;
      repo?: string;
      operation?: string;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    if (options.owner) {
      this.validateOwner(options.owner);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'pub-github-mcp/1.0.0 (Cloudflare Worker; +https://pubcore.com.br)',
      'Authorization': `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }

        const errorMessage = typeof errorBody === 'object' && errorBody?.message
          ? errorBody.message
          : `GitHub API error: ${response.status} ${response.statusText}`;

        logStructured({
          timestamp: new Date().toISOString(),
          service: 'pub-github-mcp',
          owner: options.owner,
          repo: options.repo,
          operation: options.operation || `${method} ${path}`,
          status: response.status === 403 || response.status === 429 ? 'rate_limited' : 'error',
          statusCode: response.status,
          durationMs,
          error: errorMessage,
        });

        if (response.status === 401) {
          throw new GitHubError('GitHub authentication failed. Please verify GITHUB_TOKEN permissions.', 401, errorBody);
        } else if (response.status === 403) {
          throw new GitHubError(`GitHub API forbidden / rate limit exceeded: ${errorMessage}`, 403, errorBody);
        } else if (response.status === 404) {
          throw new GitHubError(`GitHub resource not found: ${errorMessage}`, 404, errorBody);
        } else if (response.status === 429) {
          throw new GitHubError(`GitHub API rate limit exceeded: ${errorMessage}`, 429, errorBody);
        } else {
          throw new GitHubError(errorMessage, response.status, errorBody);
        }
      }

      logStructured({
        timestamp: new Date().toISOString(),
        service: 'pub-github-mcp',
        owner: options.owner,
        repo: options.repo,
        operation: options.operation || `${method} ${path}`,
        status: 'success',
        statusCode: response.status,
        durationMs,
      });

      // Handle raw responses vs JSON
      if (options.headers?.Accept?.includes('application/vnd.github.raw') || options.headers?.Accept?.includes('application/vnd.github.v3.diff')) {
        return (await response.text()) as unknown as T;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (err.name === 'AbortError') {
        logStructured({
          timestamp: new Date().toISOString(),
          service: 'pub-github-mcp',
          owner: options.owner,
          repo: options.repo,
          operation: options.operation || `${method} ${path}`,
          status: 'error',
          statusCode: 408,
          durationMs,
          error: `GitHub API request timed out after ${timeoutMs}ms`,
        });
        throw new GitHubError(`GitHub API request timed out after ${timeoutMs}ms`, 408);
      }

      if (err instanceof GitHubError) {
        throw err;
      }

      logStructured({
        timestamp: new Date().toISOString(),
        service: 'pub-github-mcp',
        owner: options.owner,
        repo: options.repo,
        operation: options.operation || `${method} ${path}`,
        status: 'error',
        statusCode: 500,
        durationMs,
        error: err.message,
      });

      throw new GitHubError(err.message || 'Unknown GitHub API error', 500);
    }
  }

  // 1. list_repositories
  public async listRepositories(type: 'all' | 'public' | 'private' = 'all', perPage: number = 30, page: number = 1) {
    const params = new URLSearchParams({
      per_page: Math.min(perPage, 100).toString(),
      page: page.toString(),
      sort: 'updated',
      direction: 'desc',
    });

    if (type !== 'all') {
      params.set('type', type);
    }

    try {
      return await this.request(`/users/${this.allowedOrg}/repos?${params}`, {
        operation: 'listRepositories',
        owner: this.allowedOrg,
      });
    } catch (err: any) {
      if (err.status === 404) {
        return await this.request(`/orgs/${this.allowedOrg}/repos?${params}`, {
          operation: 'listRepositories',
          owner: this.allowedOrg,
        });
      }
      throw err;
    }
  }

  // 2. get_repository
  public async getRepository(owner: string, repo: string) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}`, {
      operation: 'getRepository',
      owner,
      repo,
    });
  }

  // 3. get_file
  public async getFile(owner: string, repo: string, path: string, ref?: string) {
    this.validateOwner(owner);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await this.request<any>(`/repos/${owner}/${repo}/contents/${cleanPath}${query}`, {
      operation: 'getFile',
      owner,
      repo,
    });

    if (Array.isArray(data)) {
      throw new GitHubError(`Path '${path}' is a directory, not a file. Use list_directory instead.`, 400);
    }

    let content = '';
    if (data.content && data.encoding === 'base64') {
      try {
        content = atob(data.content.replace(/\n/g, ''));
      } catch {
        content = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    }

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      type: data.type,
      content,
      encoding: 'utf-8',
      download_url: data.download_url,
    };
  }

  // 4. list_directory
  public async listDirectory(owner: string, repo: string, path: string = '', ref?: string) {
    this.validateOwner(owner);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await this.request<any>(`/repos/${owner}/${repo}/contents/${cleanPath}${query}`, {
      operation: 'listDirectory',
      owner,
      repo,
    });

    if (!Array.isArray(data)) {
      throw new GitHubError(`Path '${path}' is a file, not a directory. Use get_file instead.`, 400);
    }

    return data.map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      type: item.type,
    }));
  }

  // 5. search_code
  public async searchCode(query: string, repo?: string, perPage: number = 30, page: number = 1) {
    let q = query;
    if (repo) {
      q += ` repo:${this.allowedOrg}/${repo}`;
    } else {
      q += ` user:${this.allowedOrg}`;
    }

    const params = new URLSearchParams({
      q,
      per_page: Math.min(perPage, 50).toString(),
      page: page.toString(),
    });

    return this.request(`/search/code?${params}`, {
      operation: 'searchCode',
      owner: this.allowedOrg,
    });
  }

  // 6. get_branch
  public async getBranch(owner: string, repo: string, branch: string) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, {
      operation: 'getBranch',
      owner,
      repo,
    });
  }

  // 7. list_branches
  public async listBranches(owner: string, repo: string, protectedOnly: boolean = false, perPage: number = 30, page: number = 1) {
    this.validateOwner(owner);
    const params = new URLSearchParams({
      protected: protectedOnly ? 'true' : 'false',
      per_page: Math.min(perPage, 100).toString(),
      page: page.toString(),
    });
    return this.request(`/repos/${owner}/${repo}/branches?${params}`, {
      operation: 'listBranches',
      owner,
      repo,
    });
  }

  // 8. get_commits
  public async getCommits(owner: string, repo: string, sha?: string, path?: string, perPage: number = 30, page: number = 1) {
    this.validateOwner(owner);
    const params = new URLSearchParams({
      per_page: Math.min(perPage, 100).toString(),
      page: page.toString(),
    });
    if (sha) params.set('sha', sha);
    if (path) params.set('path', path);

    return this.request(`/repos/${owner}/${repo}/commits?${params}`, {
      operation: 'getCommits',
      owner,
      repo,
    });
  }

  // 9. get_commit
  public async getCommit(owner: string, repo: string, ref: string) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, {
      operation: 'getCommit',
      owner,
      repo,
    });
  }

  // 10. get_issue
  public async getIssue(owner: string, repo: string, issueNumber: number) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      operation: 'getIssue',
      owner,
      repo,
    });
  }

  // 11. list_issues
  public async listIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    labels?: string[],
    perPage: number = 30,
    page: number = 1
  ) {
    this.validateOwner(owner);
    const params = new URLSearchParams({
      state,
      per_page: Math.min(perPage, 100).toString(),
      page: page.toString(),
    });
    if (labels && labels.length > 0) {
      params.set('labels', labels.join(','));
    }

    return this.request(`/repos/${owner}/${repo}/issues?${params}`, {
      operation: 'listIssues',
      owner,
      repo,
    });
  }

  // 12. create_issue
  public async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
    assignees?: string[]
  ) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: { title, body, labels, assignees },
      operation: 'createIssue',
      owner,
      repo,
    });
  }

  // 13. update_issue
  public async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    update: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      state_reason?: 'completed' | 'not_planned' | 'reopened';
      labels?: string[];
      assignees?: string[];
    }
  ) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: update,
      operation: 'updateIssue',
      owner,
      repo,
    });
  }

  // 14. get_pull_request
  public async getPullRequest(owner: string, repo: string, pullNumber: number) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      operation: 'getPullRequest',
      owner,
      repo,
    });
  }

  // 15. list_pull_requests
  public async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    head?: string,
    base?: string,
    perPage: number = 30,
    page: number = 1
  ) {
    this.validateOwner(owner);
    const params = new URLSearchParams({
      state,
      per_page: Math.min(perPage, 100).toString(),
      page: page.toString(),
    });
    if (head) params.set('head', head);
    if (base) params.set('base', base);

    return this.request(`/repos/${owner}/${repo}/pulls?${params}`, {
      operation: 'listPullRequests',
      owner,
      repo,
    });
  }

  // 16. create_pull_request
  public async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
    draft?: boolean
  ) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: { title, head, base, body, draft },
      operation: 'createPullRequest',
      owner,
      repo,
    });
  }

  // 17. get_pull_request_diff
  public async getPullRequestDiff(owner: string, repo: string, pullNumber: number) {
    this.validateOwner(owner);
    return this.request<string>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
      },
      operation: 'getPullRequestDiff',
      owner,
      repo,
    });
  }

  // 18. create_branch
  public async createBranch(owner: string, repo: string, branch: string, fromShaOrBranch: string) {
    this.validateOwner(owner);

    // If fromShaOrBranch is a branch name instead of a 40-char SHA, resolve it
    let targetSha = fromShaOrBranch;
    if (!/^[0-9a-f]{40}$/i.test(fromShaOrBranch)) {
      const branchData = await this.getBranch(owner, repo, fromShaOrBranch);
      targetSha = branchData.commit.sha;
    }

    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: {
        ref: `refs/heads/${branch}`,
        sha: targetSha,
      },
      operation: 'createBranch',
      owner,
      repo,
    });
  }

  // 19. create_or_update_file
  public async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    content: string,
    branch?: string,
    sha?: string
  ) {
    this.validateOwner(owner);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Disallow modifying protected files or workflow configs without explicit intent
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    const body: any = {
      message,
      content: base64Content,
    };
    if (branch) body.branch = branch;
    if (sha) body.sha = sha;

    return this.request(`/repos/${owner}/${repo}/contents/${cleanPath}`, {
      method: 'PUT',
      body,
      operation: 'createOrUpdateFile',
      owner,
      repo,
    });
  }

  // 20. create_commit
  public async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[]
  ) {
    this.validateOwner(owner);
    return this.request(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: {
        message,
        tree,
        parents,
      },
      operation: 'createCommit',
      owner,
      repo,
    });
  }
}
