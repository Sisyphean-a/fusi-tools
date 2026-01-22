## 2024-05-23 - Webview Accessibility Gaps
**Learning:** VS Code Webviews are often implemented as raw HTML/JS and can easily miss standard accessibility features like `aria-label` or focus indicators, which native VS Code UI components handle automatically.
**Action:** When auditing VS Code extensions, prioritize checking any `webview` implementations for missing ARIA attributes and focus styles.

## 2024-06-15 - Lightweight Confirmation in Webviews
**Learning:** Standard modal dialogs are too heavy for micro-interactions within Webviews. A two-step button confirmation (Click -> Confirm? -> Click) provides safety without context switching.
**Action:** Implement inline state-based confirmation for destructive actions in Webviews, using `setTimeout` to auto-reset.

## 2024-05-27 - Clipboard Reliability in Webviews
**Learning:** `navigator.clipboard.writeText` in VS Code Webviews is flaky because it requires the document to be focused, which isn't guaranteed if the user just clicked a button.
**Action:** Always delegate clipboard operations to the extension host via `postMessage` and `vscode.env.clipboard.writeText` for robust behavior.

## 2025-10-26 - Scratchpad Focus Management
**Learning:** In VS Code Webviews, automatically returning focus to the main input (e.g. textarea) after a button click (like "Copy" or "Remove Empty Lines") can be disorienting for screen reader users and keyboard navigators. It interrupts the natural tab order and prevents users from hearing status updates on the button they just clicked.
**Action:** Avoid calling `.focus()` on the input element immediately after secondary actions unless the primary purpose of the action is to prepare for immediate typing. For status updates (like "Copied!"), keep focus on the trigger element.

## 2025-05-20 - Smart Copy Context Sensitivity
**Learning:** Users often select specific text expecting only that text to be copied, even if the general "Copy" button usually copies the entire document. Ignoring the selection in favor of a "Copy All" default feels like a loss of agency and utility.
**Action:** Implement "Smart Copy" logic in text-heavy interfaces: if text is selected, copy only the selection; otherwise, copy the full content. Provide clear feedback (e.g., "Copied Selection!") to confirm the action.
