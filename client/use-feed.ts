// Lightweight bounded timeline observer for tool bubbles, inter-agent message envelopes, and selected chat.
import { useEffect, useState } from "react";
import type { PaseoAgent, PaseoApi } from "./paseo-types";

const MAX_TIMELINE_SUBS = 8;
const ENVELOPE_TTL_MS = 6_500;
const CHAT_TAIL_LIMIT = 24;

export interface ActiveEnvelope {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: number;
}

export interface ChatBubbleItem {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  text: string;
}

const TOOL_WORDS: ReadonlyArray<[RegExp, string]> = [
  [/^(bash|shell|exec|terminal|run)\b|\b(command|terminal)\b/, "Bash"],
  [/^(read|view|cat)\b/, "Read"],
  [/^(edit|multiedit|write|patch|apply)\b/, "Edit"],
  [/^(grep|glob|search|find|ls)\b/, "Find"],
  [/^web|\b(fetch|browser|navigate|screenshot)\b/, "Web"],
  [/\b(send agent prompt|agent message|message)\b/, "Msg"],
  [/^(task|agent)$|\b(create agent|subagent|delegate)\b/, "Agent"],
  [/^todo|\bplan\b/, "Plan"],
];

function shortToolWord(rawName: string): string {
  const last = rawName.split("__").filter(Boolean).pop() ?? rawName;
  const clean = last.replace(/_/g, " ").trim().toLowerCase();
  for (const [pattern, word] of TOOL_WORDS) {
    if (pattern.test(clean)) return word;
  }
  const first = (clean.split(/\s+/)[0] ?? "tool").slice(0, 8);
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function firstLine(text: string, max = 96): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[#>*\-\s`]+/, "").trim())
      .find((l) => l.length > 0) ?? "";
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

function parseTimelineItems(
  agentId: string,
  items: readonly unknown[],
): { toolWord: string | null; envelopes: ActiveEnvelope[]; chat: ChatBubbleItem[] } {
  let toolWord: string | null = null;
  const envelopes: ActiveEnvelope[] = [];
  const chat: ChatBubbleItem[] = [];
  const now = Date.now();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    const type = typeof raw.type === "string" ? raw.type : "";
    const id = typeof raw.id === "string" ? raw.id : `${agentId}-${i}`;

    if (type === "tool_call") {
      const name = typeof raw.name === "string" ? raw.name : "tool";
      const status = typeof raw.status === "string" ? raw.status : "";
      const callId = typeof raw.callId === "string" ? raw.callId : "";
      if (status === "running") {
        toolWord = shortToolWord(name);
      }
      // Paseo daemon stamps agent-to-agent messages with `paseo-agent-message:` callIds.
      if (callId.startsWith("paseo-agent-message:")) {
        const detail = (raw.detail ?? raw.input) as Record<string, unknown> | undefined;
        const fromId = typeof detail?.fromAgentId === "string" ? detail.fromAgentId : null;
        const text = typeof detail?.text === "string" ? firstLine(detail.text, 48) : "Message";
        if (fromId) {
          envelopes.push({ id: callId, fromId, toId: agentId, text, at: now });
        }
      }
      chat.push({
        id,
        role: "tool",
        text: `${shortToolWord(name)}${status ? ` (${status})` : ""}`,
      });
    } else if (type === "assistant_message" || type === "user_message") {
      const text = typeof raw.text === "string" ? firstLine(raw.text, 140) : "";
      if (text) {
        chat.push({
          id,
          role: type === "user_message" ? "user" : "assistant",
          text,
        });
      }
    } else if (type === "error") {
      const message = typeof raw.message === "string" ? firstLine(raw.message, 120) : "Error";
      chat.push({ id, role: "system", text: message });
    }
  }

  return { toolWord, envelopes, chat: chat.slice(-14) };
}

export interface LiveFeedState {
  toolByAgent: ReadonlyMap<string, string>;
  envelopes: readonly ActiveEnvelope[];
}

/**
 * Watches up to 8 currently active agents' timelines for live tool bubbles and flying
 * inter-agent message envelopes.
 */
export function useWorkshopFeed(
  paseo: PaseoApi,
  agents: ReadonlyMap<string, PaseoAgent>,
): LiveFeedState {
  const [toolByAgent, setToolByAgent] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [envelopes, setEnvelopes] = useState<readonly ActiveEnvelope[]>([]);

  // Select up to 8 active (running / initializing / waiting) agents to watch.
  const watchedIds = [...agents.values()]
    .filter(
      (a) =>
        !a.archivedAt &&
        (a.status === "running" || a.status === "initializing" || a.pendingPermissions.length > 0),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_TIMELINE_SUBS)
    .map((a) => a.id);

  const watchKey = watchedIds.join(",");

  useEffect(() => {
    const ids = watchKey ? watchKey.split(",") : [];
    if (ids.length === 0) {
      setToolByAgent(new Map());
      return;
    }

    let alive = true;
    const unsubs: Array<() => void> = [];

    for (const id of ids) {
      const unsub = paseo.agents.ref(id).timeline.subscribe((event) => {
        if (!alive) return;
        const payload = event as unknown as Record<string, unknown>;
        const item = (payload.item ?? payload.entry ?? payload) as Record<string, unknown> | null;
        if (!item || typeof item !== "object") return;
        const { toolWord, envelopes: found } = parseTimelineItems(id, [item]);
        if (toolWord) {
          setToolByAgent((prev) => {
            if (prev.get(id) === toolWord) return prev;
            const next = new Map(prev);
            next.set(id, toolWord);
            return next;
          });
        } else if (item.type === "tool_call" && item.status !== "running") {
          setToolByAgent((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }
        if (found.length > 0) {
          setEnvelopes((prev) => {
            const merged = [...prev];
            for (const env of found) {
              if (!merged.some((e) => e.id === env.id)) merged.push(env);
            }
            return merged.slice(-12);
          });
        }
      });
      unsubs.push(unsub);
    }

    const gc = setInterval(() => {
      if (!alive) return;
      const cutoff = Date.now() - ENVELOPE_TTL_MS;
      setEnvelopes((prev) => {
        const next = prev.filter((e) => e.at >= cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 1_500);

    return () => {
      alive = false;
      clearInterval(gc);
      for (const unsub of unsubs) unsub();
    };
  }, [paseo, watchKey]);

  return { toolByAgent, envelopes };
}

/** Fetches the recent read-only chat tail for the currently selected agent. */
export function useSelectedChat(
  paseo: PaseoApi,
  agentId: string | null,
  refreshToken: number,
): { items: readonly ChatBubbleItem[]; loading: boolean } {
  const [items, setItems] = useState<readonly ChatBubbleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void paseo.agents
      .ref(agentId)
      .timeline.refetch({ direction: "tail", limit: CHAT_TAIL_LIMIT, projection: "projected" })
      .then((res) => {
        if (!alive) return;
        const entries = (res as unknown as { entries?: Array<{ item?: unknown }> }).entries ?? [];
        const rawItems = entries.map((e) => e.item ?? e);
        setItems(parseTimelineItems(agentId, rawItems).chat);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [paseo, agentId, refreshToken]);

  return { items, loading };
}
