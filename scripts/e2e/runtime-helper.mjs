import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadPlaywrightRuntime() {
  const runtimeDir = path.resolve(
    process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
  );
  return import(pathToFileURL(path.join(runtimeDir, "index.mjs")).href);
}

export async function apiJson(page, url, init = {}) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, requestInit);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestUrl: url, requestInit: init },
  );
}
