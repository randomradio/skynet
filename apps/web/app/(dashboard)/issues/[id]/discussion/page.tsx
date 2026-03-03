"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChatArea } from "@/components/discussion/chat-area";
import { LivingDocumentPanel } from "@/components/discussion/living-document-panel";
import { FinalizeButton } from "@/components/discussion/finalize-button";

interface Message {
  id: string;
  authorType: "user" | "ai";
  content: string;
  createdAt: string;
}

interface Discussion {
  id: string;
  synthesizedDocument: string | null;
  lastSynthesizedAt: string | null;
  finalized: boolean;
}

export default function DiscussionPage() {
  const params = useParams<{ id: string }>();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/issues/${params.id}/discussion`);
        const data = await res.json();
        if (data.error) {
          setError(data.error.message);
        } else {
          setDiscussion(data.discussion);
          setMessages(data.messages ?? []);
        }
      } catch {
        setError("Failed to load discussion");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return <div className="text-sm text-slate-500">Loading discussion...</div>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={`/issues/${params.id}`} className="text-sm text-blue-600 hover:underline">
          Back to issue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <Link href={`/issues/${params.id}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to issue
        </Link>
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
        <div className="flex w-3/5 flex-col border-r">
          <ChatArea
            issueId={params.id}
            initialMessages={messages}
            finalized={discussion?.finalized ?? false}
          />
        </div>

        {/* Living document - 40% */}
        <div className="w-2/5 bg-white">
          <LivingDocumentPanel
            issueId={params.id}
            document={discussion?.synthesizedDocument ?? null}
            lastSynthesizedAt={discussion?.lastSynthesizedAt ?? null}
            finalized={discussion?.finalized ?? false}
          />
        </div>
      </div>
    </div>
  );
}
