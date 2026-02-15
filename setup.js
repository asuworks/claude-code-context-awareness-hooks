#!/usr/bin/env node
// setup.js — Cross-platform installer for context-awareness hooks
//
// Usage:
//   node setup.js              # install
//   node setup.js --uninstall  # remove hook scripts
//   node setup.js --test       # smoke test only (skip install)
//
// Also callable via wrapper scripts:
//   bash setup.sh              # Unix/WSL2/macOS
//   powershell setup.ps1       # Windows
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Paths ──────────────────────────────────────────────────────────
const SCRIPT_DIR = __dirname;
const HOOKS_SRC = path.join(SCRIPT_DIR, "hooks");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const HOOKS_DST = path.join(CLAUDE_DIR, "hooks");
const SETTINGS = path.join(CLAUDE_DIR, "settings.json");

const HOOK_FILES = [
  "statusline-bridge.js",
  "inject-context-on-prompt.js",
  "inject-context-on-tool.js",
  "session-cleanup.js",
];

// ── Colors (works on Windows Terminal, macOS Terminal, Linux) ──────
const C = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};
const info = (msg) => console.log(`${C.cyan}[INFO]${C.reset}  ${msg}`);
const ok = (msg) => console.log(`${C.green}[OK]${C.reset}    ${msg}`);
const warn = (msg) => console.log(`${C.yellow}[WARN]${C.reset}  ${msg}`);
const fail = (msg) => {
  console.log(`${C.red}[FAIL]${C.reset}  ${msg}`);
  process.exit(1);
};

// ── Parse args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FLAG = args[0] || "";

// ═════════════════════════════════════════════════════════════════════
// UNINSTALL
// ═════════════════════════════════════════════════════════════════════
if (FLAG === "--uninstall") {
  console.log();
  console.log(`${C.bold}${C.cyan}Context Hooks — Uninstall${C.reset}`);
  console.log("═".repeat(40));

  for (const f of HOOK_FILES) {
    const dst = path.join(HOOKS_DST, f);
    if (fs.existsSync(dst)) {
      fs.unlinkSync(dst);
      ok(`Removed ${dst}`);
    }
  }

  // Clean temp files
  const tmpDir = os.tmpdir();
  try {
    for (const f of fs.readdirSync(tmpDir)) {
      if (f.startsWith("claude-context-usage") || f.startsWith("claude-tool-counter-")) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
    }
    ok("Cleaned temp files");
  } catch {
    // Non-fatal
  }

  console.log();
  warn("settings.json was NOT modified — remove hook entries manually.");
  warn("  Keys to remove: hooks.UserPromptSubmit, hooks.PostToolUse,");
  warn("  hooks.SessionStart, hooks.SessionEnd, and statusLine.");
  console.log();

  // Find latest backup
  try {
    const backups = fs.readdirSync(CLAUDE_DIR)
      .filter((f) => f.startsWith("settings.json.bak."))
      .sort()
      .reverse();
    if (backups.length > 0) {
      info(`Latest backup: ${path.join(CLAUDE_DIR, backups[0])}`);
    }
  } catch {
    // No backups
  }
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════
// INSTALL
// ═════════════════════════════════════════════════════════════════════
console.log();
console.log(`${C.bold}${C.cyan}Context Hooks for Claude Code${C.reset}`);
console.log("═".repeat(40));
console.log("Makes Opus 4.6 aware of its context window usage");
console.log(`Platform: ${os.platform()} (${os.arch()})`);
console.log();

// ── Step 1: Prerequisites ──────────────────────────────────────────
if (FLAG !== "--test") {
  info("Step 1/5 — Checking prerequisites...");

  // Node.js is obviously present since we're running
  ok(`Node.js ${process.version}`);

  if (!fs.existsSync(CLAUDE_DIR)) {
    warn("~/.claude/ doesn't exist — creating it...");
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
  ok(`${CLAUDE_DIR} exists`);

  // ── Step 2: Verify source scripts ────────────────────────────────
  info("Step 2/5 — Verifying source scripts...");

  for (const f of HOOK_FILES) {
    const src = path.join(HOOKS_SRC, f);
    if (!fs.existsSync(src)) {
      fail(`Missing: ${src}`);
    }
  }
  ok(`All hook scripts found in ${HOOKS_SRC}/`);

  // ── Step 3: Copy scripts ─────────────────────────────────────────
  info("Step 3/5 — Installing hook scripts...");

  fs.mkdirSync(HOOKS_DST, { recursive: true });
  for (const f of HOOK_FILES) {
    const src = path.join(HOOKS_SRC, f);
    const dst = path.join(HOOKS_DST, f);
    fs.copyFileSync(src, dst);

    // Make executable on Unix (no-op concept on Windows, but harmless)
    try {
      fs.chmodSync(dst, 0o755);
    } catch {
      // Windows doesn't support chmod — that's fine
    }

    ok(`Installed ${dst}`);
  }

  // ── Step 4: Update settings.json ─────────────────────────────────
  info("Step 4/5 — Updating settings.json...");

  // Build absolute paths for hook commands
  const bridgePath = path.join(HOOKS_DST, "statusline-bridge.js");
  const promptPath = path.join(HOOKS_DST, "inject-context-on-prompt.js");
  const toolPath = path.join(HOOKS_DST, "inject-context-on-tool.js");
  const cleanupPath = path.join(HOOKS_DST, "session-cleanup.js");

  const newConfig = {
    statusLine: {
      type: "command",
      command: `node "${bridgePath}"`,
      padding: 0,
    },
    hooks: {
      UserPromptSubmit: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: `node "${promptPath}"`,
              timeout: 5,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: `node "${toolPath}"`,
              timeout: 5,
            },
          ],
        },
      ],
      SessionStart: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command:
                'node -e "process.stdout.write(\'[Context tracking active. You will receive context window usage updates before each user message and every 5 tool calls. When usage exceeds 80%, suggest /compact. Be concise when above 60%.]\')"',
              timeout: 5,
            },
          ],
        },
      ],
      SessionEnd: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: `node "${cleanupPath}"`,
              timeout: 5,
            },
          ],
        },
      ],
    },
  };

  if (fs.existsSync(SETTINGS)) {
    // Backup existing settings
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = `${SETTINGS}.bak.${timestamp}`;
    fs.copyFileSync(SETTINGS, backupPath);
    ok(`Backed up settings → ${backupPath}`);

    // Read and merge
    let existing = {};
    try {
      existing = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    } catch {
      warn("Existing settings.json was invalid — starting fresh");
    }

    // Deep merge: overlay our config onto existing
    const merged = deepMerge(existing, newConfig);
    fs.writeFileSync(SETTINGS, JSON.stringify(merged, null, 2) + "\n");
    ok("Merged hook config into existing settings.json");

    if (existing.hooks) {
      warn(
        "You had existing hooks — verify no entries were overwritten in:"
      );
      warn(`  ${SETTINGS}`);
    }
  } else {
    fs.writeFileSync(SETTINGS, JSON.stringify(newConfig, null, 2) + "\n");
    ok("Created new settings.json with hook config");
  }
}

// ── Step 5: Smoke test ─────────────────────────────────────────────
info("Step 5/5 — Smoke test...");
console.log();

const testSessionId = `test-${Date.now()}`;
const testJson = JSON.stringify({
  session_id: testSessionId,
  model: { display_name: "Opus 4.6" },
  cwd: process.cwd(),
  context_window: {
    used_percentage: 42,
    remaining_percentage: 58,
    context_window_size: 200000,
    total_input_tokens: 84000,
    total_output_tokens: 12000,
  },
  cost: { total_cost_usd: 0.47 },
});

// Determine path to hook scripts (installed location or source)
const hookDir = fs.existsSync(path.join(HOOKS_DST, HOOK_FILES[0]))
  ? HOOKS_DST
  : HOOKS_SRC;

// Test statusline bridge
info("Testing statusline-bridge.js...");
try {
  const bridgeOut = runHook(path.join(hookDir, "statusline-bridge.js"), testJson);
  console.log(`  Output: ${bridgeOut}`);

  const bridgeFile = path.join(os.tmpdir(), `claude-context-usage-${testSessionId}.json`);
  if (fs.existsSync(bridgeFile)) {
    ok("Bridge file written successfully (session-scoped)");
    info(`  ${fs.readFileSync(bridgeFile, "utf8")}`);
  } else {
    warn("Bridge file was not created");
  }
} catch (e) {
  warn(`Statusline test error: ${e.message}`);
}
console.log();

// Test UserPromptSubmit hook
info("Testing inject-context-on-prompt.js...");
try {
  // Pass session_id so the hook finds the bridge file we just wrote
  const promptInput = JSON.stringify({ session_id: testSessionId });
  const promptOut = runHook(path.join(hookDir, "inject-context-on-prompt.js"), promptInput);
  const promptData = JSON.parse(promptOut);
  ok(`Output: ${promptData.hookSpecificOutput.additionalContext}`);
} catch (e) {
  warn(`Prompt hook test error: ${e.message}`);
}
console.log();

// Test PostToolUse hook (simulate 5 calls)
info("Testing inject-context-on-tool.js (5 calls)...");
for (let i = 1; i <= 5; i++) {
  const toolInput = JSON.stringify({
    session_id: testSessionId,
    tool_name: "Read",
  });
  try {
    const toolOut = runHook(path.join(hookDir, "inject-context-on-tool.js"), toolInput);
    if (toolOut.trim()) {
      const toolData = JSON.parse(toolOut);
      ok(`  Call #${i}: ${toolData.hookSpecificOutput.additionalContext}`);
    } else {
      info(`  Call #${i}: (skipped — not every-5th)`);
    }
  } catch (e) {
    info(`  Call #${i}: (skipped)`);
  }
}
// Clean up test files (both counter and bridge)
try {
  fs.unlinkSync(path.join(os.tmpdir(), `claude-tool-counter-${testSessionId}`));
} catch { /* Fine */ }
try {
  fs.unlinkSync(path.join(os.tmpdir(), `claude-context-usage-${testSessionId}.json`));
} catch { /* Fine */ }

// ── Done ───────────────────────────────────────────────────────────
console.log();
console.log("═".repeat(50));
console.log(`${C.bold}${C.green}Installation complete!${C.reset}`);
console.log("═".repeat(50));
console.log();
info("Restart Claude Code to activate the hooks.");
info("Verify inside Claude Code with:  /hooks");
console.log();
info("Files installed:");
for (const f of HOOK_FILES) {
  info(`  ${path.join(HOOKS_DST, f)}`);
}
info(`  ${SETTINGS}`);
console.log();
info("To change the tool-call interval, edit EVERY_N in:");
info(`  ${path.join(HOOKS_DST, "inject-context-on-tool.js")}`);
console.log();
info(`To uninstall:  node ${path.join(SCRIPT_DIR, "setup.js")} --uninstall`);

// ═════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function runHook(scriptPath, stdinData) {
  const { execSync } = require("child_process");
  // Use node to run the script, pass data on stdin
  const escaped = stdinData.replace(/'/g, "'\\''");
  const isWin = os.platform() === "win32";

  let cmd;
  if (isWin) {
    // Windows: use echo with pipe
    const escaped_win = stdinData.replace(/"/g, '\\"');
    cmd = `echo "${escaped_win}" | node "${scriptPath}"`;
  } else {
    cmd = `echo '${escaped}' | node "${scriptPath}"`;
  }

  return execSync(cmd, {
    encoding: "utf8",
    timeout: 10000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
