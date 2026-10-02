import { useEffect } from 'react';

let counter = 0;

// Many forms have a bare <label> followed by its input in the same field. Link
// each such pair (for / id) so clicking the label focuses the input and screen
// readers announce the label. Labels that already have htmlFor, or that wrap
// their control, are left alone.
function linkLabels(root) {
  for (const label of root.querySelectorAll('label:not([for])')) {
    if (label.querySelector('input, select, textarea')) continue;
    const field = label.parentElement;
    if (!field) continue;
    const control = [...field.querySelectorAll('input:not([type="hidden"]), select, textarea')].find(
      (el) => label.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    if (!control) continue;
    if (!control.id) control.id = `v2-auto-${(counter += 1)}`;
    label.htmlFor = control.id;
  }
}

export default function useLabelLinks() {
  useEffect(() => {
    let queued = false;
    const run = () => {
      queued = false;
      linkLabels(document.body);
    };
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    });
    run();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}
