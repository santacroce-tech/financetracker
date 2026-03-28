import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getBudgets, addBudget, updateBudget, deleteBudget, getCategories } from "../api/tauri";
import Alert from "../components/Alert";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const empty = { category_id: "", amount: "", period: "monthly", start_date: today() };

export default function Budgets() {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    Promise.all([getBudgets(), getCategories()])
      .then(([b, c]) => { setBudgets(b); setCategories(c); })
      .catch((e) => setAlert({ type: "danger", msg: String(e) }));

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditing(null); setShowForm(true); };
  const openEdit = (b) => {
    setForm({ category_id: b.category_id, amount: b.amount, period: b.period, start_date: b.start_date });
    setEditing(b.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateBudget(editing, Number(form.category_id), Number(form.amount), form.period, form.start_date);
        setAlert({ type: "success", msg: t("budgets.budgetUpdated") });
      } else {
        await addBudget(Number(form.category_id), Number(form.amount), form.period, form.start_date);
        setAlert({ type: "success", msg: t("budgets.budgetAdded") });
      }
      setShowForm(false); load();
    } catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const handleDelete = async (id) => {
    try { await deleteBudget(id); setDeleting(null); load(); }
    catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const expenseCategories = categories.filter((c) => c.category_type === "expense");

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">{t("budgets.title")}</h4>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" /> {t("budgets.addBudget")}
        </button>
      </div>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">{t(editing ? "budgets.editBudget" : "budgets.newBudget")}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">{t("transactions.category")}</label>
                  <select className="form-select" required value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">{t("common.select")}</option>
                    {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("common.amount")}</label>
                  <input className="form-control" type="number" step="0.01" min="0" required value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("budgets.period")}</label>
                  <select className="form-select" value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}>
                    <option value="monthly">{t("budgets.monthly")}</option>
                    <option value="yearly">{t("budgets.yearly")}</option>
                    <option value="weekly">{t("budgets.weekly")}</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("budgets.startDate")}</label>
                  <input className="form-control" type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
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

      <div className="row g-3">
        {budgets.length === 0 && !showForm && (
          <div className="col-12 text-center text-muted py-5">
            <i className="bi bi-pie-chart fs-1 d-block mb-2" />
            {t("budgets.noBudgets")}
          </div>
        )}
        {budgets.map((b) => {
          const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
          const over = b.spent > b.amount;
          return (
            <div key={b.id} className="col-md-6 col-lg-4">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="badge rounded-pill mb-1"
                        style={{ backgroundColor: b.category_color ?? "#6c757d" }}>
                        <i className={`bi bi-${b.category_icon ?? "tag"} me-1`} />
                        {b.category_name}
                      </span>
                      <div className="text-muted small text-capitalize">{b.period}</div>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(b)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(b.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className={`fw-semibold ${over ? "text-danger" : ""}`}>{fmt(b.spent)} {t("common.spent")}</span>
                    <span className="text-muted">{t("common.of")} {fmt(b.amount)}</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className={`progress-bar ${over ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <small className={`${over ? "text-danger" : "text-muted"} mt-1 d-block`}>
                    {over ? t("budgets.overBudget", { amount: fmt(b.spent - b.amount) }) : t("budgets.remaining", { amount: fmt(b.amount - b.spent) })}
                  </small>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {deleting && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center p-4">{t("budgets.deleteConfirm")}</div>
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
