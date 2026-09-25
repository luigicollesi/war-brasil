import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(
  "src/components/auth/command-auth-modal.module.css",
  "utf8",
);

test("auth modal constrains only the mobile layout to the dynamic viewport", () => {
  const mobileStart = styles.indexOf("@media (max-width: 760px)");
  assert.ok(mobileStart >= 0);

  const mobile = styles.slice(mobileStart);

  assert.match(
    mobile,
    /--auth-mobile-max-height:[\s\S]*100dvh[\s\S]*env\(safe-area-inset-top\)/,
  );
  assert.match(
    mobile,
    /\.dialog[\s\S]*max-height:\s*var\(--auth-mobile-max-height\)/,
  );
  assert.match(
    mobile,
    /\.shell[\s\S]*max-height:\s*var\(--auth-mobile-max-height\)/,
  );
  assert.match(
    mobile,
    /\.authPanel[\s\S]*max-height:\s*var\(--auth-mobile-max-height\)/,
  );
});

test("mobile auth content scrolls only on overflow and respects safe areas", () => {
  const mobileStart = styles.indexOf("@media (max-width: 760px)");
  const mobile = styles.slice(mobileStart);

  assert.match(
    mobile,
    /\.authPanel[\s\S]*overflow-y:\s*auto/,
  );
  assert.match(
    mobile,
    /\.authPanel[\s\S]*overscroll-behavior-y:\s*contain/,
  );
  assert.match(
    mobile,
    /\.authPanel[\s\S]*-webkit-overflow-scrolling:\s*touch/,
  );
  assert.match(
    mobile,
    /padding:[\s\S]*env\(safe-area-inset-bottom\)/,
  );
});

test("desktop auth content scrolls only when its bounded panel actually overflows", () => {
  const mobileStart = styles.indexOf("@media (max-width: 760px)");
  const desktop = styles.slice(0, mobileStart);

  assert.match(
    desktop,
    /--auth-dialog-max-height:\s*min\(760px, calc\(100dvh - 32px\)\)/,
  );
  assert.match(
    desktop,
    /\.shell[\s\S]*min-height:\s*min\(600px, var\(--auth-dialog-max-height\)\)[\s\S]*max-height:\s*var\(--auth-dialog-max-height\)/,
  );
  assert.match(
    desktop,
    /\.authPanel[\s\S]*min-height:\s*0[\s\S]*max-height:\s*var\(--auth-dialog-max-height\)[\s\S]*overflow-y:\s*auto/,
  );
  assert.match(desktop, /\.identityPanel[\s\S]*min-height:\s*0/);
  assert.doesNotMatch(desktop, /overflow-y:\s*scroll/);
  assert.doesNotMatch(desktop, /--auth-mobile-max-height/);
});

test("mobile reuses the shared height constraint with safe-area-aware viewport sizing", () => {
  const mobileStart = styles.indexOf("@media (max-width: 760px)");
  const mobile = styles.slice(mobileStart);

  assert.match(
    mobile,
    /--auth-dialog-max-height:\s*var\(--auth-mobile-max-height\)/,
  );
});
