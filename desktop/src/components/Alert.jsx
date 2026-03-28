export default function Alert({ type = "info", message, onDismiss }) {
  if (!message) return null;
  return (
    <div className={`alert alert-${type} alert-dismissible`} role="alert">
      {message}
      {onDismiss && (
        <button type="button" className="btn-close" onClick={onDismiss} />
      )}
    </div>
  );
}
