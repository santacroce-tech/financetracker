import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getAccounts, addAccount, updateAccount, deleteAccount } from "../api/tauri";
import Alert from "../components/Alert";

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "investment", "other"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "DKK"];

const fmt = (n, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

const empty = { name: "", account_type: "checking", balance: 0, currency: "USD" };

export default function Accounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [deleting, setDeleting] = useState(null);

  const load = () => getAccounts().then(setAccounts).catch((e) => setAlert({ type: "danger", msg: String(e) }));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditing(null); setShowForm(true); };
  const openEdit = (a) => {
    setForm({ name: a.name, account_type: a.account_type, balance: a.balance, currency: a.currency });
    setEditing(a.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateAccount(editing, form.name, form.account_type, Number(form.balance), form.currency);
        setAlert({ type: "success", msg: t("accounts.accountUpdated") });
      } else {
        await addAccount(form.name, form.account_type, Number(form.balance), form.currency);
        setAlert({ type: "success", msg: t("accounts.accountAdded") });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id);
      setDeleting(null);
      load();
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    }
  };

  const typeIcon = (t) => ({ checking: "bank", savings: "piggy-bank", credit: "credit-card", cash: "cash", investment: "graph-up-arrow", other: "wallet" }[t] || "bank");

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">{t("accounts.title")}</h4>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" /> {t("accounts.addAccount")}
        </button>
      </div>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">{t(editing ? "accounts.editAccount" : "accounts.newAccount")}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">{t("common.name")}</label>
                  <input className="form-control" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("common.type")}</label>
                  <select className="form-select" value={form.account_type}
                    onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("accounts.currency")}</label>
                  <select className="form-select" value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("accounts.balance")}</label>
                  <input className="form-control" type="number" step="0.01" value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })} />
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
        {accounts.length === 0 && !showForm && (
          <div className="col-12 text-center text-muted py-5">
            <i className="bi bi-bank fs-1 d-block mb-2" />
            {t("accounts.noAccounts")}
          </div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="col-sm-6 col-lg-4">
            <div className="card h-100">
              <div className="card-body d-flex justify-content-between align-items-start">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className={`bi bi-${typeIcon(a.account_type)} text-primary`} />
                    <span className="fw-semibold">{a.name}</span>
                  </div>
                  <small className="text-muted text-capitalize">{a.account_type}</small>
                  <div className="fs-5 fw-bold mt-1">{fmt(a.balance, a.currency)}</div>
                </div>
                <div className="d-flex gap-1">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(a)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(a.id)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deleting && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center p-4">
                <i className="bi bi-exclamation-triangle text-danger fs-2 d-block mb-2" />
                {t("accounts.deleteConfirm")}
              </div>
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
