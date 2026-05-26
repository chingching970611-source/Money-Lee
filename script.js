const currency = new Intl.NumberFormat("zh-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const categoryColors = {
  餐饮: "#ff8668",
  交通: "#8ec7ff",
  购物: "#ffd84f",
  学习: "#b9e6c9",
  娱乐: "#cdb8ff",
  生活: "#f2b28d",
  薪水: "#2d7d57",
  生意: "#cdb8ff",
};

const expenseCategories = ["餐饮", "交通", "购物", "学习", "娱乐", "生活"];
const incomeCategories = ["薪水", "生意"];
const today = new Date().toISOString().slice(0, 10);
const supabaseUrl = "https://suzlxzjqgqcvdxpiiokk.supabase.co";
const supabaseAnonKey = "";
const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseAnonKey.includes("PASTE") &&
    window.supabase?.createClient,
);
const cloudClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
let cloudUser = null;
let cloudBusy = false;

const defaultState = {
  budget: 1200,
  mode: "expense",
  selectedCategory: "餐饮",
  transactions: [
    { id: 1, type: "income", title: "薪水", category: "薪水", amount: 2600, date: today },
    { id: 2, type: "expense", title: "午餐", category: "餐饮", amount: 12.9, date: today },
    { id: 3, type: "expense", title: "打车", category: "交通", amount: 18.4, date: today },
    { id: 4, type: "expense", title: "课程资料", category: "学习", amount: 5.5, date: today },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("xiaoqianben-data"));
    return saved ? { ...clone(defaultState), ...saved } : clone(defaultState);
  } catch {
    return clone(defaultState);
  }
};

let state = loadState();

const saveState = () => {
  localStorage.setItem("xiaoqianben-data", JSON.stringify(state));
};

const money = (value) => `RM ${currency.format(value)}`;

const cleanText = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
};

const setHidden = (selector, hidden) => {
  const element = document.querySelector(selector);
  if (element) element.hidden = hidden;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isCloudId = (id) => uuidPattern.test(String(id));
const monthStart = () => `${today.slice(0, 7)}-01`;

const setCloudStatus = (status, note, connected = false) => {
  setText(".cloud-status", status);
  setText(".sync-note", note);
  const badge = document.querySelector(".cloud-status");
  if (badge) badge.classList.toggle("connected", connected);
};

const expenses = () => state.transactions.filter((item) => item.type === "expense");
const incomes = () => state.transactions.filter((item) => item.type === "income");
const totalExpense = () => expenses().reduce((sum, item) => sum + item.amount, 0);
const totalIncome = () => incomes().reduce((sum, item) => sum + item.amount, 0);

const getCategoryTotals = () =>
  expenses().reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
    return totals;
  }, {});

const ensureCategory = () => {
  const allowed = state.mode === "income" ? incomeCategories : expenseCategories;
  if (!allowed.includes(state.selectedCategory)) {
    state.selectedCategory = allowed[0];
  }
};

const updateModeUi = () => {
  document.querySelectorAll(".type-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === state.mode);
  });

  document.querySelectorAll(".category-choice").forEach((button) => {
    const category = button.dataset.category || "";
    const shouldShow = state.mode === "income" ? incomeCategories.includes(category) : expenseCategories.includes(category);
    button.classList.toggle("hidden", !shouldShow);
    button.classList.toggle("active", category === state.selectedCategory);
  });
};

const renderSummary = () => {
  const spent = totalExpense();
  const income = totalIncome();
  const remaining = state.budget - spent;
  const usedPercent = Math.min(Math.round((spent / state.budget) * 100), 100);
  const status = usedPercent > 95 ? "超支中" : usedPercent > 75 ? "要留意" : "健康";

  setText(".remaining-amount", money(remaining));
  setText(".spent-amount", money(spent));
  setText(".income-amount", money(income));
  setText(".entry-count", `${state.transactions.length} 笔`);
  setText(".used-percent", `${usedPercent}%`);
  setText(".budget-status", status);
  setText(".budget-amount", money(state.budget));
  setText(".cashflow-amount", money(income - spent));

  const ring = document.querySelector(".budget-ring");
  if (ring) ring.style.setProperty("--used", `${usedPercent}%`);

  const budgetSlider = document.querySelector(".budget-slider");
  if (budgetSlider) budgetSlider.value = state.budget;
};

const renderTransactions = () => {
  const list = document.querySelector(".transaction-list");
  if (!list) return;

  if (!state.transactions.length) {
    list.innerHTML = '<div class="empty-state">还没有记录。先新增一笔，小钱本就会开始帮你整理。</div>';
    return;
  }

  const sortValue = (item) => new Date(`${item.date || today}T00:00:00`).getTime() || Number(item.id) || 0;

  list.innerHTML = state.transactions
    .slice()
    .sort((a, b) => sortValue(b) - sortValue(a))
    .map((item) => {
      const isIncome = item.type === "income";
      const sign = isIncome ? "+" : "-";
      return `
        <article class="transaction-row">
          <div class="transaction-meta">
            <span class="category-dot" style="--dot: ${categoryColors[item.category] || categoryColors.生活}"></span>
            <div>
              <strong>${cleanText(item.title)}</strong>
              <p>${cleanText(item.date)} · ${cleanText(item.category)}</p>
            </div>
          </div>
          <div class="amount-group">
            <span class="transaction-amount ${isIncome ? "income" : ""}">${sign}${money(item.amount)}</span>
            <button class="delete-button" type="button" data-delete="${item.id}" aria-label="删除 ${cleanText(item.title)}">删</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderReport = () => {
  const report = document.querySelector(".category-report");
  if (!report) return;

  const totals = getCategoryTotals();
  const biggest = Math.max(...Object.values(totals), 1);

  report.innerHTML = expenseCategories
    .map((category) => {
      const amount = totals[category] || 0;
      const width = amount ? Math.max((amount / biggest) * 100, 7) : 0;
      return `
        <article class="report-row">
          <div class="report-meta">
            <span class="category-dot" style="--dot: ${categoryColors[category]}"></span>
            <div class="report-info">
              <div class="report-label">
                <strong>${category}</strong>
                <span>${money(amount)}</span>
              </div>
              <div class="report-track">
                <span class="report-fill" style="--bar-width: ${width}%; --dot: ${categoryColors[category]}"></span>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = top ? top[0] : "餐饮";
  setText(".top-category", `最大支出：${topCategory}`);
  setText(
    ".saving-tip",
    top
      ? `这个月 ${topCategory} 最高。先把这一类控制好，整个月会轻松很多。`
      : "先保持简单：自己记录每天花在哪里，慢慢看出习惯。",
  );
};

const render = () => {
  ensureCategory();
  updateModeUi();
  renderSummary();
  renderTransactions();
  renderReport();
};

const updateCloudUi = () => {
  if (!cloudClient) {
    setCloudStatus("未连接", "Supabase 还差 anon public key；本机记录照常可用。");
    setHidden(".sync-now-button", true);
    setHidden(".sync-logout-button", true);
    setHidden(".sync-login-button", false);
    return;
  }

  if (cloudUser) {
    const emailInput = document.querySelector(".sync-email");
    if (emailInput) emailInput.value = cloudUser.email || "";
    setCloudStatus("已连接", `已登入 ${cloudUser.email || "Supabase"}，新记录会同步到云端。`, true);
    setHidden(".sync-login-button", true);
    setHidden(".sync-now-button", false);
    setHidden(".sync-logout-button", false);
  } else {
    setCloudStatus("本机保存", "输入 email 后会收到登入链接，登入后才同步到 Supabase。");
    setHidden(".sync-login-button", false);
    setHidden(".sync-now-button", true);
    setHidden(".sync-logout-button", true);
  }
};

const toCloudTransaction = (item) => ({
  user_id: cloudUser.id,
  type: item.type,
  title: item.title,
  category: item.category,
  amount: item.amount,
  transaction_date: item.date || today,
  receipt_text: item.receiptText || null,
});

const fromCloudTransaction = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  category: row.category,
  amount: Number(row.amount),
  date: row.transaction_date,
  receiptText: row.receipt_text || "",
});

const saveTransactionToCloud = async (item) => {
  if (!cloudClient || !cloudUser) return null;

  const { data, error } = await cloudClient
    .from("transactions")
    .insert(toCloudTransaction(item))
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const syncBudgetToCloud = async () => {
  if (!cloudClient || !cloudUser) return;

  const { error } = await cloudClient.from("monthly_settings").upsert(
    {
      user_id: cloudUser.id,
      month_start: monthStart(),
      budget: state.budget,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month_start" },
  );

  if (error) throw error;
};

const loadBudgetFromCloud = async () => {
  if (!cloudClient || !cloudUser) return;

  const { data, error } = await cloudClient
    .from("monthly_settings")
    .select("budget")
    .eq("user_id", cloudUser.id)
    .eq("month_start", monthStart())
    .maybeSingle();

  if (error) throw error;
  if (data?.budget) state.budget = Number(data.budget);
};

const uploadLocalTransactions = async () => {
  if (!cloudClient || !cloudUser) return;

  for (const item of state.transactions) {
    if (isCloudId(item.id)) continue;
    const cloudId = await saveTransactionToCloud(item);
    if (cloudId) item.id = cloudId;
  }
};

const loadTransactionsFromCloud = async () => {
  if (!cloudClient || !cloudUser) return;

  const { data, error } = await cloudClient
    .from("transactions")
    .select("*")
    .eq("user_id", cloudUser.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.transactions = (data || []).map(fromCloudTransaction);
};

const syncCloud = async (message = "云端同步完成。") => {
  if (!cloudClient || !cloudUser || cloudBusy) return;

  cloudBusy = true;
  setCloudStatus("同步中", "正在把本机记录和 Supabase 对齐。", true);

  try {
    await uploadLocalTransactions();
    await syncBudgetToCloud();
    await loadBudgetFromCloud();
    await loadTransactionsFromCloud();
    saveState();
    render();
    setCloudStatus("已连接", message, true);
  } catch {
    setCloudStatus("同步失败", "Supabase 还没准备好，或资料表还没建立。本机记录没有丢。");
  } finally {
    cloudBusy = false;
  }
};

const initCloud = async () => {
  updateCloudUi();
  if (!cloudClient) return;

  const {
    data: { session },
  } = await cloudClient.auth.getSession();

  cloudUser = session?.user || null;
  updateCloudUi();
  if (cloudUser) await syncCloud("已和 Supabase 同步。");

  cloudClient.auth.onAuthStateChange(async (_event, session) => {
    cloudUser = session?.user || null;
    updateCloudUi();
    if (cloudUser) await syncCloud("已登入并同步到 Supabase。");
  });
};

document.querySelector(".today-label").textContent = new Date().toLocaleDateString("zh-MY", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateInput = document.querySelector(".entry-date");
if (dateInput) dateInput.value = today;

const receiptInput = document.querySelector(".receipt-input");
const receiptPreview = document.querySelector(".receipt-preview");
const receiptImage = document.querySelector(".receipt-image");
const receiptStatus = document.querySelector(".receipt-status");
const receiptHint = document.querySelector(".receipt-hint");
let receiptWorkerPromise = null;
let receiptJob = 0;
let receiptPreviewUrl = "";

const receiptToolPath = (path) => new URL(path, window.location.href).href.replace(/\/$/, "");

const setReceiptMessage = (status, hint) => {
  if (receiptStatus) receiptStatus.textContent = status;
  if (receiptHint) receiptHint.textContent = hint;
};

const updateReceiptProgress = (message) => {
  if (!message?.status) return;

  const percent = Number.isFinite(message.progress) ? Math.round(message.progress * 100) : 0;
  const labels = {
    "loading tesseract core": "正在准备识别工具",
    "initializing tesseract": "正在打开识别工具",
    "loading language traineddata": "正在读取识别资料",
    "initializing api": "正在准备读收据",
    "recognizing text": `正在读收据 ${percent}%`,
  };

  setReceiptMessage(labels[message.status] || "正在读收据", "拍清楚一点会更准，尤其是总金额那一行。");
};

const getReceiptWorker = () => {
  if (!window.Tesseract?.createWorker) {
    throw new Error("receipt scanner is not ready");
  }

  if (!receiptWorkerPromise) {
    receiptWorkerPromise = window.Tesseract.createWorker("eng", 1, {
      workerPath: receiptToolPath("./vendor/tesseract/worker.min.js"),
      corePath: receiptToolPath("./vendor/tesseract-core"),
      langPath: receiptToolPath("./vendor/tessdata"),
      logger: updateReceiptProgress,
    });
  }

  return receiptWorkerPromise;
};

const loadReceiptImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("receipt image cannot be opened"));
    };
    image.src = url;
  });

const enhanceReceiptImage = async (file) => {
  const image = await loadReceiptImage(file);
  const maxSide = 1800;
  const scale = Math.min(maxSide / Math.max(image.naturalWidth, image.naturalHeight), 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const clearer = gray < 165 ? Math.max(0, gray * 0.72) : Math.min(255, 255 - (255 - gray) * 0.66);
    data[index] = clearer;
    data[index + 1] = clearer;
    data[index + 2] = clearer;
  }

  context.putImageData(pixels, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/png", 0.96);
  });
};

const getBestReceiptText = async (worker, file) => {
  const enhancedFile = await enhanceReceiptImage(file).catch(() => file);
  const first = await worker.recognize(enhancedFile);
  const firstText = first.data.text || "";

  if (findReceiptAmount(getReceiptLines(firstText)) || enhancedFile === file) {
    return firstText;
  }

  setReceiptMessage("正在再读一次", "第一轮没有找到金额，正在用原图再试。");
  const second = await worker.recognize(file);
  const secondText = second.data.text || "";

  return secondText.length > firstText.length ? secondText : firstText;
};

const normalizeReceiptLine = (line) =>
  line
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getReceiptLines = (text) =>
  text
    .split(/\r?\n/)
    .map(normalizeReceiptLine)
    .filter((line) => line.length >= 2);

const receiptAmountPattern = /(?:RM|MYR)?\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*|[0-9]+)[.,]([0-9]{1,2})\b/gi;

const getAmountsFromLine = (line) => {
  const amounts = [];
  const matches = line.matchAll(receiptAmountPattern);

  for (const match of matches) {
    const value = Number(`${match[1].replace(/[,\s]/g, "")}.${match[2].padEnd(2, "0")}`);
    if (value > 0 && value < 100000) amounts.push(value);
  }

  return amounts;
};

const findReceiptAmount = (lines) => {
  const candidates = [];
  const strongWords = /(grand\s*total|total\s*due|amount\s*due|amount\s*payable|net\s*total|jumlah\s*besar|jumlah\s*perlu\s*dibayar|总计|總計|合计|合計|实付|實付|应付|應付)/i;
  const totalWords = /(total|amount|paid|payable|jumlah|bayar)/i;
  const weakWords = /(subtotal|sub\s*total|tax|sst|change|rounding|balance|cash|tender)/i;

  lines.forEach((line, index) => {
    getAmountsFromLine(line).forEach((amount) => {
      let score = amount / 100;
      if (strongWords.test(line)) score += 100;
      else if (totalWords.test(line)) score += 55;
      if (weakWords.test(line)) score -= 35;
      if (index < 3) score -= 10;

      candidates.push({ amount, score });
    });
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return candidates[0].amount;
};

const toReceiptDate = (year, month, day) => {
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const date = new Date(fullYear, Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }

  return [
    String(fullYear).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
};

const findReceiptDate = (text) => {
  const normalized = text.replace(/\s+/g, " ");
  const ymd = normalized.match(/\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (ymd) return toReceiptDate(ymd[1], ymd[2], ymd[3]);

  const dmy = normalized.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2,4})\b/);
  if (dmy) return toReceiptDate(dmy[3], dmy[2], dmy[1]);

  return "";
};

const findReceiptMerchant = (lines) => {
  const blocked = /(receipt|invoice|tax|sst|date|time|cashier|total|amount|member|tel|phone|address|company|reg|www|facebook|instagram|thank|welcome)/i;

  return (
    lines.find((line) => {
      const clean = line.replace(/[^A-Za-z0-9\u4e00-\u9fff &'().-]/g, "").trim();
      if (clean.length < 3 || clean.length > 42) return false;
      if (blocked.test(clean)) return false;
      if (!/[A-Za-z\u4e00-\u9fff]/.test(clean)) return false;
      if ((clean.match(/\d/g) || []).length > clean.length / 2) return false;
      return true;
    }) || ""
  );
};

const guessReceiptCategory = (text) => {
  const value = text.toLowerCase();
  const rules = [
    ["餐饮", /(restaurant|cafe|coffee|kopitiam|mamak|food|nasi|ayam|rice|pizza|burger|kfc|mcd|starbucks|tealive|zus|餐|饭|飯|咖啡|茶)/],
    ["交通", /(grab|taxi|parking|petrol|fuel|shell|petronas|caltex|toll|touch.?n.?go|交通|油|停车|停車)/],
    ["购物", /(mall|market|store|super|mart|shopee|lazada|guardian|watsons|uniqlo|购物|購物|买|買)/],
    ["学习", /(book|school|tuition|course|class|stationery|print|学习|學習|书|書|课程|課程)/],
    ["娱乐", /(cinema|movie|game|ktv|netflix|spotify|娱乐|娛樂|电影|電影)/],
  ];

  const match = rules.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : "生活";
};

const applyReceiptResult = ({ amount, merchant, date, category }) => {
  const amountInput = document.querySelector(".entry-amount");
  const titleInput = document.querySelector(".entry-title");
  const dateField = document.querySelector(".entry-date");

  if (amountInput && amount) amountInput.value = amount.toFixed(2);
  if (titleInput && merchant) titleInput.value = merchant;
  if (dateField && date) dateField.value = date;

  state.mode = "expense";
  state.selectedCategory = expenseCategories.includes(category) ? category : "生活";
  saveState();
  render();
};

receiptInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const currentJob = Date.now();
  receiptJob = currentJob;

  if (receiptImage) {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    receiptPreviewUrl = URL.createObjectURL(file);
    receiptImage.src = receiptPreviewUrl;
  }
  if (receiptPreview) {
    receiptPreview.hidden = false;
  }
  setReceiptMessage("正在整理照片", "会先自动调清楚，再找总金额、店名和日期。");
  setText(".form-note", "正在帮你整理收据照片，等一下就会自动填进表格。");

  try {
    const worker = await getReceiptWorker();
    if (receiptJob !== currentJob) return;

    const text = await getBestReceiptText(worker, file);
    if (receiptJob !== currentJob) return;

    const lines = getReceiptLines(text);
    const result = {
      amount: findReceiptAmount(lines),
      merchant: findReceiptMerchant(lines),
      date: findReceiptDate(text),
      category: guessReceiptCategory(text),
    };

    applyReceiptResult(result);

    if (result.amount || result.merchant) {
      const details = [
        result.amount ? `金额 ${money(result.amount)}` : "",
        result.merchant ? `内容 ${result.merchant}` : "",
      ].filter(Boolean);

      setReceiptMessage("已自动填好", "请看一下有没有读错，确认后按「新增记录」。");
      setText(".form-note", `收据已读取：${details.join("，")}。`);
    } else {
      setReceiptMessage("照片读不到重点", "请换一张更清楚的照片，或先手动填金额。");
      setText(".form-note", "这张收据暂时读不到金额。拍清楚总金额那一行会更准。");
    }
  } catch {
    setReceiptMessage("自动识别暂时不能用", "你还是可以先手动填，照片入口会保留。");
    setText(".form-note", "收据识别暂时不能用，我会保留手动记录，不影响新增。");
  } finally {
    event.target.value = "";
  }
});

let installPrompt = null;
const installButton = document.querySelector(".install-button");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if (installButton) installButton.hidden = false;
});

installButton?.addEventListener("click", async () => {
  if (!installPrompt) return;

  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  setText(".form-note", "小钱本已安装，可以像应用一样打开。");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      setText(".form-note", "离线功能暂时没有开启，但记账功能可以继续使用。");
    });
  });
}

document.querySelectorAll(".type-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.type || "expense";
    ensureCategory();
    saveState();
    render();
  });
});

document.querySelectorAll(".category-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCategory = button.dataset.category || "餐饮";
    saveState();
    render();
  });
});

document.querySelector(".sync-login-button")?.addEventListener("click", async () => {
  if (!cloudClient) {
    setCloudStatus("未连接", "请先加入 Supabase anon public key，我就能帮你开启云端同步。");
    return;
  }

  const email = document.querySelector(".sync-email")?.value.trim();
  if (!email) {
    setCloudStatus("需要 email", "输入你的 email 后，我会发送 Supabase 登入链接。");
    return;
  }

  const { error } = await cloudClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });

  if (error) {
    setCloudStatus("发送失败", "Supabase 暂时不能发送登入链接，请检查 email 或稍后再试。");
  } else {
    setCloudStatus("已发送", "请去 email 点登入链接，回来后会自动同步。");
  }
});

document.querySelector(".sync-now-button")?.addEventListener("click", async () => {
  await syncCloud("云端同步完成。");
});

document.querySelector(".sync-logout-button")?.addEventListener("click", async () => {
  if (cloudClient) await cloudClient.auth.signOut();
  cloudUser = null;
  updateCloudUi();
});

document.querySelector(".budget-slider")?.addEventListener("input", (event) => {
  state.budget = Number(event.target.value);
  saveState();
  render();
});

document.querySelector(".entry-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amountInput = document.querySelector(".entry-amount");
  const titleInput = document.querySelector(".entry-title");
  const dateField = document.querySelector(".entry-date");
  const amount = Number(amountInput.value);
  const title = titleInput.value.trim();

  if (!amount || !title) return;

  const transaction = {
    id: Date.now(),
    type: state.mode,
    title,
    category: state.selectedCategory,
    amount,
    date: dateField.value || today,
  };

  state.transactions.push(transaction);

  amountInput.value = "";
  titleInput.value = "";
  dateField.value = today;
  setText(".form-note", `已新增：${title} ${money(amount)}`);
  saveState();
  render();

  try {
    const cloudId = await saveTransactionToCloud(transaction);
    if (cloudId) {
      transaction.id = cloudId;
      saveState();
      render();
      setCloudStatus("已连接", "这笔记录已同步到 Supabase。", true);
    }
  } catch {
    setCloudStatus("同步失败", "这笔先保存在本机；Supabase 准备好后可按立即同步。");
  }
});

document.querySelector(".transaction-list")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  state.transactions = state.transactions.filter((item) => String(item.id) !== id);
  setText(".form-note", "已删除一笔记录。");
  saveState();
  render();

  if (cloudClient && cloudUser && isCloudId(id)) {
    const { error } = await cloudClient.from("transactions").delete().eq("id", id).eq("user_id", cloudUser.id);
    if (error) setCloudStatus("云端删除失败", "本机已删除，云端稍后可按立即同步再整理。");
  }
});

document.querySelector(".reset-button")?.addEventListener("click", () => {
  state = clone(defaultState);
  localStorage.setItem("xiaoqianben-data", JSON.stringify(state));
  setText(".form-note", "示例已重设，可以重新开始试。");
  render();
});

document.querySelector(".clear-button")?.addEventListener("click", async () => {
  state.transactions = [];
  saveState();
  setText(".form-note", "已清空全部记录。");
  render();

  if (cloudClient && cloudUser) {
    const { error } = await cloudClient.from("transactions").delete().eq("user_id", cloudUser.id);
    if (error) setCloudStatus("云端清空失败", "本机已清空，云端稍后再同步整理。");
  }
});

document.querySelector(".export-button")?.addEventListener("click", () => {
  const header = "日期,类型,分类,内容,金额";
  const rows = state.transactions.map((item) =>
    [
      item.date,
      item.type === "income" ? "收入" : "支出",
      item.category,
      item.title,
      item.amount,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "小钱本记录.csv";
  link.click();
  URL.revokeObjectURL(url);
  setText(".form-note", "已准备导出记录。");
});

render();
initCloud();
