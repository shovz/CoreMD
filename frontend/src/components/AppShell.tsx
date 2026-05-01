import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import AiChatLauncher from "./AiChatLauncher";
import { useAuthContext } from "../context/AuthContext";

export default function AppShell() {
  const location = useLocation();
  const { isAuthenticated } = useAuthContext();

  const isAuthPage = ["/login", "/register"].includes(location.pathname);
  const showSidebar = isAuthenticated && !isAuthPage;
  const showLauncher = isAuthenticated && !isAuthPage;

  return (
    <div className="flex flex-row h-screen">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto h-screen">
        <Outlet />
      </main>
      {showLauncher && <AiChatLauncher />}
    </div>
  );
}
