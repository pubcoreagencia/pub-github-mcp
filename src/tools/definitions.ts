import { z } from 'zod';

export const ListRepositoriesSchema = z.object({
  type: z.enum(['all', 'public', 'private']).default('all'),
  per_page: z.number().int().min(1).max(100).default(30),
  page: z.number().int().min(1).default(1),
});

export const GetRepositorySchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
});

export const GetFileSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  ref: z.string().optional(),
});

export const ListDirectorySchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().default(''),
  ref: z.string().optional(),
});

export const SearchCodeSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  repo: z.string().optional(),
  per_page: z.number().int().min(1).max(50).default(30),
  page: z.number().int().min(1).default(1),
});

export const GetBranchSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().min(1, 'Branch name is required'),
});

export const ListBranchesSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  protected: z.boolean().default(false),
  per_page: z.number().int().min(1).max(100).default(30),
  page: z.number().int().min(1).default(1),
});

export const GetCommitsSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  sha: z.string().optional(),
  path: z.string().optional(),
  per_page: z.number().int().min(1).max(100).default(30),
  page: z.number().int().min(1).default(1),
});

export const GetCommitSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  ref: z.string().min(1, 'Commit SHA or ref is required'),
});

export const GetIssueSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be positive'),
});

export const ListIssuesSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  state: z.enum(['open', 'closed', 'all']).default('open'),
  labels: z.array(z.string()).optional(),
  per_page: z.number().int().min(1).max(100).default(30),
  page: z.number().int().min(1).default(1),
});

export const CreateIssueSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  title: z.string().min(1, 'Issue title is required'),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

export const UpdateIssueSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be positive'),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(['open', 'closed']).optional(),
  state_reason: z.enum(['completed', 'not_planned', 'reopened']).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

export const GetPullRequestSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  pull_number: z.number().int().min(1, 'Pull request number must be positive'),
});

export const ListPullRequestsSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  state: z.enum(['open', 'closed', 'all']).default('open'),
  head: z.string().optional(),
  base: z.string().optional(),
  per_page: z.number().int().min(1).max(100).default(30),
  page: z.number().int().min(1).default(1),
});

export const CreatePullRequestSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  title: z.string().min(1, 'Pull request title is required'),
  head: z.string().min(1, 'Head branch is required'),
  base: z.string().min(1, 'Base branch is required'),
  body: z.string().optional(),
  draft: z.boolean().default(false),
});

export const GetPullRequestDiffSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  pull_number: z.number().int().min(1, 'Pull request number must be positive'),
});

export const CreateBranchSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().min(1, 'New branch name is required'),
  from_branch_or_sha: z.string().min(1, 'Base branch or SHA is required'),
});

export const CreateOrUpdateFileSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  message: z.string().min(1, 'Commit message is required'),
  content: z.string(),
  branch: z.string().optional(),
  sha: z.string().optional(),
});

export const CreateCommitSchema = z.object({
  owner: z.string().default('pubcoreagencia'),
  repo: z.string().min(1, 'Repository name is required'),
  message: z.string().min(1, 'Commit message is required'),
  tree: z.string().min(1, 'Tree SHA is required'),
  parents: z.array(z.string()).min(1, 'At least one parent commit SHA is required'),
});

export const TOOL_DEFINITIONS = [
  {
    name: 'list_repositories',
    description: 'List all permitted repositories belonging to the pubcoreagencia organization.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['all', 'public', 'private'], description: 'Filter by repository visibility (default: all)' },
        per_page: { type: 'number', description: 'Number of results per page (max 100, default 30)' },
        page: { type: 'number', description: 'Page number for pagination (default 1)' },
      },
    },
  },
  {
    name: 'get_repository',
    description: 'Get detailed information about a specific permitted repository in the pubcoreagencia organization.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'get_file',
    description: 'Get file content and metadata from a permitted repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'Path to the file' },
        ref: { type: 'string', description: 'Branch, tag, or commit SHA' },
      },
      required: ['repo', 'path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List directory contents in a permitted repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'Directory path (empty for root)' },
        ref: { type: 'string', description: 'Branch, tag, or commit SHA' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code inside permitted repositories in the pubcoreagencia organization.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords or terms' },
        repo: { type: 'string', description: 'Optional specific repo to search within' },
        per_page: { type: 'number', description: 'Results per page (max 50, default 30)' },
        page: { type: 'number', description: 'Page number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_branch',
    description: 'Get information about a specific branch in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'Branch name' },
      },
      required: ['repo', 'branch'],
    },
  },
  {
    name: 'list_branches',
    description: 'List branches in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        protected: { type: 'boolean', description: 'Filter only protected branches' },
        per_page: { type: 'number', description: 'Results per page (max 100, default 30)' },
        page: { type: 'number', description: 'Page number' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'get_commits',
    description: 'List commits in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        sha: { type: 'string', description: 'Branch or commit SHA to start from' },
        path: { type: 'string', description: 'Filter commits affecting this file path' },
        per_page: { type: 'number', description: 'Results per page (max 100, default 30)' },
        page: { type: 'number', description: 'Page number' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'get_commit',
    description: 'Get detailed information for a specific commit.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        ref: { type: 'string', description: 'Commit SHA or ref' },
      },
      required: ['repo', 'ref'],
    },
  },
  {
    name: 'get_issue',
    description: 'Get details of a specific issue.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: { type: 'number', description: 'Issue number' },
      },
      required: ['repo', 'issue_number'],
    },
  },
  {
    name: 'list_issues',
    description: 'List issues in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state (default: open)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'List of label names' },
        per_page: { type: 'number', description: 'Results per page (max 100, default 30)' },
        page: { type: 'number', description: 'Page number' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'create_issue',
    description: 'Create a new issue in a permitted repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Title of the issue' },
        body: { type: 'string', description: 'Body text of the issue' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
      },
      required: ['repo', 'title'],
    },
  },
  {
    name: 'update_issue',
    description: 'Update an existing issue.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: { type: 'number', description: 'Issue number' },
        title: { type: 'string', description: 'Updated title' },
        body: { type: 'string', description: 'Updated body' },
        state: { type: 'string', enum: ['open', 'closed'], description: 'Issue state' },
        state_reason: { type: 'string', enum: ['completed', 'not_planned', 'reopened'], description: 'Reason for state change' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Updated labels' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Updated assignees' },
      },
      required: ['repo', 'issue_number'],
    },
  },
  {
    name: 'get_pull_request',
    description: 'Get details of a specific pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        pull_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['repo', 'pull_number'],
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'PR state (default: open)' },
        head: { type: 'string', description: 'Filter by head branch / user:branch' },
        base: { type: 'string', description: 'Filter by base branch' },
        per_page: { type: 'number', description: 'Results per page (max 100, default 30)' },
        page: { type: 'number', description: 'Page number' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a new pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'PR Title' },
        head: { type: 'string', description: 'Branch containing your changes' },
        base: { type: 'string', description: 'Branch you want to merge into' },
        body: { type: 'string', description: 'PR description body' },
        draft: { type: 'boolean', description: 'Whether to create as draft PR' },
      },
      required: ['repo', 'title', 'head', 'base'],
    },
  },
  {
    name: 'get_pull_request_diff',
    description: 'Get unified diff content for a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        pull_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['repo', 'pull_number'],
    },
  },
  {
    name: 'create_branch',
    description: 'Create a new branch from a base branch or commit SHA.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'Name of the new branch to create' },
        from_branch_or_sha: { type: 'string', description: 'Base branch or commit SHA' },
      },
      required: ['repo', 'branch', 'from_branch_or_sha'],
    },
  },
  {
    name: 'create_or_update_file',
    description: 'Create or update a file in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'Path to the file' },
        message: { type: 'string', description: 'Commit message' },
        content: { type: 'string', description: 'New text content of the file' },
        branch: { type: 'string', description: 'Branch name (defaults to default branch)' },
        sha: { type: 'string', description: 'Blob SHA if updating an existing file' },
      },
      required: ['repo', 'path', 'message', 'content'],
    },
  },
  {
    name: 'create_commit',
    description: 'Create a Git commit using git data objects.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (must be pubcoreagencia)' },
        repo: { type: 'string', description: 'Repository name' },
        message: { type: 'string', description: 'Commit message' },
        tree: { type: 'string', description: 'Tree SHA' },
        parents: { type: 'array', items: { type: 'string' }, description: 'Parent commit SHAs' },
      },
      required: ['repo', 'message', 'tree', 'parents'],
    },
  },
];
