"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: true,
    refetchWhenOffline: false,
  },
});

export const { signIn, signOut, signUp, useSession } = authClient;
export type ClientAuthSession = typeof authClient.$Infer.Session;
