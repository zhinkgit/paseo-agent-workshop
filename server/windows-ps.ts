// Cross-platform helper for Windows process table inspection via PowerShell + Win32 PEB reading.
// Pure script builder & JSON parser live here so they are unit-testable on any OS.
import { formatElapsedSeconds } from "../shared/format.ts";
import { processKey, type RawProcess } from "./processes.ts";

export interface WindowsProcessRecord {
  pid: number;
  ppid: number;
  started: string;
  rssKb: number;
  cpuMs: number;
  elapsedSec: number;
  command: string;
  agentId: string | null;
}

export interface CpuSampleState {
  atMs: number;
  cpuMsByKey: ReadonlyMap<string, number>;
}

export const EMPTY_CPU_SAMPLE: CpuSampleState = { atMs: 0, cpuMsByKey: new Map() };

/**
 * PowerShell script that enumerates running processes via CIM (Win32_Process) and reads
 * `PASEO_AGENT_ID` from same-user process PEB environment blocks via NtQueryInformationProcess +
 * ReadProcessMemory. Processes that deny access (system/elevated) are silently skipped for env reading.
 * Emits a JSON array of WindowsProcessRecord objects.
 */
export function buildWindowsSnapshotScript(): string {
  return String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class PaseoPebReader {
  [StructLayout(LayoutKind.Sequential)]
  struct PROCESS_BASIC_INFORMATION {
    public IntPtr Reserved1;
    public IntPtr PebBaseAddress;
    public IntPtr Reserved2_0;
    public IntPtr Reserved2_1;
    public IntPtr UniqueProcessId;
    public IntPtr Reserved3;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr OpenProcess(uint access, bool inherit, int pid);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CloseHandle(IntPtr handle);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr baseAddr, byte[] buffer, int size, out IntPtr read);

  [DllImport("ntdll.dll")]
  static extern int NtQueryInformationProcess(IntPtr hProcess, int infoClass, ref PROCESS_BASIC_INFORMATION pbi, int len, out int retLen);

  const uint PROCESS_QUERY_INFORMATION = 0x0400;
  const uint PROCESS_VM_READ = 0x0010;

  static IntPtr ReadPtr(IntPtr h, IntPtr addr) {
    byte[] buf = new byte[IntPtr.Size];
    IntPtr read;
    if (!ReadProcessMemory(h, addr, buf, buf.Length, out read) || read.ToInt64() != buf.Length) return IntPtr.Zero;
    return IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(buf, 0)) : new IntPtr(BitConverter.ToInt32(buf, 0));
  }

  public static string ReadAgentId(int pid) {
    IntPtr h = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
    if (h == IntPtr.Zero) return null;
    try {
      PROCESS_BASIC_INFORMATION pbi = new PROCESS_BASIC_INFORMATION();
      int retLen = 0;
      if (NtQueryInformationProcess(h, 0, ref pbi, Marshal.SizeOf(pbi), out retLen) != 0) return null;
      if (pbi.PebBaseAddress == IntPtr.Zero) return null;

      int procParamsOffset = IntPtr.Size == 8 ? 0x20 : 0x10;
      int envOffset = IntPtr.Size == 8 ? 0x80 : 0x48;

      IntPtr procParams = ReadPtr(h, IntPtr.Add(pbi.PebBaseAddress, procParamsOffset));
      if (procParams == IntPtr.Zero) return null;

      IntPtr envPtr = ReadPtr(h, IntPtr.Add(procParams, envOffset));
      if (envPtr == IntPtr.Zero) return null;

      // Read up to 64 KiB of UTF-16LE environment block in 8 KiB chunks.
      byte[] chunk = new byte[8192];
      StringBuilder sb = new StringBuilder();
      for (int offset = 0; offset < 65536; offset += chunk.Length) {
        IntPtr read;
        if (!ReadProcessMemory(h, IntPtr.Add(envPtr, offset), chunk, chunk.Length, out read) || read.ToInt32() <= 0) break;
        string piece = Encoding.Unicode.GetString(chunk, 0, read.ToInt32());
        int idx = piece.IndexOf("PASEO_AGENT_ID=", StringComparison.OrdinalIgnoreCase);
        if (idx >= 0) {
          int start = idx + 15;
          int end = piece.IndexOf('\0', start);
          if (end > start) return piece.Substring(start, end - start).Trim();
          sb.Append(piece.Substring(start));
          continue;
        }
        if (sb.Length > 0) {
          int end = piece.IndexOf('\0');
          if (end >= 0) {
            sb.Append(piece.Substring(0, end));
            return sb.ToString().Trim();
          }
          sb.Append(piece);
        }
        if (piece.Contains("\0\0")) break;
      }
      return sb.Length > 0 ? sb.ToString().Trim() : null;
    } catch {
      return null;
    } finally {
      CloseHandle(h);
    }
  }
}
"@

$now = [DateTime]::UtcNow
$procs = Get-CimInstance Win32_Process | ForEach-Object {
  $pidVal = [int]$_.ProcessId
  $ppidVal = [int]$_.ParentProcessId
  $created = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime() } else { $null }
  $startedStr = if ($created) { $created.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } else { "" }
  $elapsedSec = if ($created) { [Math]::Max(0, [int](($now - $created).TotalSeconds)) } else { 0 }
  $rssKb = if ($_.WorkingSetSize) { [int]([double]$_.WorkingSetSize / 1024.0) } else { 0 }
  $cpu100ns = ([double]$_.UserModeTime) + ([double]$_.KernelModeTime)
  $cpuMs = [Math]::Round($cpu100ns / 10000.0, 2)
  $cmd = if ($_.CommandLine) { $_.CommandLine } elseif ($_.ExecutablePath) { $_.ExecutablePath } else { $_.Name }
  $agentId = $null
  if ($pidVal -gt 4) {
    $agentId = [PaseoPebReader]::ReadAgentId($pidVal)
  }
  [PSCustomObject]@{
    pid = $pidVal
    ppid = $ppidVal
    started = $startedStr
    rssKb = $rssKb
    cpuMs = $cpuMs
    elapsedSec = $elapsedSec
    command = $cmd
    agentId = $agentId
  }
}
$procs | ConvertTo-Json -Compress -Depth 2
`.trim();
}

export function buildWindowsStartedAtScript(pid: number): string {
  return `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${Math.floor(pid)}" -ErrorAction SilentlyContinue; if ($p -and $p.CreationDate) { $p.CreationDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }`;
}

/**
 * Parse JSON stdout from `buildWindowsSnapshotScript()` into RawProcess rows, computing CPU%
 * from the delta of cumulative CPU milliseconds between consecutive polls.
 */
export function parseWindowsSnapshot(
  jsonOutput: string,
  nowMs: number,
  previousCpu: CpuSampleState = EMPTY_CPU_SAMPLE,
): { raw: RawProcess[]; nextCpu: CpuSampleState } {
  const trimmed = jsonOutput.trim();
  if (!trimmed) return { raw: [], nextCpu: { atMs: nowMs, cpuMsByKey: new Map() } };

  const parsed: unknown = JSON.parse(trimmed);
  const items: WindowsProcessRecord[] = Array.isArray(parsed)
    ? (parsed as WindowsProcessRecord[])
    : parsed && typeof parsed === "object"
      ? [parsed as WindowsProcessRecord]
      : [];

  const dtMs = previousCpu.atMs > 0 ? Math.max(200, nowMs - previousCpu.atMs) : 0;
  const nextCpuMap = new Map<string, number>();
  const raw: RawProcess[] = [];

  for (const item of items) {
    if (!item || typeof item.pid !== "number" || item.pid <= 0) continue;
    const started = typeof item.started === "string" ? item.started.trim() : "";
    const key = processKey({ pid: item.pid, started });
    const cpuMs = Number(item.cpuMs) || 0;
    nextCpuMap.set(key, cpuMs);

    let cpuPct = 0;
    if (dtMs > 0 && previousCpu.cpuMsByKey.has(key)) {
      const prevMs = previousCpu.cpuMsByKey.get(key) ?? cpuMs;
      const deltaMs = Math.max(0, cpuMs - prevMs);
      cpuPct = Math.round(((deltaMs / dtMs) * 100) * 10) / 10;
    }

    const rawAgent = typeof item.agentId === "string" ? item.agentId.trim().toLowerCase() : "";
    const validAgent = /^[0-9a-f-]{36}$/.test(rawAgent) ? rawAgent : null;

    raw.push({
      pid: item.pid,
      ppid: Number(item.ppid) || 0,
      pgid: 0,
      started,
      cpu: cpuPct,
      rssKb: Math.max(0, Math.round(Number(item.rssKb) || 0)),
      elapsed: formatElapsedSeconds(Number(item.elapsedSec) || 0),
      command: typeof item.command === "string" && item.command.trim() ? item.command.trim() : `pid-${item.pid}`,
      taggedAgentId: validAgent,
    });
  }

  return { raw, nextCpu: { atMs: nowMs, cpuMsByKey: nextCpuMap } };
}
