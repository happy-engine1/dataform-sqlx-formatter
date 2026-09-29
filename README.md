# Dataform SQLX Formatter

Format the `.sqlx` file you are editing with the **Dataform CLI's own formatter**. The output is exactly what `dataform format` produces, but only the current file is touched.

## Why

`dataform format` (CLI 2.x) always formats every file in the project, so you cannot run it on the file you are working on. This extension copies the file into a throwaway project in a temp directory, runs the CLI there, and applies the result as a normal editor edit.

- Same output as `dataform format`, so it never fights a `dataform format` pre-commit hook or CI check
- Works with **Format Document** (`Shift+Alt+F` / `Shift+Option+F`), **Format on Save**, and undo
- Works in Dev Containers and Remote SSH (runs where the Dataform CLI is installed)

## Requirements

The [Dataform CLI](https://cloud.google.com/dataform/docs/use-dataform-cli) must be installed (`npm i -g @dataform/cli`). Tested with 2.9.0 and 3.0.71.

## Settings

| Setting | Default | Description |
|---|---|---|
| `dataformSqlxFormatter.dataformPath` | `dataform` | Path to the CLI. Set an absolute path if it is not on `PATH`. |
| `dataformSqlxFormatter.timeoutMs` | `30000` | Timeout for one format run. |
| `dataformSqlxFormatter.keywordCase` | `preserve` | `upper` / `lower` to change the case of SQL keywords. See below. |

The SQL dialect is taken from `warehouse` in the nearest `dataform.json` (default `bigquery`).

### Keyword case (CLI 2.x)

CLI 2.x leaves SQL keywords as written. With `keywordCase` set to `upper` or `lower`, the extension tells the CLI's SQL formatter to change their case. Because CLI 2.x never changes keyword case, the result stays unchanged by a stock `dataform format` run. CLI 3.x always uppercases keywords, so this setting has no effect there.

## Safety check

CLI 2.x reports success even on a file with syntax errors, and may corrupt it (for example, splitting `${` into `$ {`). The extension rejects a result if any non-whitespace character was added or removed, or if the number of `${` changed. In that case the file is left unchanged and a warning is shown. Details are in the **Dataform SQLX Formatter** output channel.

## Development

```bash
npm install
npm run package          # builds dataform-sqlx-formatter-<version>.vsix
```

`test/verify-against-cli.js` checks, on a real Dataform project, that formatting each file on its own matches `dataform format` on the whole project:

```bash
# In a clean git working copy of a Dataform project, format everything without committing,
# so HEAD holds the original files and the working tree holds the CLI's output.
(cd <project> && dataform format .)
node test/verify-against-cli.js <project>                        # compare with the CLI output
node test/verify-against-cli.js <project> --keyword-case=upper   # check stability under the stock CLI
```

## License

[MIT](LICENSE)
