import { loadSkynetConfig, type RepositoryConfig } from "@skynet/config";
import { getRepositoryByOwnerName, upsertRepository } from "@skynet/db";
import { getGitHubClient, hasGitHubToken } from "@/lib/github/client";
import { fullSyncRepository } from "@/lib/github/sync-issue";

async function onboardRepo(repo: RepositoryConfig): Promise<void> {
  const existing = await getRepositoryByOwnerName(repo.owner, repo.name);
  if (existing) {
    console.log(`[skynet] repo ${repo.owner}/${repo.name} already onboarded, skipping`);
    return;
  }

  const client = getGitHubClient();
  const ghRepo = await client.getRepository(repo.owner, repo.name);

  await upsertRepository({
    githubId: ghRepo.id,
    owner: ghRepo.owner.login,
    name: ghRepo.name,
    description: ghRepo.description,
    isPrivate: ghRepo.private,
    defaultBranch: ghRepo.default_branch,
  });

  console.log(`[skynet] onboarded ${repo.owner}/${repo.name}`);

  if (repo.sync !== false) {
    console.log(`[skynet] syncing issues for ${repo.owner}/${repo.name}...`);
    const count = await fullSyncRepository(repo.owner, repo.name);
    console.log(`[skynet] synced ${count} issues for ${repo.owner}/${repo.name}`);
  }
}

export async function autoOnboardFromConfig(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("[skynet] DATABASE_URL not set, skipping auto-onboard");
    return;
  }

  if (!hasGitHubToken()) {
    console.log("[skynet] GITHUB_TOKEN not set, skipping auto-onboard");
    return;
  }

  const config = loadSkynetConfig();

  if (config.repositories.length === 0) {
    console.log("[skynet] no repositories in skynet.yaml, skipping auto-onboard");
    return;
  }

  console.log(`[skynet] auto-onboarding ${config.repositories.length} repo(s) from skynet.yaml`);

  for (const repo of config.repositories) {
    try {
      await onboardRepo(repo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[skynet] failed to onboard ${repo.owner}/${repo.name}: ${msg}`);
    }
  }
}
