import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getCategories, addCategory, updateCategory, deleteCategory } from "../api/tauri";
import Alert from "../components/Alert";

const ICONS = ["tag", "bag", "cart", "house", "car-front", "airplane", "heart-pulse", "film",
  "music-note", "book", "laptop", "phone", "egg-fried", "cup-hot", "cash-stack", "graph-up-arrow",
  "lightning-charge", "droplet", "wifi", "shield", "gift", "people", "bicycle", "tools"];
const COLORS = ["#dc3545","#fd7e14","#ffc107","#198754","#20c997","#0dcaf0","#0d6efd",
  "#6610f2","#6f42c1","#d63384","#6c757d","#adb5bd"];

const empty = { name: "", category_type: "expense", icon: "tag", color: "#0d6efd" };

export default function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [deleting, setDeleting] = useState(null);

  const load = () => getCategories().then(setCategories).catch((e) => setAlert({ type: "danger", msg: String(e) }));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditing(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({ name: c.name, category_type: c.category_type, icon: c.icon, color: c.color });
    setEditing(c.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateCategory(editing, form.name, form.category_type, form.icon, form.color);
        setAlert({ type: "success", msg: t("categories.categoryUpdated") });
      } else {
        await addCategory(form.name, form.category_type, form.icon, form.color);
        setAlert({ type: "success", msg: t("categories.categoryAdded") });
      }
      setShowForm(false); load();
    } catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const handleDelete = async (id) => {
    try { await deleteCategory(id); setDeleting(null); load(); }
    catch (e) { setAlert({ type: "danger", msg: String(e) }); }
  };

  const grouped = { income: [], expense: [], transfer: [] };
  categories.forEach((c) => (grouped[c.category_type] ?? grouped.expense).push(c));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">{t("categories.title")}</h4>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" /> {t("categories.addCategory")}
        </button>
      </div>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">{t(editing ? "categories.editCategory" : "categories.newCategory")}</h6>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">{t("common.name")}</label>
                  <input className="form-control" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("common.type")}</label>
                  <select className="form-select" value={form.category_type}
                    onChange={(e) => setForm({ ...form, category_type: e.target.value })}>
                    <option value="expense">{t("common.expense")}</option>
                    <option value="income">{t("common.income")}</option>
                    <option value="transfer">{t("common.transfer")}</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t("categories.icon")}</label>
                  <select className="form-select" value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                    {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t("categories.color")}</label>
                  <div className="d-flex flex-wrap gap-1">
                    {COLORS.map((c) => (
                      <div key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: "pointer",
                          outline: form.color === c ? "2px solid #000" : "none" }} />
                    ))}
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

      {["expense", "income", "transfer"].map((type) => (
        grouped[type].length > 0 && (
          <div key={type} className="mb-4">
            <h6 className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: "0.75rem", letterSpacing: 1 }}>
              {type}
            </h6>
            <div className="row g-2">
              {grouped[type].map((c) => (
                <div key={c.id} className="col-sm-6 col-lg-4 col-xl-3">
                  <div className="card">
                    <div className="card-body d-flex align-items-center justify-content-between py-2 px-3">
                      <div className="d-flex align-items-center gap-2">
                        <span className="rounded-2 d-flex align-items-center justify-content-center"
                          style={{ width: 32, height: 32, background: c.color + "22" }}>
                          <i className={`bi bi-${c.icon}`} style={{ color: c.color }} />
                        </span>
                        <span className="fw-medium">{c.name}</span>
                      </div>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(c)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(c.id)}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {deleting && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center p-4">{t("categories.deleteConfirm")}</div>
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
