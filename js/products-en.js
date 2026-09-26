window.PRODUCT_EN = {
  1: {
    name: "STM32H750 Development Board",
    desc: "480MHz Cortex-M7, 1MB Flash, external SDRAM for high-performance embedded apps",
    tag: "Hot",
    category: "MCU Boards",
    intro:
      "High-performance MCU board based on STM32H750VBT6, up to 480MHz with 1MB Flash and 562KB SRAM plus onboard SDRAM. Ideal for GUI, audio, industrial control and real-time algorithms. Schematics and sample projects included.",
    features: [
      "Cortex-M7 @ 480MHz with DP-FPU and DSP",
      "8MB SDRAM for LVGL / frame buffers",
      "USB-C power & download with ST-Link compatible circuit",
      "UART / SPI / I2C / CAN / SDMMC / DCMI",
      "Pads for LCD / camera / Ethernet",
      "HAL / CubeMX samples and pin map",
    ],
    specs: [
      ["MCU", "STM32H750VBT6"],
      ["Core", "Arm Cortex-M7"],
      ["Clock", "Up to 480 MHz"],
      ["Flash / RAM", "1MB / 562KB + SDRAM"],
      ["Power", "5V USB-C / 3.3V LDO"],
      ["Size", "Approx. 70 × 50 mm"],
    ],
    pins: [
      ["PA0", "ADC1_IN0 / TIM2_CH1", "Analog or timer output"],
      ["PA9 / PA10", "USART1_TX / RX", "Default debug UART"],
      ["PB6 / PB7", "I2C1_SCL / SDA", "Sensor bus"],
      ["PC10–PC12", "SPI3", "Peripheral expand"],
      ["PD0 / PD1", "CAN1_RX / TX", "Industrial bus"],
      ["PE2–PE6", "FMC", "SDRAM address/data"],
      ["3V3 / GND", "Power", "Peripheral supply"],
      ["5V", "USB in", "Regulated to 3.3V"],
    ],
    package: ["Board ×1", "USB-C cable ×1", "Headers", "Quick start guide"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/stm32h750-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/stm32h750-docs.7z", format: "7Z" },
    ],
  },
  2: {
    name: "ESP32-S3 DevKit",
    desc: "WiFi + BLE 5.0, dual-core 240MHz with AI accel — ideal for IoT",
    tag: "Pick",
    category: "Wireless IoT",
    intro:
      "Espressif ESP32-S3 dual-core LX7 kit with 2.4GHz Wi‑Fi and Bluetooth LE 5. Vector instructions help light AI and voice wake. Native USB download, RGB LED and headers. Works with Arduino / ESP-IDF / MicroPython.",
    features: [
      "Dual-core LX7 @ 240MHz with vector extensions",
      "Wi‑Fi 802.11 b/g/n + Bluetooth LE 5",
      "Native USB OTG — no external USB‑UART needed",
      "GPIO for camera / LCD / I2S audio",
      "Boot / Reset buttons and status LED",
      "ESP-IDF and Arduino examples",
    ],
    specs: [
      ["Module", "ESP32-S3-WROOM"],
      ["Clock", "Up to 240 MHz"],
      ["Radio", "Wi‑Fi + BLE 5"],
      ["Flash", "Typically 8MB / 16MB"],
      ["Power", "5V USB / 3.3V"],
      ["Temp", "-40 ~ 85°C (chip)"],
    ],
    pins: [
      ["GPIO1 / GPIO2", "UART0 TX / RX", "Default debug UART"],
      ["GPIO8 / GPIO9", "I2C", "Common sensors"],
      ["GPIO11–GPIO13", "SPI", "Flash / display / expand"],
      ["GPIO19 / GPIO20", "USB D- / D+", "Native USB"],
      ["GPIO38–GPIO42", "Camera DVP", "With flex cable"],
      ["3V3 / GND", "Power", "Peripheral supply"],
      ["EN", "Enable / reset", "Active low reset"],
      ["BOOT", "Boot mode", "Hold for download"],
    ],
    package: ["Board ×1", "USB cable ×1", "Docs QR"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/esp32-s3-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/esp32-s3-docs.7z", format: "7Z" },
    ],
  },
  3: {
    name: "Raspberry Pi 5 Board",
    desc: "BCM2712 quad-core 2.4GHz, 8GB RAM, PCIe 2.0",
    tag: "New",
    category: "Single Board PC",
    intro:
      "Raspberry Pi 5 with Broadcom BCM2712 quad Cortex-A76 @ 2.4GHz and optional 8GB LPDDR4X. PCIe 2.0 enables NVMe SSDs. Dual 4K, Gigabit Ethernet and faster USB 3.0 for desktop Linux, edge compute and robotics.",
    features: [
      "Quad A76 @ 2.4GHz",
      "Dual micro-HDMI up to dual 4K60",
      "PCIe 2.0 ×1 for M.2 NVMe (HAT required)",
      "Gigabit Ethernet + dual-band Wi‑Fi / BT",
      "2× USB 3.0 + 2× USB 2.0",
      "40-pin GPIO compatible ecosystem",
    ],
    specs: [
      ["SoC", "BCM2712"],
      ["CPU", "4× Cortex-A76 @ 2.4GHz"],
      ["Memory", "8GB LPDDR4X"],
      ["Storage", "microSD + PCIe expand"],
      ["Video", "2× micro-HDMI"],
      ["Power", "5V/5A USB-C PD recommended"],
    ],
    pins: [
      ["Pin 1 / 17", "3.3V", "Logic supply"],
      ["Pin 2 / 4", "5V", "Peripheral power"],
      ["Pin 3 / 5", "GPIO2 / 3 (SDA/SCL)", "I2C1"],
      ["Pin 8 / 10", "GPIO14 / 15", "UART0 TX / RX"],
      ["Pin 19 / 21 / 23", "MOSI / MISO / SCLK", "SPI0"],
      ["Pin 6 / 9 / 14…", "GND", "Ground"],
      ["Pin 32 / 33", "PWM", "Servo / dimming"],
      ["Pin 37–40", "GPIO", "Configurable IO"],
    ],
    package: ["Pi 5 board ×1 (no PSU/case/card)", "Anti-static pack"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/rpi5-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/rpi5-docs.7z", format: "7Z" },
    ],
  },
  4: {
    name: "LVGL Touch Display Kit",
    desc: "4.3\" IPS capacitive panel + STM32F429 with LVGL demo",
    tag: "Kit",
    category: "Display Kits",
    intro:
      "4.3\" IPS capacitive touch display with STM32F429 core board, preloaded LVGL demo. Great for HMI, dashboards and embedded UI learning. Includes calibration, widget samples and font templates.",
    features: [
      "4.3\" IPS, typically 800×480",
      "Capacitive multi-touch over I2C",
      "STM32F429 with TFT interface",
      "LVGL demo: buttons, lists, charts",
      "UART debug and SD resource support",
      "Full UI project source package",
    ],
    specs: [
      ["Panel", "4.3\" IPS capacitive"],
      ["Resolution", "800 × 480 (typical)"],
      ["MCU", "STM32F429"],
      ["Touch", "Capacitive, I2C"],
      ["Graphics", "LVGL"],
      ["Interface", "FFC / headers"],
    ],
    pins: [
      ["LCD_R0–R7", "Red data", "RGB parallel"],
      ["LCD_G0–G7", "Green data", "RGB parallel"],
      ["LCD_B0–B7", "Blue data", "RGB parallel"],
      ["LCD_CLK / DE / HSYNC / VSYNC", "Timing", "Display sync"],
      ["CTP_SCL / SDA", "Touch I2C", "Touch controller"],
      ["CTP_INT / RST", "IRQ / Reset", "Touch events"],
      ["USART1", "Debug UART", "Logs / commands"],
      ["3V3 / GND / 5V", "Power", "Watch backlight current"],
    ],
    package: ["Core board ×1", "4.3\" panel ×1", "FFC ×1", "Sample docs link"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/lvgl-kit-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/lvgl-kit-docs.7z", format: "7Z" },
    ],
  },
  5: {
    name: "MPU6050 Sensor Module",
    desc: "6-axis gyro + accelerometer, I2C — essential for motion sensing",
    tag: "Sensor",
    category: "Sensors",
    intro:
      "InvenSense MPU-6050 six-axis IMU with 3-axis gyro and accelerometer over I2C. Common for balance bots, attitude estimation, gesture recognition and drone learning projects.",
    features: [
      "3-axis gyro + 3-axis accel",
      "I2C with selectable address",
      "Onboard 3.3V LDO — 5V tolerant input",
      "INT interrupt pin",
      "Arduino / STM32 / ESP32 samples",
      "Breadboard-friendly size",
    ],
    specs: [
      ["Chip", "MPU-6050"],
      ["Bus", "I2C"],
      ["Accel range", "±2/±4/±8/±16 g"],
      ["Gyro range", "±250/±500/±1000/±2000 °/s"],
      ["Power", "3.3V / 5V"],
      ["Size", "Approx. 15 × 25 mm"],
    ],
    pins: [
      ["VCC", "Power", "3.3V or 5V"],
      ["GND", "Ground", "Common ground"],
      ["SCL", "I2C clock", "Pull-ups recommended"],
      ["SDA", "I2C data", "Pull-ups recommended"],
      ["XDA / XCL", "Aux I2C", "Optional slave sensors"],
      ["AD0", "Address", "GND=0x68, VCC=0x69"],
      ["INT", "Interrupt", "Data ready / motion"],
    ],
    package: ["MPU6050 module ×1", "Straight headers"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/mpu6050-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/mpu6050-docs.7z", format: "7Z" },
    ],
  },
  6: {
    name: "Arduino UNO R4 WiFi",
    desc: "Renesas RA4M1 with onboard WiFi, classic Arduino ecosystem",
    tag: "Starter",
    category: "MCU Boards",
    intro:
      "Arduino UNO R4 WiFi pairs Renesas RA4M1 (Cortex-M4) with an ESP32-S3 co-processor for Wi‑Fi / Bluetooth while keeping the classic UNO layout and 5V logic. Compatible with many shields and tutorials.",
    features: [
      "RA4M1 @ 48MHz with larger SRAM / Flash",
      "ESP32-S3 for Wi‑Fi + Bluetooth",
      "12×8 LED matrix for simple graphics",
      "DAC, CAN, RTC and richer peripherals",
      "USB-C, UNO shield footprint",
      "Official IDE and libraries",
    ],
    specs: [
      ["MCU", "Renesas RA4M1"],
      ["Co-proc", "ESP32-S3 (wireless)"],
      ["Logic", "5V"],
      ["Supply", "5V (USB-C / barrel)"],
      ["Digital IO", "14 (PWM on some)"],
      ["Analog in", "6 channels"],
    ],
    pins: [
      ["D0 / D1", "RX / TX", "HW UART (shared with USB)"],
      ["D2–D13", "Digital IO", "Some pins support PWM"],
      ["A0–A5", "Analog in", "Also digital capable"],
      ["SCL / SDA", "I2C", "Dedicated or A4/A5"],
      ["VIN", "External in", "~6–24V regulated"],
      ["5V / 3.3V / GND", "Power", "Shields / modules"],
      ["IOREF", "Level ref", "5V for shields"],
      ["RESET", "Reset", "Active low"],
    ],
    package: ["UNO R4 WiFi ×1", "Retail box"],
    downloads: [
      { name: "Technical Docs (ZIP)", file: "/downloads/arduino-uno-r4-docs.zip", format: "ZIP" },
      { name: "Technical Docs (7Z)", file: "/downloads/arduino-uno-r4-docs.7z", format: "7Z" },
    ],
  },
  7: {
    name: "ZM01 Multifunction Control Board",
    desc: "TFT color display, 5 keys, 12–24V input, Type-C / RJ / terminal I/O",
    tag: "New",
    category: "Display Kits",
    img: "/images/zm01-1-en.jpg",
    images: [
      { url: "/images/zm01-1-en.jpg", caption: "Overview" },
      { url: "/images/zm01-2-en.jpg", caption: "TFT display and 5 keys" },
      { url: "/images/zm01-3-en.jpg", caption: "Connectors" },
      { url: "/images/zm01-detail-en.jpg", caption: "Specs" },
    ],
    intro:
      "ZM01 (ZM01_DSNT01 V2.0) control board with a TFT color display and five keys. It accepts 12–24V and includes Type-C, DC power, an RJ port, a 2-pin terminal, a 3.5mm audio jack, a buzzer, an RTC battery and a power MOSFET driver.",
    features: [
      "TFT color display",
      "Five independent keys",
      "12–24V wide input",
      "Type-C, DC jack, RJ, 2-pin terminal and 3.5mm audio",
      "32-bit MCU with RTC battery and MOSFET driver",
      "Four mounting holes",
    ],
    specs: [
      ["Model", "ZM01 (ZM01_DSNT01 V2.0)"],
      ["Power", "12–24V DC"],
      ["MCU", "32-bit MCU (LQFP64)"],
      ["Display", "TFT color screen"],
      ["Keys", "5 independent buttons"],
      ["I/O", "DC, Type-C, 3.5mm audio, RJ, 2-pin terminal"],
      ["Mounting", "4 mounting holes"],
    ],
    pins: [
      ["VIN", "12–24V in", "Follow silkscreen polarity"],
      ["DC", "DC input", "Can be used with VIN"],
      ["Type-C", "Debug / download", "Typical UART and power"],
      ["RJ", "Comms port", "Follow silkscreen"],
      ["2P", "Terminal", "Follow silkscreen"],
      ["3.5mm", "Audio", "Audio output"],
      ["Buzzer", "Alert", "Onboard buzzer"],
      ["GND", "Ground", "Common with externals"],
    ],
    package: ["ZM01 board ×1"],
    downloads: [],
  },
};

window.getLocalizedProduct = function getLocalizedProduct(product) {
  if (!product) return null;
  if (!window.I18N || window.I18N.getLang() !== "en") return product;
  const fallback = (window.PRODUCT_EN && window.PRODUCT_EN[product.id]) || {};
  const stored = product.en && typeof product.en === "object" ? product.en : {};
  const en = Object.assign({}, fallback);
  ["name", "desc", "tag", "category", "intro", "imgCaption"].forEach((key) => {
    if (stored[key] && String(stored[key]).trim()) en[key] = stored[key];
  });
  ["features", "package", "specs", "pins", "downloads"].forEach((key) => {
    if (Array.isArray(stored[key]) && stored[key].length) en[key] = stored[key];
  });
  const next = Object.assign({}, product, en);
  const enImages = Array.isArray(stored.images) ? stored.images.filter((img) => img && img.url) : [];
  if (product.custom) {
    if (enImages.length) {
      next.images = enImages.map((img) => ({ url: img.url, caption: img.caption || "" }));
      next.img = stored.img || enImages[0].url;
    } else {
      next.img = product.img;
      next.images = (product.images || []).map((img) => {
        if (!img || typeof img === "string") return img;
        return Object.assign({}, img, { caption: img.captionEn || img.caption || "" });
      });
    }
  } else if (fallback.images) {
    next.images = fallback.images;
    if (fallback.img) next.img = fallback.img;
  }
  delete next.en;
  return next;
};

window.getProductById = function getProductById(id) {
  const list = window.PRODUCTS || [];
  const raw = list.find((p) => String(p.id) === String(id));
  return window.getLocalizedProduct(raw);
};
