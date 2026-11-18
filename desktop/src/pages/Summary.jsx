import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getSummary, getRecurring, setRecurringStatus,
  getAccounts, getDebts, addDebt, updateDebt, deleteDebt,
} from "../api/tauri";
import Alert from "../components/Alert";

const CURRENCIES = ["EUR", "USD", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "DKK"];

const fmt = (n, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);

const iso = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const PRESETS = {
  thisYear: () => {
    const now = new Date();
    return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
  },
  lastYear: () => {
    const y = new Date().getFullYear() - 1;
    return [`${y}-01-01`, `${y}-12-31`];
  },
  last12Months: () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    return [iso(start), iso(end)];
  },
};

// The currency most accounts use; aggregates across accounts are shown in it.
const mainCurrency = (accounts) => {
  const counts = {};
  accounts.forEach((a) => { counts[a.currency] = (counts[a.currency] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";
};

const signClass = (n) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "");

function useDateFormatter() {
  const { i18n } = useTranslation();
  return (s) => {
    if (!s) return "—";
    const d = new Date(`${s}T00:00:00`);
    if (isNaN(d)) return s;
    return new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };
}

// ---------------------------------------------------------------------------
// Overview: accounts, personal by month, by quarter
// ---------------------------------------------------------------------------

function Overview({ setAlert }) {
  const { t } = useTranslation();
  const fmtDate = useDateFormatter();
  const [[start, end], setRange] = useState(PRESETS.thisYear());
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!start || !end) return;
    getSummary(start, end).then(setData).catch((e) => setAlert({ type: "danger", msg: String(e) }));
  }, [start, end, setAlert]);

  if (!data) return <div className="text-muted">{t("common.loading")}</div>;

  const cur = mainCurrency(data.accounts);
  const singleCurrency = new Set(data.accounts.map((a) => a.currency)).size <= 1;
  const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
  const covers = (r) => `${fmtDate(r.covers_from)} – ${fmtDate(r.covers_to)}`;

  return (
    <>
      <div className="card mb-4">
        <div className="card-body d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label small mb-1">{t("common.from")}</label>
            <input type="date" className="form-control form-control-sm" value={start}
              onChange={(e) => setRange([e.target.value, end])} />
          </div>
          <div>
            <label className="form-label small mb-1">{t("common.to")}</label>
            <input type="date" className="form-control form-control-sm" value={end}
              onChange={(e) => setRange([start, e.target.value])} />
          </div>
          <div className="btn-group btn-group-sm">
            {Object.keys(PRESETS).map((p) => (
              <button key={p} className="btn btn-outline-secondary" onClick={() => setRange(PRESETS[p]())}>
                {t(`summary.presets.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">{t("summary.accountsTitle")}</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("summary.account")}</th>
                  <th className="text-end">{t("summary.openingBalance")}</th>
                  <th className="text-end">{t("summary.moneyIn")}</th>
                  <th className="text-end">{t("summary.moneyOut")}</th>
                  <th className="text-end">{t("summary.netChange")}</th>
                  <th className="text-end">{t("summary.closingBalance")}</th>
                  <th className="text-end">{t("summary.transactions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.length === 0 && (
                  <tr><td colSpan={7} className="text-muted text-center py-3">{t("common.noData")}</td></tr>
                )}
                {data.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      <span className={`badge ms-2 ${a.owner === "company" ? "bg-info-subtle text-info-emphasis" : "bg-secondary-subtle text-secondary-emphasis"}`}>
                        {t(`accounts.owners.${a.owner}`)}
                      </span>
                    </td>
                    <td className="text-end">{fmt(a.opening_balance, a.currency)}</td>
                    <td className="text-end text-success">{fmt(a.money_in, a.currency)}</td>
                    <td className="text-end text-danger">{fmt(a.money_out, a.currency)}</td>
                    <td className={`text-end ${signClass(a.net_change)}`}>{fmt(a.net_change, a.currency)}</td>
                    <td className="text-end fw-semibold">{fmt(a.closing_balance, a.currency)}</td>
                    <td className="text-end">{a.transactions}</td>
                  </tr>
                ))}
              </tbody>
              {singleCurrency && data.accounts.length > 1 && (
                <tfoot className="fw-semibold">
                  <tr>
                    <td>{t("summary.total")}</td>
                    <td className="text-end">{fmt(sum(data.accounts, "opening_balance"), cur)}</td>
                    <td className="text-end text-success">{fmt(sum(data.accounts, "money_in"), cur)}</td>
                    <td className="text-end text-danger">{fmt(sum(data.accounts, "money_out"), cur)}</td>
                    <td className={`text-end ${signClass(sum(data.accounts, "net_change"))}`}>{fmt(sum(data.accounts, "net_change"), cur)}</td>
                    <td className="text-end">{fmt(sum(data.accounts, "closing_balance"), cur)}</td>
                    <td className="text-end">{sum(data.accounts, "transactions")}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!singleCurrency && <small className="text-muted">{t("summary.mixedCurrencies", { currency: cur })}</small>}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">{t("summary.personalByMonth")}</h6>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("summary.month")}</th>
                      <th>{t("summary.covers")}</th>
                      <th className="text-end">{t("summary.moneyIn")}</th>
                      <th className="text-end">{t("summary.moneyOut")}</th>
                      <th className="text-end">{t("summary.net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.length === 0 && (
                      <tr><td colSpan={5} className="text-muted text-center py-3">{t("common.noData")}</td></tr>
                    )}
                    {data.months.map((m) => (
                      <tr key={m.month}>
                        <td className="fw-semibold">{m.month}</td>
                        <td className="small text-muted">{covers(m)}</td>
                        <td className="text-end text-success">{fmt(m.money_in, cur)}</td>
                        <td className="text-end text-danger">{fmt(m.money_out, cur)}</td>
                        <td className={`text-end ${signClass(m.net)}`}>{fmt(m.net, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data.months.length > 1 && (
                    <tfoot className="fw-semibold">
                      <tr>
                        <td colSpan={2}>{t("summary.total")}</td>
                        <td className="text-end text-success">{fmt(sum(data.months, "money_in"), cur)}</td>
                        <td className="text-end text-danger">{fmt(sum(data.months, "money_out"), cur)}</td>
                        <td className={`text-end ${signClass(sum(data.months, "net"))}`}>{fmt(sum(data.months, "net"), cur)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">{t("summary.byQuarter")}</h6>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("summary.quarter")}</th>
                      <th>{t("summary.covers")}</th>
                      <th className="text-end">{t("summary.personalIn")}</th>
                      <th className="text-end">{t("summary.personalOut")}</th>
                      <th className="text-end">{t("summary.companyIn")}</th>
                      <th className="text-end">{t("summary.companyOut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.quarters.length === 0 && (
                      <tr><td colSpan={6} className="text-muted text-center py-3">{t("common.noData")}</td></tr>
                    )}
                    {data.quarters.map((q) => (
                      <tr key={q.quarter}>
                        <td className="fw-semibold">{q.quarter}</td>
                        <td className="small text-muted">{covers(q)}</td>
                        <td className="text-end text-success">{fmt(q.personal_in, cur)}</td>
                        <td className="text-end text-danger">{fmt(q.personal_out, cur)}</td>
                        <td className="text-end text-success">{fmt(q.company_in, cur)}</td>
                        <td className="text-end text-danger">{fmt(q.company_out, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data.quarters.length > 1 && (
                    <tfoot className="fw-semibold">
                      <tr>
                        <td colSpan={2}>{t("summary.total")}</td>
                        <td className="text-end text-success">{fmt(sum(data.quarters, "personal_in"), cur)}</td>
                        <td className="text-end text-danger">{fmt(sum(data.quarters, "personal_out"), cur)}</td>
                        <td className="text-end text-success">{fmt(sum(data.quarters, "company_in"), cur)}</td>
                        <td className="text-end text-danger">{fmt(sum(data.quarters, "company_out"), cur)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Recurring (monthly / quarterly / annual)
// ---------------------------------------------------------------------------

function Recurring({ frequency, items, currency, reload, setAlert }) {
  const { t } = useTranslation();
  const fmtDate = useDateFormatter();
  const [showDismissed, setShowDismissed] = useState(false);

  const all = items.filter((i) => i.frequency === frequency);
  const active = all.filter((i) => i.status !== "dismissed");
  const shown = showDismissed ? all : active;
  const dismissedCount = all.length - active.length;
  const total = (type) => active.filter((i) => i.transaction_type === type).reduce((s, i) => s + i.amount, 0);

  const setStatus = async (item, status) => {
    try {
      await setRecurringStatus(item, status);
      reload();
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    }
  };

  const statusBadge = (s) => ({
    detected: "bg-warning-subtle text-warning-emphasis",
    confirmed: "bg-success-subtle text-success-emphasis",
    dismissed: "bg-secondary-subtle text-secondary-emphasis",
  }[s]);

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-4">
          <div className="card"><div className="card-body">
            <div className="text-muted small">{t(`summary.recurring.totalOut.${frequency}`)}</div>
            <div className="fs-4 fw-bold text-danger">{fmt(total("expense"), currency)}</div>
          </div></div>
        </div>
        <div className="col-sm-6 col-lg-4">
          <div className="card"><div className="card-body">
            <div className="text-muted small">{t(`summary.recurring.totalIn.${frequency}`)}</div>
            <div className="fs-4 fw-bold text-success">{fmt(total("income"), currency)}</div>
          </div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <small className="text-muted">{t("summary.recurring.help")}</small>
            {dismissedCount > 0 && (
              <div className="form-check form-switch mb-0">
                <input className="form-check-input" type="checkbox" id={`dismissed-${frequency}`}
                  checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
                <label className="form-check-label small" htmlFor={`dismissed-${frequency}`}>
                  {t("summary.recurring.showDismissed", { count: dismissedCount })}
                </label>
              </div>
            )}
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("summary.account")}</th>
                  <th className="text-end">{t("summary.recurring.typicalAmount")}</th>
                  <th className="text-end">{t("summary.recurring.occurrences")}</th>
                  <th>{t("summary.recurring.last")}</th>
                  <th>{t("summary.recurring.next")}</th>
                  <th>{t("summary.recurring.status")}</th>
                  <th className="text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={8} className="text-muted text-center py-4">{t("summary.recurring.none")}</td></tr>
                )}
                {shown.map((i) => (
                  <tr key={i.key} className={i.status === "dismissed" ? "text-muted" : ""}>
                    <td>
                      {i.name}
                      {i.possibly_ended && i.status !== "dismissed" && (
                        <span className="badge bg-light text-muted border ms-2" title={t("summary.recurring.possiblyEndedHint")}>
                          {t("summary.recurring.possiblyEnded")}
                        </span>
                      )}
                    </td>
                    <td className="small">{i.account || "—"}</td>
                    <td className={`text-end ${i.transaction_type === "income" ? "text-success" : "text-danger"}`}>
                      {i.transaction_type === "income" ? "+" : "−"}{fmt(i.amount, currency)}
                    </td>
                    <td className="text-end">{i.occurrences || "—"}</td>
                    <td className="small">{fmtDate(i.last_date)}</td>
                    <td className="small">{fmtDate(i.next_date)}</td>
                    <td><span className={`badge ${statusBadge(i.status)}`}>{t(`summary.recurring.statuses.${i.status}`)}</span></td>
                    <td className="text-end text-nowrap">
                      {i.status !== "confirmed" && (
                        <button className="btn btn-sm btn-outline-success me-1" title={t("summary.recurring.confirm")}
                          onClick={() => setStatus(i, "confirmed")}>
                          <i className="bi bi-check-lg" />
                        </button>
                      )}
                      {i.status !== "dismissed" && (
                        <button className="btn btn-sm btn-outline-secondary me-1" title={t("summary.recurring.dismiss")}
                          onClick={() => setStatus(i, "dismissed")}>
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                      {i.status !== "detected" && i.occurrences > 0 && (
                        <button className="btn btn-sm btn-outline-secondary" title={t("summary.recurring.undo")}
                          onClick={() => setStatus(i, "detected")}>
                          <i className="bi bi-arrow-counterclockwise" />
                        </button>
                      )}
                      {i.status === "confirmed" && i.occurrences === 0 && (
                        <button className="btn btn-sm btn-outline-danger" title={t("common.delete")}
                          onClick={() => setStatus(i, "detected")}>
                          <i className="bi bi-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Owed & debts
// ---------------------------------------------------------------------------

const emptyDebt = { direction: "i_owe", counterparty: "", amount: "", currency: "EUR", due_date: "", note: "" };

function Debts({ accounts, currency, setAlert }) {
  const { t } = useTranslation();
  const fmtDate = useDateFormatter();
  const [debts, setDebts] = useState([]);
  const [form, setForm] = useState(null);
  const [showSettled, setShowSettled] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(
    () => getDebts().then(setDebts).catch((e) => setAlert({ type: "danger", msg: String(e) })),
    [setAlert],
  );
  useEffect(() => { load(); }, [load]);

  const liabilities = accounts.filter((a) => a.account_type === "credit" || a.balance < 0);
  const open = debts.filter((d) => !d.settled);
  const settledCount = debts.length - open.length;
  const shown = showSettled ? debts : open;

  // Totals in the main currency only; other currencies are listed but not summed.
  const sumDebts = (dir) => open.filter((d) => d.direction === dir && d.currency === currency).reduce((s, d) => s + d.amount, 0);
  const owedToMe = sumDebts("owed_to_me");
  const iOwe = sumDebts("i_owe");
  const liabilityTotal = liabilities
    .filter((a) => a.currency === currency && a.balance < 0)
    .reduce((s, a) => s - a.balance, 0);
  const net = owedToMe - iOwe - liabilityTotal;
  const today = iso(new Date());

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (form.id) await updateDebt(payload);
      else await addDebt(payload);
      setForm(null);
      load();
    } catch (err) {
      setAlert({ type: "danger", msg: String(err) });
    }
  };

  const toggleSettled = async (d) => {
    try {
      await updateDebt({ ...d, settled: !d.settled });
      load();
    } catch (err) {
      setAlert({ type: "danger", msg: String(err) });
    }
  };

  const remove = async (id) => {
    try {
      await deleteDebt(id);
      setDeleting(null);
      load();
    } catch (err) {
      setAlert({ type: "danger", msg: String(err) });
    }
  };

  return (
    <>
      <div className="row g-3 mb-4">
        {[
          ["owedToMe", owedToMe, "text-success"],
          ["iOwe", iOwe, "text-danger"],
          ["liabilities", liabilityTotal, "text-danger"],
          ["netPosition", net, signClass(net)],
        ].map(([k, v, cls]) => (
          <div key={k} className="col-sm-6 col-lg-3">
            <div className="card"><div className="card-body">
              <div className="text-muted small">{t(`summary.debts.${k}`)}</div>
              <div className={`fs-4 fw-bold ${cls}`}>{fmt(v, currency)}</div>
            </div></div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-semibold mb-0">{t("summary.debts.ledger")}</h6>
            <div className="d-flex align-items-center gap-3">
              {settledCount > 0 && (
                <div className="form-check form-switch mb-0">
                  <input className="form-check-input" type="checkbox" id="showSettled"
                    checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="showSettled">
                    {t("summary.debts.showSettled", { count: settledCount })}
                  </label>
                </div>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => setForm({ ...emptyDebt, currency })}>
                <i className="bi bi-plus-lg me-1" />{t("summary.debts.add")}
              </button>
            </div>
          </div>

          {form && (
            <form className="border rounded p-3 mb-3 bg-light-subtle" onSubmit={save}>
              <div className="row g-2">
                <div className="col-md-2">
                  <label className="form-label small">{t("summary.debts.direction")}</label>
                  <select className="form-select form-select-sm" value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                    <option value="i_owe">{t("summary.debts.directions.i_owe")}</option>
                    <option value="owed_to_me">{t("summary.debts.directions.owed_to_me")}</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small">{t("summary.debts.counterparty")}</label>
                  <input className="form-control form-control-sm" required value={form.counterparty}
                    onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">{t("common.amount")}</label>
                  <input className="form-control form-control-sm" type="number" step="0.01" min="0" required value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="col-md-1">
                  <label className="form-label small">{t("accounts.currency")}</label>
                  <select className="form-select form-select-sm" value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small">{t("summary.debts.dueDate")}</label>
                  <input className="form-control form-control-sm" type="date" value={form.due_date || ""}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">{t("summary.debts.note")}</label>
                  <input className="form-control form-control-sm" value={form.note || ""}
                    onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-sm btn-primary" type="submit">{t("common.save")}</button>
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              </div>
            </form>
          )}

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("summary.debts.direction")}</th>
                  <th>{t("summary.debts.counterparty")}</th>
                  <th className="text-end">{t("common.amount")}</th>
                  <th>{t("summary.debts.dueDate")}</th>
                  <th>{t("summary.debts.note")}</th>
                  <th className="text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={6} className="text-muted text-center py-4">{t("summary.debts.none")}</td></tr>
                )}
                {shown.map((d) => {
                  const overdue = !d.settled && d.due_date && d.due_date < today;
                  return (
                    <tr key={d.id} className={d.settled ? "text-muted text-decoration-line-through" : ""}>
                      <td>
                        <span className={`badge ${d.direction === "owed_to_me" ? "bg-success-subtle text-success-emphasis" : "bg-danger-subtle text-danger-emphasis"}`}>
                          {t(`summary.debts.directions.${d.direction}`)}
                        </span>
                      </td>
                      <td>{d.counterparty}</td>
                      <td className={`text-end ${d.direction === "owed_to_me" ? "text-success" : "text-danger"}`}>{fmt(d.amount, d.currency)}</td>
                      <td className={`small ${overdue ? "text-danger fw-semibold" : ""}`}>
                        {fmtDate(d.due_date)}{overdue && ` · ${t("summary.debts.overdue")}`}
                      </td>
                      <td className="small">{d.note}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-outline-success me-1"
                          title={t(d.settled ? "summary.debts.reopen" : "summary.debts.markSettled")}
                          onClick={() => toggleSettled(d)}>
                          <i className={`bi bi-${d.settled ? "arrow-counterclockwise" : "check2-circle"}`} />
                        </button>
                        <button className="btn btn-sm btn-outline-secondary me-1" title={t("common.edit")}
                          onClick={() => setForm({ ...d, due_date: d.due_date || "", note: d.note || "" })}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" title={t("common.delete")} onClick={() => setDeleting(d.id)}>
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h6 className="fw-semibold mb-1">{t("summary.debts.liabilityAccounts")}</h6>
          <small className="text-muted d-block mb-3">{t("summary.debts.liabilityHelp")}</small>
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>{t("summary.account")}</th>
                <th>{t("common.type")}</th>
                <th className="text-end">{t("accounts.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {liabilities.length === 0 && (
                <tr><td colSpan={3} className="text-muted text-center py-3">{t("summary.debts.noLiabilities")}</td></tr>
              )}
              {liabilities.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="small">{t(`accounts.types.${a.account_type}`, a.account_type)}</td>
                  <td className={`text-end ${signClass(a.balance)}`}>{fmt(a.balance, a.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleting && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center p-4">
                <i className="bi bi-exclamation-triangle text-danger fs-2 d-block mb-2" />
                {t("summary.debts.deleteConfirm")}
              </div>
              <div className="modal-footer justify-content-center border-0">
                <button className="btn btn-danger" onClick={() => remove(deleting)}>{t("common.delete")}</button>
                <button className="btn btn-outline-secondary" onClick={() => setDeleting(null)}>{t("common.cancel")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS = [
  { id: "overview", icon: "table" },
  { id: "monthly", icon: "calendar-month" },
  { id: "quarterly", icon: "calendar3" },
  { id: "annual", icon: "calendar-check" },
  { id: "debts", icon: "people" },
];

export default function Summary() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("overview");
  const [alert, setAlertState] = useState({ type: "", msg: "" });
  const [accounts, setAccounts] = useState([]);
  const [recurring, setRecurring] = useState([]);

  const setAlert = useCallback((a) => setAlertState(a), []);

  const loadRecurring = useCallback(
    () => getRecurring().then(setRecurring).catch((e) => setAlert({ type: "danger", msg: String(e) })),
    [setAlert],
  );

  useEffect(() => {
    getAccounts().then(setAccounts).catch((e) => setAlert({ type: "danger", msg: String(e) }));
    loadRecurring();
  }, [loadRecurring, setAlert]);

  const currency = mainCurrency(accounts);
  const pendingCount = (freq) => recurring.filter((i) => i.frequency === freq && i.status === "detected").length;

  return (
    <div>
      <h4 className="fw-bold mb-4">{t("summary.title")}</h4>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlertState({ type: "", msg: "" })} />

      <ul className="nav nav-tabs mb-4">
        {TABS.map(({ id, icon }) => {
          const pending = ["monthly", "quarterly", "annual"].includes(id) ? pendingCount(id) : 0;
          return (
            <li key={id} className="nav-item">
              <button className={`nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                <i className={`bi bi-${icon} me-1`} />
                {t(`summary.tabs.${id}`)}
                {pending > 0 && (
                  <span className="badge rounded-pill bg-warning text-dark ms-2" title={t("summary.recurring.pendingHint")}>{pending}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {tab === "overview" && <Overview setAlert={setAlert} />}
      {["monthly", "quarterly", "annual"].includes(tab) && (
        <Recurring frequency={tab} items={recurring} currency={currency} reload={loadRecurring} setAlert={setAlert} />
      )}
      {tab === "debts" && <Debts accounts={accounts} currency={currency} setAlert={setAlert} />}
    </div>
  );
}
