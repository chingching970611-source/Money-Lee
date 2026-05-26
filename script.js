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
const moneySources = ["Debit Card", "Credit Card", "TNG", "Grab", "Atome", "Shopee", "Cash", "其他"];
const defaultMoneySource = "Debit Card";
const sourceAliases = {
  电子钱包: "TNG",
  银行户口: "Debit Card",
  银行扣账: "Debit Card",
  现金: "Cash",
  ShopeePay: "Shopee",
  "Shopee Pay": "Shopee",
  "Shopee PayLater": "Shopee",
  "Shopee Payback Later": "Shopee",
  "GrabPay": "Grab",
  "Grab Pay": "Grab",
  "Grab PayLater": "Grab",
  "Touch n Go": "TNG",
  "Touch 'n Go": "TNG",
  "Touch & Go": "TNG",
};
const incomeSources = ["薪水", "生意", "兼职", "家人", "投资", "其他"];
const extraIncomeSources = ["Commission", "奖金", "兼职", "生意", "其他"];
const fixedExpensePresets = ["Credit Card", "Shopee PayLater", "Grab PayLater", "Insurance", "Telecom", "Atome", "其他"];
const viewNames = ["dashboard", "add", "records", "reports", "couple"];
const defaultPlan = { incomeAmount: 0, incomeSource: "薪水", budget: 0 };
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const pad = (value) => String(value).padStart(2, "0");
const monthKey = (year, month) => `${year}-${pad(month)}`;
const selectedKey = () => monthKey(state.selectedYear, state.selectedMonth);
const monthStart = (year = state.selectedYear, month = state.selectedMonth) => `${monthKey(year, month)}-01`;
const nextMonthStart = (year = state.selectedYear, month = state.selectedMonth) => {
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
};

const defaultState = {
  activeView: "dashboard",
  editingExpenseId: null,
  selectedYear: currentYear,
  selectedMonth: currentMonth,
  selectedCategory: "餐饮",
  selectedSource: defaultMoneySource,
  customSource: "",
  yearPlans: {
    [currentYear]: { ...defaultPlan },
  },
  transactions: [],
  incomeEntries: [],
  fixedExpenses: [],
  couple: {
    myName: "",
    partnerName: "",
    linkCode: "",
    connected: false,
  },
  coupleRequests: [],
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

const normalizeMoneySource = (value) => {
  const source = String(value || "").trim();
  if (!source) return defaultMoneySource;
  return sourceAliases[source] || source;
};

const splitSourceForForm = (value) => {
  const source = normalizeMoneySource(value);
  return moneySources.includes(source)
    ? { selectedSource: source, customSource: "" }
    : { selectedSource: "其他", customSource: source };
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
    budget: Number.isFinite(budget) && budget >= 0 ? budget : defaultPlan.budget,
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
  const source = normalizeMoneySource(item.source || item.moneySource || item.money_source);

  return {
    id: item.id ?? Date.now() + index,
    type: "expense",
    title: String(item.title || item.name || category).trim() || category,
    merchant: String(item.merchant || item.company || item.store || "").trim(),
    reference: String(item.reference || item.receiptNo || item.receipt_no || item.paymentNo || item.payment_no || "").trim(),
    category,
    source,
    amount,
    date: item.date || item.transaction_date || today,
    receiptText: item.receiptText || item.receipt_text || "",
    receiptImage: item.receiptImage || item.receipt_image || "",
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
};

const normalizeIncomeEntry = (item, index) => {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const source = extraIncomeSources.includes(item.source || item.moneySource || item.money_source || item.category)
    ? item.source || item.moneySource || item.money_source || item.category
    : "Commission";

  return {
    id: item.id ?? Date.now() + index,
    type: "income",
    title: String(item.title || item.name || source).trim() || source,
    source,
    category: source,
    amount,
    date: item.date || item.transaction_date || today,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
};

const normalizeFixedExpense = (item, index) => {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const title = String(item.title || item.name || item.label || "固定支出").trim() || "固定支出";
  const category = expenseCategories.includes(item.category) ? item.category : "生活";
  const source = normalizeMoneySource(item.source || item.moneySource || item.money_source || "Credit Card");
  const year = Number(item.year || item.selectedYear || item.selected_year || currentYear) || currentYear;

  return {
    id: item.id ?? Date.now() + index,
    type: "fixed-expense",
    title,
    category,
    source,
    amount,
    year,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
};

const normalizeCouple = (couple = {}) => ({
  myName: String(couple.myName || couple.my_name || "").trim(),
  partnerName: String(couple.partnerName || couple.partner_name || "").trim(),
  linkCode: String(couple.linkCode || couple.link_code || "").trim(),
  connected: Boolean(couple.connected),
});

const normalizeCoupleRequest = (item, index) => {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const owner = item.owner === "me" ? "me" : "partner";
  const status = ["pending", "approved", "rejected"].includes(item.status) ? item.status : "pending";
  const category = expenseCategories.includes(item.category) ? item.category : "生活";
  const source = normalizeMoneySource(item.source || defaultMoneySource);

  return {
    id: item.id ?? Date.now() + index,
    type: "couple-request",
    owner,
    status,
    title: String(item.title || item.name || category).trim() || category,
    category,
    source,
    amount,
    date: item.date || today,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    decidedAt: item.decidedAt || item.decided_at || "",
  };
};

const isDefaultSampleExpense = (item) => {
  const title = String(item?.title || "");
  const amount = Number(item?.amount);
  const category = String(item?.category || "");
  return (
    (title === "午餐" && category === "餐饮" && amount === 12.9) ||
    (title === "打车" && category === "交通" && amount === 18.4) ||
    (title === "课程资料" && category === "学习" && amount === 5.5)
  );
};

const isDefaultSampleIncome = (item) =>
  item?.type === "income" && String(item.title || "") === "薪水" && Number(item.amount) === 2600;

const migrateState = (saved) => {
  const next = { ...clone(defaultState), ...(saved || {}) };
  next.selectedYear = Number(next.selectedYear) || currentYear;
  next.selectedMonth = Math.min(Math.max(Number(next.selectedMonth) || currentMonth, 1), 12);
  next.activeView = viewNames.includes(next.activeView) ? next.activeView : "dashboard";
  next.editingExpenseId = null;
  next.selectedCategory = expenseCategories.includes(next.selectedCategory) ? next.selectedCategory : "餐饮";
  const formSource = splitSourceForForm(next.selectedSource);
  next.selectedSource = formSource.selectedSource;
  next.customSource = String(next.customSource || formSource.customSource || "").trim();
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
  const rawTransactions = Array.isArray(saved?.transactions) ? saved.transactions : [];
  const onlyDefaultSamples =
    rawTransactions.length > 0 &&
    rawTransactions.every((item) => isDefaultSampleExpense(item) || isDefaultSampleIncome(item));
  const hasRealSavedData =
    rawTransactions.some((item) => !isDefaultSampleExpense(item) && !isDefaultSampleIncome(item)) ||
    (Array.isArray(saved?.incomeEntries) && saved.incomeEntries.length > 0);
  const currentSavedPlan = next.yearPlans[String(currentYear)];
  const hasOldDefaultPlan =
    currentSavedPlan &&
    [0, 2600].includes(Number(currentSavedPlan.incomeAmount)) &&
    Number(currentSavedPlan.budget) === 1200;

  if (!hasRealSavedData && hasOldDefaultPlan) {
    next.yearPlans = { [currentYear]: normalizePlan() };
  }

  next.transactions = rawTransactions
    .map((item, index) => {
      if (item?.type === "income") {
        return null;
      }

      if (onlyDefaultSamples && isDefaultSampleExpense(item)) return null;
      return normalizeExpense(item, index);
    })
    .filter(Boolean);

  const oldIncomeEntries = rawTransactions
    .map((item, index) => {
      if (item?.type !== "income" || (onlyDefaultSamples && isDefaultSampleIncome(item))) return null;
      const { year } = getDateParts(item.date || today);
      incomeByYear[year] = (incomeByYear[year] || 0) + Number(item.amount || 0);
      return normalizeIncomeEntry(item, index);
    })
    .filter(Boolean);

  next.incomeEntries = [
    ...(Array.isArray(saved?.incomeEntries) ? saved.incomeEntries : []),
    ...oldIncomeEntries,
  ]
    .map(normalizeIncomeEntry)
    .filter(Boolean);

  next.fixedExpenses = (Array.isArray(saved?.fixedExpenses) ? saved.fixedExpenses : [])
    .map(normalizeFixedExpense)
    .filter(Boolean);
  next.couple = normalizeCouple(saved?.couple || {});
  next.coupleRequests = (Array.isArray(saved?.coupleRequests) ? saved.coupleRequests : [])
    .map(normalizeCoupleRequest)
    .filter(Boolean);

  Object.entries(incomeByYear).forEach(([year, amount]) => {
    if (amount > 0 && !next.yearPlans[year]) next.yearPlans[year] = normalizePlan();
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

const getSelectedPlan = () => ensurePlanFor(state, state.selectedYear);
const expenses = () => state.transactions.filter((item) => item.type === "expense");
const incomeEntries = () => (Array.isArray(state.incomeEntries) ? state.incomeEntries : []);
const fixedExpenses = () => (Array.isArray(state.fixedExpenses) ? state.fixedExpenses : []);
const fixedExpensesForYear = (year = state.selectedYear) =>
  fixedExpenses().filter((item) => Number(item.year) === Number(year));
const monthFixedExpenses = (year, month) =>
  fixedExpensesForYear(year).map((item) => ({
    ...item,
    id: `fixed-${item.id}-${monthKey(year, month)}`,
    originalId: item.id,
    type: "fixed-expense",
    isFixed: true,
    date: `${monthKey(year, month)}-01`,
  }));
const selectedExpenses = () => expenses().filter((item) => String(item.date || today).slice(0, 7) === selectedKey());
const selectedFixedExpenses = () => monthFixedExpenses(state.selectedYear, state.selectedMonth);
const selectedSpendingItems = () => [...selectedExpenses(), ...selectedFixedExpenses()];
const selectedIncomeEntries = () =>
  incomeEntries().filter((item) => String(item.date || today).slice(0, 7) === selectedKey());
const monthExpenses = (year, month) =>
  expenses().filter((item) => String(item.date || today).slice(0, 7) === monthKey(year, month));
const monthSpendingItems = (year, month) => [...monthExpenses(year, month), ...monthFixedExpenses(year, month)];
const monthIncomeEntries = (year, month) =>
  incomeEntries().filter((item) => String(item.date || today).slice(0, 7) === monthKey(year, month));
const total = (items) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
const selectedIncomeTotal = () => getSelectedPlan().incomeAmount + total(selectedIncomeEntries());
const selectedSpendingTotal = () => total(selectedSpendingItems());
const selectedSavingTotal = () => selectedIncomeTotal() - selectedSpendingTotal();
const coupleRequests = () => (Array.isArray(state.coupleRequests) ? state.coupleRequests : []);
const pendingCoupleRequests = () => coupleRequests().filter((item) => item.status === "pending");

const getCategoryTotals = (items = selectedSpendingItems()) =>
  items.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
    return totals;
  }, {});

const getSourceTotals = (items = selectedSpendingItems()) =>
  items.reduce((totals, item) => {
    totals[item.source] = (totals[item.source] || 0) + item.amount;
    return totals;
  }, {});

const updateSelectedButtons = () => {
  document.querySelectorAll(".category-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.selectedCategory);
  });

  document.querySelectorAll(".source-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === state.selectedSource);
  });

  const customSourceField = document.querySelector(".custom-source-field");
  const customSourceInput = document.querySelector(".custom-source-input");
  const needsCustomSource = state.selectedSource === "其他";
  if (customSourceField) customSourceField.hidden = !needsCustomSource;
  if (customSourceInput && document.activeElement !== customSourceInput) {
    customSourceInput.value = needsCustomSource ? state.customSource || "" : "";
  }
};

const renderFixedExpenseControls = () => {
  const titleSelect = document.querySelector(".fixed-expense-title");
  const customField = document.querySelector(".fixed-expense-custom-title-field");
  if (customField) customField.hidden = titleSelect?.value !== "其他";
};

const renderView = () => {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== state.activeView;
  });

  document.querySelectorAll("[data-view-container]").forEach((container) => {
    const visiblePanels = [...container.querySelectorAll("[data-view-panel]")].filter((panel) => !panel.hidden);
    container.hidden = visiblePanels.length === 0;
    container.classList.toggle("view-single", visiblePanels.length === 1);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
};

const renderFormMode = () => {
  const isEditing = Boolean(state.editingExpenseId);
  setText(".submit-button", isEditing ? "保存修改" : "新增消费");
  setText(".form-note", isEditing ? "正在修改这笔消费，确认后按「保存修改」。" : document.querySelector(".form-note")?.textContent || "");
  const cancelButton = document.querySelector(".cancel-edit-button");
  if (cancelButton) cancelButton.hidden = !isEditing;
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
  const budgetInput = document.querySelector(".budget-input");

  if (incomeInput && document.activeElement !== incomeInput) incomeInput.value = plan.incomeAmount || "";
  if (sourceSelect) sourceSelect.value = plan.incomeSource;
  if (budgetInput && document.activeElement !== budgetInput) budgetInput.value = plan.budget || "";
  setText(".budget-amount", plan.budget ? money(plan.budget) : "未设定");
  setText(".plan-note", `这个设定会自动用在 ${state.selectedYear} 年每个月。`);
};

const renderCouple = () => {
  const couple = normalizeCouple(state.couple);
  state.couple = couple;
  const myIncome = selectedIncomeTotal();
  const mySpent = selectedSpendingTotal();
  const mySaving = selectedSavingTotal();
  const pending = pendingCoupleRequests();
  const partnerName = couple.partnerName || "对方";

  setText(".couple-status", couple.connected ? `已准备连接 ${partnerName}` : "未连接");
  setText(".couple-my-saving", money(mySaving));
  setText(".couple-my-summary", `收入 ${money(myIncome)} · 支出 ${money(mySpent)} · ${selectedSpendingItems().length} 笔`);
  setText(".couple-partner-name", couple.connected ? partnerName : "连接后显示");
  setText(
    ".couple-partner-summary",
    couple.connected
      ? "下一步接上云端后，会显示对方 Dashboard、记录、收入和每月开销。"
      : "连接后可以看对方每月收入、开销、储蓄和记录。",
  );
  setText(".couple-code", couple.linkCode || "还未生成");
  setText(".couple-pending-count", `${pending.length} 笔`);

  const myNameInput = document.querySelector(".couple-my-name");
  const partnerInput = document.querySelector(".couple-partner-input");
  if (myNameInput && document.activeElement !== myNameInput) myNameInput.value = couple.myName || "";
  if (partnerInput && document.activeElement !== partnerInput) partnerInput.value = couple.partnerName || "";

  const requestDate = document.querySelector(".couple-request-date");
  if (requestDate && !requestDate.value) requestDate.value = today;

  const list = document.querySelector(".couple-request-list");
  if (!list) return;

  const items = coupleRequests().slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">还没有待批准记录。帮对方填写后，会先停在这里。</div>';
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const ownedByMe = item.owner === "me";
      const statusText = item.status === "approved" ? "已批准" : item.status === "rejected" ? "已拒绝" : "待批准";
      const ownerText = ownedByMe ? "我的账本" : `${partnerName} 的账本`;
      return `
        <article class="couple-request-row ${item.status}">
          <div>
            <strong>${cleanText(item.title)}</strong>
            <p>${cleanText(ownerText)} · ${cleanText(item.date)} · ${cleanText(item.source)} · ${cleanText(item.category)}</p>
            <span>${statusText}</span>
          </div>
          <div class="amount-group">
            <span class="transaction-amount">-${money(item.amount)}</span>
            ${
              item.status === "pending" && ownedByMe
                ? `
                  <button class="approve-button" type="button" data-approve-couple="${cleanText(item.id)}">批准</button>
                  <button class="delete-button" type="button" data-reject-couple="${cleanText(item.id)}">拒绝</button>
                `
                : item.status === "pending"
                  ? '<span class="waiting-pill">等对方批准</span>'
                  : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
};

const renderSummary = () => {
  const plan = getSelectedPlan();
  const spendingItems = selectedSpendingItems();
  const spent = total(spendingItems);
  const income = selectedIncomeTotal();
  const saving = income - spent;
  const usedPercent = plan.budget ? Math.min(Math.round((spent / plan.budget) * 100), 100) : 0;
  const status = !plan.budget ? "未设定" : usedPercent > 95 ? "超支中" : usedPercent > 75 ? "要留意" : "健康";

  setText(".saving-amount", money(saving));
  setText(".spent-amount", money(spent));
  setText(".income-amount", money(income));
  setText(".entry-count", `${spendingItems.length} 笔`);
  setText(".extra-income-total", money(total(selectedIncomeEntries())));
  setText(".fixed-expense-total", money(total(selectedFixedExpenses())));
  setText(".used-percent", `${usedPercent}%`);
  setText(".budget-status", status);

  const ring = document.querySelector(".budget-ring");
  if (ring) ring.style.setProperty("--used", `${usedPercent}%`);
};

const renderTransactions = () => {
  const list = document.querySelector(".transaction-list");
  if (!list) return;

  const items = selectedSpendingItems();
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">这个月还没有消费记录。新增一笔或固定支出后，这里会自动整理。</div>';
    return;
  }

  const sortValue = (item) =>
    new Date(`${item.date || today}T00:00:00`).getTime() + new Date(item.createdAt || 0).getTime() / 100000000;

  list.innerHTML = items
    .slice()
    .sort((a, b) => sortValue(b) - sortValue(a))
    .map(
      (item) => `
        <article class="transaction-row ${item.isFixed ? "fixed-row" : ""}">
          <div class="transaction-main">
            ${
              !item.isFixed && item.receiptImage
                ? `<button class="receipt-thumb-button" type="button" data-view-receipt="${cleanText(item.id)}" aria-label="查看 ${cleanText(item.title)} 的收据"><img class="receipt-thumb" src="${item.receiptImage}" alt="${cleanText(item.title)} 的收据" /></button>`
                : `<span class="category-dot" style="--dot: ${categoryColors[item.category] || categoryColors.生活}"></span>`
            }
            <div class="transaction-meta">
              <strong>${cleanText(item.merchant || item.title || item.category)}</strong>
              <p>${item.isFixed ? "每月固定" : cleanText(item.date)} · ${cleanText(item.source)} · ${cleanText(item.category)}</p>
              ${item.isFixed ? '<p class="receipt-ref">每个月自动算进支出</p>' : ""}
              ${
                !item.isFixed && item.reference
                  ? `<p class="receipt-ref">付款/收据号：${cleanText(item.reference)}</p>`
                  : ""
              }
              ${
                !item.isFixed && item.merchant && item.title && item.title !== item.merchant
                  ? `<p class="receipt-ref">内容：${cleanText(item.title)}</p>`
                  : ""
              }
            </div>
          </div>
          <div class="amount-group">
            <span class="transaction-amount">-${money(item.amount)}</span>
            ${
              item.isFixed
                ? `<button class="delete-button" type="button" data-delete-fixed="${cleanText(item.originalId)}" aria-label="删除固定支出 ${cleanText(item.title)}">删</button>`
                : `
                  <button class="edit-button" type="button" data-edit="${cleanText(item.id)}" aria-label="修改 ${cleanText(item.title)}">改</button>
                  <button class="delete-button" type="button" data-delete="${cleanText(item.id)}" aria-label="删除 ${cleanText(item.title)}">删</button>
                `
            }
          </div>
        </article>
      `,
    )
    .join("");
};

const renderIncomeEntries = () => {
  const list = document.querySelector(".extra-income-list");
  if (!list) return;

  const items = selectedIncomeEntries();
  if (!items.length) {
    list.innerHTML = '<div class="mini-empty">这个月还没有额外收入。</div>';
    return;
  }

  list.innerHTML = items
    .slice()
    .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))
    .map(
      (item) => `
        <article class="income-entry-row">
          <div>
            <strong>${cleanText(item.title || item.source)}</strong>
            <p>${cleanText(item.date)} · ${cleanText(item.source)}</p>
          </div>
          <div class="amount-group">
            <span class="income-entry-amount">+${money(item.amount)}</span>
            <button class="delete-button" type="button" data-delete-income="${cleanText(item.id)}" aria-label="删除 ${cleanText(item.title)}">删</button>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderFixedExpenses = () => {
  const list = document.querySelector(".fixed-expense-list");
  if (!list) return;

  const items = fixedExpensesForYear(state.selectedYear);
  if (!items.length) {
    list.innerHTML = '<div class="mini-empty">还没有固定支出。加入后，每个月会自动算进去。</div>';
    return;
  }

  list.innerHTML = items
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .map(
      (item) => `
        <article class="fixed-expense-row">
          <div>
            <strong>${cleanText(item.title)}</strong>
            <p>${cleanText(item.source)} · ${cleanText(item.category)} · ${item.year}年每个月</p>
          </div>
          <div class="amount-group">
            <span class="fixed-expense-amount-text">-${money(item.amount)}</span>
            <button class="delete-button" type="button" data-delete-fixed="${cleanText(item.id)}" aria-label="删除固定支出 ${cleanText(item.title)}">删</button>
          </div>
        </article>
      `,
    )
    .join("");
};

const renderReport = () => {
  const report = document.querySelector(".category-report");
  if (!report) return;

  const items = selectedSpendingItems();
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
    .reduce((sum, month) => sum + total(monthSpendingItems(state.selectedYear, month)), 0);
  const monthlyIncome = (month) => plan.incomeAmount + total(monthIncomeEntries(state.selectedYear, month));
  const annualIncome = months
    .filter((month) => month <= monthLimit)
    .reduce((sum, month) => sum + monthlyIncome(month), 0);
  const annualSaving = annualIncome - annualExpense;
  const biggest = Math.max(
    ...months.map((month) => monthlyIncome(month)),
    ...months.map((month) => total(monthSpendingItems(state.selectedYear, month))),
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
      const spending = total(monthSpendingItems(state.selectedYear, month));
      const income = monthlyIncome(month);
      const muted = month > monthLimit;
      const incomeWidth = Math.max((income / biggest) * 100, income ? 4 : 0);
      const expenseWidth = Math.max((spending / biggest) * 100, spending ? 4 : 0);

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
          <strong>${muted ? "未到" : money(income - spending)}</strong>
        </article>
      `;
    })
    .join("");
};

const render = () => {
  ensurePlanFor(state, state.selectedYear);
  updateSelectedButtons();
  renderView();
  renderFormMode();
  renderMonthControls();
  renderPlanControls();
  renderFixedExpenseControls();
  renderSummary();
  renderTransactions();
  renderIncomeEntries();
  renderFixedExpenses();
  renderReport();
  renderAnnualReport();
  renderCouple();
};

const schedulePlanSync = () => {};

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
let pendingReceipt = { image: "", text: "", autoSaved: false };

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

  setReceiptMessage(labels[message.status] || "正在读收据", "我会重点找 Grand Total 或 Amount Payable。");
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

const prepareReceiptImage = async (file, options = {}) => {
  const image = await loadReceiptImage(file);
  const cropTop = options.cropTop ?? 0;
  const cropBottom = options.cropBottom ?? 1;
  const maxWidth = options.maxWidth ?? 1500;
  const maxHeight = options.maxHeight ?? 3200;
  const sourceY = Math.round(image.naturalHeight * cropTop);
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * (cropBottom - cropTop)));
  const sourceWidth = image.naturalWidth;
  const scale = Math.min(Math.max(Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight), 0.35), 2);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const clearer = gray < 178 ? Math.max(0, gray * 0.68) : Math.min(255, 255 - (255 - gray) * 0.52);
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
  const image = await loadReceiptImage(file).catch(() => null);
  const isLongReceipt = image ? image.naturalHeight / Math.max(image.naturalWidth, 1) > 2.2 : false;
  const passes = [
    { label: "整张收据", cropTop: 0, cropBottom: 1, maxWidth: 1500, maxHeight: isLongReceipt ? 3600 : 2600 },
  ];

  if (isLongReceipt) {
    passes.push(
      { label: "收据下半段", cropTop: 0.35, cropBottom: 1, maxWidth: 1500, maxHeight: 3400 },
      { label: "收据最底部", cropTop: 0.62, cropBottom: 1, maxWidth: 1600, maxHeight: 3000 },
    );
  }

  const results = [];

  for (const pass of passes) {
    setReceiptMessage(`正在读取${pass.label}`, "会优先找 Grand Total / Amount Payable 那一行。");
    const prepared = await prepareReceiptImage(file, pass).catch(() => file);
    const recognized = await worker.recognize(prepared);
    const text = recognized.data.text || "";
    const candidate = findReceiptAmountCandidate(getReceiptLines(text));
    results.push({ text, score: candidate?.score || 0 });

    if (!isLongReceipt && candidate?.score >= 150) break;
  }

  const best = results.slice().sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  const combined = [...best, ...results.filter((item) => !best.includes(item))]
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n");

  return combined;
};

const normalizeReceiptLine = (line) =>
  line
    .replace(/[|_]+/g, " ")
    .replace(/\bGRANT\s+TOTAL\b/gi, "GRAND TOTAL")
    .replace(/\bGND\s+TOTAL\b/gi, "GRAND TOTAL")
    .replace(/\bGR\s+TOTAL\b/gi, "GRAND TOTAL")
    .replace(/\bT0TAL\b/gi, "TOTAL")
    .replace(/\bTOTA1\b/gi, "TOTAL")
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

const findReceiptAmountCandidate = (lines) => {
  const candidates = [];
  const grandWords = /(grand\s*total|grant\s*total|g\.?\s*total|grand\s*ttl)/i;
  const strongWords = /(grand\s*total|grant\s*total|total\s*(amount|due|payable|sales|incl|include|including)|amount\s*(due|payable)|net\s*total|nett\s*total|balance\s*due|jumlah\s*(besar|perlu|bayar|keseluruhan)|总计|總計|合计|合計|实付|實付|应付|應付)/i;
  const totalWords = /\b(total|amount|paid|payable|jumlah|bayar|due|nett?)\b/i;
  const weakWords = /(subtotal|sub\s*total|tax|sst|gst|service\s*charge|change|rounding|voucher|discount|points|member|cash|tender|tendered|payment|paid\s*by|visa|master|card)/i;

  lines.forEach((line, index) => {
    const context = [lines[index - 2], lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");

    getAmountsFromLine(line).forEach((amount) => {
      let score = amount / 100;
      if (grandWords.test(context)) score += 180;
      else if (strongWords.test(context)) score += 130;
      else if (totalWords.test(context)) score += 58;
      if (weakWords.test(context)) score -= 48;
      if (index < 3) score -= 10;
      score += (index / Math.max(lines.length - 1, 1)) * 30;

      candidates.push({ amount, score, line, context });
    });
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return candidates[0];
};

const findReceiptAmount = (lines) => findReceiptAmountCandidate(lines)?.amount || null;

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

const cleanMerchantName = (line) =>
  line
    .replace(/[^A-Za-z0-9\u4e00-\u9fff &'().,@-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findReceiptMerchant = (lines) => {
  const blocked = /(receipt|invoice|tax|sst|gst|date|time|cashier|counter|total|amount|member|tel|phone|address|alamat|reg\s*no|company\s*no|co\.\s*no|www|facebook|instagram|thank|welcome|table|pax|qty|quantity)/i;
  const companyWords = /(sdn\s*bhd|bhd|enterprise|trading|restaurant|restoran|cafe|kopitiam|mart|store|market|pharmacy|clinic|hotel|berhad|plc|llp|pte|ltd|有限公司|餐厅|餐廳|药房|藥房|酒店|超市|咖啡)/i;
  const candidates = [];

  lines.slice(0, 18).forEach((line, index) => {
    const clean = cleanMerchantName(line);
    if (clean.length < 3 || clean.length > 58) return;
    if (blocked.test(clean)) return;
    if (!/[A-Za-z\u4e00-\u9fff]/.test(clean)) return;
    if ((clean.match(/\d/g) || []).length > clean.length / 2) return;
    if (getAmountsFromLine(clean).length) return;

    let score = 100 - index * 4;
    if (companyWords.test(clean)) score += 50;
    if (/^[A-Z0-9 &'().,@-]{5,}$/.test(clean)) score += 18;
    if (clean.length >= 8 && clean.length <= 34) score += 12;
    if (/[,.]/.test(clean)) score -= 8;
    candidates.push({ clean, score });
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.clean || "";
};

const findReceiptReference = (lines) => {
  const labelWords = /(receipt|resit|invoice|inv|bill|order|transaction|trans|trx|ref|reference|payment|auth|approval|trace|rrn|terminal|tid|mid|batch|收据|收據|发票|發票|单号|單號|订单|訂單|交易|付款|参考|參考|号码|號碼|编号|編號|rujukan|bayaran)/i;
  const blocked = /(total|amount|subtotal|tax|sst|gst|change|balance|date|time|tel|phone)/i;
  const candidates = [];

  lines.slice(0, 45).forEach((line, index) => {
    if (!labelWords.test(line) || blocked.test(line)) return;
    const normalized = line.replace(/\s+/g, " ").trim();
    const matches = normalized.match(/[A-Z0-9][A-Z0-9\-/:]{4,}/gi) || [];

    matches.forEach((raw) => {
      const value = raw.replace(/^[#:\-]+|[#:\-]+$/g, "");
      if (value.length < 5 || value.length > 32) return;
      if (/^\d{1,2}[:/-]\d{1,2}/.test(value)) return;
      if (/^\d+[.,]\d{2}$/.test(value)) return;

      let score = 100 - index;
      if (/(receipt|resit|invoice|inv|bill|order|ref|reference|transaction|trans|trx|收据|收據|发票|發票|单号|單號|交易|参考|參考|rujukan)/i.test(normalized)) score += 35;
      if (/(payment|auth|approval|trace|rrn|terminal|付款|bayaran)/i.test(normalized)) score += 20;
      if (/[A-Z]/i.test(value) && /\d/.test(value)) score += 10;
      candidates.push({ value, score });
    });
  });

  candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
  return candidates[0]?.value || "";
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

const applyReceiptResult = ({ amount, merchant, reference, date, category }) => {
  const amountInput = document.querySelector(".entry-amount");
  const titleInput = document.querySelector(".entry-title");
  const merchantInput = document.querySelector(".entry-merchant");
  const referenceInput = document.querySelector(".entry-reference");
  const dateField = document.querySelector(".entry-date");

  if (amountInput && amount) amountInput.value = amount.toFixed(2);
  if (titleInput && merchant && !titleInput.value.trim()) titleInput.value = merchant;
  if (merchantInput && merchant) merchantInput.value = merchant;
  if (referenceInput && reference) referenceInput.value = reference;
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
  pendingReceipt = { image: "", text: "", autoSaved: false };
  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
  receiptPreviewUrl = "";
  if (receiptImage) receiptImage.removeAttribute("src");
  if (receiptPreview) receiptPreview.hidden = true;
  setReceiptMessage("已选择照片", "请确认 Grand Total 有没有读对，再按新增消费。");
};

receiptInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const currentJob = Date.now();
  receiptJob = currentJob;
  pendingReceipt = { image: "", text: "", autoSaved: false };

  if (receiptImage) {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    receiptPreviewUrl = URL.createObjectURL(file);
    receiptImage.src = receiptPreviewUrl;
  }
  if (receiptPreview) receiptPreview.hidden = false;
  setReceiptMessage("正在整理照片", "会先看整张，再重点看收据底部的 Grand Total。");
  setText(".form-note", "正在读取收据，长收据会多读底部一次。");

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
      reference: findReceiptReference(lines),
      date: findReceiptDate(text),
      category: guessReceiptCategory(text),
    };

    applyReceiptResult(result);

    if (result.amount || result.merchant) {
      const details = [
        result.amount ? `金额 ${money(result.amount)}` : "",
        result.merchant ? `公司 ${result.merchant}` : "",
        result.reference ? `号码 ${result.reference}` : "",
      ].filter(Boolean);

      const shouldAutoSave = document.querySelector(".receipt-auto-save")?.checked && result.amount && result.merchant;
      if (shouldAutoSave && !pendingReceipt.autoSaved) {
        pendingReceipt.autoSaved = true;
        saveExpenseFromForm({ auto: true });
      } else {
        setReceiptMessage("已自动填好", "请看一下 Grand Total 有没有读错，确认后按「新增消费」。");
        setText(".form-note", `收据已读取：${details.join("，")}。`);
      }
    } else {
      setReceiptMessage("照片已保存", "这张没读到 Grand Total，你可以手动填金额。");
      setText(".form-note", "我没有把握读对总金额，所以先不乱填；照片会跟着记录保存。");
    }
  } catch {
    setReceiptMessage("照片已保存", "这次没有成功读取金额，你可以先手动填。");
    setText(".form-note", "这张照片已保存；金额先手动填，不影响新增记录。");
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
    state.selectedSource = button.dataset.source || defaultMoneySource;
    if (state.selectedSource !== "其他") state.customSource = "";
    saveState();
    render();
  });
});

document.querySelector(".custom-source-input")?.addEventListener("input", (event) => {
  state.customSource = event.target.value;
  saveState();
});

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.view || "dashboard";
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
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

document.querySelector(".budget-input")?.addEventListener("input", (event) => {
  const plan = getSelectedPlan();
  plan.budget = Number(event.target.value) || 0;
  saveState();
  renderPlanControls();
  renderSummary();
  schedulePlanSync();
});

document.querySelector(".extra-income-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amountInput = document.querySelector(".extra-income-amount");
  const sourceInput = document.querySelector(".extra-income-source");
  const titleInput = document.querySelector(".extra-income-title");
  const amount = Number(amountInput.value);
  if (!amount) return;

  const source = extraIncomeSources.includes(sourceInput.value) ? sourceInput.value : "Commission";
  const entry = {
    id: Date.now(),
    type: "income",
    title: titleInput.value.trim() || source,
    source,
    category: source,
    amount,
    date: monthStart(),
    createdAt: new Date().toISOString(),
  };

  state.incomeEntries.push(entry);
  amountInput.value = "";
  titleInput.value = "";
  saveState();
  render();
  setText(".form-note", `已加入本月额外收入：${money(amount)}`);
});

document.querySelector(".fixed-expense-title")?.addEventListener("change", () => {
  renderFixedExpenseControls();
});

document.querySelector(".fixed-expense-form")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const titleSelect = document.querySelector(".fixed-expense-title");
  const customTitleInput = document.querySelector(".fixed-expense-custom-title");
  const amountInput = document.querySelector(".fixed-expense-amount");
  const sourceInput = document.querySelector(".fixed-expense-source");
  const categoryInput = document.querySelector(".fixed-expense-category");
  const amount = Number(amountInput?.value);
  if (!amount) return;

  const presetTitle = fixedExpensePresets.includes(titleSelect?.value) ? titleSelect.value : "其他";
  const title = presetTitle === "其他"
    ? customTitleInput?.value.trim() || "固定支出"
    : presetTitle;
  const source = normalizeMoneySource(sourceInput?.value || "Credit Card");
  const category = expenseCategories.includes(categoryInput?.value) ? categoryInput.value : "生活";

  state.fixedExpenses.push({
    id: Date.now(),
    type: "fixed-expense",
    title,
    source,
    category,
    amount,
    year: state.selectedYear,
    createdAt: new Date().toISOString(),
  });

  amountInput.value = "";
  if (customTitleInput) customTitleInput.value = "";
  saveState();
  render();
  setText(".form-note", `已加入固定支出：${title} ${money(amount)}，${state.selectedYear} 年每个月都会自动计算。`);
});

document.querySelector(".couple-my-name")?.addEventListener("input", (event) => {
  state.couple.myName = event.target.value.trim();
  saveState();
  renderCouple();
});

document.querySelector(".couple-partner-input")?.addEventListener("input", (event) => {
  state.couple.partnerName = event.target.value.trim();
  state.couple.connected = Boolean(state.couple.partnerName || state.couple.linkCode);
  saveState();
  renderCouple();
});

document.querySelector(".couple-code-button")?.addEventListener("click", () => {
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  state.couple.linkCode = `XB-${state.selectedYear}-${code}`;
  state.couple.connected = Boolean(state.couple.partnerName || state.couple.linkCode);
  saveState();
  renderCouple();
  setText(".form-note", "已生成连接码。下一步接云端后，这个位置会变成真正邀请链接。");
});

document.querySelector(".couple-request-form")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const ownerInput = document.querySelector(".couple-request-owner");
  const amountInput = document.querySelector(".couple-request-amount");
  const titleInput = document.querySelector(".couple-request-title");
  const dateInput = document.querySelector(".couple-request-date");
  const sourceInput = document.querySelector(".couple-request-source");
  const categoryInput = document.querySelector(".couple-request-category");
  const amount = Number(amountInput?.value);
  if (!amount) return;

  const category = expenseCategories.includes(categoryInput?.value) ? categoryInput.value : "生活";
  const title = titleInput?.value.trim() || category;
  const owner = ownerInput?.value === "me" ? "me" : "partner";
  state.coupleRequests.push({
    id: Date.now(),
    type: "couple-request",
    owner,
    status: "pending",
    title,
    category,
    source: normalizeMoneySource(sourceInput?.value || defaultMoneySource),
    amount,
    date: dateInput?.value || today,
    createdAt: new Date().toISOString(),
    decidedAt: "",
  });

  amountInput.value = "";
  if (titleInput) titleInput.value = "";
  saveState();
  render();
  setText(
    ".form-note",
    owner === "me"
      ? `已放进待批准：${title} ${money(amount)}。批准后才会进入你的账本。`
      : `已提交给对方批准：${title} ${money(amount)}。对方批准前不会进入账本。`,
  );
});

function getExpenseSourceFromForm() {
  if (state.selectedSource !== "其他") {
    state.customSource = "";
    return state.selectedSource || defaultMoneySource;
  }

  const customSourceInput = document.querySelector(".custom-source-input");
  const customSource = String(customSourceInput?.value || state.customSource || "").trim();
  state.customSource = customSource;
  return customSource || "其他";
}

function clearExpenseForm() {
  document.querySelector(".entry-amount").value = "";
  document.querySelector(".entry-title").value = "";
  document.querySelector(".entry-merchant").value = "";
  document.querySelector(".entry-reference").value = "";
  updateEntryDateForSelectedMonth();
  resetReceiptPreview();
  state.editingExpenseId = null;
}

function fillExpenseForm(item) {
  document.querySelector(".entry-amount").value = item.amount || "";
  document.querySelector(".entry-title").value = item.title || "";
  document.querySelector(".entry-merchant").value = item.merchant || "";
  document.querySelector(".entry-reference").value = item.reference || "";
  document.querySelector(".entry-date").value = item.date || monthStart();
  state.selectedCategory = expenseCategories.includes(item.category) ? item.category : "生活";
  const formSource = splitSourceForForm(item.source);
  state.selectedSource = formSource.selectedSource;
  state.customSource = formSource.customSource;
  pendingReceipt = {
    image: item.receiptImage || "",
    text: item.receiptText || "",
    autoSaved: false,
  };

  if (item.receiptImage) {
    if (receiptImage) receiptImage.src = item.receiptImage;
    if (receiptPreview) receiptPreview.hidden = false;
    setReceiptMessage("已载入原本收据", "可以修改金额、分类、公司名或号码。");
  } else {
    if (receiptPreview) receiptPreview.hidden = true;
  }
}

function startExpenseEdit(id) {
  const item = state.transactions.find((transaction) => String(transaction.id) === String(id));
  if (!item) return;
  state.editingExpenseId = item.id;
  state.activeView = "add";
  const parts = getDateParts(item.date);
  state.selectedYear = parts.year;
  state.selectedMonth = parts.month;
  saveState();
  render();
  fillExpenseForm(item);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveExpenseFromForm(options = {}) {
  const amountInput = document.querySelector(".entry-amount");
  const titleInput = document.querySelector(".entry-title");
  const merchantInput = document.querySelector(".entry-merchant");
  const referenceInput = document.querySelector(".entry-reference");
  const dateField = document.querySelector(".entry-date");
  const amount = Number(amountInput.value);
  const date = dateField.value || monthStart();

  if (!amount) return false;

  const parts = getDateParts(date);
  state.selectedYear = parts.year;
  state.selectedMonth = parts.month;
  ensurePlanFor(state, state.selectedYear);

  const merchant = merchantInput.value.trim();
  const reference = referenceInput.value.trim();
  const title = titleInput.value.trim() || merchant || state.selectedCategory;
  const existing = state.editingExpenseId
    ? state.transactions.find((item) => String(item.id) === String(state.editingExpenseId))
    : null;
  const transaction = existing || {
    id: Date.now(),
    type: "expense",
    createdAt: new Date().toISOString(),
  };

  Object.assign(transaction, {
    title,
    merchant,
    reference,
    category: state.selectedCategory,
    source: getExpenseSourceFromForm(),
    amount,
    date,
    receiptText: pendingReceipt.text || transaction.receiptText || "",
    receiptImage: pendingReceipt.image || transaction.receiptImage || "",
  });

  if (!existing) state.transactions.push(transaction);

  const wasEditing = Boolean(state.editingExpenseId);
  clearExpenseForm();
  state.activeView = "records";
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setText(
    ".form-note",
    wasEditing
      ? `已保存修改：${title} ${money(amount)}`
      : options.auto
        ? `已自动新增：${title} ${money(amount)}`
        : `已新增：${title} ${money(amount)}`,
  );
  return true;
}

document.querySelector(".entry-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveExpenseFromForm();
});

document.querySelector(".transaction-list")?.addEventListener("click", async (event) => {
  const receiptButton = event.target.closest("[data-view-receipt]");
  if (receiptButton) {
    const item = state.transactions.find((transaction) => String(transaction.id) === receiptButton.dataset.viewReceipt);
    if (item?.receiptImage) {
      const modal = document.querySelector(".receipt-modal");
      const image = document.querySelector(".receipt-modal-image");
      const info = document.querySelector(".receipt-modal-info");
      if (image) image.src = item.receiptImage;
      if (info) {
        info.innerHTML = `
          <strong>${cleanText(item.merchant || item.title || item.category)}</strong>
          <p>${cleanText(item.date)} · ${cleanText(item.source)} · ${cleanText(item.category)} · ${money(item.amount)}</p>
          ${item.reference ? `<p>付款/收据号：${cleanText(item.reference)}</p>` : ""}
        `;
      }
      if (modal) modal.hidden = false;
    }
    return;
  }

  const fixedDeleteButton = event.target.closest("[data-delete-fixed]");
  if (fixedDeleteButton) {
    const id = fixedDeleteButton.dataset.deleteFixed;
    state.fixedExpenses = fixedExpenses().filter((item) => String(item.id) !== String(id));
    setText(".form-note", "已删除固定支出。");
    saveState();
    render();
    return;
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    startExpenseEdit(editButton.dataset.edit);
    return;
  }

  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  state.transactions = state.transactions.filter((item) => String(item.id) !== id);
  setText(".form-note", "已删除一笔消费记录。");
  saveState();
  render();
});

document.querySelector(".cancel-edit-button")?.addEventListener("click", () => {
  clearExpenseForm();
  saveState();
  render();
  setText(".form-note", "已取消修改。");
});

document.querySelector(".receipt-modal-close")?.addEventListener("click", () => {
  const modal = document.querySelector(".receipt-modal");
  if (modal) modal.hidden = true;
});

document.querySelector(".receipt-modal")?.addEventListener("click", (event) => {
  if (event.target.classList.contains("receipt-modal")) {
    event.currentTarget.hidden = true;
  }
});

document.querySelector(".extra-income-list")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-income]");
  if (!button) return;

  const id = button.dataset.deleteIncome;
  state.incomeEntries = incomeEntries().filter((item) => String(item.id) !== id);
  saveState();
  render();
  setText(".form-note", "已删除一笔额外收入。");
});

document.querySelector(".fixed-expense-list")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-fixed]");
  if (!button) return;

  const id = button.dataset.deleteFixed;
  state.fixedExpenses = fixedExpenses().filter((item) => String(item.id) !== String(id));
  saveState();
  render();
  setText(".form-note", "已删除固定支出。");
});

document.querySelector(".couple-request-list")?.addEventListener("click", (event) => {
  const approveButton = event.target.closest("[data-approve-couple]");
  const rejectButton = event.target.closest("[data-reject-couple]");
  const id = approveButton?.dataset.approveCouple || rejectButton?.dataset.rejectCouple;
  if (!id) return;

  const request = coupleRequests().find((item) => String(item.id) === String(id));
  if (!request || request.status !== "pending") return;

  if (approveButton) {
    request.status = "approved";
    request.decidedAt = new Date().toISOString();
    state.transactions.push({
      id: Date.now(),
      type: "expense",
      title: request.title,
      merchant: "",
      reference: "Couple approval",
      category: request.category,
      source: request.source,
      amount: request.amount,
      date: request.date,
      receiptText: "",
      receiptImage: "",
      createdAt: new Date().toISOString(),
    });
    setText(".form-note", `已批准并加入你的账本：${request.title} ${money(request.amount)}`);
  } else {
    request.status = "rejected";
    request.decidedAt = new Date().toISOString();
    setText(".form-note", `已拒绝这笔记录：${request.title}`);
  }

  saveState();
  render();
});

document.querySelector(".reset-button")?.addEventListener("click", () => {
  state = clone(defaultState);
  saveState();
  updateEntryDateForSelectedMonth();
  resetReceiptPreview();
  setText(".form-note", "已清空，可以重新开始记录。");
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
  setText(".form-note", "已清空这个月的手动消费记录，固定支出会保留。");
  render();
});

document.querySelector(".export-button")?.addEventListener("click", () => {
  const header = "日期,类型,来源,分类,公司店名,付款收据号码,内容,金额,有收据";
  const fixedRows = Array.from({ length: state.selectedMonth }, (_, index) =>
    monthFixedExpenses(state.selectedYear, index + 1),
  ).flat();
  const rows = [...expenses(), ...fixedRows, ...incomeEntries()].map((item) =>
    [
      item.date,
      item.type === "income" ? "收入" : item.isFixed ? "固定支出" : "消费",
      item.source,
      item.category,
      item.merchant || "",
      item.reference || "",
      item.title,
      item.amount,
      item.type === "expense" && item.receiptImage ? "有" : "无",
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
