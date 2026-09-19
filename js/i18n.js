(function () {
  const LANG_KEY = "shr_lang";

  const dict = {
    zh: {
      siteTitle: "开发板商城 - 嵌入式开发板 & 模块商城",
      brand: "开发板商城",
      topBar: "免注册购买 · 支持国际支付 · 现货 24h 发货",
      orderLookup: "订单查询",
      searchPlaceholder: "搜索开发板、模块、传感器…",
      search: "搜索",
      cart: "购物车",
      chat: "客服",
      navHome: "首页",
      navAll: "全部商品",
      navMcu: "MCU 开发板",
      navIot: "无线 IoT",
      navSbc: "单板计算机",
      navDisplay: "显示套件",
      navSensor: "传感器",
      navServices: "服务保障",
      navAfterSales: "售后说明",
      productsTitle: "商品分类",
      catAll: "全部",
      catMcu: "MCU 开发板",
      catIot: "无线 IoT",
      catSbc: "单板计算机",
      catDisplay: "显示套件",
      catSensor: "传感器",
      catMcuDesc: "STM32 / Arduino 等高性能与入门 MCU 板卡",
      catIotDesc: "Wi‑Fi / BLE 物联网模组与开发套件",
      catSbcDesc: "Raspberry Pi 等 Linux 单板机",
      catDisplayDesc: "触摸屏与 LVGL 人机界面方案",
      catSensorDesc: "姿态、环境等传感器模块",
      itemsCount: "{n} 款",
      addToCart: "加入购物车",
      buyNow: "立即购买",
      qty: "数量",
      svc1Title: "免注册购买",
      svc1Desc: "填写收货信息即可下单发货",
      svc2Title: "订单可查",
      svc2Desc: "订单号 + 手机号查询购买记录",
      svc3Title: "国际支付",
      svc3Desc: "PayPal / 银行卡 / Apple Pay",
      svc4Title: "售后保障",
      svc4Desc: "质量问题凭订单凭证处理",
      afterTitle: "购买与售后",
      afterSub: "无需注册账号。下单时填写收货人、手机与地址，系统生成订单号并本地保存，便于收货后质量问题追查。",
      step1: "选购加入购物车",
      step2: "填写收货地址并支付",
      step3: "保存订单号凭证",
      step4: "售后用订单号+手机查询",
      footerAll: "全部商品",
      footerBuyGuide: "购买说明",
      footerPay: "国际支付：PayPal · Visa / Mastercard · Apple Pay · Google Pay",
      footerCopy: "© 2026 开发板商城 · 免注册购买，订单凭证可查",
      cartTitle: "购物车",
      cartEmpty: "购物车是空的，去挑几块开发板吧",
      cartEmptyShort: "购物车是空的",
      total: "合计：¥",
      checkout: "去结算",
      checkoutTitle: "确认订单（免注册）",
      checkoutHint: "无需注册。请填写收货信息，下单后请保存订单号，便于售后查询。",
      shipName: "收货人 *",
      shipPhone: "手机号 *",
      shipEmail: "邮箱（选填）",
      shipRegion: "省 / 市 / 区 *",
      shipZip: "邮编（选填）",
      shipAddress: "详细地址 *",
      shipNote: "备注（选填）",
      payLabel: "国际支付方式 *",
      payDue: "应付合计：¥",
      submitOrder: "提交订单并支付",
      successTitle: "下单成功",
      done: "完成",
      lookupTitle: "订单查询",
      lookupHint: "请输入下单时的订单号与手机号（免登录）。",
      orderId: "订单号 *",
      phone: "手机号 *",
      query: "查询",
      chatName: "开发板商城客服",
      chatStatus: "在线 · 通常几分钟内回复",
      chatPlaceholder: "输入消息...",
      send: "发送",
      qPrice: "产品价格",
      qShip: "发货物流",
      qOrder: "订单查询",
      qHuman: "人工客服",
      detailTitle: "商品详情 - 开发板商城",
      backMall: "返回商城",
      buyGuide: "购买说明",
      loading: "正在加载商品详情…",
      goCheckoutMall: "去商城结算",
      notFound: "未找到该商品",
      backToMall: "返回商城",
      home: "首页",
      allProducts: "全部商品",
      intro: "产品介绍",
      features: "功能特点",
      specs: "规格参数",
      pins: "引脚定义",
      package: "包装清单",
      downloads: "资料下载",
      downloadHint: "提供 ZIP / 7Z 压缩包，含引脚定义、规格说明与快速入门。",
      downloadBtn: "下载",
      noDownloads: "暂无资料包",
      pinNote: "下表为常用/典型引脚说明，实际丝印与原理图请以随货资料为准。",
      pinCol: "引脚",
      funcCol: "功能",
      noteCol: "说明",
      shipTip: "免注册购买 · 结算时填写收货地址 · 订单号可查",
      remove: "删除",
      addedCart: "已加入购物车：{name}",
      cartIsEmpty: "购物车是空的",
      fillShipping: "请完整填写收货信息",
      orderOk: "下单成功，请保存订单号",
      payOk: "支付成功（{method}）",
      saveOrderId: "请保存您的订单号",
      afterTip: "售后查询请使用：订单号 + 手机号（{phone}）",
      shipTo: "收货：{name} · {region} {address}",
      lookupEmpty: "未找到订单。请核对订单号与下单手机号；订单保存在下单设备，换设备时请保留订单凭证。",
      orderTime: "下单时间：",
      payMethod: "支付方式：",
      receiver: "收货人：",
      address: "地址：",
      email: "邮箱：",
      remark: "备注：",
      orderTotal: "合计：¥",
      noProducts: "未找到相关商品，请换个关键词试试",
      namePh: "姓名",
      phonePh: "用于发货与订单查询",
      emailPh: "用于接收订单通知",
      regionPh: "如：广东省 深圳市 南山区",
      zipPh: "邮编",
      addressPh: "街道、门牌号、公司名等",
      notePh: "如：工作日送货",
      orderIdPh: "如 SHR2026…",
      lookupPhonePh: "下单时填写的手机号",
      welcome:
        "您好！我是开发板商城在线客服。可咨询商品、发货、订单查询（订单号+手机号）或售后问题。",
      botOrder:
        "免注册下单。查询请点顶部「订单查询」，输入订单号与下单手机号即可查看购买与收货记录。",
      botPrice: "价格以商品页标价为准，批量可议价。直接加购结算即可，无需注册。",
      botShip: "结算时请填写完整收货地址与手机号，现货一般 24 小时内发货。",
      botPay: "支持 PayPal、Visa/Mastercard、Apple Pay、Google Pay。",
      botReg: "本商城无需注册，游客填写收货信息即可购买；订单号+手机号可查询记录。",
      botHuman: "可通过顶部在线客服咨询，或添加微信 shr_tech / 邮件 sales@shrtech.com。",
      botHi: "您好！想选哪款开发板？也可以直接告诉我项目需求。",
      botDefault: "已收到。如需查单请用订单号+手机号；其他问题可继续描述。",
      boughtHint: "已加入购物车，请点击顶部购物车结算",
    },
    en: {
      siteTitle: "Dev Board Mall - Embedded Boards & Modules",
      brand: "Dev Board Mall",
      topBar: "Guest checkout · International payments · Ships in 24h",
      orderLookup: "Order Lookup",
      searchPlaceholder: "Search boards, modules, sensors…",
      search: "Search",
      cart: "Cart",
      chat: "Support",
      navHome: "Home",
      navAll: "All Products",
      navMcu: "MCU Boards",
      navIot: "Wireless IoT",
      navSbc: "Single Board PC",
      navDisplay: "Display Kits",
      navSensor: "Sensors",
      navServices: "Services",
      navAfterSales: "After-Sales",
      productsTitle: "Categories",
      catAll: "All",
      catMcu: "MCU Boards",
      catIot: "Wireless IoT",
      catSbc: "Single Board PC",
      catDisplay: "Display Kits",
      catSensor: "Sensors",
      catMcuDesc: "STM32 / Arduino and other MCU development boards",
      catIotDesc: "Wi‑Fi / BLE IoT modules and kits",
      catSbcDesc: "Raspberry Pi and other Linux SBCs",
      catDisplayDesc: "Touchscreens and LVGL HMI solutions",
      catSensorDesc: "Motion, environment and other sensor modules",
      itemsCount: "{n} items",
      addToCart: "Add to Cart",
      buyNow: "Buy Now",
      qty: "Qty",
      svc1Title: "No registration",
      svc1Desc: "Checkout with shipping info only",
      svc2Title: "Order tracking",
      svc2Desc: "Look up by order ID + phone",
      svc3Title: "Global payments",
      svc3Desc: "PayPal / Cards / Apple Pay",
      svc4Title: "Warranty support",
      svc4Desc: "Quality issues via order records",
      afterTitle: "Buying & Support",
      afterSub:
        "No account needed. Enter recipient, phone and address at checkout. We generate an order ID so you can look up purchases later.",
      step1: "Add items to cart",
      step2: "Enter address & pay",
      step3: "Save your order ID",
      step4: "Lookup with ID + phone",
      footerAll: "All Products",
      footerBuyGuide: "Buying Guide",
      footerPay: "Payments: PayPal · Visa / Mastercard · Apple Pay · Google Pay",
      footerCopy: "© 2026 Dev Board Mall · Guest checkout, order records available",
      cartTitle: "Cart",
      cartEmpty: "Cart is empty — pick a board",
      cartEmptyShort: "Cart is empty",
      total: "Total: ¥",
      checkout: "Checkout",
      checkoutTitle: "Confirm Order (Guest)",
      checkoutHint: "No registration. Fill shipping details and save your order ID for support.",
      shipName: "Recipient *",
      shipPhone: "Phone *",
      shipEmail: "Email (optional)",
      shipRegion: "Province / City / District *",
      shipZip: "ZIP (optional)",
      shipAddress: "Address *",
      shipNote: "Note (optional)",
      payLabel: "Payment method *",
      payDue: "Amount due: ¥",
      submitOrder: "Place Order & Pay",
      successTitle: "Order Placed",
      done: "Done",
      lookupTitle: "Order Lookup",
      lookupHint: "Enter order ID and phone used at checkout (no login).",
      orderId: "Order ID *",
      phone: "Phone *",
      query: "Search",
      chatName: "Mall Support",
      chatStatus: "Online · usually replies in minutes",
      chatPlaceholder: "Type a message...",
      send: "Send",
      qPrice: "Pricing",
      qShip: "Shipping",
      qOrder: "Order Lookup",
      qHuman: "Human Agent",
      detailTitle: "Product Detail - Dev Board Mall",
      backMall: "Back to Mall",
      buyGuide: "Buying Guide",
      loading: "Loading product…",
      goCheckoutMall: "Checkout in Mall",
      notFound: "Product not found",
      backToMall: "Back to Mall",
      home: "Home",
      allProducts: "All Products",
      intro: "Overview",
      features: "Features",
      specs: "Specifications",
      pins: "Pinout",
      package: "Package",
      downloads: "Downloads",
      downloadHint: "ZIP / 7Z packages with pinout, specs and quick start guides.",
      downloadBtn: "Download",
      noDownloads: "No packages yet",
      pinNote: "Typical pin map. Refer to silkscreen and schematics shipped with the product.",
      pinCol: "Pin",
      funcCol: "Function",
      noteCol: "Notes",
      shipTip: "Guest checkout · Enter address at payment · Order ID for support",
      remove: "Remove",
      addedCart: "Added to cart: {name}",
      cartIsEmpty: "Cart is empty",
      fillShipping: "Please complete shipping details",
      orderOk: "Order placed — please save your order ID",
      payOk: "Paid via {method}",
      saveOrderId: "Save your order ID",
      afterTip: "For support use: Order ID + phone ({phone})",
      shipTo: "Ship to: {name} · {region} {address}",
      lookupEmpty:
        "Order not found. Check ID and phone. Orders are stored on this device — keep your order ID if you switch devices.",
      orderTime: "Placed: ",
      payMethod: "Payment: ",
      receiver: "Recipient: ",
      address: "Address: ",
      email: "Email: ",
      remark: "Note: ",
      orderTotal: "Total: ¥",
      noProducts: "No products found. Try another keyword.",
      namePh: "Full name",
      phonePh: "For shipping & lookup",
      emailPh: "Order notifications",
      regionPh: "e.g. Guangdong Shenzhen Nanshan",
      zipPh: "ZIP code",
      addressPh: "Street, building, company…",
      notePh: "e.g. deliver on weekdays",
      orderIdPh: "e.g. SHR2026…",
      lookupPhonePh: "Phone used at checkout",
      welcome:
        "Hi! I'm mall support. Ask about products, shipping, order lookup (ID + phone), or after-sales.",
      botOrder:
        "Guest checkout. Use Order Lookup in the top bar with your order ID and phone.",
      botPrice: "Prices are listed on each product. Bulk quotes available. No registration needed.",
      botShip: "Enter full address and phone at checkout. In-stock items usually ship within 24h.",
      botPay: "We accept PayPal, Visa/Mastercard, Apple Pay, and Google Pay.",
      botReg: "No account required. Guest checkout with shipping info; look up orders by ID + phone.",
      botHuman: "Chat here, or reach us via WeChat shr_tech / sales@shrtech.com.",
      botHi: "Hello! Which board are you looking for? Or tell me about your project.",
      botDefault: "Got it. For orders use ID + phone; otherwise tell me more.",
      boughtHint: "Added to cart — open Cart in the header to checkout",
    },
  };

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
    return "zh";
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "zh");
  }

  function t(key, vars) {
    const lang = getLang();
    let text = (dict[lang] && dict[lang][key]) || (dict.zh && dict.zh[key]) || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
      });
    }
    return text;
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      el.setAttribute("aria-label", t(key));
    });
    const titleKey = document.body?.getAttribute("data-i18n-title");
    if (titleKey) document.title = t(titleKey);
    document.documentElement.lang = getLang() === "en" ? "en" : "zh-CN";
  }

  function localizeField(field) {
    if (field == null) return "";
    if (typeof field === "string") return field;
    const lang = getLang();
    return field[lang] || field.zh || field.en || "";
  }

  function localizeList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      if (typeof item === "string") return item;
      if (Array.isArray(item)) return item.map(localizeField);
      return localizeField(item);
    });
  }

  window.I18N = { getLang, setLang, t, applyI18n, localizeField, localizeList, dict };
})();
