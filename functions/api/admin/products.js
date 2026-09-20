import { runNodeHandler } from "../../_adapter.js";
import handler from "../../../api/admin/products.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
