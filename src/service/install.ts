/**
 * Auto-start service installer for macOS / Windows / Linux.
 *
 * cursor-agent-api install   — register as auto-start service
 * cursor-agent-api uninstall — remove auto-start service
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const SERVICE_NAME = "cursor-agent-api";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getStandalonePath(): string {
  return join(__dirname, "..", "server", "standalone.js");
}

function getNodePath(): string {
  return process.execPath;
}

// --------------- macOS ---------------

const PLIST_DIR = join(homedir(), "Library", "LaunchAgents");
const PLIST_PATH = join(PLIST_DIR, `com.${SERVICE_NAME}.plist`);

function installMacOS(): void {
  const nodePath = getNodePath();
  const scriptPath = getStandalonePath();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.${SERVICE_NAME}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${scriptPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:${homedir()}/.local/bin:/usr/bin:/bin</string>${process.env.CURSOR_API_KEY ? `
    <key>CURSOR_API_KEY</key>
    <string>${process.env.CURSOR_API_KEY}</string>` : ""}
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/${SERVICE_NAME}.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/${SERVICE_NAME}.log</string>
</dict>
</plist>`;

  mkdirSync(PLIST_DIR, { recursive: true });
  writeFileSync(PLIST_PATH, plist);

  try {
    execSync(`launchctl bootout gui/$(id -u) ${PLIST_PATH} 2>/dev/null`, { stdio: "ignore" });
  } catch { /* not loaded yet */ }
  execSync(`launchctl bootstrap gui/$(id -u) ${PLIST_PATH}`);

  console.log("Service installed and started.");
  console.log(`  Config: ${PLIST_PATH}`);
  console.log(`  Logs:   /tmp/${SERVICE_NAME}.log`);
}

function uninstallMacOS(): void {
  try {
    execSync(`launchctl bootout gui/$(id -u) ${PLIST_PATH} 2>/dev/null`, { stdio: "ignore" });
  } catch { /* already unloaded */ }

  if (existsSync(PLIST_PATH)) {
    unlinkSync(PLIST_PATH);
  }
  console.log("Service uninstalled.");
}

// --------------- Windows ---------------

const WIN_TASK_NAME = "CursorAgentAPI";

function installWindows(): void {
  const nodePath = getNodePath();
  const scriptPath = getStandalonePath();

  try {
    execSync(`schtasks /Delete /TN "${WIN_TASK_NAME}" /F`, { stdio: "ignore" });
  } catch { /* task doesn't exist yet */ }

  execSync(
    `schtasks /Create /TN "${WIN_TASK_NAME}" /TR "\\"${nodePath}\\" \\"${scriptPath}\\"" /SC ONLOGON /RL HIGHEST /F`,
    { stdio: "inherit" }
  );

  // Start it now
  execSync(`schtasks /Run /TN "${WIN_TASK_NAME}"`, { stdio: "inherit" });

  console.log("\nService installed and started.");
  console.log(`  Task name: ${WIN_TASK_NAME}`);
  console.log("  Manage in: Task Scheduler (taskschd.msc)");
}

function uninstallWindows(): void {
  try {
    execSync(`schtasks /End /TN "${WIN_TASK_NAME}"`, { stdio: "ignore" });
  } catch { /* not running */ }

  try {
    execSync(`schtasks /Delete /TN "${WIN_TASK_NAME}" /F`, { stdio: "inherit" });
  } catch { /* doesn't exist */ }

  console.log("Service uninstalled.");
}

// --------------- Linux ---------------

const SYSTEMD_USER_DIR = join(homedir(), ".config", "systemd", "user");
const SYSTEMD_PATH = join(SYSTEMD_USER_DIR, `${SERVICE_NAME}.service`);

function installLinux(): void {
  const nodePath = getNodePath();
  const scriptPath = getStandalonePath();

  const unit = `[Unit]
Description=Cursor Agent API Proxy
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${scriptPath}
Restart=on-failure
RestartSec=5${process.env.CURSOR_API_KEY ? `\nEnvironment=CURSOR_API_KEY=${process.env.CURSOR_API_KEY}` : ""}

[Install]
WantedBy=default.target
`;

  mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
  writeFileSync(SYSTEMD_PATH, unit);

  execSync("systemctl --user daemon-reload");
  execSync(`systemctl --user enable --now ${SERVICE_NAME}`);

  console.log("Service installed and started.");
  console.log(`  Config: ${SYSTEMD_PATH}`);
  console.log(`  Status: systemctl --user status ${SERVICE_NAME}`);
  console.log(`  Logs:   journalctl --user -u ${SERVICE_NAME} -f`);
}

function uninstallLinux(): void {
  try {
    execSync(`systemctl --user disable --now ${SERVICE_NAME}`, { stdio: "ignore" });
  } catch { /* not active */ }

  if (existsSync(SYSTEMD_PATH)) {
    unlinkSync(SYSTEMD_PATH);
    execSync("systemctl --user daemon-reload");
  }
  console.log("Service uninstalled.");
}

// --------------- Entry ---------------

export function installService(): void {
  console.log(`Installing ${SERVICE_NAME} as auto-start service...\n`);

  switch (process.platform) {
    case "darwin":
      installMacOS();
      break;
    case "win32":
      installWindows();
      break;
    case "linux":
      installLinux();
      break;
    default:
      console.error(`Unsupported platform: ${process.platform}`);
      process.exit(1);
  }
}

export function uninstallService(): void {
  console.log(`Uninstalling ${SERVICE_NAME} service...\n`);

  switch (process.platform) {
    case "darwin":
      uninstallMacOS();
      break;
    case "win32":
      uninstallWindows();
      break;
    case "linux":
      uninstallLinux();
      break;
    default:
      console.error(`Unsupported platform: ${process.platform}`);
      process.exit(1);
  }
}
