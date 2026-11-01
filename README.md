# UiPath Playwright Migrator

> Convert legacy UiPath automation workflows into modern Playwright test suites for any web application.

This project is built to support UiPath-to-Playwright migration across multiple languages and frameworks, without being tied to a single tool or platform.

---

## Why this project

- Converts UiPath scripts and workflow data into Playwright test code
- Supports TypeScript, JavaScript, Python, and C#
- Works for generic web apps, portals, internal tools, and enterprise apps
- Uses Playwright-friendly selectors and self-healing patterns
- Helps teams modernize automation into maintainable test suites

---

## Product name

Recommended product naming:

- UiPath Playwright Migrator
- UiPath to Playwright Migration Engine
- Playwright Migration Bridge
- FlowBridge

For this repo, the cleanest and most direct name is: UiPath Playwright Migrator.

---

## Quick start

```bash
npm install
npm run dashboard
```

Then open:

http://127.0.0.1:3333

---

## Common commands

```bash
npm run migrate
node ./orchestration/coordinator.js
npm test
npm run test:ui
npm run test:report
```

---

## Project structure

```text
├── dashboard/
├── directives/
├── executions/
├── fixtures/
├── orchestration/
├── tests/
├── package.json
├── server.js
├── playwright.config.ts
├── README.md
├── .gitignore
└── .env.example
```

---

## Notes

- This project is intentionally tool-agnostic and designed for broad automation migration use cases.
- The migration logic is designed to support common web automation flows across multiple languages and platforms.
- The repo is ready for GitHub publishing once the final cleanup is complete.
