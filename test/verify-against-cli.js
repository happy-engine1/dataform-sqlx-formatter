// Checks that formatting each file on its own matches `dataform format` on the whole project.
//
// Usage: node test/verify-against-cli.js <git working copy of a Dataform project>
// Run `dataform format .` on the working copy first: HEAD holds the unformatted files and the
// working tree holds the CLI's output. With --keyword-case=upper, it instead checks that the
// uppercased output is left unchanged by the stock CLI (so a `dataform format` pre-commit hook
// won't fight it).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { formatSqlx } = require("../out/formatter");

const root = process.argv[2];
const keywordCase = (process.argv.find((a) => a.startsWith("--keyword-case=")) ?? "=preserve").split("=")[1];
const dataformPath = process.env.DATAFORM_PATH ?? "dataform";
const base = { dataformPath, timeoutMs: 60000, warehouse: "bigquery" };
const files = execFileSync("git", ["ls-files", "definitions/**.sqlx", "includes/**.sqlx"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

(async () => {
  const result = { ok: 0, skipped: 0, ng: [] };
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let f; (f = queue.shift()); ) {
        const before = execFileSync("git", ["show", `HEAD:${f}`], { cwd: root, encoding: "utf8" });
        const cliOutput = fs.readFileSync(path.join(root, f), "utf8");
        let actual;
        try {
          actual = await formatSqlx(before, { ...base, keywordCase });
        } catch (e) {
          // Fine if the CLI also left the file untouched (it failed to format it too).
          if (cliOutput === before) result.skipped++;
          else result.ng.push(`${f}: ${e.message.split("\n")[0]}`);
          continue;
        }
        const expected =
          keywordCase === "preserve" ? cliOutput : await formatSqlx(actual, { ...base, keywordCase: "preserve" });
        if (actual === expected) result.ok++;
        else result.ng.push(f);
      }
    }),
  );
  console.log(`keywordCase=${keywordCase} total=${files.length} ok=${result.ok} skippedByBoth=${result.skipped}`);
  console.log("ng:", result.ng);
  process.exitCode = result.ng.length > 0 ? 1 : 0;
})();
