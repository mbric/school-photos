import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOctokit, getGitHubRepo } from "@/lib/github";

export async function POST(
  request: NextRequest,
  { params }: { params: { issueNumber: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const issue_number = parseInt(params.issueNumber);
  const body = await request.json();

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: body.body.trim(),
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
