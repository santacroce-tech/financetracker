import { invoke } from "@tauri-apps/api/core";

// DB lifecycle
export const openDb = (path) => invoke("open_db", { path });
export const createDb = (path) => invoke("create_db", { path });
export const getDbPath = () => invoke("get_db_path");
export const closeDb = () => invoke("close_db");
export const openDemoDb = () => invoke("open_demo_db");

// Accounts
export const getAccounts = () => invoke("get_accounts");
export const addAccount = (name, accountType, balance, currency) =>
  invoke("add_account", { name, accountType, balance, currency });
export const updateAccount = (id, name, accountType, balance, currency) =>
  invoke("update_account", { id, name, accountType, balance, currency });
export const deleteAccount = (id) => invoke("delete_account", { id });

// Transactions
export const getTransactions = (filter) => invoke("get_transactions", { filter: filter ?? null });
export const addTransaction = (data) => invoke("add_transaction", data);
export const updateTransaction = (data) => invoke("update_transaction", data);
export const deleteTransaction = (id) => invoke("delete_transaction", { id });
export const importCsv = (data) => invoke("import_csv", data);

// Categories
export const getCategories = () => invoke("get_categories");
export const addCategory = (name, categoryType, icon, color) =>
  invoke("add_category", { name, categoryType, icon, color });
export const updateCategory = (id, name, categoryType, icon, color) =>
  invoke("update_category", { id, name, categoryType, icon, color });
export const deleteCategory = (id) => invoke("delete_category", { id });

// Budgets
export const getBudgets = () => invoke("get_budgets");
export const addBudget = (categoryId, amount, period, startDate) =>
  invoke("add_budget", { categoryId, amount, period, startDate });
export const updateBudget = (id, categoryId, amount, period, startDate) =>
  invoke("update_budget", { id, categoryId, amount, period, startDate });
export const deleteBudget = (id) => invoke("delete_budget", { id });

// Rules
export const getRules = () => invoke("get_rules");
export const addRule = (categoryId, pattern, matchField, isRegex, priority) =>
  invoke("add_rule", { categoryId, pattern, matchField, isRegex, priority });
export const updateRule = (id, categoryId, pattern, matchField, isRegex, priority) =>
  invoke("update_rule", { id, categoryId, pattern, matchField, isRegex, priority });
export const deleteRule = (id) => invoke("delete_rule", { id });
export const autoCategorize = () => invoke("auto_categorize");

// Reports
export const getDashboardStats = () => invoke("get_dashboard_stats");
export const getMonthlyData = (months) => invoke("get_monthly_data", { months });
export const getCategorySpending = (period) => invoke("get_category_spending", { period });
export const getTopPayees = (limit) => invoke("get_top_payees", { limit });
export const getRecentTransactions = (limit) => invoke("get_recent_transactions", { limit });
