// Bounded timeline observer for live tool words, inter-agent message envelopes,
// Big Screen latest conversation previews, and clean conversation-focused Detail Dock chat.
import { useEffect, useState } from "react";
import type { PaseoAgent, PaseoApi } from "./paseo-types";

const MAX_TIMELINE_SUBS = 8;
const ENVELOPE_TTL_MS = 6_500;
const CHAT_TAIL_LIMIT = 120;
const PREVIEW_TAIL_LIMIT = 40;

const TOOL_STATUS_ZH: Record<string, string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  canceled: "已取消",
};

export interface ActiveEnvelope {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: number;
}

export interface ChatBubbleItem {
  id: string;
  role: "user" | "assistant" | "tool" | "system" | "delegation";
  text: string;
}

export interface LatestMessagePreview {
  role: "user" | "assistant" | "system" | "delegation";
  text: string;
}

const TOOL_WORDS: ReadonlyArray<[RegExp, string]> = [
  [/^(bash|shell|exec|terminal|run)\b|\b(command|terminal)\b/, "执行命令"],
  [/^(read|view|cat)\b/, "读取"],
  [/^(edit|multiedit|write|patch|apply)\b/, "编辑"],
  [/^(grep|glob|search|find|ls)\b/, "搜索"],
  [/^web|\b(fetch|browser|navigate|screenshot)\b/, "网页"],
  [/\b(send agent prompt|agent message|message)\b/, "发信"],
  [/^(task|agent)$|\b(create agent|subagent|delegate)\b/, "调用智能体"],
  [/^todo|\bplan\b/, "规划"],
];

function shortToolWord(rawName: string): string {
  const last = rawName.split("__").filter(Boolean).pop() ?? rawName;
  const clean = last.replace(/_/g, " ").trim().toLowerCase();
  for (const [pattern, word] of TOOL_WORDS) {
    if (pattern.test(clean)) return word;
  }
  const first = (clean.split(/\s+/)[0] ?? "工具").slice(0, 8);
  return first;
}

function cleanReadableText(text: string, max = 380): string {
  const lines: string[] = [];
  let fenced = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const cleaned = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<file:\/\/[^>]*>|file:\/\/[^\s)]*/g, "")
      .replace(/(\*\*|__|`+)/g, "")
      .replace(/^\s*#{1,6}\s+/, "")
      .trim();
    if (cleaned) lines.push(cleaned);
    if (lines.join("\n").length >= max) break;
  }
  const joined = lines.join("\n").trim();
  if (!joined) return "";
  return joined.length <= max ? joined : `${joined.slice(0, max - 1).trimEnd()}…`;
}

export function parseTimelineItems(
  agentId: string,
  items: readonly unknown[],
): {
  toolWord: string | null;
  envelopes: ActiveEnvelope[];
  conversation: ChatBubbleItem[];
  tools: ChatBubbleItem[];
  latestPreview: LatestMessagePreview | null;
} {
  let toolWord: string | null = null;
  const envelopes: ActiveEnvelope[] = [];
  const conversation: ChatBubbleItem[] = [];
  const tools: ChatBubbleItem[] = [];
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
      if (callId.startsWith("paseo-agent-message:") || raw.agentMessage) {
        const agentMsg = raw.agentMessage as
          | { sender?: { id?: string }; text?: string }
          | undefined;
        const detail = (raw.detail ?? raw.input) as Record<string, unknown> | undefined;
        const fromId =
          (typeof agentMsg?.sender?.id === "string" ? agentMsg.sender.id : null) ??
          (typeof detail?.fromAgentId === "string" ? detail.fromAgentId : null);
        const rawMsgText =
          (typeof agentMsg?.text === "string" ? agentMsg.text : null) ??
          (typeof detail?.text === "string" ? detail.text : null) ??
          "智能体消息";
        const msgText = cleanReadableText(rawMsgText, 120) || "智能体消息";
        if (fromId) {
          envelopes.push({ id: callId || id, fromId, toId: agentId, text: msgText, at: now });
          conversation.push({
            id,
            role: "delegation",
            text: `收到其他智能体消息：${msgText}`,
          });
        }
      } else {
        const zhStatus = status ? (TOOL_STATUS_ZH[status] ?? status) : "";
        tools.push({
          id,
          role: "tool",
          text: `${shortToolWord(name)}${zhStatus ? ` · ${zhStatus}` : ""}`,
        });
      }
    } else if (type === "assistant_message" || type === "user_message") {
      const text = typeof raw.text === "string" ? cleanReadableText(raw.text, 380) : "";
      if (text) {
        conversation.push({
          id,
          role: type === "user_message" ? "user" : "assistant",
          text,
        });
      }
    } else if (type === "error") {
      const message = typeof raw.message === "string" ? cleanReadableText(raw.message, 200) : "发生错误";
      conversation.push({ id, role: "system", text: message });
    }
  }

  const recentConv = conversation.slice(-18);
  const lastConv = recentConv[recentConv.length - 1];
  const latestPreview: LatestMessagePreview | null = lastConv
    ? {
        role:
          lastConv.role === "user" ||
          lastConv.role === "assistant" ||
          lastConv.role === "delegation"
            ? lastConv.role
            : "system",
        text: lastConv.text.length > 110 ? `${lastConv.text.slice(0, 109)}…` : lastConv.text,
      }
    : null;

  return {
    toolWord,
    envelopes,
    conversation: recentConv,
    tools: tools.slice(-15),
    latestPreview,
  };
}

export interface LiveFeedState {
  toolByAgent: ReadonlyMap<string, string>;
  latestByAgent: ReadonlyMap<string, LatestMessagePreview>;
  envelopes: readonly ActiveEnvelope[];
}

/**
 * Watches up to 8 visible/active agents for live tool words, flying inter-agent envelopes,
 * and latest conversation messages displayed on each room's Big Screen.
 */
export function useWorkshopFeed(
  paseo: PaseoApi,
  agents: ReadonlyMap<string, PaseoAgent>,
): LiveFeedState {
  const [toolByAgent, setToolByAgent] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [latestByAgent, setLatestByAgent] = useState<ReadonlyMap<string, LatestMessagePreview>>(
    () => new Map(),
  );
  const [envelopes, setEnvelopes] = useState<readonly ActiveEnvelope[]>([]);

  // Prioritize active/recent non-archived agents (up to 8) so Big Screens always have fresh messages.
  const watchedIds = [...agents.values()]
    .filter((a) => !a.archivedAt && a.status !== "closed")
    .sort((a, b) => {
      const aActive = a.status === "running" || a.pendingPermissions.length > 0 ? 0 : 1;
      const bActive = b.status === "running" || b.pendingPermissions.length > 0 ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, MAX_TIMELINE_SUBS)
    .map((a) => a.id);

  const watchKey = watchedIds.join(",");

  useEffect(() => {
    const ids = watchKey ? watchKey.split(",") : [];
    if (ids.length === 0) {
      setToolByAgent(new Map());
      setLatestByAgent(new Map());
      return;
    }

    let alive = true;
    const unsubs: Array<() => void> = [];

    for (const id of ids) {
      // Seed each watched agent's Big Screen with its latest real message.
      void paseo.agents
        .ref(id)
        .timeline.refetch({ direction: "tail", limit: PREVIEW_TAIL_LIMIT, projection: "projected" })
        .then((res) => {
          if (!alive) return;
          const entries = (res as unknown as { entries?: Array<{ item?: unknown }> }).entries ?? [];
          const parsed = parseTimelineItems(
            id,
            entries.map((e) => e.item ?? e),
          );
          if (parsed.latestPreview) {
            setLatestByAgent((prev) => {
              const next = new Map(prev);
              next.set(id, parsed.latestPreview!);
              return next;
            });
          }
        })
        .catch(() => {});

      const unsub = paseo.agents.ref(id).timeline.subscribe((event) => {
        if (!alive) return;
        const ev = event as unknown as Record<string, unknown>;
        const nestedPayload = (ev.payload && typeof ev.payload === "object"
          ? (ev.payload as Record<string, unknown>)
          : null);
        const item = (nestedPayload?.item ??
          ev.item ??
          nestedPayload?.entry ??
          ev.entry ??
          ev) as Record<string, unknown> | null;
        if (!item || typeof item !== "object") return;
        const parsed = parseTimelineItems(id, [item]);
        if (parsed.toolWord) {
          setToolByAgent((prev) => {
            if (prev.get(id) === parsed.toolWord) return prev;
            const next = new Map(prev);
            next.set(id, parsed.toolWord!);
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
        if (parsed.latestPreview) {
          setLatestByAgent((prev) => {
            const next = new Map(prev);
            next.set(id, parsed.latestPreview!);
            return next;
          });
        }
        if (parsed.envelopes.length > 0) {
          setEnvelopes((prev) => {
            const merged = [...prev];
            for (const env of parsed.envelopes) {
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

  return { toolByAgent, latestByAgent, envelopes };
}

/** Fetches clean conversation messages (and optional tool list) for the selected agent. */
export function useSelectedChat(
  paseo: PaseoApi,
  agentId: string | null,
  refreshToken: number,
): { conversation: readonly ChatBubbleItem[]; tools: readonly ChatBubbleItem[]; loading: boolean } {
  const [conversation, setConversation] = useState<readonly ChatBubbleItem[]>([]);
  const [tools, setTools] = useState<readonly ChatBubbleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setConversation([]);
      setTools([]);
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
        const parsed = parseTimelineItems(
          agentId,
          entries.map((e) => e.item ?? e),
        );
        setConversation(parsed.conversation);
        setTools(parsed.tools);
      })
      .catch(() => {
        if (alive) {
          setConversation([]);
          setTools([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [paseo, agentId, refreshToken]);

  return { conversation, tools, loading };
}
