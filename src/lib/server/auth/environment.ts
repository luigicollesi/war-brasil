import "server-only";

const AUTH_SECRET_MIN_LENGTH = 32;
const AUTH_EXAMPLE_SECRET = "troque-por-um-segredo-com-pelo-menos-32-caracteres";

function readOptional(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export type AuthProviderAvailability = {
  discord: boolean;
  google: boolean;
};

export type AuthEmailTransport = "gmail-oauth" | "resend";

export type AuthServerEnvironment = {
  allowedHosts: string[];
  authDatabaseUrl?: string;
  baseUrl?: string;
  databaseUrl?: string;
  discord: {
    clientId?: string;
    clientSecret?: string;
  };
  email: {
    from?: string;
    transport?: string;
    transportSecret?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleRefreshToken?: string;
  };
  google: {
    clientId?: string;
    clientSecret?: string;
  };
  providerAvailability: AuthProviderAvailability;
  secret?: string;
};

function parseAllowedHosts(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function isValidProductionBaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isValidEmailFrom(value: string | undefined) {
  if (!value) return false;
  const bracketed = value.match(/<([^<>]+)>\s*$/)?.[1];
  const address = (bracketed ?? value).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) return false;
  const domain = address.slice(at + 1);
  return domain.includes(".") && domain !== "invalid" && !domain.endsWith(".invalid");
}

function isObviouslyUnsafeAuthSecret(value: string | undefined) {
  if (!value || value.length < AUTH_SECRET_MIN_LENGTH) return true;

  return (
    value === AUTH_EXAMPLE_SECRET ||
    /SENTINEL_DO_NOT_SHIP/i.test(value) ||
    /^(?:password|secret|changeme|change-me|replace-me)/i.test(value)
  );
}

function isObviouslyUnsafeTransportSecret(value: string | undefined) {
  if (!value || value.length < 16) return true;
  return /SENTINEL_DO_NOT_SHIP|changeme|change-me|replace-me/i.test(value);
}

function inferEmailTransport({
  explicitTransport,
  gmailClientId,
  gmailClientSecret,
  gmailRefreshToken,
  transportSecret,
}: {
  explicitTransport?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  transportSecret?: string;
}) {
  if (explicitTransport) return explicitTransport;
  if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
    return "gmail-oauth";
  }
  if (transportSecret) return "resend";
  return undefined;
}

export function readAuthServerEnvironment(): AuthServerEnvironment {
  const databaseUrl = readOptional("DATABASE_URL");
  const authDatabaseUrl = readOptional("AUTH_DATABASE_URL") ?? databaseUrl;
  const googleClientId = readOptional("GOOGLE_CLIENT_ID");
  const googleClientSecret = readOptional("GOOGLE_CLIENT_SECRET");
  const discordClientId = readOptional("DISCORD_CLIENT_ID");
  const discordClientSecret = readOptional("DISCORD_CLIENT_SECRET");
  const emailTransportSecret = readOptional("EMAIL_TRANSPORT_SECRET");
  const emailGoogleClientId = readOptional("AUTH_EMAIL_GOOGLE_CLIENT_ID");
  const emailGoogleClientSecret = readOptional("AUTH_EMAIL_GOOGLE_CLIENT_SECRET");
  const emailGoogleRefreshToken = readOptional("AUTH_EMAIL_GOOGLE_REFRESH_TOKEN");

  return {
    allowedHosts: parseAllowedHosts(readOptional("AUTH_ALLOWED_HOSTS")),
    authDatabaseUrl,
    baseUrl: readOptional("BETTER_AUTH_URL"),
    databaseUrl,
    discord: {
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    },
    email: {
      from: readOptional("AUTH_EMAIL_FROM"),
      transport: inferEmailTransport({
        explicitTransport: readOptional("AUTH_EMAIL_TRANSPORT"),
        gmailClientId: emailGoogleClientId,
        gmailClientSecret: emailGoogleClientSecret,
        gmailRefreshToken: emailGoogleRefreshToken,
        transportSecret: emailTransportSecret,
      }),
      transportSecret: emailTransportSecret,
      googleClientId: emailGoogleClientId,
      googleClientSecret: emailGoogleClientSecret,
      googleRefreshToken: emailGoogleRefreshToken,
    },
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
    providerAvailability: {
      discord: Boolean(discordClientId && discordClientSecret),
      google: Boolean(googleClientId && googleClientSecret),
    },
    secret: readOptional("BETTER_AUTH_SECRET"),
  };
}

export function assertAuthRuntimeConfiguration(
  environment = readAuthServerEnvironment(),
) {
  const missing: string[] = [];

  if (!environment.databaseUrl) {
    missing.push("DATABASE_URL");
  }
  if (!environment.authDatabaseUrl) {
    missing.push("AUTH_DATABASE_URL ou DATABASE_URL");
  }
  if (isObviouslyUnsafeAuthSecret(environment.secret)) {
    missing.push(`BETTER_AUTH_SECRET(>=${AUTH_SECRET_MIN_LENGTH} chars)`);
  }
  if (!isValidProductionBaseUrl(environment.baseUrl)) {
    missing.push("BETTER_AUTH_URL(absolute HTTPS URL)");
  }
  if (!environment.google.clientId) {
    missing.push("GOOGLE_CLIENT_ID");
  }
  if (!environment.google.clientSecret) {
    missing.push("GOOGLE_CLIENT_SECRET");
  }
  if (!environment.discord.clientId) {
    missing.push("DISCORD_CLIENT_ID");
  }
  if (!environment.discord.clientSecret) {
    missing.push("DISCORD_CLIENT_SECRET");
  }
  if (!isValidEmailFrom(environment.email.from)) {
    missing.push("AUTH_EMAIL_FROM(valid deliverable sender)");
  }

  if (environment.email.transport === "gmail-oauth") {
    if (!environment.email.googleClientId) {
      missing.push("AUTH_EMAIL_GOOGLE_CLIENT_ID");
    }
    if (isObviouslyUnsafeTransportSecret(environment.email.googleClientSecret)) {
      missing.push("AUTH_EMAIL_GOOGLE_CLIENT_SECRET(valid production credential)");
    }
    if (isObviouslyUnsafeTransportSecret(environment.email.googleRefreshToken)) {
      missing.push("AUTH_EMAIL_GOOGLE_REFRESH_TOKEN(valid production credential)");
    }
  } else if (environment.email.transport === "resend") {
    if (isObviouslyUnsafeTransportSecret(environment.email.transportSecret)) {
      missing.push("EMAIL_TRANSPORT_SECRET(valid production credential)");
    }
  } else {
    missing.push("AUTH_EMAIL_TRANSPORT(gmail-oauth|resend)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuração de autenticação incompleta: ${missing.join(", ")}.`,
    );
  }

  return environment;
}
