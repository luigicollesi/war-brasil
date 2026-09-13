import "server-only";

const AUTH_SECRET_MIN_LENGTH = 32;

function readOptional(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readPrivateKey(name: string) {
  const value = readOptional(name);
  return value?.replace(/\\n/g, "\n");
}

export type AuthProviderAvailability = {
  apple: boolean;
  discord: boolean;
  google: boolean;
};

export type AuthServerEnvironment = {
  allowedHosts: string[];
  apple: {
    appBundleIdentifier?: string;
    clientId?: string;
    keyId?: string;
    privateKey?: string;
    teamId?: string;
  };
  baseUrl?: string;
  databaseUrl?: string;
  discord: {
    clientId?: string;
    clientSecret?: string;
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

export function readAuthServerEnvironment(): AuthServerEnvironment {
  const googleClientId = readOptional("GOOGLE_CLIENT_ID");
  const googleClientSecret = readOptional("GOOGLE_CLIENT_SECRET");
  const discordClientId = readOptional("DISCORD_CLIENT_ID");
  const discordClientSecret = readOptional("DISCORD_CLIENT_SECRET");
  const appleClientId = readOptional("APPLE_CLIENT_ID");
  const appleTeamId = readOptional("APPLE_TEAM_ID");
  const appleKeyId = readOptional("APPLE_KEY_ID");
  const applePrivateKey = readPrivateKey("APPLE_PRIVATE_KEY");

  return {
    allowedHosts: parseAllowedHosts(readOptional("AUTH_ALLOWED_HOSTS")),
    apple: {
      appBundleIdentifier: readOptional("APPLE_APP_BUNDLE_IDENTIFIER"),
      clientId: appleClientId,
      keyId: appleKeyId,
      privateKey: applePrivateKey,
      teamId: appleTeamId,
    },
    baseUrl: readOptional("BETTER_AUTH_URL"),
    databaseUrl: readOptional("DATABASE_URL"),
    discord: {
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    },
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
    providerAvailability: {
      apple: Boolean(
        appleClientId && appleTeamId && appleKeyId && applePrivateKey,
      ),
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
  if (!environment.secret || environment.secret.length < AUTH_SECRET_MIN_LENGTH) {
    missing.push(`BETTER_AUTH_SECRET(>=${AUTH_SECRET_MIN_LENGTH} chars)`);
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
  if (!environment.apple.clientId) {
    missing.push("APPLE_CLIENT_ID");
  }
  if (!environment.apple.teamId) {
    missing.push("APPLE_TEAM_ID");
  }
  if (!environment.apple.keyId) {
    missing.push("APPLE_KEY_ID");
  }
  if (!environment.apple.privateKey) {
    missing.push("APPLE_PRIVATE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuração de autenticação incompleta: ${missing.join(", ")}.`,
    );
  }

  return environment;
}
