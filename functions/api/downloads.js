import { runNodeHandler } from "../_adapter.js";
import handler from "../../api/downloads.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
