import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDb } from "../App";
import { closeDb } from "../api/tauri";

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { dbPath, setDbPath } = useDb();

  const navItems = [
    { to: "/dashboard", icon: "speedometer2", label: t("nav.dashboard") },
    { to: "/accounts", icon: "bank", label: t("nav.accounts") },
    { to: "/transactions", icon: "arrow-left-right", label: t("nav.transactions") },
    { to: "/clear", icon: "check2-square", label: t("nav.clear") },
    { to: "/categories", icon: "tags", label: t("nav.categories") },
    { to: "/rules", icon: "funnel", label: t("nav.rules") },
    { to: "/budgets", icon: "pie-chart", label: t("nav.budgets") },
    { to: "/reports", icon: "bar-chart-line", label: t("nav.reports") },
    { to: "/import", icon: "upload", label: t("nav.importCsv") },
  ];

  const handleClose = async () => {
    await closeDb();
    setDbPath(null);
  };

  const filename = dbPath ? dbPath.split(/[/\\]/).pop() : "";

  return (
    <nav
      className="d-flex flex-column p-3"
      style={{
        width: 220,
        height: "100vh",
        backgroundColor: "#1a1a2e",
        color: "#fff",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      <div className="mb-4 px-1">
        <div className="fw-bold fs-5 text-white">
          <i className="bi bi-cash-stack me-2 text-primary" />
          FinanceTracker
        </div>
        {filename && (
          <small
            className="text-secondary text-truncate d-block mt-1"
            style={{ fontSize: "0.7rem", maxWidth: 190 }}
            title={dbPath}
          >
            <i className="bi bi-database me-1" />
            {filename}
          </small>
        )}
      </div>

      <ul className="nav flex-column gap-1 flex-grow-1">
        {navItems.map(({ to, icon, label }) => (
          <li key={to} className="nav-item">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `nav-link px-2 py-2 rounded d-flex align-items-center gap-2 ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-secondary"
                }`
              }
              style={{ fontSize: "0.9rem" }}
            >
              <i className={`bi bi-${icon}`} style={{ width: 18 }} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <select
        className="form-select form-select-sm bg-dark text-white border-secondary mt-auto mb-2"
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{ fontSize: "0.8rem" }}
      >
        <option value="en">English</option>
        <option value="pt-BR">Portugu&#234;s (BR)</option>
        <option value="es">Espa&#241;ol</option>
      </select>

      <button
        className="btn btn-sm btn-outline-secondary mt-3 d-flex align-items-center gap-2"
        onClick={handleClose}
      >
        <i className="bi bi-folder2-open" />
        {t("nav.switchDatabase")}
      </button>
    </nav>
  );
}
