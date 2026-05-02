import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOctokit, getGitHubRepo } from "@/lib/github";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const octokit = getOctokit();
    const { owner, repo } = getGitHubRepo();

    const { data: labels } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    return NextResponse.json({ labels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
