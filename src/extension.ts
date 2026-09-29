import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { FormatError, formatSqlx, KeywordCase } from "./formatter";

const DEFAULT_WAREHOUSE = "bigquery";

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Dataform SQLX Formatter");
  context.subscriptions.push(
    log,
    vscode.languages.registerDocumentFormattingEditProvider("sqlx", {
      async provideDocumentFormattingEdits(document) {
        const config = vscode.workspace.getConfiguration("dataformSqlxFormatter");
        const started = Date.now();
        try {
          const text = document.getText();
          const formatted = await formatSqlx(text, {
            dataformPath: config.get<string>("dataformPath", "dataform"),
            timeoutMs: config.get<number>("timeoutMs", 30000),
            warehouse: await findWarehouse(document.uri.fsPath),
            keywordCase: config.get<KeywordCase>("keywordCase", "preserve"),
          });
          log.appendLine(`formatted ${document.uri.fsPath} (${Date.now() - started}ms)`);
          if (formatted === text) {
            return [];
          }
          const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
          return [vscode.TextEdit.replace(fullRange, formatted)];
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          log.appendLine(`failed ${document.uri.fsPath}: ${message}`);
          if (e instanceof FormatError) {
            vscode.window.showWarningMessage(`Dataform SQLX Formatter: ${message.split("\n")[0]}`);
          } else {
            vscode.window.showErrorMessage(`Dataform SQLX Formatter: ${message}`);
          }
          return [];
        }
      },
    }),
  );
}

// Walk up from the file to find dataform.json and read its `warehouse`. Defaults to bigquery.
async function findWarehouse(filePath: string): Promise<string> {
  let dir = path.dirname(filePath);
  while (true) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(dir, "dataform.json"), "utf8"));
      return typeof json.warehouse === "string" ? json.warehouse : DEFAULT_WAREHOUSE;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) {
        return DEFAULT_WAREHOUSE;
      }
      dir = parent;
    }
  }
}

export function deactivate(): void {}
