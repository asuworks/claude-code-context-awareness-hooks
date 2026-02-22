#!/usr/bin/env node
// session-cleanup.cjs — SessionEnd hook
// Cleans up temp files for the ending session only.
// Reads session_id from stdin to target the correct files.
//
// Uses .cjs extension to guarantee CommonJS mode regardless of any
// package.json "type": "module" in the hooks directory.
//
// Cross-platform: works on Windows, macOS, and Linux/WSL2.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let sessionId = "";
  try {
    const data = JSON.parse(input);
    sessionId = data.session_id || "";
  } catch {
    // Can't parse — try to clean up generically
  }

  const tmpDir = os.tmpdir();

  if (!sessionId) return; // No session_id = can't identify files safely

  // Clean up only this session's files
  const files = [
    `claude-context-usage-${sessionId}.json`,
    `claude-tool-counter-${sessionId}`,
  ];
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(tmpDir, f));
    } catch {
      // Already gone or never created
    }
  }
});
