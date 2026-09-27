import { describe, expect, it } from "vitest";
import { connectedClosingPinTop, measureConnectedClosingGeometry, readConnectedJ3ScrollRange } from "./connectedClosingGeometry";

describe("shared closing geometry", () => {
  it("keeps ordinary desktops at zero and reserves reachable tall-screen release", () => {
    expect(connectedClosingPinTop(900, 688, 569)).toBe(0);
    expect(connectedClosingPinTop(1687, 688, 569)).toBe(462);
    expect(connectedClosingPinTop(1797, 688, 569)).toBe(572);
    expect(connectedClosingPinTop(NaN, 688, 569)).toBe(0);
  });

  it("excludes reveal transforms and pin reservation from measured flow", () => {
    const stage = document.createElement("div");
    const envelope = document.createElement("div");
    const coda = document.createElement("div");
    const footer = document.createElement("footer");
    for (const [element, top, height] of [[stage, 100, 688], [envelope, 156, 576], [coda, 868, 300], [footer, 9000, 189]] as const) {
      Object.defineProperties(element, { offsetTop: { value: top }, offsetHeight: { value: height } });
      element.style.transform = "translateY(200px)";
    }
    const first = measureConnectedClosingGeometry(stage, envelope, coda, footer, 12);
    expect(first.envelopeDelta).toBe(68);
    expect(first).toEqual(measureConnectedClosingGeometry(stage, envelope, coda, footer, 12));
  });

  it("uses the owner's actual range for semantic checkpoint restoration", () => {
    const root = document.createElement("div");
    const j3 = document.createElement("div");
    j3.dataset.connectedJ3 = "";
    root.append(j3);
    expect(readConnectedJ3ScrollRange(root)).toBeNull();
    j3.dataset.connectedScrollStart = "904";
    j3.dataset.connectedScrollEnd = "5122";
    expect(readConnectedJ3ScrollRange(root)).toEqual({ start: 904, end: 5122 });
    j3.dataset.connectedScrollEnd = "invalid";
    expect(readConnectedJ3ScrollRange(root)).toBeNull();
  });
});
