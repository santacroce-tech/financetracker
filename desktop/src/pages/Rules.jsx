import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getRules, addRule, updateRule, deleteRule, autoCategorize, getCategories } from "../api/tauri";
import Alert from "../components/Alert";

const empty = { category_id: "", pattern: "", match_field: "description", is_regex: false, priority: 0 };

export default function Rules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    Promise.all([getRules(), getCategories()])
      .then(([r, c]) => { setRules(r); setCategories(c); })
      .catch((e) => setAlert({ type: "danger", msg: String(e) }));

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditing(null); setShowForm(true); };
  const openEdit = (r) => {
    setForm({
      category_id: r.category_id, pattern: r.pattern,
      match_field: r.match_field, is_regex: r.is_regex, priority: r.priority,
    });
    setEditing(r.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateRule(editing, Number(form.category_id), form.pattern, form.match_field, form.is_regex, Number(form.priority));
        setAlert({ type: "success", msg: t("rules.ruleUpdated") });
      } else {
        await addRule(Number(form.category_id), form.pattern, form.match_field, form.is_regex, Number(form.priority));
        setAlert({ type: "success", msg: t("rules.ruleAdded") });
      }
      setShowForm(false); load();
    } catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const handleDelete = async (id) => {
    try { await deleteRule(id); setDeleting(null); load(); }
    catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const handleAutoCateg = async () => {
    try {
      const count = await autoCategorize();
      setAlert({ type: "success", msg: t("rules.autoCategorized", { count }) });
    } catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">{t("rules.title")}</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success" onClick={handleAutoCateg}>
            <i className="bi bi-magic me-1" /> {t("rules.runAutoCategorize")}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" /> {t("rules.addRule")}
          </button>
        </div>
      </div>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">{t(editing ? "rules.editRule" : "rules.newRule")}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">{t("rules.pattern")}</label>
                  <input className="form-control" required value={form.pattern}
                    placeholder={form.is_regex ? "e.g. (?i)amazon.*" : "e.g. Amazon"}
                    onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("transactions.category")}</label>
                  <select className="form-select" required value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">{t("common.select")}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("rules.matchField")}</label>
                  <select className="form-select" value={form.match_field}
                    onChange={(e) => setForm({ ...form, match_field: e.target.value })}>
                    <option value="description">{t("common.description")}</option>
                    <option value="payee">{t("transactions.payee")}</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("rules.priority")}</label>
                  <input className="form-control" type="number" value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
                <div className="col-md-1 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="isRegex" checked={form.is_regex}
                      onChange={(e) => setForm({ ...form, is_regex: e.target.checked })} />
                    <label className="form-check-label" htmlFor="isRegex">{t("rules.regex")}</label>
                  </div>
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
                <th>{t("rules.pattern")}</th>
                <th>{t("transactions.category")}</th>
                <th>{t("rules.field")}</th>
                <th>{t("common.type")}</th>
                <th>{t("rules.priority")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-5">{t("rules.noRules")}</td></tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.pattern}</code></td>
                    <td>
                      <span className="badge rounded-pill" style={{ backgroundColor: r.category_color ?? "#6c757d" }}>
                        {r.category_name}
                      </span>
                    </td>
                    <td className="text-capitalize">{r.match_field}</td>
                    <td>{r.is_regex ? <span className="badge bg-info">{t("rules.regex")}</span> : <span className="badge bg-secondary">{t("rules.text")}</span>}</td>
                    <td>{r.priority}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(r)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(r.id)}>
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
              <div className="modal-body text-center p-4">{t("rules.deleteConfirm")}</div>
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
