import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import AiChatLauncher from "./AiChatLauncher";
import { useAuthContext } from "../context/AuthContext";
import { useExamGuard } from "../context/ExamGuardContext";

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const { examRunning, modalOpen, requestNavigation, confirmNavigation, cancelNavigation } = useExamGuard();
  const allowNextRouteRef = useRef(false);
  const examPathRef = useRef<string>("/exams/stage-a");
  const prevExamRunningRef = useRef<boolean>(false);

  const isAuthPage = ["/login", "/register"].includes(location.pathname);
  const showSidebar = isAuthenticated && !isAuthPage;
  const showLauncher = isAuthenticated && !isAuthPage;

  const examPaths = ["/exams/stage-a", "/exams/stage-b"];

  useEffect(() => {
    if (examRunning && !prevExamRunningRef.current) {
      examPathRef.current = location.pathname;
    }
    prevExamRunningRef.current = examRunning;
  }, [examRunning, location.pathname]);

  useEffect(() => {
    if (!examRunning) return;
    if (examPaths.includes(location.pathname)) return;
    if (allowNextRouteRef.current) {
      allowNextRouteRef.current = false;
      return;
    }
    const canLeave = requestNavigation(location.pathname);
    if (!canLeave) {
      navigate(examPathRef.current, { replace: true });
    }
  }, [examRunning, location.pathname, navigate, requestNavigation]);

  const handleConfirmExit = () => {
    const { path, action } = confirmNavigation();
    if (action === "navigate" && path) {
      allowNextRouteRef.current = true;
      navigate(path);
    }
  };

  const handleStay = () => {
    cancelNavigation();
    if (location.pathname !== examPathRef.current) {
      navigate(examPathRef.current, { replace: true });
    }
  };

  return (
    <div className="flex flex-row h-screen">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto h-screen">
        <Outlet />
      </main>
      {showLauncher && <AiChatLauncher />}

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Exit Active Exam?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You have an active exam in progress. Do you want to exit the exam and continue navigation?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={handleStay}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stay
              </button>
              <button
                onClick={handleConfirmExit}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
