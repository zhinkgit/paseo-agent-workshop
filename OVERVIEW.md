# Agent Workshop

Agent Workshop combines a retro pixel-art workshop view of your Paseo agents with cross-platform OS process monitoring and cleanup.

Each workspace is drawn as a cozy pixel workshop room. Active agents work at benches with animated poses, tool bubbles, permission alerts, and flying message envelopes between agents. Background subprocesses appear beside each bench as running mini-machines that overheat under high CPU or memory load. Closed or archived agents that still hold live processes leave behind flashing runaway machines so lingering resource leaks stay visible.

Selecting any character or runaway machine opens a two-tab inspector dock:

- **Activity**: review and respond to pending permission requests (Allow, Deny, Review), inspect recent chat messages, send messages, open the agent tab, or archive it.
- **Processes**: inspect the full attributed process tree (PID, CPU, memory, runtime, detached status), stop individual subtrees or all lingering processes, or launch an optimizer agent briefed with the live process tree.

A List view toggle presents the same agents with animated pixel status icons alongside their process counts, CPU, and memory totals.

## Process tracking and cleanup

The daemon subprocess polls the local process table every 2 seconds and attributes processes to agents via `PASEO_AGENT_ID`, ancestor lineage, and process groups (on Unix) or PEB environment inspection (on Windows). It supports Linux, macOS, and Windows.

Automatic orphan cleanup is enabled by default and can be toggled from the workshop toolbar. When enabled, it waits 15 seconds after close, archive, or turn-end events (plus a 60-second periodic sweep) and stops provider processes whose owning agent has ended, while leaving user-started dev servers running until manually stopped.
