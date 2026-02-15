# Context-Aware Hooks for Claude Code

Give **Claude Opus 4.6** the context-window awareness it lacks natively.

Sonnet 4.5 and Haiku 4.5 receive automatic `<system_warning>Token usage: X/Y</system_warning>` tags after each tool call. Opus 4.6 does not. These hooks fix that by injecting usage data at three lifecycle points:

- **Before every user message** — `UserPromptSubmit` hook
- **Every 5th tool call** — `PostToolUse` hook (configurable)
- **Session start** — one-time instruction telling Claude to manage context

## Prerequisites

- **Claude Code** installed and working
- **Node.js** (already required by Claude Code)

## Install

```bash
git clone https://github.com/asuworks/claude-code-context-awareness-hooks.git
cd claude-code-context-awareness-hooks
node setup.js
```

The installer will:
1. Copy the hook scripts to `~/.claude/hooks/`
2. Back up your existing `~/.claude/settings.json`
3. Merge the hook configuration into your settings
4. Run a smoke test

Restart Claude Code, then run `/hooks` to confirm the hooks are active.

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

Edit `~/.claude/hooks/inject-context-on-tool.js`, line 14:

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

## Uninstall

```bash
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

## License

MIT
