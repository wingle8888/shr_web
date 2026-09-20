import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/auth/warehouse.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
