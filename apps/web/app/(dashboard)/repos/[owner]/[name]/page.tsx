import { redirect } from "next/navigation";

interface RepoPageProps {
  params: Promise<{ owner: string; name: string }>;
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { owner, name } = await params;
  redirect(`/repos/${owner}/${name}/issues`);
}
