## 2024-05-23 - Webview Accessibility Gaps
**Learning:** VS Code Webviews are often implemented as raw HTML/JS and can easily miss standard accessibility features like `aria-label` or focus indicators, which native VS Code UI components handle automatically.
**Action:** When auditing VS Code extensions, prioritize checking any `webview` implementations for missing ARIA attributes and focus styles.
