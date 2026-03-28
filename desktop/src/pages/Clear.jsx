import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getTransactions, updateTransaction, getCategories } from "../api/tauri";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function Clear() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [categorized, setCategorized] = useState(0);
  const [flash, setFlash] = useState("");

  const load = async () => {
    const [txs, cats] = await Promise.all([
      getTransactions({ limit: 200 }),
      getCategories(),
    ]);
    const uncategorized = txs.filter((t) => !t.category_id);
    setTransactions(uncategorized);
    setCategories(cats.filter((c) => c.category_type !== "transfer"));
    setIndex(0);
    setDone(uncategorized.length === 0);
  };

  useEffect(() => { load(); }, []);

  const current = transactions[index];

  const categorize = useCallback(async (categoryId) => {
    if (!current) return;
    try {
      await updateTransaction({
        id: current.id,
        accountId: current.account_id,
        categoryId: categoryId,
        transactionType: current.transaction_type,
        amount: current.amount,
        description: current.description,
        payee: current.payee,
        date: current.date,
      });
      setCategorized((c) => c + 1);
      setFlash(categories.find((c) => c.id === categoryId)?.name ?? "");
      setTimeout(() => setFlash(""), 600);
      if (index >= transactions.length - 1) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch (_) {}
  }, [current, index, transactions.length, categories]);

  const skip = () => {
    if (index < transactions.length - 1) setIndex((i) => i + 1);
    else setDone(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "j") skip();
      if (e.key === "ArrowLeft" || e.key === "k") setIndex((i) => Math.max(0, i - 1));
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const cat = categories[num - 1];
        if (cat) categorize(cat.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [categories, categorize]);

  if (done || transactions.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-check-circle-fill text-success" style={{ fontSize: 64 }} />
        <h3 className="mt-3 fw-bold">{t("clear.allCaughtUp")}</h3>
        <p className="text-muted">
          {categorized > 0 ? t("clear.categorizedCount", { count: categorized }) : t("clear.noUncategorized")}
        </p>
        <button className="btn btn-primary" onClick={() => { setCategorized(0); load(); }}>
          <i className="bi bi-arrow-clockwise me-1" /> {t("common.refresh")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">{t("clear.title")}</h4>
        <span className="text-muted">
          {t("clear.remaining", { current: index + 1, total: transactions.length })}
        </span>
      </div>

      {flash && (
        <div className="alert alert-success text-center py-2 mb-3">
          <i className="bi bi-check-lg me-1" /> {t("clear.categorizedAs", { name: flash })}
        </div>
      )}

      {/* Transaction card */}
      <div className="card mb-4 border-primary" style={{ borderWidth: 2 }}>
        <div className="card-body p-4">
          <div className="row align-items-center">
            <div className="col">
              <h5 className="fw-bold mb-1">{current.payee || current.description || t("clear.unknown")}</h5>
              {current.payee && current.description && (
                <p className="text-muted mb-1">{current.description}</p>
              )}
              <div className="d-flex gap-3 text-muted small">
                <span><i className="bi bi-calendar me-1" />{current.date}</span>
                <span><i className="bi bi-bank me-1" />{current.account_name}</span>
              </div>
            </div>
            <div className="col-auto">
              <span className={`fs-2 fw-bold ${current.transaction_type === "income" ? "text-success" : "text-danger"}`}>
                {current.transaction_type === "income" ? "+" : "−"}{fmt(current.amount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category buttons */}
      <div className="row g-2 mb-3">
        {categories.slice(0, 18).map((cat, i) => (
          <div key={cat.id} className="col-6 col-md-4 col-lg-3">
            <button
              className="btn btn-outline-secondary w-100 d-flex align-items-center gap-2 text-start"
              onClick={() => categorize(cat.id)}
              style={{ borderColor: cat.color, color: cat.color }}
            >
              <span className="badge text-bg-secondary rounded-pill" style={{ minWidth: 22, background: cat.color + "22", color: cat.color }}>
                {i + 1}
              </span>
              <i className={`bi bi-${cat.icon}`} />
              <span className="text-truncate text-dark">{cat.name}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="d-flex gap-2 align-items-center">
        <button className="btn btn-outline-secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <i className="bi bi-arrow-left me-1" /> {t("clear.prev")}
        </button>
        <button className="btn btn-outline-secondary" onClick={skip}>
          {t("clear.skip")} <i className="bi bi-arrow-right ms-1" /> {t("clear.nextJ")}
        </button>
        <small className="text-muted ms-2">{t("clear.keyHint")}</small>
      </div>
    </div>
  );
}
