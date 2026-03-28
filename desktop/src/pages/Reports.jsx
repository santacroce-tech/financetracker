import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import { getMonthlyData, getCategorySpending, getTopPayees } from "../api/tauri";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function Reports() {
  const { t } = useTranslation();
  const [monthly, setMonthly] = useState([]);
  const [catSpending, setCatSpending] = useState([]);
  const [topPayees, setTopPayees] = useState([]);
  const [period, setPeriod] = useState("this_month");
  const [months, setMonths] = useState(6);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getMonthlyData(months),
      getCategorySpending(period),
      getTopPayees(10),
    ])
      .then(([m, c, p]) => { setMonthly(m); setCatSpending(c); setTopPayees(p); })
      .catch((e) => setError(String(e)));
  }, [period, months]);

  const barData = {
    labels: monthly.map((m) => m.month),
    datasets: [
      { label: t("common.income"), data: monthly.map((m) => m.income), backgroundColor: "rgba(25,135,84,0.7)", borderRadius: 6 },
      { label: t("common.expense"), data: monthly.map((m) => m.expenses), backgroundColor: "rgba(220,53,69,0.7)", borderRadius: 6 },
    ],
  };

  const doughnutData = {
    labels: catSpending.map((c) => c.category_name),
    datasets: [{
      data: catSpending.map((c) => c.total),
      backgroundColor: catSpending.map((c) => c.category_color),
      borderWidth: 2,
    }],
  };

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return (
    <div>
      <h4 className="fw-bold mb-4">{t("reports.title")}</h4>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        <div className="col-sm-4"><div className="card text-center p-3">
          <div className="text-muted small">{t("reports.totalIncome")}</div>
          <div className="fs-4 fw-bold text-success">{fmt(totalIncome)}</div>
        </div></div>
        <div className="col-sm-4"><div className="card text-center p-3">
          <div className="text-muted small">{t("reports.totalExpenses")}</div>
          <div className="fs-4 fw-bold text-danger">{fmt(totalExpenses)}</div>
        </div></div>
        <div className="col-sm-4"><div className="card text-center p-3">
          <div className="text-muted small">{t("reports.savingsRate")}</div>
          <div className={`fs-4 fw-bold ${savingsRate >= 0 ? "text-success" : "text-danger"}`}>
            {savingsRate.toFixed(1)}%
          </div>
        </div></div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="card-title fw-semibold mb-0">{t("reports.monthlyIncomeVsExpenses")}</h6>
            <select className="form-select form-select-sm w-auto" value={months}
              onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={3}>{t("reports.lastNMonths", { n: 3 })}</option>
              <option value={6}>{t("reports.lastNMonths", { n: 6 })}</option>
              <option value={12}>{t("reports.lastNMonths", { n: 12 })}</option>
            </select>
          </div>
          {monthly.length > 0 ? (
            <Bar data={barData} options={{ responsive: true, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } }} />
          ) : (
            <p className="text-muted text-center py-4">{t("reports.noDataPeriod")}</p>
          )}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="card-title fw-semibold mb-0">{t("reports.spendingByCategory")}</h6>
                <select className="form-select form-select-sm w-auto" value={period}
                  onChange={(e) => setPeriod(e.target.value)}>
                  <option value="this_month">{t("reports.thisMonth")}</option>
                  <option value="last_month">{t("reports.lastMonth")}</option>
                  <option value="this_year">{t("reports.thisYear")}</option>
                  <option value="all">{t("reports.allTime")}</option>
                </select>
              </div>
              {catSpending.length > 0 ? (
                <div style={{ maxWidth: 300, margin: "0 auto" }}>
                  <Doughnut data={doughnutData} options={{ plugins: { legend: { position: "bottom" } } }} />
                </div>
              ) : (
                <p className="text-muted text-center py-4">{t("reports.noExpenseData")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title fw-semibold mb-3">{t("reports.topPayees")}</h6>
              {topPayees.length === 0 ? (
                <p className="text-muted text-center py-4">{t("reports.noPayeeData")}</p>
              ) : (
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr><th>{t("reports.payee")}</th><th className="text-end">{t("reports.total")}</th><th className="text-end">{t("reports.count")}</th></tr>
                  </thead>
                  <tbody>
                    {topPayees.map((p, i) => (
                      <tr key={i}>
                        <td>{p.payee}</td>
                        <td className="text-end text-danger">{fmt(p.total)}</td>
                        <td className="text-end text-muted">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
