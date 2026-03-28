import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useTranslation } from "react-i18next";
import {
  getDashboardStats,
  getMonthlyData,
  getRecentTransactions,
} from "../api/tauri";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmt = (n, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      getMonthlyData(6),
      getRecentTransactions(10),
    ])
      .then(([s, m, r]) => {
        setStats(s);
        setMonthly(m);
        setRecent(r);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const chartData = {
    labels: monthly.map((m) => m.month),
    datasets: [
      {
        label: t("common.income"),
        data: monthly.map((m) => m.income),
        backgroundColor: "rgba(25, 135, 84, 0.7)",
        borderRadius: 6,
      },
      {
        label: t("common.expense"),
        data: monthly.map((m) => m.expenses),
        backgroundColor: "rgba(220, 53, 69, 0.7)",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div>
      <h4 className="mb-4 fw-bold">{t("dashboard.title")}</h4>

      {error && <div className="alert alert-danger">{error}</div>}

      {stats && (
        <div className="row g-3 mb-4">
          <StatCard
            icon="wallet2"
            label={t("dashboard.totalBalance")}
            value={fmt(stats.total_balance)}
            color="primary"
          />
          <StatCard
            icon="arrow-down-circle"
            label={t("dashboard.monthlyIncome")}
            value={fmt(stats.monthly_income)}
            color="success"
          />
          <StatCard
            icon="arrow-up-circle"
            label={t("dashboard.monthlyExpenses")}
            value={fmt(stats.monthly_expenses)}
            color="danger"
          />
          <StatCard
            icon="bank"
            label={t("dashboard.accounts")}
            value={stats.account_count}
            color="info"
          />
        </div>
      )}

      {stats?.uncategorized_count > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>
            {t("dashboard.uncategorizedWarning", { count: stats.uncategorized_count })}{" "}
            <Link to="/clear" className="alert-link">
              {t("dashboard.clearNow")}
            </Link>
          </span>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title fw-semibold mb-3">{t("dashboard.incomeVsExpenses")}</h6>
              {monthly.length > 0 ? (
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: "top" } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              ) : (
                <p className="text-muted text-center py-4">{t("dashboard.noTransactionData")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title fw-semibold mb-3">{t("dashboard.recentTransactions")}</h6>
              {recent.length === 0 ? (
                <p className="text-muted text-center py-4">{t("dashboard.noTransactions")}</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {recent.map((txn) => (
                    <li
                      key={txn.id}
                      className="d-flex justify-content-between align-items-center py-2 border-bottom"
                    >
                      <div>
                        <div className="fw-medium" style={{ fontSize: "0.9rem" }}>
                          {txn.payee || txn.description || "—"}
                        </div>
                        <small className="text-muted">
                          {txn.date} · {txn.account_name}
                        </small>
                      </div>
                      <span
                        className={`fw-semibold ${
                          txn.transaction_type === "income"
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {txn.transaction_type === "income" ? "+" : "−"}
                        {fmt(txn.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className="card">
        <div className="card-body d-flex align-items-center gap-3">
          <div
            className={`rounded-3 bg-${color} bg-opacity-10 p-3`}
          >
            <i className={`bi bi-${icon} text-${color} fs-4`} />
          </div>
          <div>
            <div className="text-muted small">{label}</div>
            <div className="fw-bold fs-5">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
