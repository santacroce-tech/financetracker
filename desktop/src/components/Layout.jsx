import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="d-flex" style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main
        className="flex-grow-1 p-4"
        style={{ backgroundColor: "#f8f9fa", height: "100vh", overflowY: "auto" }}
      >
        {children}
      </main>
    </div>
  );
}
