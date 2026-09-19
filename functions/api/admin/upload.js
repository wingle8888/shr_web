import { createRequire } from "node:module";
import { runNodeHandler } from "../../_adapter.js";

const require = createRequire(import.meta.url);
const handler = require("../../../api/admin/upload.js");

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
