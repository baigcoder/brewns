'use client';

/** Prints a small self-contained HTML document (a bill, a kitchen slip) without touching the page: it goes into a hidden frame, which is printed and removed. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) return frame.remove();
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the frame a moment to lay the page out before the print dialog reads it.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => frame.remove(), 3000);
    }
  }, 120);
}
