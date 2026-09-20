import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/admin/upload.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
