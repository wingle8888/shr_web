import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/admin/users.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
