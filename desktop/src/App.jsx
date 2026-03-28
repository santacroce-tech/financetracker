import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getDbPath } from "./api/tauri";
import Layout from "./components/Layout";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Rules from "./pages/Rules";
import Budgets from "./pages/Budgets";
import Reports from "./pages/Reports";
import Import from "./pages/Import";
import Clear from "./pages/Clear";

export const DbContext = createContext(null);
export const useDb = () => useContext(DbContext);

export default function App() {
  const [dbPath, setDbPath] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDbPath()
      .then((p) => setDbPath(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <DbContext.Provider value={{ dbPath, setDbPath }}>
      <BrowserRouter>
        {!dbPath ? (
          <Welcome />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/import" element={<Import />} />
              <Route path="/clear" element={<Clear />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </DbContext.Provider>
  );
}
