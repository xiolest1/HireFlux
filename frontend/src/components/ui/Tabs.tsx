import {
  type KeyboardEvent,
  type ReactNode,
  useRef,
} from "react";
import { Link } from "react-router-dom";

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  href?: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onValueChange?: (value: T) => void;
  ariaLabel: string;
  className?: string;
  stretch?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  className = "",
  stretch = false,
}: TabsProps<T>) {
  const tabRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const enabledIndices = items
      .map((item, itemIndex) => (item.disabled ? -1 : itemIndex))
      .filter((itemIndex) => itemIndex >= 0);
    if (enabledIndices.length === 0) return;

    const position = enabledIndices.indexOf(index);
    let nextIndex: number;
    if (event.key === "Home") nextIndex = enabledIndices[0];
    else if (event.key === "End") nextIndex = enabledIndices.at(-1) ?? index;
    else if (event.key === "ArrowRight") {
      nextIndex = enabledIndices[(position + 1) % enabledIndices.length];
    } else {
      nextIndex =
        enabledIndices[(position - 1 + enabledIndices.length) % enabledIndices.length];
    }

    const nextTab = tabRefs.current[nextIndex];
    nextTab?.focus();
    nextTab?.click();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line-subtle bg-surface-muted p-1 ${stretch ? "w-full" : ""} ${className}`}
    >
      {items.map((item, index) => {
        const isSelected = item.value === value;
        const sharedProps = {
          role: "tab" as const,
          "aria-selected": isSelected,
          "aria-disabled": item.disabled || undefined,
          tabIndex: isSelected ? 0 : -1,
          onKeyDown: (event: KeyboardEvent<HTMLAnchorElement | HTMLButtonElement>) =>
            handleKeyDown(event, index),
          className: `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-[var(--motion-ui)] ease-[var(--ease-standard)] active:scale-[0.98] ${stretch ? "min-w-0 flex-1 px-2" : "shrink-0 px-3"} ${
            isSelected
              ? "bg-surface-raised text-ink shadow-sm"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-pressed"
          } ${item.disabled ? "pointer-events-none opacity-45" : ""}`,
        };
        const content = (
          <>
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${
                  isSelected ? "bg-accent-soft text-accent-strong" : "bg-surface text-ink-muted"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </>
        );

        return item.href ? (
          <Link
            key={item.value}
            to={item.href}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            {...sharedProps}
          >
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            disabled={item.disabled}
            onClick={() => onValueChange?.(item.value)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            {...sharedProps}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
