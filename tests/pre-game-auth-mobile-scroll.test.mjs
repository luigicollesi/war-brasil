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

test("desktop auth layout remains unchanged by the mobile overflow fix", () => {
  const mobileStart = styles.indexOf("@media (max-width: 760px)");
  const desktop = styles.slice(0, mobileStart);

  assert.match(desktop, /\.dialog[\s\S]*max-height:\s*min\(760px, calc\(100dvh - 32px\)\)/);
  assert.match(desktop, /\.authPanel[\s\S]*overflow-y:\s*auto/);
  assert.doesNotMatch(desktop, /--auth-mobile-max-height/);
});
