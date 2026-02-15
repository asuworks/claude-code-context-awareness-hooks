#!/usr/bin/env node
// statusline-bridge.js — Status line + token data bridge for hooks
// Reads JSON from stdin (Claude Code StatusLine payload), writes context
// metrics to a session-specific temp file so lifecycle hooks can read them,
// then renders an ANSI-colored status line to stdout.
//
// Bridge file: {tmpdir}/claude-context-usage-{session_id}.json
// This ensures concurrent Claude Code sessions don't overwrite each other.
//
// Cross-platform: works on Windows, macOS, and Linux/WSL2.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Read all of stdin ──────────────────────────────────────────────
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    writeBridgeFile(data);
    renderStatusLine(data);
  } catch {
    process.stdout.write("\x1b[38;5;250m\x1b[2mClaude\x1b[0m");
  }
});

// ── Derive session-scoped bridge file path ─────────────────────────
function bridgePath(sessionId) {
  return path.join(os.tmpdir(), `claude-context-usage-${sessionId}.json`);
}

// ── Write context data to session-scoped temp file ─────────────────
function writeBridgeFile(data) {
  const sessionId = data.session_id;
  if (!sessionId) return; // No session_id = can't namespace safely

  const ctx = data.context_window || {};
  const bridge = {
    session_id: sessionId,
    used_pct: ctx.used_percentage ?? 0,
    remaining_pct: ctx.remaining_percentage ?? 100,
    window_size: ctx.context_window_size ?? 200000,
    input_tokens: ctx.total_input_tokens ?? 0,
    output_tokens: ctx.total_output_tokens ?? 0,
    model: (data.model && data.model.display_name) || "Claude",
    cost_usd: (data.cost && data.cost.total_cost_usd) || 0,
    timestamp: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(bridgePath(sessionId), JSON.stringify(bridge));
  } catch {
    // Non-fatal — hooks just won't have data this turn
  }
}

// ── Render ANSI status line ────────────────────────────────────────
function renderStatusLine(data) {
  const ctx = data.context_window || {};
  const pct = Math.round(ctx.used_percentage ?? 0);
  const model = (data.model && data.model.display_name) || "Claude";
  const cost = (data.cost && data.cost.total_cost_usd) || 0;
  const cwd = data.cwd || "";

  const dir = cwd ? path.basename(cwd) : "";

  // Git branch (best-effort, silent fail)
  let branch = "";
  try {
    const { execSync } = require("child_process");
    branch = execSync("git branch --show-current", {
      cwd: cwd || undefined,
      encoding: "utf8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // Not a git repo or git not installed
  }

  // Color gradient: green → yellow → red
  let ctxColor;
  if (pct >= 80) {
    ctxColor = "\x1b[38;2;255;80;50m";
  } else if (pct >= 50) {
    ctxColor = "\x1b[38;2;255;230;50m";
  } else {
    ctxColor = "\x1b[38;2;100;230;100m";
  }

  const DIM = "\x1b[2m";
  const BOLD = "\x1b[1m";
  const GRAY = "\x1b[38;5;250m";
  const RST = "\x1b[0m";
  const SEP = `${GRAY}${DIM} | ${RST}`;

  const parts = [];
  if (dir) parts.push(`${GRAY}${DIM}${dir}${RST}`);
  parts.push(`${GRAY}${DIM}${model}${RST}`);
  if (branch) parts.push(`${GRAY}${DIM}${branch}${RST}`);
  parts.push(`${GRAY}${DIM}ctx ${RST}${ctxColor}${BOLD}${pct}%${RST}`);
  parts.push(`${GRAY}${DIM}$${cost}${RST}`);

  process.stdout.write(parts.join(SEP));
}
