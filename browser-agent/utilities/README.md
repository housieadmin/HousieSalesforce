# Reusable utilities

Add small, focused helpers here when a scenario needs behavior that another scenario is likely to reuse. Prefer plain TypeScript modules that accept a Playwright Page or BrowserContext rather than hiding browser behavior. Document each helper's purpose, arguments, side effects and example usage. Do not add speculative utilities; scenarios can use Playwright directly until reuse is justified.
