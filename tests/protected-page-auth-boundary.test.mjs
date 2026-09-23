import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profilePage = readFileSync("src/app/profile/page.tsx", "utf8");
const gamePage = readFileSync("src/app/game/[roomId]/page.tsx", "utf8");

test("Profile valida sessão autoritativa antes de consultar dados privados", () => {
  assert.match(profilePage, /import \{ redirect \} from "next\/navigation"/);
  assert.match(profilePage, /const session = await getAuthenticatedSessionForReadHeaders\(await headers\(\)\)/);
  assert.match(profilePage, /if \(!session\) \{?[\s\S]*redirect\("\/"\)/);

  const sessionIndex = profilePage.indexOf("const session = await getAuthenticatedSessionForReadHeaders");
  const redirectIndex = profilePage.indexOf('redirect("/")');
  const snapshotIndex = profilePage.indexOf("getCurrentProfileCommandSnapshot");

  assert.ok(sessionIndex >= 0);
  assert.ok(redirectIndex > sessionIndex);
  assert.ok(snapshotIndex > redirectIndex);
});

test("Game valida Better Auth antes de resolver a referência da sala", () => {
  assert.match(gamePage, /import \{ headers \} from "next\/headers"/);
  assert.match(gamePage, /getAuthenticatedSessionForReadHeaders/);
  assert.match(gamePage, /if \(!session\) \{?[\s\S]*redirect\("\/"\)/);

  const sessionIndex = gamePage.indexOf("getAuthenticatedSessionForReadHeaders");
  const redirectIndex = gamePage.indexOf('redirect("/")');
  const roomLookupIndex = gamePage.indexOf("resolveGameRoomReference(publicReference)");

  assert.ok(sessionIndex >= 0);
  assert.ok(redirectIndex > sessionIndex);
  assert.ok(roomLookupIndex > redirectIndex);
});
