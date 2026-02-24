/**
 * Centralized environment configuration and validation.
 * Provides fail-fast validation for required production secrets.
 * 
 * IMPORTANT: This module should only be imported in server-side code.
 * Client-safe env vars are exposed via NEXT_PUBLIC_ prefix.
 */

import { z } from 'zod';

// Schema for server-only secrets (must never be exposed to client)
const serverEnvSchema = z.object({
    // Supabase - database and auth
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required for auth'),

    // Upstash Redis - caching and rate limiting
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

    // Captain API - provider communication
    CAPTAIN_API_TOKEN: z.string().min(1, 'CAPTAIN_API_TOKEN is required'),
});

// Schema for client-safe public env vars
const publicEnvSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Schema for optional env vars with defaults
const optionalEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    RATE_LIMIT_GLOBAL_RPM: z.string().transform(Number).default('45'),
    RATE_LIMIT_PROVIDER_RPM: z.string().transform(Number).default('10'),
    // Database URL for Drizzle ORM (optional - can use Supabase client instead)
    DATABASE_URL: z.string().url().optional(),
    SUPABASE_DB_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type OptionalEnv = z.infer<typeof optionalEnvSchema>;

/**
 * Validation result with detailed error messages
 */
interface EnvValidationResult {
    success: boolean;
    errors: string[];
    missingVars: string[];
}

/**
 * Validate server environment variables
 * Call this at server startup for fail-fast behavior
 */
function validateServerEnv(): EnvValidationResult {
    const errors: string[] = [];
    const missingVars: string[] = [];

    const result = serverEnvSchema.safeParse(process.env);

    if (!result.success) {
        for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (issue.code === 'invalid_type' && issue.received === 'undefined') {
                missingVars.push(path);
                errors.push(`Missing required environment variable: ${path}`);
            } else {
                errors.push(`${path}: ${issue.message}`);
            }
        }
    }

    return {
        success: errors.length === 0,
        errors,
        missingVars,
    };
}

/**
 * Cached validated env - singleton pattern
 */
let validatedServerEnv: ServerEnv | null = null;
let validatedOptionalEnv: OptionalEnv | null = null;
let validationPerformed = false;

/**
 * Get validated server environment variables.
 * Throws on first access if validation fails (fail-fast).
 * Only call from server-side code.
 */
export function getServerEnv(): ServerEnv {
    if (typeof window !== 'undefined') {
        throw new Error('getServerEnv() must only be called on the server side');
    }

    if (validatedServerEnv) {
        return validatedServerEnv;
    }

    const result = validateServerEnv();

    if (!result.success) {
        const errorDetail = result.errors.join('\n  ');
        const missingDetail = result.missingVars.length > 0
            ? `\nMissing variables: ${result.missingVars.join(', ')}`
            : '';

        throw new Error(
            `Environment validation failed:\n  ${errorDetail}${missingDetail}\n\n` +
            `Please check your .env file or environment configuration.`
        );
    }

    validatedServerEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
        CAPTAIN_API_TOKEN: process.env.CAPTAIN_API_TOKEN!,
    };

    return validatedServerEnv;
}

/**
 * Get optional environment variables with defaults
 */
export function getOptionalEnv(): OptionalEnv {
    if (validatedOptionalEnv) {
        return validatedOptionalEnv;
    }

    const result = optionalEnvSchema.parse(process.env);
    validatedOptionalEnv = result;
    return result;
}

/**
 * Get public (client-safe) environment variables
 * Safe to call from client or server
 */
export function getPublicEnv(): PublicEnv {
    return publicEnvSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
}

/**
 * Preflight check - validates all server env vars.
 * Call this at server startup for early failure detection.
 * Returns validation result without throwing.
 */
export function preflightEnvCheck(): EnvValidationResult {
    validationPerformed = true;
    return validateServerEnv();
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
}

/**
 * Get CORS allowed origin from env or default
 */
export function getCorsOrigin(): string {
    const env = getOptionalEnv();

    if (env.CORS_ALLOWED_ORIGIN) {
        return env.CORS_ALLOWED_ORIGIN;
    }

    // Production default - should be configured via CORS_ALLOWED_ORIGIN
    if (isProduction()) {
        console.warn(
            'CORS_ALLOWED_ORIGIN not set in production. Using restrictive default. ' +
            'Set CORS_ALLOWED_ORIGIN to your domain.'
        );
        return 'https://localhost:3000';
    }

    // Development default
    return 'http://localhost:3000';
}

/**
 * Rate limit configuration from env
 */
export function getRateLimitConfig() {
    const env = getOptionalEnv();
    return {
        globalRpm: env.RATE_LIMIT_GLOBAL_RPM,
        providerRpm: env.RATE_LIMIT_PROVIDER_RPM,
    };
}