import { AppShell } from "@/app/_components/app-shell";
import { MatchResult } from "@/app/_components/match-result";

export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  return (
    <AppShell>
      <MatchResult matchId={matchId} />
    </AppShell>
  );
}
