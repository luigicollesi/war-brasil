import "server-only";

import { importPKCS8, SignJWT } from "jose";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_CLIENT_SECRET_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export async function generateAppleClientSecret({
  clientId,
  keyId,
  privateKey,
  teamId,
}: {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
}) {
  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + APPLE_CLIENT_SECRET_MAX_AGE_SECONDS)
    .sign(key);
}
