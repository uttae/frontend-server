export function setHtmlDragImageFromPointer(
  event: DragEvent,
  source: HTMLElement,
): void {
  const rect = source.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.style.width = `${rect.width}px`;
  clone.style.boxSizing = "border-box";
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.opacity = "1";
  clone.style.pointerEvents = "none";
  clone.style.zIndex = "-1";

  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;

  document.body.appendChild(clone);
  dataTransfer.setDragImage(clone, offsetX, offsetY);

  document.addEventListener(
    "dragend",
    () => {
      clone.remove();
    },
    { once: true },
  );
}
