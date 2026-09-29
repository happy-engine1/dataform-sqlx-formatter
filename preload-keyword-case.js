// Dataform CLI 2.x calls sql-formatter without `keywordCase` (i.e. "preserve").
// Loaded via NODE_OPTIONS=--require, this wraps sql-formatter's format() to inject `keywordCase`.
const Module = require("module");
const keywordCase = process.env.DATAFORM_SQLX_FORMATTER_KEYWORD_CASE;
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  const loaded = originalLoad.call(this, request, ...rest);
  if (request !== "sql-formatter" || !keywordCase) {
    return loaded;
  }
  return { ...loaded, format: (query, options) => loaded.format(query, { ...options, keywordCase }) };
};
