const STAGE_STATUS = {
  unpaid: "待付款",
  paid: "已支付，待发货",
  shipped: "已发货，待收货",
  received: "已签收",
  refund: "退款/售后",
};

const STAGE_LABEL = {
  unpaid: { zh: "待付款", en: "Awaiting payment" },
  paid: { zh: "待发货", en: "Awaiting shipment" },
  shipped: { zh: "待收货", en: "Awaiting delivery" },
  received: { zh: "已签收", en: "Received" },
  refund: { zh: "退款/售后", en: "Refund / After-sales" },
};

function orderStage(order) {
  const s = String((order && order.status) || "");
  if (/退款|售后|refund/i.test(s)) return "refund";
  if (/待付款|未支付|unpaid|pending payment|awaiting payment/i.test(s)) return "unpaid";
  if (/已签收|已完成|received|delivered|completed/i.test(s) && !/待收货/.test(s)) return "received";
  if (/待收货|已发货|shipped|in transit/i.test(s)) return "shipped";
  if (/待发货|已支付|paid|awaiting shipment/i.test(s)) return "paid";
  return "paid";
}

function statusForStage(stage) {
  return STAGE_STATUS[stage] || STAGE_STATUS.paid;
}

function labelForStage(stage, lang) {
  const row = STAGE_LABEL[stage] || STAGE_LABEL.paid;
  return lang === "en" ? row.en : row.zh;
}

function publicOrder(order) {
  if (!order || typeof order !== "object") return null;
  const shipping = order.shipping && typeof order.shipping === "object" ? order.shipping : {};
  const stage = orderStage(order);
  return {
    id: String(order.id || ""),
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || order.createdAt || "",
    status: String(order.status || statusForStage(stage)),
    stage,
    payMethod: String(order.payMethod || ""),
    total: Number(order.total) || 0,
    items: Array.isArray(order.items) ? order.items : [],
    shipping: {
      name: String(shipping.name || ""),
      phone: String(shipping.phone || ""),
      email: String(shipping.email || ""),
      region: String(shipping.region || ""),
      zip: String(shipping.zip || ""),
      address: String(shipping.address || ""),
      note: String(shipping.note || ""),
    },
  };
}

module.exports = {
  STAGE_STATUS,
  STAGE_LABEL,
  orderStage,
  statusForStage,
  labelForStage,
  publicOrder,
};
