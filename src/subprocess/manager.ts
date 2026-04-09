/**
 * Cursor CLI (agent) Subprocess Manager.
 *
 * Spawns `agent -p --output-format stream-json --stream-partial-output --yolo`
 * and emits normalized events: content_delta, result, error, close.
 *
 * The prompt is piped via stdin to avoid shell argument length limits.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import type { CursorCliMessage } from "../types/cursor-cli.js";
import {
  isSystemInit,
  isAssistantMessage,
  isToolCallMessage,
  isResultMessage,
} from "../types/cursor-cli.js";

const IS_WIN = process.platform === "win32";
const DEFAULT_TIMEOUT = 300_000; // 5 minutes
const DEBUG = !!process.env.CURSOR_DEBUG;

export interface SubprocessOptions {
  model: string;
  apiKey?: string;
  cwd?: string;
  timeout?: number;
}

export interface ContentDeltaEvent {
  text: string;
}

export interface ResultEvent {
  text: string;
  model: string;
}

export class CursorSubprocess extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";
  private timeoutId: NodeJS.Timeout | null = null;
  private isKilled = false;
  private detectedModel = "cursor-auto";
  private turnBuffer = "";

  async start(prompt: string, options: SubprocessOptions): Promise<void> {
    const args = this.buildArgs(options);
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    return new Promise<void>((resolve, reject) => {
      try {
        const env = { ...process.env };
        if (options.apiKey) {
          env.CURSOR_API_KEY = options.apiKey;
        }

        this.process = spawn("agent", args, {
          cwd: options.cwd ?? process.cwd(),
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: IS_WIN,
        });

        this.timeoutId = setTimeout(() => {
          if (!this.isKilled) {
            this.isKilled = true;
            this.process?.kill(IS_WIN ? undefined : "SIGTERM");
            this.emit("error", new Error(`Request timed out after ${timeout}ms`));
          }
        }, timeout);

        this.process.on("error", (err) => {
          this.clearTimer();
          if (err.message.includes("ENOENT")) {
            reject(
              new Error(
                IS_WIN
                  ? "Cursor CLI (agent) not found. Install: irm 'https://cursor.com/install?win32=true' | iex"
                  : "Cursor CLI (agent) not found. Install: curl https://cursor.com/install -fsS | bash"
              )
            );
          } else {
            reject(err);
          }
        });

        this.process.stdin?.write(prompt);
        this.process.stdin?.end();

        this.process.stdout?.on("data", (chunk: Buffer) => {
          this.buffer += chunk.toString();
          this.processBuffer();
        });

        this.process.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString().trim();
          if (text) {
            console.error("[CursorSubprocess stderr]", text.slice(0, 500));
          }
        });

        this.process.on("close", (code) => {
          this.clearTimer();
          if (this.buffer.trim()) {
            this.processBuffer();
          }
          this.emit("close", code);
        });

        resolve();
      } catch (err) {
        this.clearTimer();
        reject(err);
      }
    });
  }

  private buildArgs(options: SubprocessOptions): string[] {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--yolo",
      // Non-interactive HTTP proxy: no TTY and no user to answer prompts.
      // --trust lets the CLI skip trust/workspace confirmation that would
      // otherwise block or exit without emitting stream-json results.
      "--trust",
    ];

    if (options.model && options.model !== "auto") {
      args.push("--model", options.model);
    }

    return args;
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg: CursorCliMessage = JSON.parse(trimmed);
        this.handleMessage(msg);
      } catch {
        this.emit("raw", trimmed);
      }
    }
  }

  private handleMessage(msg: CursorCliMessage): void {
    if (DEBUG) {
      console.error("[debug]", JSON.stringify(msg).slice(0, 300));
    }

    if (isSystemInit(msg)) {
      if (msg.model) this.detectedModel = msg.model;
      return;
    }

    if (isAssistantMessage(msg)) {
      const text = msg.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");

      if (!text) return;

      if (text === this.turnBuffer) return;

      if (text.startsWith(this.turnBuffer)) {
        const diff = text.slice(this.turnBuffer.length);
        if (diff) this.emit("content_delta", { text: diff } as ContentDeltaEvent);
        this.turnBuffer = text;
        return;
      }

      this.emit("content_delta", { text } as ContentDeltaEvent);
      this.turnBuffer += text;
      return;
    }

    if (isToolCallMessage(msg)) {
      this.turnBuffer = "";
      return;
    }

    if (isResultMessage(msg)) {
      const result: ResultEvent = {
        text: msg.result ?? "",
        model: this.detectedModel,
      };
      this.emit("result", result);
      return;
    }
  }

  private clearTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  kill(): void {
    if (!this.isKilled && this.process) {
      this.isKilled = true;
      this.clearTimer();
      if (IS_WIN) {
        this.process.kill();
      } else {
        this.process.kill("SIGTERM");
      }
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.isKilled && this.process.exitCode === null;
  }
}

export async function verifyCursorCli(): Promise<{
  ok: boolean;
  error?: string;
  version?: string;
}> {
  return new Promise((resolve) => {
    const proc = spawn("agent", ["--version"], { stdio: "pipe", shell: IS_WIN });
    let output = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.on("error", () => {
      resolve({
        ok: false,
        error:
          IS_WIN
          ? "Cursor CLI (agent) not found. Install: irm 'https://cursor.com/install?win32=true' | iex"
          : "Cursor CLI (agent) not found. Install: curl https://cursor.com/install -fsS | bash",
      });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, version: output.trim() });
      } else {
        resolve({
          ok: false,
          error: "Cursor CLI (agent) returned non-zero exit code",
        });
      }
    });
  });
}
