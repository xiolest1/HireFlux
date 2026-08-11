import { Link } from "react-router-dom";
import { buttonClassName } from "../components/ui/buttonStyles";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-panel">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Page not found
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
        The page may have moved, or the address may be incomplete.
      </p>
      <Link to="/applications" className={buttonClassName("primary", "mt-7")}>
        View applications
      </Link>
    </div>
  );
}
