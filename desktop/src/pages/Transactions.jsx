import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getTransactions, addTransaction, updateTransaction, deleteTransaction,
  getAccounts, getCategories,
} from "../api/tauri";
import Alert from "../components/Alert";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  account_id: "", category_id: "", transaction_type: "expense",
  amount: "", description: "", payee: "", date: today(),
};

export default function Transactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [alert, setAlert] = useState({ type: "", msg: "" });

  const load = () =>
    Promise.all([
      getTransactions(filter),
      getAccounts(),
      getCategories(),
    ]).then(([txns, a, c]) => {
      setTransactions(txns);
      setAccounts(a);
      setCategories(c);
    }).catch((e) => setAlert({ type: "danger", msg: String(e) }));

  useEffect(() => { load(); }, [JSON.stringify(filter)]);

  const openAdd = () => {
    setForm({ ...emptyForm, account_id: accounts[0]?.id ?? "" });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (txn) => {
    setForm({
      account_id: txn.account_id, category_id: txn.category_id ?? "",
      transaction_type: txn.transaction_type, amount: txn.amount,
      description: txn.description ?? "", payee: txn.payee ?? "", date: txn.date,
    });
    setEditing(txn.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      accountId: Number(form.account_id),
      categoryId: form.category_id ? Number(form.category_id) : null,
      transactionType: form.transaction_type,
      amount: Number(form.amount),
      description: form.description || null,
      payee: form.payee || null,
      date: form.date,
    };
    try {
      if (editing) {
        await updateTransaction({ id: editing, ...payload });
        setAlert({ type: "success", msg: t("transactions.transactionUpdated") });
      } else {
        await addTransaction(payload);
        setAlert({ type: "success", msg: t("transactions.transactionAdded") });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTransaction(id);
      setDeleting(null);
      load();
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    }
  };

  const expenses = categories.filter((c) => c.category_type !== "income");
  const incomeCategories = categories.filter((c) => c.category_type === "income");
  const relevantCats = form.transaction_type === "income" ? incomeCategories : expenses;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">{t("transactions.title")}</h4>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" /> {t("transactions.addTransaction")}
        </button>
      </div>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <select className="form-select form-select-sm" value={filter.account_id ?? ""}
                onChange={(e) => setFilter({ ...filter, account_id: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">{t("transactions.allAccounts")}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={filter.transaction_type ?? ""}
                onChange={(e) => setFilter({ ...filter, transaction_type: e.target.value || undefined })}>
                <option value="">{t("transactions.allTypes")}</option>
                <option value="income">{t("common.income")}</option>
                <option value="expense">{t("common.expense")}</option>
                <option value="transfer">{t("common.transfer")}</option>
              </select>
            </div>
            <div className="col-auto">
              <input className="form-control form-control-sm" type="date" placeholder="From"
                value={filter.date_from ?? ""}
                onChange={(e) => setFilter({ ...filter, date_from: e.target.value || undefined })} />
            </div>
            <div className="col-auto">
              <input className="form-control form-control-sm" type="date" placeholder="To"
                value={filter.date_to ?? ""}
                onChange={(e) => setFilter({ ...filter, date_to: e.target.value || undefined })} />
            </div>
            <div className="col">
              <input className="form-control form-control-sm" placeholder={t("common.search")}
                value={filter.search ?? ""}
                onChange={(e) => setFilter({ ...filter, search: e.target.value || undefined })} />
            </div>
            <div className="col-auto">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setFilter({})}>{t("common.clear")}</button>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">{t(editing ? "transactions.editTransaction" : "transactions.newTransaction")}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-2">
                <div className="col-md-2">
                  <label className="form-label">{t("common.date")}</label>
                  <input className="form-control" type="date" required value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("common.type")}</label>
                  <select className="form-select" value={form.transaction_type}
                    onChange={(e) => setForm({ ...form, transaction_type: e.target.value, category_id: "" })}>
                    <option value="expense">{t("common.expense")}</option>
                    <option value="income">{t("common.income")}</option>
                    <option value="transfer">{t("common.transfer")}</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("common.amount")}</label>
                  <input className="form-control" type="number" step="0.01" min="0" required value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("transactions.account")}</label>
                  <select className="form-select" required value={form.account_id}
                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                    <option value="">{t("common.select")}</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("transactions.category")}</label>
                  <select className="form-select" value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">{t("common.uncategorized")}</option>
                    {relevantCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("common.description")}</label>
                  <input className="form-control" value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("transactions.payee")}</label>
                  <input className="form-control" value={form.payee}
                    onChange={(e) => setForm({ ...form, payee: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <button className="btn btn-primary" type="submit">{t("common.save")}</button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => setShowForm(false)}>{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>{t("common.date")}</th>
                <th>{t("transactions.descPayee")}</th>
                <th>{t("transactions.account")}</th>
                <th>{t("transactions.category")}</th>
                <th className="text-end">{t("common.amount")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-5">{t("transactions.noTransactions")}</td></tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="text-nowrap">{txn.date}</td>
                    <td>
                      <div>{txn.payee || txn.description || "—"}</div>
                      {txn.payee && txn.description && <small className="text-muted">{txn.description}</small>}
                    </td>
                    <td>{txn.account_name}</td>
                    <td>
                      {txn.category_name ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: txn.category_color ?? "#6c757d" }}>
                          {txn.category_name}
                        </span>
                      ) : (
                        <span className="badge bg-secondary">{t("common.uncategorized")}</span>
                      )}
                    </td>
                    <td className={`text-end fw-semibold ${txn.transaction_type === "income" ? "text-success" : "text-danger"}`}>
                      {txn.transaction_type === "income" ? "+" : "−"}{fmt(txn.amount)}
                    </td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(txn)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(txn.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleting && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center p-4">{t("transactions.deleteConfirm")}</div>
              <div className="modal-footer justify-content-center border-0">
                <button className="btn btn-danger" onClick={() => handleDelete(deleting)}>{t("common.delete")}</button>
                <button className="btn btn-outline-secondary" onClick={() => setDeleting(null)}>{t("common.cancel")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
