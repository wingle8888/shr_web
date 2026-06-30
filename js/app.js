const products = [
  {
    id: 1,
    name: "STM32H750 开发板",
    desc: "480MHz Cortex-M7，1MB Flash，外置 SDRAM，适合高性能嵌入式应用",
    price: 189,
    tag: "热卖",
    img: "https://picsum.photos/seed/stm32/400/250",
  },
  {
    id: 2,
    name: "ESP32-S3 开发套件",
    desc: "WiFi + BLE 5.0，双核 240MHz，内置 AI 加速，IoT 首选",
    price: 68,
    tag: "推荐",
    img: "https://picsum.photos/seed/esp32/400/250",
  },
  {
    id: 3,
    name: "Raspberry Pi 5 主板",
    desc: "博通 BCM2712 四核 2.4GHz，8GB RAM，PCIe 2.0 接口",
    price: 599,
    tag: "新品",
    img: "https://picsum.photos/seed/rpi5/400/250",
  },
  {
    id: 4,
    name: "LVGL 触摸屏套件",
    desc: "4.3 寸 IPS 电容屏 + STM32F429，预装 LVGL 图形库 Demo",
    price: 258,
    tag: "套装",
    img: "https://picsum.photos/seed/lvgl/400/250",
  },
  {
    id: 5,
    name: "MPU6050 传感器模块",
    desc: "六轴陀螺仪 + 加速度计，I2C 接口，姿态检测必备",
    price: 12,
    tag: "传感器",
    img: "https://picsum.photos/seed/mpu6050/400/250",
  },
  {
    id: 6,
    name: "Arduino UNO R4 WiFi",
    desc: "Renesas RA4M1 芯片，内置 WiFi，兼容 Arduino 生态",
    price: 145,
    tag: "入门",
    img: "https://picsum.photos/seed/arduino/400/250",
  },
];

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = products
    .map(
      (p) => `
    <div class="card">
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <div class="card-body">
        <span class="card-tag">${p.tag}</span>
        <h3>${p.name}</h3>
        <p class="card-desc">${p.desc}</p>
        <div class="card-price"><small>¥</small>${p.price}</div>
        <button class="btn" onclick="handleInquiry('${p.name}')">咨询采购</button>
      </div>
    </div>
  `
    )
    .join("");
}

function handleInquiry(productName) {
  showToast(`已记录您对「${productName}」的咨询，我们将尽快联系您！`);
  document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
}

function handleContactSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("formName").value.trim();
  showToast(`感谢 ${name || "您"} 的留言，我们会尽快回复！`);
  e.target.reset();
}

function initNav() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");

  toggle.addEventListener("click", () => nav.classList.toggle("open"));

  document.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });

  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll("nav a");

  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach((section) => {
      if (window.scrollY >= section.offsetTop - 100) {
        current = section.id;
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  initNav();

  document.getElementById("contactForm").addEventListener("submit", handleContactSubmit);

  document.getElementById("heroBtn").addEventListener("click", () => {
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("headerCta").addEventListener("click", () => {
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  });
});