// ArcGent API Auth — API key middleware
// Protects sensitive endpoints: kill, revive, approvals, rule changes

import { createHash, randomBytes } from "crypto";

export interface ApiKey {
  key: string;
  name: string;
  role: "admin" | "operator" | "viewer";
  createdAt: number;
}

// --- KEY GENERATION ---
export function generateApiKey(name: string, role: "admin" | "operator" | "viewer"): ApiKey {
  const key = `ag_${randomBytes(24).toString("hex")}`;
  return { key, name, role, createdAt: Date.now() };
}

// --- AUTH STORE ---
class AuthStore {
  private keys: Map<string, ApiKey> = new Map();
  private adminKey: string;

  constructor() {
    // Default admin key from env or generate
    this.adminKey = process.env.ARC_ADMIN_KEY || generateApiKey("default-admin", "admin").key;
    if (!process.env.ARC_ADMIN_KEY) {
      console.log(`[Auth] ⚠️  No ARC_ADMIN_KEY set. Generated: ${this.adminKey}`);
      console.log(`[Auth] Set ARC_ADMIN_KEY=${this.adminKey} in .env to persist`);
    }
    this.keys.set(this.adminKey, { key: this.adminKey, name: "admin", role: "admin", createdAt: Date.now() });

    // Load additional keys from env
    if (process.env.ARC_API_KEYS) {
      const extraKeys = process.env.ARC_API_KEYS.split(",");
      for (const k of extraKeys) {
        const [key, name, role] = k.split(":");
        if (key && name) {
          this.keys.set(key, { key, name, role: (role as any) || "viewer", createdAt: Date.now() });
        }
      }
    }
  }

  validate(key: string): ApiKey | null {
    return this.keys.get(key) || null;
  }

  requireAuth(key: string | undefined, minRole: "viewer" | "operator" | "admin"): ApiKey | null {
    if (!key) return null;
    const apiKey = this.validate(key);
    if (!apiKey) return null;

    const roleLevel = { viewer: 0, operator: 1, admin: 2 };
    if (roleLevel[apiKey.role] < roleLevel[minRole]) return null;

    return apiKey;
  }

  getAdminKey(): string {
    return this.adminKey;
  }
}

// Singleton
let _auth: AuthStore | null = null;
export function getAuth(): AuthStore {
  if (!_auth) _auth = new AuthStore();
  return _auth;
}

// --- MIDDLEWARE HELPER ---
export function extractKey(request: Request): string | undefined {
  // From header: Authorization: Bearer <key>
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // From query: ?api_key=<key>
  const url = new URL(request.url);
  return url.searchParams.get("api_key") || undefined;
}

export function requireAdmin(request: Request): ApiKey | null {
  const auth = getAuth();
  const key = extractKey(request);
  return auth.requireAuth(key, "admin");
}

export function requireOperator(request: Request): ApiKey | null {
  const auth = getAuth();
  const key = extractKey(request);
  return auth.requireAuth(key, "operator");
}

export function requireViewer(request: Request): ApiKey | null {
  const auth = getAuth();
  const key = extractKey(request);
  return auth.requireAuth(key, "viewer");
}
