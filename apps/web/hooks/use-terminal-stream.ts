"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TerminalStreamState {
  output: string;
  isStreaming: boolean;
  waitingForInput: boolean;
  status: string;
  exitCode: number | null;
}

export function useTerminalStream(runId: string, enabled = true) {
  const [state, setState] = useState<TerminalStreamState>({
    output: "",
    isStreaming: false,
    waitingForInput: false,
    status: "planning",
    exitCode: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !runId) return;

    setState((prev) => ({ ...prev, isStreaming: true }));

    const es = new EventSource(`/api/agents/${runId}/terminal`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "output") {
          setState((prev) => ({
            ...prev,
            output: prev.output + data.text,
          }));
        }

        if (data.type === "status") {
          setState((prev) => ({
            ...prev,
            status: data.status,
            waitingForInput: data.waitingForInput ?? prev.waitingForInput,
          }));
        }

        if (data.type === "done") {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            status: data.status ?? prev.status,
            exitCode: data.exitCode ?? null,
          }));
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState((prev) => ({ ...prev, isStreaming: false }));
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, enabled]);

  const sendInput = useCallback(
    async (input: string) => {
      await fetch(`/api/agents/${runId}/terminal/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
    },
    [runId],
  );

  const sendInterrupt = useCallback(async () => {
    await fetch(`/api/agents/${runId}/terminal/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "interrupt" }),
    });
  }, [runId]);

  return {
    ...state,
    sendInput,
    sendInterrupt,
  };
}
