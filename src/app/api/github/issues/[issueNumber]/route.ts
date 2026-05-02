import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOctokit, getGitHubRepo } from "@/lib/github";

export async function GET(
  _request: NextRequest,
  { params }: { params: { issueNumber: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const issue_number = parseInt(params.issueNumber);

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    const [issueRes, commentsRes] = await Promise.all([
      octokit.rest.issues.get({ owner, repo, issue_number }),
      octokit.rest.issues.listComments({ owner, repo, issue_number, per_page: 100 }),
    ]);

    return NextResponse.json({
      issue: issueRes.data,
      comments: commentsRes.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { issueNumber: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const issue_number = parseInt(params.issueNumber);
  const body = await request.json();

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    const { data: issue } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number,
      ...body,
    });

    return NextResponse.json({ issue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
