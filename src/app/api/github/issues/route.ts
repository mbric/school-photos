import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOctokit, getGitHubRepo } from "@/lib/github";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const state = (searchParams.get("state") || "open") as "open" | "closed";
  const label = searchParams.get("label") || "";
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    let searchQuery = `repo:${owner}/${repo} type:issue state:${state}`;
    if (label) searchQuery += ` label:"${label}"`;
    if (q) searchQuery += ` ${q}`;

    const [issuesRes, openRes, closedRes] = await Promise.all([
      octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 30,
        page,
        sort: "created",
        order: "desc",
      }),
      octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} type:issue state:open`,
        per_page: 1,
      }),
      octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} type:issue state:closed`,
        per_page: 1,
      }),
    ]);

    return NextResponse.json({
      issues: issuesRes.data.items,
      total: issuesRes.data.total_count,
      openCount: openRes.data.total_count,
      closedCount: closedRes.data.total_count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { title, body: issueBody, labels } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title: title.trim(),
      body: issueBody?.trim() || undefined,
      labels: labels || [],
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
