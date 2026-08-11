import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDemoSession } from "./demoSessionContext";

export function DemoSessionGuard() {
  const { status } = useDemoSession();
  const location = useLocation();

  if (status === "active") {
    return <Outlet />;
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
