"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChatArea, type AuthorProfile } from "@/components/discussion/chat-area";
import { LivingDocumentPanel } from "@/components/discussion/living-document-panel";
import { FinalizeButton } from "@/components/discussion/finalize-button";
import { ParticipantList } from "@/components/discussion/participant-list";

interface Message {
  id: string;
  authorId?: string | null;
  authorType: "user" | "ai" | "system";
  content: string;
  createdAt: string;
  parentId?: string | null;
  threadCount?: number;
}

interface Participant {
  githubId: number;
  username: string;
  avatarUrl: string | null;
}

interface Discussion {
  id: string;
  issueId: string;
  participants: Participant[];
  synthesizedDocument: string | null;
  lastSynthesizedAt: string | null;
  finalized: boolean;
}

export default function DiscussionPage() {
  const params = useParams<{ id: string }>();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoContext, setRepoContext] = useState<{ owner: string; name: string } | undefined>();

  // Get current user ID from cookie/session
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Load discussion
        const res = await fetch(`/api/issues/${params.id}/discussion`);
        const data = await res.json();
        if (data.error) {
          setError(data.error.message);
          return;
        }
        setDiscussion(data.discussion);
        setMessages(data.messages ?? []);
        setAuthors(data.authors ?? {});

        // Load issue to get repoContext
        const issueRes = await fetch(`/api/issues/${params.id}`);
        const issueData = await issueRes.json();
        if (issueData.issue) {
          setRepoContext({
            owner: issueData.issue.repoOwner,
            name: issueData.issue.repoName,
          });
        }
      } catch {
        setError("Failed to load discussion");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  // Try to extract current user from cookie
  useEffect(() => {
    try {
      const cookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith("skynet_user="));
      if (cookie) {
        const val = decodeURIComponent(cookie.split("=")[1]!);
        const parsed = JSON.parse(val);
        if (parsed.sub) {
          setCurrentUserId(parsed.sub);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (loading) {
    return <div className="text-sm text-[var(--text-quaternary)]">Loading discussion...</div>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={`/issues/${params.id}`} className="text-sm text-[var(--accent-blue)] hover:underline">
          Back to issue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href={`/issues/${params.id}`} className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-blue)]">
            &larr; Back to issue
          </Link>
          <ParticipantList participants={discussion?.participants ?? []} />
        </div>
        <FinalizeButton
          issueId={params.id}
          finalized={discussion?.finalized ?? false}
          onFinalized={(doc) => {
            setDiscussion((prev) =>
              prev ? { ...prev, finalized: true, synthesizedDocument: doc } : prev,
            );
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area - 60% */}
        <div className="flex w-3/5 flex-col border-r border-[var(--border-subtle)]">
          <ChatArea
            issueId={params.id}
            initialMessages={messages}
            finalized={discussion?.finalized ?? false}
            currentUserId={currentUserId}
            authors={authors}
            repoContext={repoContext}
            participants={discussion?.participants ?? []}
          />
        </div>

        {/* Living document - 40% */}
        <div className="w-2/5 bg-[var(--bg-primary)]">
          <LivingDocumentPanel
            issueId={params.id}
            document={discussion?.synthesizedDocument ?? null}
            lastSynthesizedAt={discussion?.lastSynthesizedAt ?? null}
            finalized={discussion?.finalized ?? false}
            repoContext={repoContext}
          />
        </div>
      </div>
    </div>
  );
}
