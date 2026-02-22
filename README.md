# Context-Aware Hooks for Claude Code

Give **Claude Opus 4.6** the context-window awareness it lacks natively.

Sonnet 4.5 and Haiku 4.5 receive automatic `<system_warning>Token usage: X/Y</system_warning>` tags after each tool call. Opus 4.6 does not. These hooks fix that by injecting usage data at three lifecycle points:

- **Before every user message** — `UserPromptSubmit` hook
- **Every 5th tool call** — `PostToolUse` hook (configurable)
- **Session start** — one-time instruction telling Claude to manage context

## Cross-platform

All hooks are Node.js — the one runtime guaranteed to exist wherever Claude Code runs. No `jq`, no `bash`, no `pwsh` dependency beyond Node itself.

Scripts use the `.cjs` extension (not `.js`) to guarantee CommonJS mode. Some Claude Code plugins place a `package.json` with `"type": "module"` in `~/.claude/hooks/`, which would break `require()` calls in plain `.js` files. The `.cjs` extension overrides this regardless of any `package.json` present.

| Platform          | Install command                             |
|-------------------|---------------------------------------------|
| macOS / Linux     | `bash setup.sh`                             |
| WSL2              | `bash setup.sh`                             |
| Windows (native)  | `powershell -NoProfile -File setup.ps1`     |
| Any (direct)      | `node setup.js`                             |

## Prerequisites

- **Claude Code** installed and working
- **Node.js** (already required by Claude Code)
- **Git** on PATH (optional — shows branch in status line)

## Install

### 1. Get the files

```bash
git clone https://github.com/asuworks/cc-context-awareness-hook.git
cd cc-context-awareness-hook
```

Or download and unzip. The structure should be:

```
cc-context-awareness-hook/
├── README.md
├── setup.js            ← cross-platform installer (Node.js)
├── setup.sh            ← Unix wrapper
├── setup.ps1           ← Windows wrapper
└── hooks/
    ├── statusline-bridge.cjs
    ├── inject-context-on-prompt.cjs
    ├── inject-context-on-tool.cjs
    └── session-cleanup.cjs
```

### 2. Run the installer

**macOS / Linux / WSL2:**
```bash
bash setup.sh
```

**Windows (PowerShell):**
```powershell
powershell -NoProfile -File setup.ps1
```

The installer will:
1. Verify Node.js is available
2. Copy the three hook scripts to `~/.claude/hooks/`
3. Back up your existing `~/.claude/settings.json`
4. Merge the hook configuration into your settings
5. Run a smoke test

### 3. Restart Claude Code

```bash
claude
```

### 4. Verify

Inside Claude Code, run `/hooks` to confirm `UserPromptSubmit`, `PostToolUse`, `SessionStart`, and `SessionEnd` are listed.

## What Claude sees

Before each user message:

```
[CONTEXT OK] 23% used (77% free) of 200k window | ~46000 in / ~8000 out
```

As usage climbs:

```
[CONTEXT WARNING — be concise, avoid verbose output] 65% used ...
```

```
[CONTEXT CRITICAL — suggest /compact now] 85% used ...
```

Every 5th tool call adds a mid-turn checkpoint:

```
🟡 Context checkpoint (#15, after Write): 67% used, 33% free of 200k. Context above 60% — keep responses concise.
```

## Configuration

### Change the tool-call interval

Edit `~/.claude/hooks/inject-context-on-tool.cjs`, line 14:

```javascript
const EVERY_N = 5; // change to 10, 20, etc.
```

### Pair with CLAUDE.md

Add to your project's `CLAUDE.md` for best results:

```markdown
## Context management

You receive context window usage data before each prompt and every 5 tool calls.
- Below 40%: work normally
- 40–60%: prefer concise responses, avoid re-reading files already in context
- 60–80%: be brief, skip verbose explanations, avoid unnecessary tool calls
- Above 80%: suggest /compact, summarize progress before compacting
```

## Architecture

```
Claude Code StatusLine event (includes session_id)
    │
    ▼
statusline-bridge.cjs
    ├── writes {tmpdir}/claude-context-usage-{session_id}.json
    └── renders ANSI color-coded status line
    
User types a message
    │
    ▼
UserPromptSubmit → inject-context-on-prompt.cjs
    ├── reads session_id from hook stdin
    ├── reads claude-context-usage-{session_id}.json
    └── injects via additionalContext

Claude calls tools
    │
    ▼
PostToolUse → inject-context-on-tool.cjs
    ├── reads session_id from hook stdin
    ├── increments {tmpdir}/claude-tool-counter-{session_id}
    ├── every 5th call: reads session-scoped bridge file
    └── injects via additionalContext

Session ends
    │
    ▼
SessionEnd → session-cleanup.cjs
    ├── reads session_id from hook stdin
    └── removes this session's bridge + counter files
```

All temp files are namespaced by `session_id` (a UUID v4 that Claude Code assigns to each session). This means multiple concurrent sessions — even in the same directory — never cross-contaminate. A new session starts with a clean bridge file (no stale data from previous sessions).

All temp files use `os.tmpdir()` and `path.join()` — resolves correctly on every platform.

## Uninstall

```bash
# Unix
bash setup.sh --uninstall

# Windows
powershell -NoProfile -File setup.ps1 -Uninstall

# Direct
node setup.js --uninstall
```

Removes hook scripts and temp files. Settings.json backup location is printed so you can restore manually.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No context data on first message | Normal — status line hasn't fired yet. Data appears from turn 2. |
| Hooks not firing | Run `claude --debug` and check for hook execution logs. |
| Settings conflict | Restore backup: copy `settings.json.bak.TIMESTAMP` over `settings.json`. |
| Percentages seem off | Known issue [#13783](https://github.com/anthropics/claude-code/issues/13783): use `used_percentage` not raw token counts. |
| Want bash/PowerShell hooks | Bash and PowerShell alternatives in `scripts/` (if provided). Core hooks are Node.js only. |

## License

MIT
