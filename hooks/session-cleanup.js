#!/usr/bin/env node
// session-cleanup.js — SessionEnd hook
// Cleans up temp files for the ending session only.
// Reads session_id from stdin to target the correct files.
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

  if (sessionId) {
    // Clean up this session's specific files
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
  } else {
    // Fallback: clean up all orphaned context/counter files
    try {
      for (const f of fs.readdirSync(tmpDir)) {
        if (
          f.startsWith("claude-context-usage-") ||
          f.startsWith("claude-tool-counter-")
        ) {
          try {
            fs.unlinkSync(path.join(tmpDir, f));
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }
});
