import { Octokit } from "@octokit/rest";

export function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is not set");
  return new Octokit({ auth: token });
}

export function getGitHubRepo(): { owner: string; repo: string } {
  const value = process.env.GITHUB_REPO;
  if (!value) throw new Error("GITHUB_REPO environment variable is not set");
  const [owner, repo] = value.split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO must be in 'owner/repo' format");
  return { owner, repo };
}
