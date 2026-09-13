import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";
import { rejectUntrustedAuthMutationOrigin } from "@/server/auth/request-origin";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  const rejected = rejectUntrustedAuthMutationOrigin(request);
  if (rejected) {
    return rejected;
  }

  return handlers.POST(request);
}
