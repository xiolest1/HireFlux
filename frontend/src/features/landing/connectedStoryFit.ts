export function connectedJ3PreflightFits(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-connected-j3-fit-stage]");
  const envelope = root.querySelector<HTMLElement>("[data-connected-j3-fit-envelope]");
  const shell = root.querySelector<HTMLElement>("[data-connected-j3-fit-shell]");
  if (!stage || !envelope || !shell || stage.offsetHeight === 0) return false;
  if (stage.offsetHeight > window.innerHeight + 1) return false;
  if (shell.offsetHeight > envelope.clientHeight + 1) return false;
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-connected-j3-fit-copy]"),
  ).every((copy) => copy.scrollHeight <= copy.clientHeight + 1);
}
