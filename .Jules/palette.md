## 2024-05-23 - Webview Accessibility Gaps
**Learning:** VS Code Webviews are often implemented as raw HTML/JS and can easily miss standard accessibility features like `aria-label` or focus indicators, which native VS Code UI components handle automatically.
**Action:** When auditing VS Code extensions, prioritize checking any `webview` implementations for missing ARIA attributes and focus styles.

## 2024-06-15 - Lightweight Confirmation in Webviews
**Learning:** Standard modal dialogs are too heavy for micro-interactions within Webviews. A two-step button confirmation (Click -> Confirm? -> Click) provides safety without context switching.
**Action:** Implement inline state-based confirmation for destructive actions in Webviews, using `setTimeout` to auto-reset.
