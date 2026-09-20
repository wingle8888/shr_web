import { runNodeHandler } from "../_adapter.js";
import handler from "../../api/products.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
