#!/usr/bin/env node
// inject-context-on-tool.js — PostToolUse hook
// Injects context window usage into Claude's context every N tool calls.
// Uses session_id to read the correct bridge file and maintain a
// per-session counter, so concurrent sessions never collide.
//
// Cross-platform: works on Windows, macOS, and Linux/WSL2.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Configuration ──────────────────────────────────────────────────
const EVERY_N = 5; // inject every Nth tool call

// ── Read stdin ─────────────────────────────────────────────────────
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const sessionId = hookData.session_id || "default";
  const toolName = hookData.tool_name || "unknown";

  const counterFile = path.join(
    os.tmpdir(),
    `claude-tool-counter-${sessionId}`
  );
  const bridgeFile = path.join(
    os.tmpdir(),
    `claude-context-usage-${sessionId}.json`
  );

  // ── Increment counter ────────────────────────────────────────────
  let count = 0;
  try {
    count = parseInt(fs.readFileSync(counterFile, "utf8"), 10) || 0;
  } catch {
    // First tool call this session
  }
  count++;
  try {
    fs.writeFileSync(counterFile, String(count));
  } catch {
    // Non-fatal
  }

  // ── Only inject on every Nth call ────────────────────────────────
  if (count % EVERY_N !== 0) {
    process.exit(0);
  }

  // ── Read session-scoped bridge file ──────────────────────────────
  let data;
  try {
    const raw = fs.readFileSync(bridgeFile, "utf8");
    data = JSON.parse(raw);
  } catch {
    process.exit(0); // Bridge not written yet
  }

  const pct = Math.round(data.used_pct ?? 0);
  const rem = Math.round(data.remaining_pct ?? 100);
  const winK = Math.round((data.window_size ?? 200000) / 1000);

  // ── Build message ────────────────────────────────────────────────
  let icon, advice;
  if (pct >= 80) {
    icon = "🔴";
    advice = "Context nearly full — run /compact or wrap up this task.";
  } else if (pct >= 60) {
    icon = "🟡";
    advice = "Context above 60% — keep responses concise.";
  } else {
    icon = "🟢";
    advice = "";
  }

  let msg = `${icon} Context checkpoint (#${count}, after ${toolName}): ${pct}% used, ${rem}% free of ${winK}k`;
  if (advice) msg += `. ${advice}`;

  const output = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: msg,
    },
  };

  process.stdout.write(JSON.stringify(output));
});
