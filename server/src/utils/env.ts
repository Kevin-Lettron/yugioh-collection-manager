/**
 * Reads a required environment variable and throws a fatal error if missing.
 * Use this for secrets and configuration that MUST be defined in production.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in server/.env (see .env.example) before starting the server.`
    );
  }
  return value;
}

/**
 * Called at server startup to fail fast when critical env vars are missing,
 * BEFORE any request is served (avoids running with insecure defaults).
 */
export function validateStartupEnv(): void {
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
  const missing = required.filter((k) => !process.env[k] || !process.env[k]!.trim());
  if (missing.length > 0) {
    throw new Error(
      `Fatal: missing required env vars: ${missing.join(', ')}. ` +
        `Check server/.env.`
    );
  }

  const jwtSecret = process.env.JWT_SECRET!;
  if (
    jwtSecret === 'your_super_secret_jwt_key' ||
    jwtSecret === 'your_super_secret_jwt_key_change_this_in_production' ||
    jwtSecret === 'CHANGE_ME_generate_a_64_char_random_hex_string' ||
    jwtSecret.length < 32
  ) {
    throw new Error(
      'Fatal: JWT_SECRET is a default/weak value. Generate a random 64-char secret ' +
        '(e.g. `openssl rand -hex 32`) and set it in server/.env.'
    );
  }

  // NODE_ENV must be one of the well-known values so downstream code (logger,
  // errorHandler, debug routes) behaves predictably.
  const validNodeEnvs = ['development', 'production', 'test'];
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    // Default to production for safety (fewer debug endpoints, generic errors)
    process.env.NODE_ENV = 'production';
    console.warn('⚠️  NODE_ENV not set — defaulting to "production" for safety.');
  } else if (!validNodeEnvs.includes(nodeEnv)) {
    throw new Error(
      `Fatal: invalid NODE_ENV "${nodeEnv}". Must be one of: ${validNodeEnvs.join(', ')}.`
    );
  }
}
