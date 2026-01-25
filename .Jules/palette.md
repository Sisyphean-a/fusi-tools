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

## 2025-01-21 - Smart Copy Actions in Webviews
**Learning:** Users often expect "Copy" buttons to respect their active text selection, even if the button click moves focus away from the input. Fortunately, `textarea.selectionStart/End` properties persist even when the element loses focus.
**Action:** When implementing "Copy" actions in Webviews, check for selection first. If present, copy only the selection and update the button feedback (e.g. "Copied Selection!") to confirm the specific action.

## 2025-01-26 - Webview Selection Stats
**Learning:** Webviews lack the native VS Code status bar context for text selection. Manually calculate and display selection statistics (e.g. "X chars selected") by checking `selectionStart !== selectionEnd` and triggering updates on `mouseup`, `keyup`, and `focus` events.
**Action:** Always implement manual selection tracking in custom editor Webviews to match native editor expectations.
