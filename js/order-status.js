(function () {
  const STAGE_STATUS = {
    unpaid: "待付款",
    paid: "已支付，待发货",
    shipped: "已发货，待收货",
    received: "已签收",
    refund: "退款/售后",
  };

  function stage(order) {
    const s = String((order && order.status) || "");
    if (/退款|售后|refund/i.test(s)) return "refund";
    if (/待付款|未支付|unpaid|pending payment|awaiting payment/i.test(s)) return "unpaid";
    if (/已签收|已完成|received|delivered|completed/i.test(s) && !/待收货/.test(s)) return "received";
    if (/待收货|已发货|shipped|in transit/i.test(s)) return "shipped";
    if (/待发货|已支付|paid|awaiting shipment/i.test(s)) return "paid";
    return "paid";
  }

  function writeStatus(nextStage) {
    return STAGE_STATUS[nextStage] || STAGE_STATUS.paid;
  }

  function label(nextStage) {
    const key = {
      unpaid: "orderStageUnpaid",
      paid: "orderStagePaid",
      shipped: "orderStageShipped",
      received: "orderStageReceived",
      refund: "orderStageRefund",
    }[nextStage] || "orderStagePaid";
    return window.I18N ? window.I18N.t(key) : key;
  }

  window.OrderStatus = { stage, writeStatus, label };
})();
