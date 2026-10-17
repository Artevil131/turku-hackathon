import type { ExportFile } from "@aei/export";

/** Browser download glue; the exporters themselves do not depend on the DOM. */
export function downloadFile(file: ExportFile): void {
  const data = typeof file.data === "string" ? file.data : new Uint8Array(file.data);
  const url = URL.createObjectURL(new Blob([data], { type: file.mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Let the browser consume the URL before revoking it (including multiple CSV downloads).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
