import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const buttonStyles = readFileSync(new URL("../src/components/ui/buttonStyles.ts", import.meta.url), "utf8");
const dangerClasses = /danger:\s*"([^"]+)"/.exec(buttonStyles)?.[1];
assert.ok(dangerClasses, "Shared danger variant is present");

function declarations(selector) {
  const start = styles.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Theme ${selector} exists`);
  const block = styles.slice(start, styles.indexOf("}", start));
  return Object.fromEntries(
    Array.from(block.matchAll(/(--[\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2].trim()]),
  );
}

function color(value, tokens) {
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference) {
    const resolved = tokens[reference[1]];
    assert.ok(resolved, `Color ${reference[1]} exists`);
    return color(resolved, tokens);
  }
  if (value === "white") return [255, 255, 255];
  assert.match(value, /^#[a-f\d]{6}$/i);
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function utilityColor(prefix, tokens) {
  const utility = dangerClasses.split(" ").find((item) => item.startsWith(`${prefix}-`)
    && (tokens[`--color-${item.slice(prefix.length + 1)}`] || item === `${prefix}-white`));
  assert.ok(utility, `${prefix} color utility is present`);
  const name = utility.slice(prefix.length + 1);
  return color(tokens[`--color-${name}`] ?? name, tokens);
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(left, right) {
  const [dark, light] = [luminance(left), luminance(right)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

const brightness = (rgb) => rgb.map((channel) => channel * 0.9);
const themes = [
  { name: "light", selectors: [":root"] },
  { name: "workspace light", selectors: [":root", ":root:not(.dark):has([data-workspace-shell])"] },
  { name: "dark", selectors: [":root", ".dark"] },
];

for (const { name, selectors } of themes) {
  const tokens = Object.assign({}, declarations("@theme"), ...selectors.map(declarations));
  test(`danger text is readable enabled, hovered and focused in ${name}`, () => {
    const foreground = utilityColor("text", tokens);
    const background = utilityColor("bg", tokens);
    assert.ok(contrast(foreground, background) >= 4.5, "Enabled/focused text reaches 4.5:1");
    // brightness() filters the whole control, including its text, on hover.
    assert.ok(dangerClasses.includes("hover:brightness-90"));
    assert.ok(contrast(brightness(foreground), brightness(background)) >= 4.5, "Hovered text reaches 4.5:1");
  });

  test(`danger boundary and focus remain visible on ${name} surfaces`, () => {
    const background = utilityColor("bg", tokens);
    const focus = color(tokens["--color-focus"], tokens);
    for (const surface of ["canvas", "surface", "surface-raised", "surface-muted"]) {
      const adjacent = color(tokens[`--color-${surface}`], tokens);
      assert.ok(contrast(background, adjacent) >= 3, `Enabled boundary against ${surface}`);
      assert.ok(contrast(brightness(background), adjacent) >= 3, `Hover boundary against ${surface}`);
      assert.ok(contrast(focus, adjacent) >= 3, `Focus ring against ${surface}`);
      assert.ok(contrast(brightness(focus), adjacent) >= 3, `Hovered focus ring against ${surface}`);
    }
  });
}
