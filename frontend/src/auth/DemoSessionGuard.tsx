import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ui/Feedback";
import { useDemoSession } from "./demoSessionContext";

export function DemoSessionGuard() {
  const { status, isCreating } = useDemoSession();
  const location = useLocation();

  if (status === "active") {
    return <Outlet />;
  }

  if (isCreating) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <LoadingState label="Preparing a fresh demo workspace..." />
      </div>
    );
  }

  return (
    <Navigate
      to="/"
      replace
      state={{
        from: `${location.pathname}${location.search}`,
        reason: status === "expired" ? "expired" : "required",
      }}
    />
  );
}
