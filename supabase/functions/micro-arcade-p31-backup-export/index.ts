const ISSUER = "https://token.actions.githubusercontent.com";
const EXPECTED_REPOSITORY = "thiepn/arcade";
const EXPECTED_REPOSITORY_ID = "1347223890";
const EXPECTED_OWNER = "thiepn";
const EXPECTED_OWNER_ID = "229373572";
const EXPECTED_REF = "refs/heads/main";
const WORKFLOW_POLICIES = new Map([
  ["P31 Encrypted Offsite Backup", {
    audience: "arcade-p31-backup",
    workflowRef: "thiepn/arcade/.github/workflows/p31-offsite-backup.yml@refs/heads/main",
    events: new Set(["schedule", "workflow_dispatch", "push"]),
  }],
  ["P32 Cold Recovery Exercise", {
    audience: "arcade-p32-recovery",
    workflowRef: "thiepn/arcade/.github/workflows/p32-cold-recovery.yml@refs/heads/main",
    events: new Set(["schedule", "workflow_dispatch", "push"]),
  }],
]);

type Claims = Record<string, unknown> & {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
  repository?: string;
  repository_id?: string;
  repository_owner?: string;
  repository_owner_id?: string;
  repository_visibility?: string;
  ref?: string;
  workflow_ref?: string;
  workflow?: string;
  event_name?: string;
  runner_environment?: string;
  run_id?: string;
  run_attempt?: string;
};

function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function parseJwtPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getGithubJwks(): Promise<JsonWebKey[]> {
  const discovery = await fetch(`${ISSUER}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!discovery.ok) throw new Error("github_oidc_discovery_failed");
  const config = await discovery.json();
  if (typeof config?.jwks_uri !== "string" || !config.jwks_uri.startsWith(ISSUER)) {
    throw new Error("github_oidc_invalid_jwks_uri");
  }
  const response = await fetch(config.jwks_uri, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("github_oidc_jwks_failed");
  const jwks = await response.json();
  if (!Array.isArray(jwks?.keys)) throw new Error("github_oidc_invalid_jwks");
  return jwks.keys as JsonWebKey[];
}

function audienceIncludes(aud: unknown, expected: string): boolean {
  return typeof aud === "string"
    ? aud === expected
    : Array.isArray(aud) && aud.some((item) => item === expected);
}

function validSubject(sub: unknown): boolean {
  if (typeof sub !== "string") return false;
  return /^repo:thiepn(?:@229373572)?\/arcade(?:@1347223890)?:ref:refs\/heads\/main$/.test(sub);
}

async function verifyGithubToken(token: string): Promise<Claims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_token_shape");

  const header = parseJwtPart(parts[0]);
  const claims = parseJwtPart(parts[1]) as Claims;
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("invalid_token_header");
  }

  const keys = await getGithubJwks();
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("unknown_token_key");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("invalid_token_signature");

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) throw new Error("invalid_issuer");
  const workflowName = String(claims.workflow ?? "");
  const workflowPolicy = WORKFLOW_POLICIES.get(workflowName);
  if (!workflowPolicy) throw new Error("invalid_workflow_name");
  if (!audienceIncludes(claims.aud, workflowPolicy.audience)) throw new Error("invalid_audience");
  if (typeof claims.exp !== "number" || claims.exp < now - 15) throw new Error("expired_token");
  if (typeof claims.nbf === "number" && claims.nbf > now + 30) throw new Error("token_not_yet_valid");
  if (typeof claims.iat !== "number" || claims.iat > now + 30 || claims.iat < now - 900) {
    throw new Error("invalid_issued_at");
  }
  if (claims.repository !== EXPECTED_REPOSITORY) throw new Error("invalid_repository");
  if (String(claims.repository_id ?? "") !== EXPECTED_REPOSITORY_ID) throw new Error("invalid_repository_id");
  if (claims.repository_owner !== EXPECTED_OWNER) throw new Error("invalid_repository_owner");
  if (String(claims.repository_owner_id ?? "") !== EXPECTED_OWNER_ID) throw new Error("invalid_repository_owner_id");
  if (claims.repository_visibility !== "public") throw new Error("invalid_repository_visibility");
  if (claims.ref !== EXPECTED_REF) throw new Error("invalid_ref");
  if (claims.workflow_ref !== workflowPolicy.workflowRef) throw new Error("invalid_workflow_ref");
  if (claims.runner_environment !== "github-hosted") throw new Error("invalid_runner_environment");
  if (!workflowPolicy.events.has(String(claims.event_name ?? ""))) throw new Error("invalid_event");
  if (!validSubject(claims.sub)) throw new Error("invalid_subject");

  return claims;
}

async function exportVerifiedBackup() {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceRoleKey) throw new Error("supabase_runtime_secret_missing");

  const response = await fetch(`${baseUrl}/rest/v1/rpc/micro_arcade_p31_offsite_export`, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error(`backup_export_failed_${response.status}`);

  const raw = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("backup_export_invalid_json");
  }
  if (
    payload?.format !== "arcade-p31-offsite-v1" ||
    payload?.project_ref !== "hycegznamzjhwinegaai" ||
    payload?.snapshot_count !== 1 ||
    payload?.snapshot?.verified !== true ||
    payload?.restore_drill?.ok !== true
  ) {
    throw new Error("backup_export_contract_invalid");
  }
  return { raw, payload };
}

Deno.serve(async (request: Request) => {
  if (request.method === "GET") {
    return jsonResponse(200, {
      ok: true,
      service: "micro-arcade-p31-backup-export",
      auth: "github-oidc",
      project: "hycegznamzjhwinegaai",
      data: "never returned by health requests",
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
  }

  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return jsonResponse(401, { error: "github_oidc_required" });

  let claims: Claims;
  try {
    claims = await verifyGithubToken(match[1]);
  } catch (error) {
    console.warn("P31 OIDC rejection", error instanceof Error ? error.message : "unknown");
    return jsonResponse(401, { error: "github_oidc_rejected" });
  }

  try {
    const { raw, payload } = await exportVerifiedBackup();
    console.log(JSON.stringify({
      event: "arcade_p31_backup_export",
      run_id: claims.run_id ?? null,
      run_attempt: claims.run_attempt ?? null,
      snapshot_id: payload.snapshot?.id ?? null,
      payload_bytes: payload.snapshot?.payload_bytes ?? null,
    }));
    return new Response(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Arcade-P31-Run-Id": String(claims.run_id ?? ""),
      },
    });
  } catch (error) {
    console.error("P31 backup export failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse(503, { error: "backup_export_unavailable" });
  }
});
