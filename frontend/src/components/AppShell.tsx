import { Outlet, useLocation } from "react-router-dom";
import TopNavbar from "./TopNavbar";
import AiChatLauncher from "./AiChatLauncher";

export default function AppShell() {
  const location = useLocation();
  const isAuthenticated = Boolean(localStorage.getItem("access_token"));

  const showLauncher =
    isAuthenticated && !["/chat", "/login", "/register"].includes(location.pathname);

  return (
    <div className="min-h-screen">
      <TopNavbar isAuthenticated={isAuthenticated} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      {showLauncher && <AiChatLauncher />}
    </div>
  );
}
