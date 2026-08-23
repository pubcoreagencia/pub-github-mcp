import { GitHubClient } from '../github';
import * as schemas from './definitions';

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export async function handleToolCall(
  name: string,
  args: Record<string, any> = {},
  client: GitHubClient
): Promise<ToolResult> {
  try {
    switch (name) {
      // 1. list_repositories
      case 'list_repositories': {
        const parsed = schemas.ListRepositoriesSchema.parse(args);
        const data = await client.listRepositories(parsed.type, parsed.per_page, parsed.page);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 2. get_repository
      case 'get_repository': {
        const parsed = schemas.GetRepositorySchema.parse(args);
        const data = await client.getRepository(parsed.owner, parsed.repo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 3. get_file
      case 'get_file': {
        const parsed = schemas.GetFileSchema.parse(args);
        const data = await client.getFile(parsed.owner, parsed.repo, parsed.path, parsed.ref);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 4. list_directory
      case 'list_directory': {
        const parsed = schemas.ListDirectorySchema.parse(args);
        const data = await client.listDirectory(parsed.owner, parsed.repo, parsed.path, parsed.ref);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 5. search_code
      case 'search_code': {
        const parsed = schemas.SearchCodeSchema.parse(args);
        const data = await client.searchCode(parsed.query, parsed.repo, parsed.per_page, parsed.page);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 6. get_branch
      case 'get_branch': {
        const parsed = schemas.GetBranchSchema.parse(args);
        const data = await client.getBranch(parsed.owner, parsed.repo, parsed.branch);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 7. list_branches
      case 'list_branches': {
        const parsed = schemas.ListBranchesSchema.parse(args);
        const data = await client.listBranches(parsed.owner, parsed.repo, parsed.protected, parsed.per_page, parsed.page);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 8. get_commits
      case 'get_commits': {
        const parsed = schemas.GetCommitsSchema.parse(args);
        const data = await client.getCommits(parsed.owner, parsed.repo, parsed.sha, parsed.path, parsed.per_page, parsed.page);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 9. get_commit
      case 'get_commit': {
        const parsed = schemas.GetCommitSchema.parse(args);
        const data = await client.getCommit(parsed.owner, parsed.repo, parsed.ref);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 10. get_issue
      case 'get_issue': {
        const parsed = schemas.GetIssueSchema.parse(args);
        const data = await client.getIssue(parsed.owner, parsed.repo, parsed.issue_number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 11. list_issues
      case 'list_issues': {
        const parsed = schemas.ListIssuesSchema.parse(args);
        const data = await client.listIssues(
          parsed.owner,
          parsed.repo,
          parsed.state,
          parsed.labels,
          parsed.per_page,
          parsed.page
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 12. create_issue
      case 'create_issue': {
        const parsed = schemas.CreateIssueSchema.parse(args);
        const data = await client.createIssue(
          parsed.owner,
          parsed.repo,
          parsed.title,
          parsed.body,
          parsed.labels,
          parsed.assignees
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 13. update_issue
      case 'update_issue': {
        const parsed = schemas.UpdateIssueSchema.parse(args);
        const { owner, repo, issue_number, ...update } = parsed;
        const data = await client.updateIssue(owner, repo, issue_number, update);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 14. get_pull_request
      case 'get_pull_request': {
        const parsed = schemas.GetPullRequestSchema.parse(args);
        const data = await client.getPullRequest(parsed.owner, parsed.repo, parsed.pull_number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 15. list_pull_requests
      case 'list_pull_requests': {
        const parsed = schemas.ListPullRequestsSchema.parse(args);
        const data = await client.listPullRequests(
          parsed.owner,
          parsed.repo,
          parsed.state,
          parsed.head,
          parsed.base,
          parsed.per_page,
          parsed.page
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 16. create_pull_request
      case 'create_pull_request': {
        const parsed = schemas.CreatePullRequestSchema.parse(args);
        const data = await client.createPullRequest(
          parsed.owner,
          parsed.repo,
          parsed.title,
          parsed.head,
          parsed.base,
          parsed.body,
          parsed.draft
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 17. get_pull_request_diff
      case 'get_pull_request_diff': {
        const parsed = schemas.GetPullRequestDiffSchema.parse(args);
        const data = await client.getPullRequestDiff(parsed.owner, parsed.repo, parsed.pull_number);
        return {
          content: [
            {
              type: 'text',
              text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 18. create_branch
      case 'create_branch': {
        const parsed = schemas.CreateBranchSchema.parse(args);
        const data = await client.createBranch(parsed.owner, parsed.repo, parsed.branch, parsed.from_branch_or_sha);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 19. create_or_update_file
      case 'create_or_update_file': {
        const parsed = schemas.CreateOrUpdateFileSchema.parse(args);
        const data = await client.createOrUpdateFile(
          parsed.owner,
          parsed.repo,
          parsed.path,
          parsed.message,
          parsed.content,
          parsed.branch,
          parsed.sha
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // 20. create_commit
      case 'create_commit': {
        const parsed = schemas.CreateCommitSchema.parse(args);
        const data = await client.createCommit(parsed.owner, parsed.repo, parsed.message, parsed.tree, parsed.parents);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: '${name}'`,
            },
          ],
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Tool execution error: ${err.message || String(err)}`,
        },
      ],
      isError: true,
    };
  }
}
