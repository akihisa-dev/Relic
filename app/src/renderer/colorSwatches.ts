const hexColorCellPattern = /^`?\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1})?(?:[0-9a-fA-F]{2})?(?:[0-9a-fA-F]{2})?)\s*`?$/;

export function colorValueFromTableCell(value: string): string | null {
  const match = hexColorCellPattern.exec(value.trim());
  const color = match?.[1];

  if (!color || ![4, 5, 7, 9].includes(color.length)) return null;

  return color.toUpperCase();
}

export function createColorSwatch(color: string): HTMLSpanElement {
  const swatch = document.createElement("span");
  swatch.className = "color-swatch";
  swatch.setAttribute("aria-hidden", "true");
  swatch.style.backgroundColor = color;
  return swatch;
}

export function enhancePreviewTableColorSwatches(container: HTMLElement): void {
  container.querySelectorAll<HTMLTableCellElement>("table th, table td").forEach((cell) => {
    const color = colorValueFromTableCell(cell.textContent ?? "");

    cell.querySelector(".color-swatch")?.remove();
    cell.classList.toggle("preview-color-cell", Boolean(color));

    if (!color) return;

    const swatch = createColorSwatch(color);
    swatch.classList.add("preview-color-swatch");
    cell.prepend(swatch);
  });
}
