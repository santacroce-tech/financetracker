import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { openDb, createDb, openDemoDb } from "../api/tauri";
import { useDb } from "../App";

export default function Welcome() {
  const { t } = useTranslation();
  const { setDbPath } = useDb();
  const [error, setError] = useState("");
  const [lastUsed, setLastUsed] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load("store.json", { autoSave: false }).then((store) => {
      store.get("lastDbPath").then((p) => {
        if (p) setLastUsed(p);
      });
    }).catch(() => {});
  }, []);

  const saveLastUsed = async (path) => {
    try {
      const store = await load("store.json", { autoSave: true });
      await store.set("lastDbPath", path);
      await store.save();
    } catch (_) {}
  };

  const handleOpen = async () => {
    setError("");
    setLoading(true);
    try {
      const selected = await open({
        title: t("welcome.openTitle"),
        filters: [{ name: t("welcome.filterName"), extensions: ["db", "sqlite", "sqlite3"] }],
      });
      if (!selected) return;
      await openDb(selected);
      await saveLastUsed(selected);
      setDbPath(selected);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const path = await save({
        title: t("welcome.createTitle"),
        defaultPath: "finance.db",
        filters: [{ name: t("welcome.filterName"), extensions: ["db"] }],
      });
      if (!path) return;
      await createDb(path);
      await saveLastUsed(path);
      setDbPath(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError("");
    setLoading(true);
    try {
      const path = await openDemoDb();
      setDbPath(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLastUsed = async () => {
    if (!lastUsed) return;
    setError("");
    setLoading(true);
    try {
      await openDb(lastUsed);
      setDbPath(lastUsed);
    } catch (e) {
      setError(t("welcome.couldNotOpen", { error: e }));
      setLastUsed(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center vh-100"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      <div className="card shadow-lg" style={{ width: 420, borderRadius: 16 }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <i className="bi bi-cash-stack text-primary" style={{ fontSize: 48 }} />
            <h2 className="mt-2 fw-bold">{t("welcome.title")}</h2>
            <p className="text-muted">{t("welcome.subtitle")}</p>
          </div>

          {error && (
            <div className="alert alert-danger alert-dismissible">
              {error}
              <button className="btn-close" onClick={() => setError("")} />
            </div>
          )}

          <div className="d-grid gap-3">
            {lastUsed && (
              <button
                className="btn btn-success d-flex align-items-center gap-2 justify-content-center"
                onClick={handleLastUsed}
                disabled={loading}
              >
                <i className="bi bi-clock-history" />
                <span className="text-truncate" style={{ maxWidth: 260 }}>
                  {t("welcome.openRecent", { filename: lastUsed.split(/[/\\]/).pop() })}
                </span>
              </button>
            )}

            <button
              className="btn btn-primary d-flex align-items-center gap-2 justify-content-center"
              onClick={handleOpen}
              disabled={loading}
            >
              <i className="bi bi-folder2-open" />
              {t("welcome.openExisting")}
            </button>

            <button
              className="btn btn-outline-primary d-flex align-items-center gap-2 justify-content-center"
              onClick={handleCreate}
              disabled={loading}
            >
              <i className="bi bi-plus-circle" />
              {t("welcome.createNew")}
            </button>

            <div className="position-relative my-1">
              <hr className="text-muted" />
              <span
                className="position-absolute top-50 start-50 translate-middle bg-white px-2 text-muted"
                style={{ fontSize: "0.75rem" }}
              >
                {t("common.or", "or")}
              </span>
            </div>

            <button
              className="btn btn-outline-success d-flex align-items-center gap-2 justify-content-center"
              onClick={handleDemo}
              disabled={loading}
            >
              <i className="bi bi-play-circle" />
              {t("welcome.tryDemo")}
            </button>
          </div>

          {loading && (
            <div className="text-center mt-3">
              <div className="spinner-border spinner-border-sm text-primary" />
            </div>
          )}

          <p className="text-muted text-center mt-4 mb-0" style={{ fontSize: "0.8rem" }}>
            {t("welcome.privacy")}
          </p>
        </div>
      </div>
    </div>
  );
}
