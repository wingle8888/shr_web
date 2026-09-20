import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/auth/login.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
