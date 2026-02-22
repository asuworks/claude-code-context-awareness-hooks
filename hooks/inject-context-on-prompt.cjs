#!/usr/bin/env node
// inject-context-on-prompt.cjs — UserPromptSubmit hook
// Injects current context window usage into Claude's context before
// each user message. Reads cached data written by statusline-bridge.cjs.
//
// Uses session_id from the hook stdin payload to read the correct
// bridge file, so concurrent sessions never cross-contaminate.
//
// Uses .cjs extension to guarantee CommonJS mode regardless of any
// package.json "type": "module" in the hooks directory.
//
// Cross-platform: works on Windows, macOS, and Linux/WSL2.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Read stdin (hook payload with session_id) ──────────────────────
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    // Can't parse — still try to respond gracefully
  }

  const sessionId = hookData.session_id || "";
  const msg = buildContextMessage(sessionId);

  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: msg,
    },
  };
  process.stdout.write(JSON.stringify(output));
});

function buildContextMessage(sessionId) {
  if (!sessionId) {
    return "[Context tracking: no session_id available]";
  }

  // ── Read session-scoped bridge file ──────────────────────────────
  const bridgeFile = path.join(
    os.tmpdir(),
    `claude-context-usage-${sessionId}.json`
  );

  let data;
  try {
    const raw = fs.readFileSync(bridgeFile, "utf8");
    data = JSON.parse(raw);
  } catch {
    // Bridge file doesn't exist yet — statusline hasn't fired
    return "[Context tracking: awaiting first status update]";
  }

  const pct = Math.round(data.used_pct ?? 0);
  const rem = Math.round(data.remaining_pct ?? 100);
  const winK = Math.round((data.window_size ?? 200000) / 1000);
  const inTok = data.input_tokens ?? 0;
  const outTok = data.output_tokens ?? 0;

  // ── Severity + guidance ──────────────────────────────────────────
  let sev;
  if (pct >= 80) {
    sev = "CRITICAL — suggest /compact now";
  } else if (pct >= 60) {
    sev = "WARNING — be concise, avoid verbose output";
  } else if (pct >= 40) {
    sev = "MODERATE";
  } else {
    sev = "OK";
  }

  return (
    `[CONTEXT ${sev}] ` +
    `${pct}% used (${rem}% free) of ${winK}k window | ` +
    `~${inTok} in / ~${outTok} out`
  );
}
