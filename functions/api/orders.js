import { runNodeHandler } from "../_adapter.js";
import handler from "../../api/orders.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
