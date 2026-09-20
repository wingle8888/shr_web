import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/admin/auth.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
