import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { importCsv, getAccounts } from "../api/tauri";
import Alert from "../components/Alert";

export default function Import() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ date: 0, amount: 1, description: 2, payee: 3 });
  const [accountId, setAccountId] = useState("");
  const [transactionType, setTransactionType] = useState("auto");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [hasHeader, setHasHeader] = useState(true);
  const [alert, setAlert] = useState({ type: "", msg: "" });
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    getAccounts().then((a) => { setAccounts(a); if (a.length) setAccountId(a[0].id); });
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length === 0) return;
      const firstLine = lines[0].split(",");
      setHeaders(firstLine);
      setPreview(lines.slice(0, 6).map((l) => l.split(",")));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText || !accountId) {
      setAlert({ type: "warning", msg: t("import.selectFileAccount") });
      return;
    }
    setImporting(true);
    try {
      const res = await importCsv({
        csvContent: csvText,
        accountId: Number(accountId),
        columnMap: {
          date: mapping.date,
          amount: mapping.amount,
          description: mapping.description,
          payee: mapping.payee,
        },
        transactionType,
        dateFormat,
        hasHeader,
      });
      setResult(res);
      setAlert({ type: "success", msg: t("import.importedCount", { count: res.imported }) });
    } catch (e) {
      setAlert({ type: "danger", msg: String(e) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h4 className="fw-bold mb-4">{t("import.title")}</h4>

      <Alert type={alert.type} message={alert.msg} onDismiss={() => setAlert({ type: "", msg: "" })} />

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">{t("import.uploadFile")}</h6>
          <input className="form-control" type="file" accept=".csv,.txt" onChange={handleFile} />
          <div className="form-check mt-2">
            <input className="form-check-input" type="checkbox" id="hasHeader" checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)} />
            <label className="form-check-label" htmlFor="hasHeader">{t("import.firstRowHeader")}</label>
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">{t("import.mapColumns")}</h6>
              <div className="row g-3 mb-3">
                {["date", "amount", "description", "payee"].map((field) => (
                  <div key={field} className="col-md-3">
                    <label className="form-label text-capitalize">{field} column</label>
                    <select className="form-select" value={mapping[field]}
                      onChange={(e) => setMapping({ ...mapping, [field]: Number(e.target.value) })}>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <h6 className="fw-semibold mb-2">{t("common.preview")}</h6>
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i === 0 && hasHeader ? "table-light fw-semibold" : ""}>
                        {row.map((cell, j) => <td key={j}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">{t("import.importSettings")}</h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">{t("import.targetAccount")}</label>
                  <select className="form-select" value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("import.dateFormat")}</label>
                  <select className="form-select" value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t("import.transactionType")}</label>
                  <select className="form-select" value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}>
                    <option value="auto">{t("import.auto")}</option>
                    <option value="expense">{t("import.allExpenses")}</option>
                    <option value="income">{t("import.allIncome")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? <><span className="spinner-border spinner-border-sm me-2" />{t("import.importing")}</> : <><i className="bi bi-upload me-2" />{t("import.importTransactions")}</>}
          </button>
        </>
      )}

      {result && (
        <div className="card mt-4">
          <div className="card-body">
            <h6 className="fw-semibold mb-2">{t("import.importResults")}</h6>
            <p className="mb-1">✅ Imported: <strong>{result.imported}</strong></p>
            <p className="mb-1">⏭ Skipped: <strong>{result.skipped}</strong></p>
            {result.errors.length > 0 && (
              <>
                <p className="mb-1 text-danger">⚠ Errors:</p>
                <ul className="mb-0">
                  {result.errors.slice(0, 10).map((e, i) => <li key={i} className="text-danger small">{e}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
