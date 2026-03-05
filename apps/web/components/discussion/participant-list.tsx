interface Participant {
  githubId: number;
  username: string;
  avatarUrl: string | null;
}

interface ParticipantListProps {
  participants: Participant[];
}

export function ParticipantList({ participants }: ParticipantListProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-[var(--text-quaternary)]">
        {participants.length} participant{participants.length !== 1 ? "s" : ""}
      </span>
      <div className="flex -space-x-1.5">
        {participants.slice(0, 8).map((p) => (
          <div key={p.githubId} title={p.username}>
            {p.avatarUrl ? (
              <img
                src={p.avatarUrl}
                alt={p.username}
                className="h-6 w-6 rounded-full border-2 border-[var(--bg-primary)]"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--bg-elevated)] text-[10px] font-bold text-[var(--text-tertiary)]">
                {p.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {participants.length > 8 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--bg-elevated)] text-[10px] font-medium text-[var(--text-tertiary)]">
            +{participants.length - 8}
          </div>
        )}
      </div>
    </div>
  );
}
