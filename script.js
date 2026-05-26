const currency = new Intl.NumberFormat("zh-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const categoryColors = {
  餐饮: "#ff8668",
  交通: "#5ba6e6",
  购物: "#d9a72f",
  学习: "#4d8f73",
  娱乐: "#8f74d9",
  生活: "#a86f45",
  健康: "#e36f88",
  住宿: "#6876d8",
};

const expenseCategories = ["餐饮", "交通", "购物", "学习", "娱乐", "生活", "健康", "住宿"];
const moneySources = ["电子钱包", "银行户口", "银行扣账", "现金", "其他"];
const incomeSources = ["薪水", "生意", "兼职", "家人", "投资", "其他"];
const defaultPlan = { incomeAmount: 2600, incomeSource: "薪水", budget: 1200 };
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
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
let planSyncTimer = null;

const pad = (value) => String(value).padStart(2, "0");
const monthKey = (year, month) => `${year}-${pad(month)}`;
const selectedKey = () => monthKey(state.selectedYear, state.selectedMonth);
const monthStart = (year = state.selectedYear, month = state.selectedMonth) => `${monthKey(year, month)}-01`;
const nextMonthStart = (year = state.selectedYear, month = state.selectedMonth) => {
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
};

const defaultState = {
  selectedYear: currentYear,
  selectedMonth: currentMonth,
  selectedCategory: "餐饮",
  selectedSource: "电子钱包",
  yearPlans: {
    [currentYear]: { ...defaultPlan },
  },
  transactions: [
    {
      id: 1,
      type: "expense",
      title: "午餐",
      category: "餐饮",
      source: "电子钱包",
      amount: 12.9,
      date: today,
      receiptText: "",
      receiptImage: "",
      createdAt: now.toISOString(),
    },
    {
      id: 2,
      type: "expense",
      title: "打车",
      category: "交通",
      source: "银行扣账",
      amount: 18.4,
      date: today,
      receiptText: "",
      receiptImage: "",
      createdAt: now.toISOString(),
    },
    {
      id: 3,
      type: "expense",
      title: "课程资料",
      category: "学习",
      source: "银行户口",
      amount: 5.5,
      date: today,
      receiptText: "",
      receiptImage: "",
      createdAt: now.toISOString(),
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const money = (value) => `RM ${currency.format(Number(value) || 0)}`;

const cleanText = (value) =>
  String(value ?? "")
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

const normalizePlan = (plan = {}) => {
  const incomeAmount = Number(plan.incomeAmount ?? plan.income_amount ?? plan.income ?? defaultPlan.incomeAmount);
  const budget = Number(plan.budget ?? defaultPlan.budget);
  const incomeSource = incomeSources.includes(plan.incomeSource || plan.income_source)
    ? plan.incomeSource || plan.income_source
    : defaultPlan.incomeSource;

  return {
    incomeAmount: Number.isFinite(incomeAmount) && incomeAmount >= 0 ? incomeAmount : defaultPlan.incomeAmount,
    incomeSource,
    budget: Number.isFinite(budget) && budget > 0 ? budget : defaultPlan.budget,
  };
};

const ensurePlanFor = (target, year) => {
  const key = String(year || currentYear);
  if (!target.yearPlans || typeof target.yearPlans !== "object") {
    target.yearPlans = {};
  }

  if (!target.yearPlans[key]) {
    const fallback =
      target.yearPlans[String(currentYear)] ||
      Object.values(target.yearPlans).find(Boolean) ||
      defaultPlan;
    target.yearPlans[key] = normalizePlan(fallback);
  } else {
    target.yearPlans[key] = normalizePlan(target.yearPlans[key]);
  }

  return target.yearPlans[key];
};

const getDateParts = (dateText) => {
  const [year, month, day] = String(dateText || today)
    .split("-")
    .map((part) => Number(part));

  return {
    year: Number.isFinite(year) ? year : currentYear,
    month: Number.isFinite(month) ? month : currentMonth,
    day: Number.isFinite(day) ? day : 1,
  };
};

const normalizeExpense = (item, index) => {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const category = expenseCategories.includes(item.category) ? item.category : "生活";
  const source = moneySources.includes(item.source || item.moneySource || item.money_source)
    ? item.source || item.moneySource || item.money_source
    : "电子钱包";

  return {
    id: item.id ?? Date.now() + index,
    type: "expense",
    title: String(item.title || item.name || category).trim() || category,
    category,
    source,
    amount,
    date: item.date || item.transaction_date || today,
    receiptText: item.receiptText || item.receipt_text || "",
    receiptImage: item.receiptImage || item.receipt_image || "",
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
};

const migrateState = (saved) => {
  const next = { ...clone(defaultState), ...(saved || {}) };
  next.selectedYear = Number(next.selectedYear) || currentYear;
  next.selectedMonth = Math.min(Math.max(Number(next.selectedMonth) || currentMonth, 1), 12);
  next.selectedCategory = expenseCategories.includes(next.selectedCategory) ? next.selectedCategory : "餐饮";
  next.selectedSource = moneySources.includes(next.selectedSource) ? next.selectedSource : "电子钱包";
  next.yearPlans = {};

  Object.entries(saved?.yearPlans || {}).forEach(([year, plan]) => {
    next.yearPlans[String(year)] = normalizePlan(plan);
  });

  if (saved?.monthlySettings && typeof saved.monthlySettings === "object") {
    Object.entries(saved.monthlySettings).forEach(([key, setting]) => {
      const year = String(key).slice(0, 4);
      if (!next.yearPlans[year]) next.yearPlans[year] = normalizePlan(setting);
    });
  }

  if (saved?.budget) {
    ensurePlanFor(next, currentYear).budget = Number(saved.budget) || defaultPlan.budget;
  }

  const incomeByYear = {};
  const rawTransactions = Array.isArray(saved?.transactions) ? saved.transactions : clone(defaultState.transactions);
  next.transactions = rawTransactions
    .map((item, index) => {
      if (item?.type === "income") {
        const { year } = getDateParts(item.date || today);
        incomeByYear[year] = (incomeByYear[year] || 0) + Number(item.amount || 0);
        return null;
      }

      return normalizeExpense(item, index);
    })
    .filter(Boolean);

  Object.entries(incomeByYear).forEach(([year, amount]) => {
    if (amount > 0 && !next.yearPlans[year]) {
      next.yearPlans[year] = normalizePlan({
        incomeAmount: amount,
        incomeSource: "薪水",
        budget: saved?.budget || defaultPlan.budget,
      });
    }
  });

  ensurePlanFor(next, next.selectedYear);
  return next;
};

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("xiaoqianben-data"));
    return migrateState(saved);
  } catch {
    return migrateState();
  }
};

let state = loadState();

const saveState = () => {
  localStorage.setItem("xiaoqianben-data", JSON.stringify(state));
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isCloudId = (id) => uuidPattern.test(String(id));

const getSelectedPlan = () => ensurePlanFor(state, state.selectedYear);
const expenses = () => state.transactions.filter((item) => item.type === "expense");
const selectedExpenses = () => expenses().filter((item) => String(item.date || today).slice(0, 7) === selectedKey());
const monthExpenses = (year, month) =>
  expenses().filter((item) => String(item.date || today).slice(0, 7) === monthKey(year, month));
const total = (items) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const getCategoryTotals = (items = selectedExpenses()) =>
  items.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
    return totals;
  }, {});

const getSourceTotals = (items = selectedExpenses()) =>
  items.reduce((totals, item) => {
    totals[item.source] = (totals[item.source] || 0) + item.amount;
    return totals;
  }, {});

const setCloudStatus = (status, note, connected = false) => {
  setText(".cloud-status", status);
  setText(".sync-note", note);
  const badge = document.querySelector(".cloud-status");
  if (badge) badge.classList.toggle("connected", connected);
};

const updateSelectedButtons = () => {
  document.querySelectorAll(".category-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.selectedCategory);
  });

  document.querySelectorAll(".source-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === state.selectedSource);
  });
};

const updateEntryDateForSelectedMonth = () => {
  const dateInput = document.querySelector(".entry-date");
  if (!dateInput) return;

  const currentKey = monthKey(currentYear, currentMonth);
  dateInput.value = selectedKey() === currentKey ? today : monthStart();
};

const renderMonthControls = () => {
  const yearSelect = document.querySelector(".year-select");
  const monthSelect = document.querySelector(".month-select");
  const yearStart = Math.min(currentYear - 5, state.selectedYear);
  const yearEnd = Math.max(currentYear + 3, state.selectedYear);

  if (yearSelect) {
    yearSelect.innerHTML = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => yearStart + index)
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
    yearSelect.value = String(state.selectedYear);
  }

  if (monthSelect) {
    monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => index + 1)
      .map((month) => `<option value="${month}">${month}月</option>`)
      .join("");
    monthSelect.value = String(state.selectedMonth);
  }

  setText(".current-month-title", `${state.selectedYear}年${state.selectedMonth}月账本`);
  setText(".selected-period-label", `${state.selectedYear}年${state.selectedMonth}月`);
  setText(".plan-year-label", `${state.selectedYear} 年`);
};

const renderPlanControls = () => {
  const plan = getSelectedPlan();
  const incomeInput = document.querySelector(".monthly-income-input");
  const sourceSelect = document.querySelector(".income-source-select");
  const budgetSlider = document.querySelector(".budget-slider");

  if (incomeInput && document.activeElement !== incomeInput) incomeInput.value = plan.incomeAmount || "";
  if (sourceSelect) sourceSelect.value = plan.incomeSource;
  if (budgetSlider) budgetSlider.value = plan.budget;
  setText(".budget-amount", money(plan.budget));
  setText(".plan-note", `这个设定会自动用在 ${state.selectedYear} 年每个月。`);
};

const renderSummary = () => {
  const plan = getSelectedPlan();
  const spent = total(selectedExpenses());
  const income = plan.incomeAmount;
  const saving = income - spent;
  const usedPercent = plan.budget ? Math.min(Math.round((spent / plan.budget) * 100), 100) : 0;
  const status = usedPercent > 95 ? "超支中" : usedPercent > 75 ? "要留意" : "健康";

  setText(".saving-amount", money(saving));
  setText(".spent-amount", money(spent));
  setText(".income-amount", money(income));
  setText(".entry-count", `${selectedExpenses().length} 笔`);
  setText(".used-percent", `${usedPercent}%`);
  setText(".budget-status", status);

  const ring = document.querySelector(".budget-ring");
  if (ring) ring.style.setProperty("--used", `${usedPercent}%`);
};

const renderTransactions = () => {
  const list = document.querySelector(".transaction-list");
  if (!list) return;

  const items = selectedExpenses();
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">这个月还没有消费记录。新增一笔后，这里会自动整理。</div>';
    return;
  }

  const sortValue = (item) =>
    new Date(`${item.date || today}T00:00:00`).getTime() + new Date(item.createdAt || 0).getTime() / 100000000;

  list.innerHTML = items
    .slice()
    .sort((a, b) => sortValue(b) - sortValue(a))
    .map(
      (item) => `
        <article class="transaction-row">
          <div class="transaction-main">
            ${
              item.receiptImage
                ? `<img class="receipt-thumb" src="${item.receiptImage}" alt="${cleanText(item.title)} 的收据" />`
                : `<span class="category-dot" style="--dot: ${categoryColors[item.category] || categoryColors.生活}"></span>`
            }
            <div class="transaction-meta">
              <strong>${cleanText(item.title || item.category)}</strong>
              <p>${cleanText(item.date)} · ${cleanText(item.source)} · ${cleanText(item.category)}</p>
            </div>
          </div>
          <div class="amount-group">
            <span class="transaction-amount">-${money(item.amount)}</span>
            <button class="delete-button" type="button" data-delete="${cleanText(item.id)}" aria-label="删除 ${cleanText(item.title)}">删</button>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderReport = () => {
  const report = document.querySelector(".category-report");
  if (!report) return;

  const items = selectedExpenses();
  const totals = getCategoryTotals(items);
  const sourceTotals = getSourceTotals(items);
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
  const topSource = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = top ? top[0] : "餐饮";
  setText(".top-category", `最大支出：${topCategory}`);
  setText(
    ".saving-tip",
    top
      ? `${topCategory} 最高，主要从 ${topSource?.[0] || "常用来源"} 支出。`
      : "先记录一个月，就会看出自己的消费习惯。",
  );
};

const renderAnnualReport = () => {
  const plan = getSelectedPlan();
  const monthLimit = state.selectedMonth;
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const annualExpense = months
    .filter((month) => month <= monthLimit)
    .reduce((sum, month) => sum + total(monthExpenses(state.selectedYear, month)), 0);
  const annualIncome = plan.incomeAmount * monthLimit;
  const annualSaving = annualIncome - annualExpense;
  const biggest = Math.max(
    plan.incomeAmount,
    ...months.map((month) => total(monthExpenses(state.selectedYear, month))),
    1,
  );

  setText(".annual-period-label", `累计到 ${state.selectedMonth} 月`);
  setText(".annual-income", money(annualIncome));
  setText(".annual-expense", money(annualExpense));
  setText(".annual-saving", money(annualSaving));

  const annualBars = document.querySelector(".annual-bars");
  if (!annualBars) return;

  annualBars.innerHTML = months
    .map((month) => {
      const expense = total(monthExpenses(state.selectedYear, month));
      const muted = month > monthLimit;
      const incomeWidth = Math.max((plan.incomeAmount / biggest) * 100, plan.incomeAmount ? 4 : 0);
      const expenseWidth = Math.max((expense / biggest) * 100, expense ? 4 : 0);

      return `
        <article class="annual-row ${muted ? "muted" : ""}">
          <span>${month}月</span>
          <div class="annual-track-group">
            <div class="annual-track income-track" aria-label="${month}月收入">
              <span style="--bar-width: ${incomeWidth}%"></span>
            </div>
            <div class="annual-track expense-track" aria-label="${month}月消费">
              <span style="--bar-width: ${expenseWidth}%"></span>
            </div>
          </div>
          <strong>${muted ? "未到" : money(plan.incomeAmount - expense)}</strong>
        </article>
      `;
    })
    .join("");
};

const render = () => {
  ensurePlanFor(state, state.selectedYear);
  updateSelectedButtons();
  renderMonthControls();
  renderPlanControls();
  renderSummary();
  renderTransactions();
  renderReport();
  renderAnnualReport();
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
  type: "expense",
  title: item.title,
  category: item.category,
  amount: item.amount,
  transaction_date: item.date || today,
  money_source: item.source || "电子钱包",
  receipt_text: item.receiptText || null,
  receipt_image: item.receiptImage || null,
});

const fromCloudTransaction = (row) =>
  normalizeExpense({
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    date: row.transaction_date,
    money_source: row.money_source,
    receipt_text: row.receipt_text,
    receipt_image: row.receipt_image,
    created_at: row.created_at,
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

const syncYearPlansToCloud = async () => {
  if (!cloudClient || !cloudUser) return;

  const rows = Object.entries(state.yearPlans).map(([year, plan]) => ({
    user_id: cloudUser.id,
    plan_year: Number(year),
    income_amount: Number(plan.incomeAmount) || 0,
    income_source: plan.incomeSource || "薪水",
    budget: Number(plan.budget) || defaultPlan.budget,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await cloudClient.from("year_plans").upsert(rows, {
    onConflict: "user_id,plan_year",
  });

  if (error) throw error;
};

const loadYearPlansFromCloud = async () => {
  if (!cloudClient || !cloudUser) return;

  const { data, error } = await cloudClient.from("year_plans").select("*").eq("user_id", cloudUser.id);
  if (error) throw error;

  (data || []).forEach((row) => {
    state.yearPlans[String(row.plan_year)] = normalizePlan(row);
  });
  ensurePlanFor(state, state.selectedYear);
};

const schedulePlanSync = () => {
  if (!cloudClient || !cloudUser) return;
  window.clearTimeout(planSyncTimer);
  planSyncTimer = window.setTimeout(async () => {
    try {
      await syncYearPlansToCloud();
      setCloudStatus("已连接", "收入和预算设定已同步。", true);
    } catch {
      setCloudStatus("同步失败", "这次设定先保存在本机；Supabase 准备好后可按立即同步。");
    }
  }, 700);
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
    .eq("type", "expense")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.transactions = (data || []).map(fromCloudTransaction).filter(Boolean);
};

const syncCloud = async (message = "云端同步完成。") => {
  if (!cloudClient || !cloudUser || cloudBusy) return;

  cloudBusy = true;
  setCloudStatus("同步中", "正在把本机记录和 Supabase 对齐。", true);

  try {
    await uploadLocalTransactions();
    await syncYearPlansToCloud();
    await loadYearPlansFromCloud();
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

const receiptInput = document.querySelector(".receipt-input");
const receiptPreview = document.querySelector(".receipt-preview");
const receiptImage = document.querySelector(".receipt-image");
const receiptStatus = document.querySelector(".receipt-status");
const receiptHint = document.querySelector(".receipt-hint");
let receiptWorkerPromise = null;
let receiptJob = 0;
let receiptPreviewUrl = "";
let pendingReceipt = { image: "", text: "" };

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

  setReceiptMessage(labels[message.status] || "正在读收据", "拍清楚总金额那一行会更准。");
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

const createReceiptArchiveImage = async (file) => {
  const image = await loadReceiptImage(file);
  const maxSide = 900;
  const scale = Math.min(maxSide / Math.max(image.naturalWidth, image.naturalHeight), 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.68);
};

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
    ["健康", /(clinic|hospital|pharmacy|doctor|guardian|watsons|medicine|health|诊所|診所|药|藥|医院|醫院)/],
    ["住宿", /(rent|room|hotel|airbnb|hostel|住宿|房租|租金|酒店)/],
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
  if (dateField && date) {
    dateField.value = date;
    const parts = getDateParts(date);
    state.selectedYear = parts.year;
    state.selectedMonth = parts.month;
    ensurePlanFor(state, state.selectedYear);
  }

  state.selectedCategory = expenseCategories.includes(category) ? category : "生活";
  saveState();
  render();
};

const resetReceiptPreview = () => {
  pendingReceipt = { image: "", text: "" };
  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
  receiptPreviewUrl = "";
  if (receiptImage) receiptImage.removeAttribute("src");
  if (receiptPreview) receiptPreview.hidden = true;
  setReceiptMessage("已选择照片", "请确认金额有没有读错，再按新增消费。");
};

receiptInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const currentJob = Date.now();
  receiptJob = currentJob;
  pendingReceipt = { image: "", text: "" };

  if (receiptImage) {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    receiptPreviewUrl = URL.createObjectURL(file);
    receiptImage.src = receiptPreviewUrl;
  }
  if (receiptPreview) receiptPreview.hidden = false;
  setReceiptMessage("正在整理照片", "会先自动调清楚，再找总金额、店名和日期。");
  setText(".form-note", "正在帮你整理收据照片，等一下就会自动填进表格。");

  try {
    pendingReceipt.image = await createReceiptArchiveImage(file).catch(() => "");
    if (pendingReceipt.image && receiptImage) receiptImage.src = pendingReceipt.image;

    const worker = await getReceiptWorker();
    if (receiptJob !== currentJob) return;

    const text = await getBestReceiptText(worker, file);
    if (receiptJob !== currentJob) return;
    pendingReceipt.text = text.slice(0, 5000);

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

      setReceiptMessage("已自动填好", "请看一下有没有读错，确认后按「新增消费」。");
      setText(".form-note", `收据已读取：${details.join("，")}。`);
    } else {
      setReceiptMessage("照片已保存", "暂时读不到金额，你可以手动填；照片还是会跟着记录保存。");
      setText(".form-note", "这张收据暂时读不到金额。拍清楚总金额那一行会更准。");
    }
  } catch {
    setReceiptMessage("照片已保存", "自动读取暂时不能用，你可以先手动填。");
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

document.querySelector(".month-prev")?.addEventListener("click", () => {
  state.selectedMonth -= 1;
  if (state.selectedMonth < 1) {
    state.selectedMonth = 12;
    state.selectedYear -= 1;
  }
  ensurePlanFor(state, state.selectedYear);
  updateEntryDateForSelectedMonth();
  saveState();
  render();
});

document.querySelector(".month-next")?.addEventListener("click", () => {
  state.selectedMonth += 1;
  if (state.selectedMonth > 12) {
    state.selectedMonth = 1;
    state.selectedYear += 1;
  }
  ensurePlanFor(state, state.selectedYear);
  updateEntryDateForSelectedMonth();
  saveState();
  render();
});

document.querySelector(".year-select")?.addEventListener("change", (event) => {
  state.selectedYear = Number(event.target.value) || currentYear;
  ensurePlanFor(state, state.selectedYear);
  updateEntryDateForSelectedMonth();
  saveState();
  render();
});

document.querySelector(".month-select")?.addEventListener("change", (event) => {
  state.selectedMonth = Number(event.target.value) || currentMonth;
  updateEntryDateForSelectedMonth();
  saveState();
  render();
});

document.querySelectorAll(".category-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCategory = button.dataset.category || "餐饮";
    saveState();
    render();
  });
});

document.querySelectorAll(".source-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedSource = button.dataset.source || "电子钱包";
    saveState();
    render();
  });
});

document.querySelector(".monthly-income-input")?.addEventListener("input", (event) => {
  const plan = getSelectedPlan();
  plan.incomeAmount = Number(event.target.value) || 0;
  saveState();
  renderSummary();
  renderAnnualReport();
  schedulePlanSync();
});

document.querySelector(".income-source-select")?.addEventListener("change", (event) => {
  const plan = getSelectedPlan();
  plan.incomeSource = incomeSources.includes(event.target.value) ? event.target.value : "薪水";
  saveState();
  renderPlanControls();
  schedulePlanSync();
});

document.querySelector(".budget-slider")?.addEventListener("input", (event) => {
  const plan = getSelectedPlan();
  plan.budget = Number(event.target.value) || defaultPlan.budget;
  saveState();
  renderPlanControls();
  renderSummary();
  schedulePlanSync();
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

document.querySelector(".entry-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amountInput = document.querySelector(".entry-amount");
  const titleInput = document.querySelector(".entry-title");
  const dateField = document.querySelector(".entry-date");
  const amount = Number(amountInput.value);
  const date = dateField.value || monthStart();

  if (!amount) return;

  const parts = getDateParts(date);
  state.selectedYear = parts.year;
  state.selectedMonth = parts.month;
  ensurePlanFor(state, state.selectedYear);

  const title = titleInput.value.trim() || state.selectedCategory;
  const transaction = {
    id: Date.now(),
    type: "expense",
    title,
    category: state.selectedCategory,
    source: state.selectedSource,
    amount,
    date,
    receiptText: pendingReceipt.text,
    receiptImage: pendingReceipt.image,
    createdAt: new Date().toISOString(),
  };

  state.transactions.push(transaction);

  amountInput.value = "";
  titleInput.value = "";
  updateEntryDateForSelectedMonth();
  resetReceiptPreview();
  setText(".form-note", `已新增：${title} ${money(amount)}`);
  saveState();
  render();

  try {
    const cloudId = await saveTransactionToCloud(transaction);
    if (cloudId) {
      transaction.id = cloudId;
      saveState();
      render();
      setCloudStatus("已连接", "这笔消费已同步到 Supabase。", true);
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
  setText(".form-note", "已删除一笔消费记录。");
  saveState();
  render();

  if (cloudClient && cloudUser && isCloudId(id)) {
    const { error } = await cloudClient.from("transactions").delete().eq("id", id).eq("user_id", cloudUser.id);
    if (error) setCloudStatus("云端删除失败", "本机已删除，云端稍后可按立即同步再整理。");
  }
});

document.querySelector(".reset-button")?.addEventListener("click", () => {
  state = clone(defaultState);
  saveState();
  updateEntryDateForSelectedMonth();
  resetReceiptPreview();
  setText(".form-note", "示例已重设，可以重新开始试。");
  render();
});

document.querySelector(".clear-button")?.addEventListener("click", async () => {
  const start = monthStart();
  const end = nextMonthStart();
  state.transactions = state.transactions.filter((item) => {
    const date = item.date || today;
    return date < start || date >= end;
  });
  saveState();
  setText(".form-note", "已清空这个月的消费记录。");
  render();

  if (cloudClient && cloudUser) {
    const { error } = await cloudClient
      .from("transactions")
      .delete()
      .eq("user_id", cloudUser.id)
      .gte("transaction_date", start)
      .lt("transaction_date", end);
    if (error) setCloudStatus("云端清空失败", "本机已清空，云端稍后再同步整理。");
  }
});

document.querySelector(".export-button")?.addEventListener("click", () => {
  const header = "日期,来源,分类,内容,金额,有收据";
  const rows = expenses().map((item) =>
    [
      item.date,
      item.source,
      item.category,
      item.title,
      item.amount,
      item.receiptImage ? "有" : "无",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "小钱本消费记录.csv";
  link.click();
  URL.revokeObjectURL(url);
  setText(".form-note", "已准备导出消费记录。");
});

updateEntryDateForSelectedMonth();
render();
initCloud();
