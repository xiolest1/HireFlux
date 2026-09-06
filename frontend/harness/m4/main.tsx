/* eslint-disable react-refresh/only-export-components -- standalone browser-test entry */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LandingViewportReveal } from "../../src/features/landing/LandingViewportReveal";
import "../../src/styles.css";

declare global {
  interface Window {
    __m4AnimationStarts: Record<string, number>;
    __m4PaintFrames: Record<string, PaintFrame[]>;
    __m4Harness?: {
      mountPassed: () => void;
    };
  }
}

interface PaintFrame {
  motion: string | null;
  opacity: string;
  state: string | null;
  top: number;
  transform: string;
}

const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: "1rem",
  color: "var(--color-ink)",
  marginInline: "auto",
  maxWidth: "42rem",
  padding: "1.5rem",
} as const;

function RevealCard({ id, focusable = false }: { id: string; focusable?: boolean }) {
  return (
    <LandingViewportReveal>
      <article data-m4-card={id} style={cardStyle}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{id}</h2>
        <p style={{ marginTop: "0.5rem" }}>
          Rendered-browser evidence for the landing viewport reveal foundation.
        </p>
        {focusable ? (
          <button data-m4-focus-target type="button" style={{ marginTop: "1rem" }}>
            Focus target
          </button>
        ) : null}
      </article>
    </LandingViewportReveal>
  );
}

function App() {
  const [showPassed, setShowPassed] = useState(false);

  useEffect(() => {
    window.__m4Harness = {
      mountPassed: () => setShowPassed(true),
    };

    return () => {
      delete window.__m4Harness;
    };
  }, []);

  return (
    <main style={{ minHeight: "520vh", overflowX: "clip", padding: "1rem", position: "relative" }}>
      <h1
        style={{ height: "1px", margin: "-1px", overflow: "hidden", position: "absolute", width: "1px" }}
      >
        M4 viewport reveal browser harness
      </h1>
      <div data-m4-id="intersecting">
        <RevealCard id="Already intersecting" />
      </div>

      <div
        data-m4-near-boundary-host
        style={{ left: "1rem", position: "absolute", right: "1rem", top: "calc(100vh + 0.5px)" }}
      >
        <div data-m4-id="near-boundary">
          <RevealCard id="Near viewport boundary" />
        </div>
      </div>

      <div aria-hidden="true" style={{ height: "125vh" }} />

      <div data-m4-below-host>
        <div data-m4-id="below">
          <RevealCard id="Safely below" />
        </div>
      </div>

      <div aria-hidden="true" style={{ height: "80vh" }} />

      <div data-m4-id="focus-pending">
        <RevealCard focusable id="Focus while pending" />
      </div>

      <div aria-hidden="true" style={{ height: "80vh" }} />

      <div data-m4-id="fast-pending">
        <RevealCard id="Fast-scroll target" />
      </div>

      <div aria-hidden="true" style={{ height: "100vh" }} />

      {showPassed ? (
        <div data-m4-passed-host style={{ left: "1rem", position: "absolute", right: "1rem", top: "10rem" }}>
          <div data-m4-id="passed">
            <RevealCard id="Already passed" />
          </div>
        </div>
      ) : null}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("M4 harness root is missing");
createRoot(root).render(<App />);
