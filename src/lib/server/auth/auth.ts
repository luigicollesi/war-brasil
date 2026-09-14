import "server-only";

import { betterAuth } from "better-auth";
import { authPool } from "./auth-pool";
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  dispatchAuthEmail,
} from "./email";
import {
  assertAuthRuntimeConfiguration,
  readAuthServerEnvironment,
} from "./environment";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;
const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;
const AUTH_TOKEN_TTL_SECONDS = 60 * 60;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const AUTH_RATE_LIMIT_MAX = 100;
const CREDENTIAL_LOGIN_WINDOW_SECONDS = 60;
const CREDENTIAL_LOGIN_MAX = 5;
const CREDENTIAL_SIGNUP_WINDOW_SECONDS = 10 * 60;
const CREDENTIAL_SIGNUP_MAX = 5;
const AUTH_EMAIL_ACTION_WINDOW_SECONDS = 10 * 60;
const AUTH_EMAIL_ACTION_MAX = 3;

const environment = readAuthServerEnvironment();
const isControlledCiHarness =
  process.env.CI === "true" && Boolean(process.env.AUTH_EMAIL_SINK_DIR?.trim());

if (process.env.NODE_ENV === "production" && !isControlledCiHarness) {
  assertAuthRuntimeConfiguration(environment);
}

function resolveBaseUrl() {
  if (environment.allowedHosts.length > 0) {
    return {
      allowedHosts: environment.allowedHosts,
      protocol: "auto" as const,
      ...(environment.baseUrl ? { fallback: environment.baseUrl } : {}),
    };
  }

  return environment.baseUrl;
}

const googleProvider = environment.providerAvailability.google
  ? {
      google: {
        clientId: environment.google.clientId!,
        clientSecret: environment.google.clientSecret!,
      },
    }
  : {};

const discordProvider = environment.providerAvailability.discord
  ? {
      discord: {
        clientId: environment.discord.clientId!,
        clientSecret: environment.discord.clientSecret!,
        scope: ["identify", "email"],
        mapProfileToUser: (profile: { email?: string | null; id: string }) => ({
          email:
            profile.email ?? `${profile.id}@discord.placeholder.invalid`,
        }),
      },
    }
  : {};

export const auth = betterAuth({
  appName: "War-Brasil",
  database: authPool,
  basePath: "/api/auth",
  ...(resolveBaseUrl() ? { baseURL: resolveBaseUrl() } : {}),
  ...(environment.secret ? { secret: environment.secret } : {}),
  rateLimit: {
    enabled: true,
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": {
        window: CREDENTIAL_LOGIN_WINDOW_SECONDS,
        max: CREDENTIAL_LOGIN_MAX,
      },
      "/sign-up/email": {
        window: CREDENTIAL_SIGNUP_WINDOW_SECONDS,
        max: CREDENTIAL_SIGNUP_MAX,
      },
      "/send-verification-email": {
        window: AUTH_EMAIL_ACTION_WINDOW_SECONDS,
        max: AUTH_EMAIL_ACTION_MAX,
      },
      "/request-password-reset": {
        window: AUTH_EMAIL_ACTION_WINDOW_SECONDS,
        max: AUTH_EMAIL_ACTION_MAX,
      },
    },
  },
  socialProviders: {
    ...googleProvider,
    ...discordProvider,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: AUTH_TOKEN_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const email = buildPasswordResetEmail(url);
      dispatchAuthEmail({ ...email, to: user.email });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      const email = buildVerificationEmail(url);
      dispatchAuthEmail({ ...email, to: user.email });
    },
  },
  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_COOKIE_CACHE_SECONDS,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      allowDifferentEmails: true,
      trustedProviders: [],
      updateUserInfoOnLink: false,
      allowUnlinkingAll: false,
    },
  },
  advanced: {
    cookiePrefix: "war-brasil",
    disableCSRFCheck: false,
    disableOriginCheck: false,
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
