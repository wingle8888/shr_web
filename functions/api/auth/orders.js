import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/auth/orders.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
