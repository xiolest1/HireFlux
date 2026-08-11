import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { buttonClassName } from "../components/ui/buttonStyles";

export function RouteErrorPage() {
  const error = useRouteError();
  const isMissing = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-panel">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-700">
          {isMissing ? "404" : "Unexpected error"}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          {isMissing ? "Page not found" : "HireFlux hit a problem"}
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          {isMissing
            ? "The requested page does not exist."
            : "Your data has not been changed. Return to your applications and try again."}
        </p>
        <Link to="/applications" className={buttonClassName("primary", "mt-7")}>
          View applications
        </Link>
      </div>
    </main>
  );
}
