// `dataform format` (CLI 2.x) can only format a whole project. To format one file, copy it into a
// throwaway project in a temp directory and let the CLI itself format it, so the result is exactly
// what `dataform format` would produce for the real project.
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export type KeywordCase = "preserve" | "upper" | "lower";

export interface FormatOptions {
  dataformPath: string;
  timeoutMs: number;
  // `warehouse` from dataform.json; it selects the SQL dialect used for formatting.
  warehouse: string;
  keywordCase: KeywordCase;
}

export class FormatError extends Error {}

const PRELOAD = path.join(__dirname, "..", "preload-keyword-case.js");

export async function formatSqlx(text: string, options: FormatOptions): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sqlx-format-"));
  try {
    const target = path.join(tmp, "definitions", "target.sqlx");
    await fs.mkdir(path.dirname(target));
    await fs.writeFile(path.join(tmp, "dataform.json"), JSON.stringify({ warehouse: options.warehouse }));
    await fs.writeFile(target, text);

    const env = { ...process.env };
    if (options.keywordCase !== "preserve") {
      env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(PRELOAD)}`.trim();
      env.DATAFORM_SQLX_FORMATTER_KEYWORD_CASE = options.keywordCase;
    }
    // The CLI writes snowflake.log to its cwd, so run it inside the temp dir to clean that up too.
    const output = await run(options.dataformPath, ["format", tmp], tmp, env, options.timeoutMs);
    // CLI 2.x exits 0 even when formatting fails, so check the output instead.
    if (!output.includes("Successfully formatted")) {
      throw new FormatError(`dataform format failed:\n${stripAnsi(output)}`);
    }

    const formatted = await fs.readFile(target, "utf8");
    assertSafe(text, formatted);
    return formatted;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

// On a file with syntax errors, CLI 2.x still reports success but can break `${` into `$ {`.
// Reject results whose non-whitespace characters changed, or whose `${` count changed.
// Character order is ignored because the CLI moves blocks, e.g. comments above `config` go below it.
function assertSafe(original: string, formatted: string): void {
  const squash = (s: string) => [...s.replace(/\s/g, "").toLowerCase()].sort().join("");
  if (squash(original) !== squash(formatted)) {
    throw new FormatError("Formatting aborted: it would change non-whitespace characters.");
  }
  const count = (s: string) => (s.match(/\$\{/g) ?? []).length;
  if (count(original) !== count(formatted)) {
    throw new FormatError("Formatting aborted: it would break a ${...} expression (syntax error?).");
  }
}

function run(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, env, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        reject(new FormatError(`Could not run ${file}: ${err.message}\n${stderr}`));
        return;
      }
      resolve(stdout + stderr);
    });
  });
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
