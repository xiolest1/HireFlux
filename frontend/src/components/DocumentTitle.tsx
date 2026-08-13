import { type ReactNode, useEffect } from "react";

export function DocumentTitle({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · HireFlux`;
  }, [title]);

  return children;
}
