export function formatCpu(cpu: number): string {
  if (!Number.isFinite(cpu) || cpu <= 0) return "0%";
  return cpu >= 10 ? `${Math.round(cpu)}%` : `${cpu.toFixed(1)}%`;
}

export function formatMemory(rssKb: number): string {
  if (!Number.isFinite(rssKb) || rssKb <= 0) return "0 MB";
  const mb = rssKb / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(rssKb)} KB`;
}

export function formatElapsed(elapsed: string): string {
  const trimmed = elapsed.trim();
  if (!trimmed) return "0s";
  // Supports ps etime formats: [[dd-]hh:]mm:ss
  const daySplit = trimmed.split("-");
  let days = 0;
  let timePart = trimmed;
  if (daySplit.length === 2) {
    days = Number(daySplit[0]) || 0;
    timePart = daySplit[1] ?? "";
  }
  const parts = timePart.split(":").map((part) => Number(part) || 0);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = parts as [number, number, number];
  } else if (parts.length === 2) {
    [minutes, seconds] = parts as [number, number];
  } else {
    seconds = parts[0] ?? 0;
  }
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatElapsedSeconds(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}-${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function splitCommand(command: string): { name: string; rest: string } {
  const trimmed = command.trim();
  if (!trimmed) return { name: "process", rest: "" };
  // Handle quoted executable paths on Windows, e.g. "C:\Program Files\nodejs\node.exe" ...
  if (trimmed.startsWith('"')) {
    const endQuote = trimmed.indexOf('"', 1);
    if (endQuote > 1) {
      const exe = trimmed.slice(1, endQuote);
      const rest = trimmed.slice(endQuote + 1).trim();
      const base = exe.split(/[\\/]/).pop() || exe;
      return { name: base, rest };
    }
  }
  const space = trimmed.indexOf(" ");
  const exe = space === -1 ? trimmed : trimmed.slice(0, space);
  const rest = space === -1 ? "" : trimmed.slice(space + 1).trim();
  const base = exe.split(/[\\/]/).pop() || exe;
  return { name: base, rest };
}

export function shortenMiddle(text: string, max = 56): string {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) * 0.55);
  const tail = max - 1 - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

export function formatAge(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 45_000) return "now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
