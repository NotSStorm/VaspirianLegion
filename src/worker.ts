async function jsonResponse(payload: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {})
    }
  });
}

function normalizePersonnelName(value?: string | null) {
  return String(value || '').trim().replace(/[_\s]+/g, '').toLowerCase();
}

function getRateLimitKey(request: Request, env: any) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  const authHeader = request.headers.get('authorization') || '';
  return `${env.ENVIRONMENT || 'dev'}:${ip}:${authHeader}`;
}

async function enforceRateLimit(request: Request, env: any, maxRequests = 5, windowMs = 60_000) {
  const key = getRateLimitKey(request, env);
  const store = (env.RATE_LIMIT_STORE as Map<string, number[]>) || null;
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    return true;
  }

  const now = Date.now();
  const timestamps = (store.get(key) || []).filter((value) => now - value < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

async function verifyRobloxUsername(username: string) {
  if (!username) {
    return { verified: false, message: 'Please enter a Roblox username.' };
  }

  try {
    const userResponse = await fetchWithRetry(
      'https://users.roblox.com/v1/usernames/users',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
      },
      1,
      250,
      5000,
      'verify-username'
    );

    if (userResponse.status === 429) {
      return { verified: false, message: 'Roblox is rate limiting username checks right now. Please try again shortly.' };
    }

    if (!userResponse.ok) {
      return { verified: false, message: 'Unable to validate that Roblox username right now.' };
    }

    const userData = await userResponse.json().catch(() => ({}));
    const resolvedUser = Array.isArray(userData?.data) && userData.data.length > 0 ? userData.data[0] : null;

    if (!resolvedUser?.id) {
      return { verified: false, message: 'That Roblox username could not be found.' };
    }

    return { verified: true, robloxId: resolvedUser.id, displayName: resolvedUser.displayName || resolvedUser.name || '' };
  } catch {
    return { verified: false, message: 'Unable to reach the Roblox API right now.' };
  }
}

async function verifyRobloxCode(username: string, code: string) {
  const usernameCheck = await verifyRobloxUsername(username);
  if (!usernameCheck.verified) {
    return { verified: false, message: usernameCheck.message };
  }

  try {
    const trimmedCode = String(code || '').trim();
    if (!trimmedCode) {
      return { verified: false, message: 'Verification code is missing. Generate a new code and try again.' };
    }

    const userDetailsResponse = await fetchWithRetry(
      `https://users.roblox.com/v1/users/${usernameCheck.robloxId}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' }
      },
      2,
      300,
      8000,
      'verify-code-user-profile'
    );

    if (userDetailsResponse.status === 429) {
      return { verified: false, message: 'Roblox is rate limiting profile checks right now. Please try again shortly.' };
    }

    if (!userDetailsResponse.ok) {
      console.warn(`verifyRobloxCode profile lookup failed with status ${userDetailsResponse.status}`);
      return { verified: false, message: 'Unable to read the Roblox profile description right now.' };
    }

    const userDetails = await userDetailsResponse.json().catch(() => ({}));
    const description = String(userDetails?.description || '');

    if (!description.includes(trimmedCode)) {
      return { verified: false, message: 'Code not found on your profile — make sure you saved it and try again' };
    }

    return { verified: true, robloxId: usernameCheck.robloxId, description: userDetails?.displayName || usernameCheck.displayName || '' };
  } catch (error) {
    console.warn('verifyRobloxCode users API request failed', error);
    return { verified: false, message: 'Unable to reach the Roblox API right now.' };
  }
}

async function verifyRobloxGroupRole(username: string, groupUrl: string, env: any) {
  const groupMatch = groupUrl.match(/communities\/(\d+)/);
  const groupId = groupMatch?.[1] ?? env.ROBLOX_GROUP_ID;

  if (!username || !groupId) {
    return { verified: false, checked: true, message: 'Verification pending' };
  }

  const roleName = env.ROBLOX_GROUP_ROLE_NAME || '';
  const roleId = env.ROBLOX_GROUP_ROLE_ID || '';

  if (!roleName && !roleId) {
    return {
      verified: false,
      checked: true,
      message: 'A specific Battery role name or role ID is still required for this check.'
    };
  }

  try {
    const usernameCheck = await verifyRobloxUsername(username);
    if (!usernameCheck.verified || !usernameCheck.robloxId) {
      return { verified: false, checked: true, message: 'Unable to resolve Roblox username.' };
    }

    const userId = usernameCheck.robloxId;

    const rolesResponse = await fetchWithRetry(
      `https://groups.roblox.com/v2/users/${encodeURIComponent(String(userId))}/groups/roles`,
      { method: 'GET' },
      2,
      300,
      7000,
      'verify-group-role'
    );
    if (!rolesResponse.ok) {
      return { verified: false, checked: true, message: 'Unable to read Roblox group role data.' };
    }

    const rolesData = await rolesResponse.json();
    const groupRole = rolesData?.data?.find((entry: any) => String(entry.group.id) === String(groupId));

    if (!groupRole) {
      return {
        verified: false,
        checked: true,
        message: 'Joined the wider community, but the Battery-specific role has not been confirmed yet.'
      };
    }

    const matchesRoleName = roleName ? String(groupRole.role.name).toLowerCase() === String(roleName).toLowerCase() : false;
    const matchesRoleId = roleId ? String(groupRole.role.id) === String(roleId) : false;

    return {
      verified: Boolean(matchesRoleName || matchesRoleId),
      checked: true,
      message: matchesRoleName || matchesRoleId
        ? 'Verified against the Battery-specific Roblox role.'
        : 'Joined the wider community, but the required Battery-specific role did not match.'
    };
  } catch {
    return { verified: false, checked: true, message: 'Verification pending' };
  }
}

async function resolveRobloxUserId(input: { robloxId?: string | number | null; robloxUsername?: string | null }) {
  if (input.robloxId) {
    return String(input.robloxId);
  }

  const username = String(input.robloxUsername || '').trim();
  if (!username) {
    return null;
  }

  const result = await verifyRobloxUsername(username);
  return result.verified && result.robloxId ? String(result.robloxId) : null;
}

async function fetchRobloxAvatarImageUrl(input: { robloxId?: string | number | null; robloxUsername?: string | null }) {
  const resolvedId = await resolveRobloxUserId(input);
  if (!resolvedId) {
    return { ok: false, status: 400, message: 'Missing Roblox identity.', imageUrl: null, robloxId: null };
  }

  try {
    const response = await fetchWithRetry(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(resolvedId)}&size=150x150&format=Png&isCircular=true`,
      { method: 'GET' },
      1,
      250,
      5000,
      'avatar-headshot'
    );
    if (!response.ok) {
      return { ok: false, status: response.status, message: 'Unable to fetch Roblox avatar.', imageUrl: null, robloxId: resolvedId };
    }

    const payload = await response.json().catch(() => ({}));
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (!first?.imageUrl) {
      return { ok: false, status: 502, message: 'Roblox avatar not available.', imageUrl: null, robloxId: resolvedId };
    }

    return { ok: true, status: 200, message: 'Avatar resolved.', imageUrl: String(first.imageUrl), robloxId: resolvedId };
  } catch {
    return { ok: false, status: 500, message: 'Unable to reach Roblox thumbnail API.', imageUrl: null, robloxId: resolvedId };
  }
}

const BULK_USERNAME_BATCH_SIZE = 100;
const BULK_ROLE_CONCURRENCY = 2;
const BULK_USERNAME_BATCH_DELAY_MS = 1200;
const BULK_USERNAME_THROTTLED_DELAY_MS = 10000;
const BULK_USERNAME_MAX_ATTEMPTS = 3;
const BULK_USERNAME_INITIAL_RETRY_DELAY_MS = 3000;
const BULK_USERNAME_MAX_RETRY_DELAY_MS = 30000;
const SYNC_JOB_TTL_SECONDS = 15 * 60;
const DEFAULT_SYNC_CONTINUATION_DELAY_MS = 4000;

const DEFAULT_SUBREQUEST_BUDGET = 50;
const MAX_FETCH_ATTEMPTS_PER_REQUEST = 3; // initial call + up to 2 retries
const SUBREQUEST_SAFETY_HEADROOM = 8;
const DEFAULT_MAX_ROLE_LOOKUPS_PER_INVOCATION = 12;

const RANK_HIERARCHY = [
  'Conscript',
  'Soldat',
  'Musketier',
  'Fusilier',
  'Legionnaire',
  'Lance Corporal',
  'Corporal',
  'Sergeant',
  'Staff Sergeant',
  'Sergeant Major',
  'Ensign',
  'Sub-Lieutenant',
  'Lieutenant',
  'Captain',
  'Major',
  'Lieutenant Colonel',
  'Colonel',
  'Nobility',
  'Brigadier General',
  'Major General',
  'Adjutant General',
  'Lord General',
  'Architect',
  'Lordship',
  'Lord Marshal',
  'Crown Prince',
  'Emperor of the Andouran Isles',
  'Ares'
] as const;

const RANK_CEILING = 'Colonel';
const RANK_HIERARCHY_INDEX = new Map<string, number>(
  RANK_HIERARCHY.map((rank, index) => [normalizePersonnelName(rank), index])
);
const RANK_CEILING_INDEX = RANK_HIERARCHY_INDEX.get(normalizePersonnelName(RANK_CEILING)) ?? 16;

type LookupDiagnostic = {
  resolvedUserId: boolean;
  groupRolesCallSucceeded: boolean;
  matchingGroupFound: boolean;
  resolvedRoleName: string | null;
  error: string | null;
  cappedFromRank?: string | null;
};

type SyncJobState = {
  jobId: string;
  groupId: string;
  createdAt: string;
  totalRequested: number;
  bodyUsernamesRequested: number;
  uniqueRequested: number;
  usernames: string[];
  userIdByUsername: Record<string, string>;
  cursor: number;
  rankByUsername: Record<string, string>;
  unresolvedUsernames: string[];
  roleLookupFailures: string[];
  lookupDiagnostics: Record<string, LookupDiagnostic>;
  usernameLookupBatchDiagnostics: Array<any>;
  sourceDiagnostics: {
    rosterRows: number;
    rosterProfileUsernames: number;
    rosterCallsigns: number;
    personnelRows: number;
    personnelDirectoryRows: number;
  };
  sourceWarnings: string[];
  exclusionsApplied: number;
  exclusionsWarning: string | null;
  nextRecommendedPollAt: string | null;
  recommendedPollDelayMs: number;
};

function parseRetryAfterMs(retryAfterHeader: string | null, fallbackMs: number, maxDelayMs: number) {
  const boundedFallbackMs = Math.min(Math.max(0, fallbackMs), maxDelayMs);
  if (!retryAfterHeader) {
    return boundedFallbackMs;
  }

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(Math.floor(seconds * 1000), maxDelayMs);
  }

  const absoluteTime = Date.parse(retryAfterHeader);
  if (Number.isFinite(absoluteTime)) {
    const delta = absoluteTime - Date.now();
    return Math.min(Math.max(0, delta), maxDelayMs);
  }

  return boundedFallbackMs;
}

function applyRankCeiling(rawRoleName?: string | null) {
  const raw = String(rawRoleName || '').trim();
  if (!raw) {
    return { rank: 'Unranked', cappedFromRank: null as string | null };
  }

  const roleKey = normalizePersonnelName(raw);
  const roleIndex = RANK_HIERARCHY_INDEX.get(roleKey);
  if (roleIndex === undefined) {
    console.warn(`[rank-ceiling] Unrecognized role name from Roblox: "${raw}"`);
    return { rank: raw, cappedFromRank: null as string | null };
  }

  const canonicalRank = RANK_HIERARCHY[roleIndex];
  if (roleIndex > RANK_CEILING_INDEX) {
    return { rank: RANK_CEILING, cappedFromRank: canonicalRank };
  }

  return { rank: canonicalRank, cappedFromRank: null as string | null };
}

function chunk<T>(items: T[], size: number) {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(`Request timeout after ${timeoutMs}ms`);
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number,
  initialDelayMs: number,
  timeoutMs = 5000,
  label = 'roblox-fetch',
  options?: {
    maxRetryDelayMs?: number;
  }
) {
  let attempt = 0;
  let delayMs = Math.max(100, initialDelayMs);
  const maxDelayMs = Number.isFinite(options?.maxRetryDelayMs)
    ? Math.max(500, Math.floor(Number(options?.maxRetryDelayMs)))
    : 1500;

  while (attempt <= retries) {
    try {
      console.log(`[${label}] attempt ${attempt + 1}/${retries + 1}`);
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (response.status !== 429 && response.status < 500) {
        return response;
      }

      if (attempt === retries) {
        return response;
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const retryDelay = parseRetryAfterMs(retryAfterHeader, Math.min(delayMs, maxDelayMs), maxDelayMs);
      console.warn(`[${label}] retrying after status ${response.status} with delay ${retryDelay}ms`);
      await sleep(retryDelay);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.warn(`[${label}] request failed on attempt ${attempt + 1}; retrying in ${Math.min(delayMs, maxDelayMs)}ms`);
      await sleep(Math.min(delayMs, maxDelayMs));
    }

    attempt += 1;
    delayMs = Math.min(delayMs * 2, maxDelayMs);
  }

  throw new Error('Retry loop exited unexpectedly.');
}

async function fetchPersonnelExclusions(env: any) {
  const supabaseUrl = String(env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      excludedNames: new Set<string>(),
      warning: 'Exclusions lookup skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/personnel_exclusions?select=normalized_name`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      },
      5000
    );

    if (!response.ok) {
      const warning = `Exclusions lookup failed (${response.status}). Sync will continue without exclusions.`;
      console.warn(warning);
      return { excludedNames: new Set<string>(), warning };
    }

    const payload = await response.json().catch(() => []);
    const excludedNames = new Set<string>();
    if (Array.isArray(payload)) {
      payload.forEach((row: any) => {
        const normalized = normalizePersonnelName(row?.normalized_name);
        if (normalized) {
          excludedNames.add(normalized);
        }
      });
    }

    return { excludedNames, warning: null as string | null };
  } catch (error) {
    const warning = 'Exclusions lookup failed due to network/timeout. Sync will continue without exclusions.';
    console.warn(warning, error);
    return { excludedNames: new Set<string>(), warning };
  }
}

async function fetchSyncUsernamesFromSupabase(env: any) {
  const supabaseUrl = String(env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      usernames: [] as string[],
      warnings: ['Supabase source lookup skipped: missing env.SUPABASE_URL or env.SUPABASE_SERVICE_ROLE_KEY in this Worker runtime.'],
      diagnostics: {
        rosterRows: 0,
        rosterProfileUsernames: 0,
        rosterCallsigns: 0,
        personnelRows: 0,
        personnelDirectoryRows: 0
      }
    };
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };

  const warnings: string[] = [];
  const usernames = new Set<string>();
  const diagnostics = {
    rosterRows: 0,
    rosterProfileUsernames: 0,
    rosterCallsigns: 0,
    personnelRows: 0,
    personnelDirectoryRows: 0
  };

  try {
    const rosterResponse = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/roster?select=callsign,profile:profiles!roster_profile_id_fkey(roblox_username)&limit=2000`,
      { method: 'GET', headers },
      6000
    );

    if (!rosterResponse.ok) {
      warnings.push(`Roster source lookup failed (${rosterResponse.status}).`);
    } else {
      const rosterPayload = await rosterResponse.json().catch(() => []);
      if (Array.isArray(rosterPayload)) {
        diagnostics.rosterRows = rosterPayload.length;
        rosterPayload.forEach((row: any) => {
          const profileRaw = row?.profile;
          const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
          const profileUsername = String(profile?.roblox_username || '').trim();
          const callsignUsername = String(row?.callsign || '').trim();

          if (profileUsername) {
            usernames.add(profileUsername);
            diagnostics.rosterProfileUsernames += 1;
          }

          if (callsignUsername) {
            usernames.add(callsignUsername);
            diagnostics.rosterCallsigns += 1;
          }
        });
      }
    }
  } catch {
    warnings.push('Roster source lookup failed due to timeout/network issue.');
  }

  try {
    const personnelResponse = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/personnel?select=roblox_username&limit=2000`,
      { method: 'GET', headers },
      6000
    );

    if (!personnelResponse.ok) {
      warnings.push(`Personnel source lookup failed (${personnelResponse.status}).`);
    } else {
      const personnelPayload = await personnelResponse.json().catch(() => []);
      if (Array.isArray(personnelPayload)) {
        diagnostics.personnelRows = personnelPayload.length;
        personnelPayload.forEach((row: any) => {
          const username = String(row?.roblox_username || '').trim();
          if (username) {
            usernames.add(username);
          }
        });
      }
    }
  } catch {
    warnings.push('Personnel source lookup failed due to timeout/network issue.');
  }

  try {
    const directoryResponse = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/personnel_directory?select=roblox_username&limit=2000`,
      { method: 'GET', headers },
      6000
    );

    if (directoryResponse.ok) {
      const directoryPayload = await directoryResponse.json().catch(() => []);
      if (Array.isArray(directoryPayload)) {
        diagnostics.personnelDirectoryRows = directoryPayload.length;
        directoryPayload.forEach((row: any) => {
          const username = String(row?.roblox_username || '').trim();
          if (username) {
            usernames.add(username);
          }
        });
      }
    }
  } catch {
    // Optional source; ignore failures silently.
  }

  return {
    usernames: Array.from(usernames),
    warnings,
    diagnostics
  };
}

async function resolveRobloxUserIdsInBulk(usernames: string[]) {
  const uniqueUsernames = Array.from(new Set(usernames.map((username) => username.trim()).filter(Boolean)));
  const userIdByUsername = new Map<string, string>();
  const unresolvedUsernames = new Set<string>();
  const batchDiagnostics: Array<{
    batchIndex: number;
    batchSize: number;
    status: number | null;
    retryAfterHeader: string | null;
    resolvedInBatch: number;
    unresolvedInBatch: number;
    responsePreview: string;
    pacingDelayMs: number;
  }> = [];

  const usernameBatches = chunk(uniqueUsernames, BULK_USERNAME_BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < usernameBatches.length; batchIndex += 1) {
    const usernameBatch = usernameBatches[batchIndex];
    console.log(`[bulk-user-ids] processing batch ${batchIndex + 1}/${usernameBatches.length} with size ${usernameBatch.length}`);
    let response: Response | null = null;
    let responsePreview = 'request_failed_or_timed_out';
    let retryAfterHeader: string | null = null;
    let pacingDelayMs = BULK_USERNAME_BATCH_DELAY_MS;
    let completed = false;
    let attempt = 0;
    let retryDelayMs = BULK_USERNAME_INITIAL_RETRY_DELAY_MS;

    while (attempt < BULK_USERNAME_MAX_ATTEMPTS && !completed) {
      attempt += 1;

      try {
        response = await fetchWithTimeout(
          'https://users.roblox.com/v1/usernames/users',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: usernameBatch, excludeBannedUsers: false })
          },
          8000
        );
      } catch (error) {
        if (attempt >= BULK_USERNAME_MAX_ATTEMPTS) {
          console.warn(`[bulk-user-ids] batch ${batchIndex + 1} exhausted retries after request errors`, error);
          break;
        }

        const networkRetryDelay = Math.min(retryDelayMs, BULK_USERNAME_MAX_RETRY_DELAY_MS);
        console.warn(`[bulk-user-ids] batch ${batchIndex + 1} request failed on attempt ${attempt}; retrying in ${networkRetryDelay}ms`);
        await sleep(networkRetryDelay);
        retryDelayMs = Math.min(retryDelayMs * 2, BULK_USERNAME_MAX_RETRY_DELAY_MS);
        continue;
      }

      responsePreview = await response.clone().text().then((text) => text.slice(0, 500)).catch(() => 'unable_to_read_response');
      retryAfterHeader = response.headers.get('retry-after');
      console.log(`[bulk-user-ids] batch ${batchIndex + 1}/${usernameBatches.length} attempt ${attempt}/${BULK_USERNAME_MAX_ATTEMPTS} status ${response.status}`);

      if (response.ok) {
        completed = true;
        pacingDelayMs = BULK_USERNAME_BATCH_DELAY_MS;
        break;
      }

      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt >= BULK_USERNAME_MAX_ATTEMPTS) {
        pacingDelayMs = response.status === 429
          ? Math.max(BULK_USERNAME_THROTTLED_DELAY_MS, parseRetryAfterMs(retryAfterHeader, BULK_USERNAME_THROTTLED_DELAY_MS, BULK_USERNAME_MAX_RETRY_DELAY_MS))
          : BULK_USERNAME_BATCH_DELAY_MS;
        break;
      }

      const retryDelay = response.status === 429
        ? Math.max(BULK_USERNAME_THROTTLED_DELAY_MS, parseRetryAfterMs(retryAfterHeader, retryDelayMs, BULK_USERNAME_MAX_RETRY_DELAY_MS))
        : Math.min(retryDelayMs, BULK_USERNAME_MAX_RETRY_DELAY_MS);
      pacingDelayMs = retryDelay;
      console.warn(`[bulk-user-ids] batch ${batchIndex + 1} got status ${response.status}; retrying same batch in ${retryDelay}ms`);
      await sleep(retryDelay);
      retryDelayMs = Math.min(retryDelayMs * 2, BULK_USERNAME_MAX_RETRY_DELAY_MS);
    }

    if (!response || !response.ok) {
      usernameBatch.forEach((username) => unresolvedUsernames.add(username));
      batchDiagnostics.push({
        batchIndex: batchIndex + 1,
        batchSize: usernameBatch.length,
        status: response?.status ?? null,
        retryAfterHeader,
        resolvedInBatch: 0,
        unresolvedInBatch: usernameBatch.length,
        responsePreview,
        pacingDelayMs
      });
      if (batchIndex + 1 < usernameBatches.length) {
        await sleep(pacingDelayMs);
      }
      continue;
    }

    const payload = await response.json().catch(() => ({}));
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const seenInBatch = new Set<string>();

    data.forEach((entry: any) => {
      const resolvedId = entry?.id ? String(entry.id) : '';
      const requestedUsername = String(entry?.requestedUsername || entry?.name || '').trim();
      if (!resolvedId || !requestedUsername) {
        return;
      }

      const usernameKey = requestedUsername.toLowerCase();
      userIdByUsername.set(usernameKey, resolvedId);
      seenInBatch.add(usernameKey);
    });

    usernameBatch.forEach((username) => {
      if (!seenInBatch.has(username.toLowerCase())) {
        unresolvedUsernames.add(username);
      }
    });

    const unresolvedInBatch = usernameBatch.length - seenInBatch.size;
    batchDiagnostics.push({
      batchIndex: batchIndex + 1,
      batchSize: usernameBatch.length,
      status: response.status,
      retryAfterHeader,
      resolvedInBatch: seenInBatch.size,
      unresolvedInBatch,
      responsePreview,
      pacingDelayMs
    });

    if (batchIndex + 1 < usernameBatches.length) {
      await sleep(pacingDelayMs);
    }
  }

  return {
    userIdByUsername,
    unresolvedUsernames: Array.from(unresolvedUsernames),
    batchDiagnostics
  };
}

async function fetchBulkGroupRanks(entries: Array<[string, string]>, groupId: string) {
  const rankByUsername: Record<string, string> = {};
  const roleLookupFailures: string[] = [];
  const lookupDiagnostics: Record<string, LookupDiagnostic> = {};

  for (let index = 0; index < entries.length; index += BULK_ROLE_CONCURRENCY) {
    const segment = entries.slice(index, index + BULK_ROLE_CONCURRENCY);
    const segmentResults = await Promise.all(segment.map(async ([usernameKey, userId]) => {
      let response: Response;
      try {
        response = await fetchWithRetry(
          `https://groups.roblox.com/v2/users/${encodeURIComponent(userId)}/groups/roles`,
          { method: 'GET' },
          2,
          300,
          7000,
          'bulk-group-roles'
        );
      } catch {
        return { usernameKey, ok: false, roleName: null as string | null, failureReason: 'group_roles_request_failed' };
      }

      if (!response.ok) {
        return { usernameKey, ok: false, roleName: null as string | null, failureReason: `group_roles_http_${response.status}` };
      }

      const payload = await response.json().catch(() => ({}));
      const matchingRoles = Array.isArray(payload?.data)
        ? payload.data.filter((entry: any) => String(entry?.group?.id) === String(groupId))
        : [];
      const groupRole = matchingRoles.length > 0 ? matchingRoles[0] : null;

      if (matchingRoles.length > 1) {
        console.warn(`[bulk-group-ranks] ${usernameKey}: multiple roles matched same group id (${groupId}); using first match deterministically`);
      }

      if (!groupRole?.role?.name) {
        return {
          usernameKey,
          ok: false,
          roleName: null as string | null,
          failureReason: 'group_not_found_for_user'
        };
      }

      return {
        usernameKey,
        ok: true,
        roleName: String(groupRole.role.name),
        failureReason: null
      };
    }));

    segmentResults.forEach((result) => {
      if (!result.ok || !result.roleName) {
        roleLookupFailures.push(result.usernameKey);
        lookupDiagnostics[result.usernameKey] = {
          resolvedUserId: true,
          groupRolesCallSucceeded: result.failureReason !== 'group_roles_request_failed',
          matchingGroupFound: false,
          resolvedRoleName: null,
          error: result.failureReason || 'unknown_failure'
        };
        console.warn(`[bulk-group-ranks] ${result.usernameKey}: failed (${result.failureReason || 'unknown_failure'})`);
        return;
      }

      const { rank: finalizedRank, cappedFromRank } = applyRankCeiling(result.roleName);
      rankByUsername[result.usernameKey] = finalizedRank;
      lookupDiagnostics[result.usernameKey] = {
        resolvedUserId: true,
        groupRolesCallSucceeded: true,
        matchingGroupFound: true,
        resolvedRoleName: finalizedRank,
        error: null,
        cappedFromRank
      };
      if (cappedFromRank) {
        console.log(`[bulk-group-ranks] ${result.usernameKey}: matched role "${result.roleName}" -> capped to "${finalizedRank}"`);
      } else {
        console.log(`[bulk-group-ranks] ${result.usernameKey}: matched role "${finalizedRank}"`);
      }
    });

    if (index + BULK_ROLE_CONCURRENCY < entries.length) {
      await sleep(220);
    }
  }

  return {
    rankByUsername,
    roleLookupFailures,
    usernamesResolved: entries.length,
    lookupDiagnostics
  };
}

function normalizeUsernameKey(username: string) {
  return String(username || '').trim().toLowerCase();
}

function buildSyncResponseFromJob(job: SyncJobState, status: 'in_progress' | 'complete') {
  const failed = Array.from(new Set([
    ...job.unresolvedUsernames.map((username) => normalizeUsernameKey(username)),
    ...job.roleLookupFailures.map((username) => normalizeUsernameKey(username))
  ]));

  return {
    status,
    jobId: job.jobId,
    groupId: job.groupId,
    totalRequested: job.totalRequested,
    bodyUsernamesRequested: job.bodyUsernamesRequested,
    uniqueRequested: job.uniqueRequested,
    processed: Math.min(job.cursor, job.usernames.length),
    total: job.usernames.length,
    cursorPosition: job.cursor,
    usernamesResolved: Object.keys(job.rankByUsername).length,
    unresolvedUsernames: job.unresolvedUsernames,
    roleLookupFailures: job.roleLookupFailures,
    usernameLookupBatchDiagnostics: job.usernameLookupBatchDiagnostics,
    lookupDiagnostics: job.lookupDiagnostics,
    rankByUsername: job.rankByUsername,
    synced: Object.keys(job.rankByUsername).length,
    failed,
    sourceDiagnostics: job.sourceDiagnostics,
    sourceWarnings: job.sourceWarnings,
    exclusionsApplied: job.exclusionsApplied,
    exclusionsWarning: job.exclusionsWarning,
    nextRecommendedPollAt: job.nextRecommendedPollAt,
    recommendedPollDelayMs: job.recommendedPollDelayMs,
    retryAfterSeconds: Math.max(1, Math.ceil(job.recommendedPollDelayMs / 1000))
  };
}

function createSyncJobId() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '');
}

function computeMaxRoleLookupsPerInvocation(env: any) {
  const configured = Number(env.MAX_ROLE_LOOKUPS_PER_INVOCATION || '');
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.floor(configured));
  }

  const configuredBudget = Number(env.SUBREQUEST_BUDGET || '');
  const subrequestBudget = Number.isFinite(configuredBudget) && configuredBudget > 0
    ? Math.floor(configuredBudget)
    : DEFAULT_SUBREQUEST_BUDGET;

  // Worst case budget model per invocation:
  // role lookups:   N * MAX_FETCH_ATTEMPTS_PER_REQUEST
  // plus fixed safety headroom for future overhead.
  const remainingBudget = Math.max(
    1,
    subrequestBudget
      - SUBREQUEST_SAFETY_HEADROOM
  );

  const computed = Math.floor(remainingBudget / MAX_FETCH_ATTEMPTS_PER_REQUEST);
  if (!Number.isFinite(computed) || computed <= 0) {
    return DEFAULT_MAX_ROLE_LOOKUPS_PER_INVOCATION;
  }

  return computed;
}

function computeSyncContinuationDelayMs(env: any) {
  const configured = Number(env.SYNC_CONTINUATION_DELAY_MS || '');
  if (Number.isFinite(configured) && configured >= 0) {
    return Math.max(0, Math.floor(configured));
  }

  return DEFAULT_SYNC_CONTINUATION_DELAY_MS;
}

// Worker that serves static assets from the built-in assets binding and falls back to index.html for SPA routes
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/api/roblox/user-rank' && request.method === 'POST') {
      if (!(await enforceRateLimit(request, env, 15, 60_000))) {
        return jsonResponse({ message: 'Too many rank lookup requests. Please try again shortly.' }, 429);
      }

      try {
        const body = await request.json().catch(() => ({}));
        const groupId = String(body.groupId || env.ROBLOX_GROUP_ID || '5531725');
        const resolvedUserId = await resolveRobloxUserId({
          robloxId: body.robloxId,
          robloxUsername: body.robloxUsername || body.username
        });

        if (!resolvedUserId) {
          return jsonResponse({ message: 'Unable to resolve Roblox user.', rank: 'Unranked', found: false }, 400);
        }

        const response = await fetchWithRetry(
          `https://groups.roblox.com/v2/users/${encodeURIComponent(resolvedUserId)}/groups/roles`,
          { method: 'GET' },
          2,
          300,
          7000,
          'user-rank'
        );

        if (!response.ok) {
          return jsonResponse({ message: 'Unable to fetch Roblox group rank.', rank: 'Unranked', found: false }, 502);
        }

        const payload = await response.json().catch(() => ({}));
        const groupRole = Array.isArray(payload?.data)
          ? payload.data.find((entry: any) => String(entry?.group?.id) === String(groupId))
          : null;
        const rawRoleName = groupRole?.role?.name ? String(groupRole.role.name) : null;
        const finalized = applyRankCeiling(rawRoleName);

        return jsonResponse({
          robloxId: resolvedUserId,
          groupId,
          rank: finalized.rank,
          rawRank: rawRoleName,
          cappedFromRank: finalized.cappedFromRank,
          found: Boolean(rawRoleName)
        });
      } catch (error) {
        console.error('user-rank endpoint failed', error);
        return jsonResponse({ message: 'Unable to fetch Roblox group rank.', rank: 'Unranked', found: false }, 500);
      }
    }

    if (url.pathname === '/api/roblox/verify-username' && request.method === 'POST') {
      if (!(await enforceRateLimit(request, env))) {
        return jsonResponse({ verified: false, message: 'Too many verification requests. Please try again shortly.' }, 429);
      }

      try {
        const body = await request.json().catch(() => ({}));
        const result = await verifyRobloxUsername(body.username || '');
        return jsonResponse(result, result.verified ? 200 : 400);
      } catch {
        return jsonResponse({ verified: false, message: 'Unable to reach the Roblox API right now.' }, 500);
      }
    }

    if (url.pathname === '/api/roblox/verify-code' && request.method === 'POST') {
      if (!(await enforceRateLimit(request, env))) {
        return jsonResponse({ verified: false, message: 'Too many verification requests. Please try again shortly.' }, 429);
      }

      try {
        const body = await request.json().catch(() => ({}));
        const result = await verifyRobloxCode(body.username || '', body.code || '');
        return jsonResponse(result, result.verified ? 200 : 400);
      } catch {
        return jsonResponse({ verified: false, message: 'Unable to reach the Roblox API right now.' }, 500);
      }
    }

    if (url.pathname === '/api/roblox/verify-rank' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const result = await verifyRobloxGroupRole(body.robloxUsername || body.username, body.groupUrl || '', env);
        return jsonResponse(result);
      } catch {
        return jsonResponse({ verified: false, checked: true, message: 'Verification pending' }, 500);
      }
    }

    if (url.pathname === '/api/roblox/avatar' && request.method === 'POST') {
      if (!(await enforceRateLimit(request, env, 20, 60_000))) {
        return jsonResponse({ imageUrl: null, message: 'Too many avatar requests. Please try again shortly.' }, 429);
      }

      try {
        const body = await request.json().catch(() => ({}));
        const result = await fetchRobloxAvatarImageUrl({
          robloxId: body.robloxId,
          robloxUsername: body.robloxUsername || body.username
        });
        return jsonResponse({ imageUrl: result.imageUrl, robloxId: result.robloxId, message: result.message }, result.status);
      } catch {
        return jsonResponse({ imageUrl: null, robloxId: null, message: 'Unable to fetch Roblox avatar.' }, 500);
      }
    }

    if (url.pathname === '/api/roblox/sync-ranks' && request.method === 'POST') {
      if (!(await enforceRateLimit(request, env, 10, 60_000))) {
        return jsonResponse({ message: 'Too many rank sync requests. Please try again shortly.' }, 429);
      }

      try {
        const syncStore = env.SYNC_PROGRESS;
        if (!syncStore || typeof syncStore.get !== 'function' || typeof syncStore.put !== 'function' || typeof syncStore.delete !== 'function') {
          // Configure in wrangler.toml with a KV binding named SYNC_PROGRESS.
          return jsonResponse({ message: 'Sync progress store is not configured. Bind KV namespace SYNC_PROGRESS first.' }, 500);
        }

        const body = await request.json().catch(() => ({}));
        const groupId = String(body.groupId || env.ROBLOX_GROUP_ID || '5531725');
        const requestedJobId = String(body.jobId || '').trim();

        let job: SyncJobState | null = null;
        const continuationDelayMs = computeSyncContinuationDelayMs(env);
        const nowMs = Date.now();

        if (requestedJobId) {
          const existing = await syncStore.get(`job:${requestedJobId}`);
          if (!existing) {
            return jsonResponse({ message: `No sync job found for id ${requestedJobId}.` }, 404);
          }

          job = JSON.parse(existing) as SyncJobState;
          if (job.groupId !== groupId) {
            job.groupId = groupId;
          }

          const nextAllowedAtMs = job.nextRecommendedPollAt ? Date.parse(job.nextRecommendedPollAt) : Number.NaN;
          if (Number.isFinite(nextAllowedAtMs) && nowMs < nextAllowedAtMs) {
            const retryAfterMs = Math.max(0, nextAllowedAtMs - nowMs);
            job.recommendedPollDelayMs = retryAfterMs;
            return jsonResponse(
              {
                ...buildSyncResponseFromJob(job, 'in_progress'),
                message: 'Sync continuation called too soon. Wait before requesting the next step.'
              },
              429,
              { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) }
            );
          }
        }

        if (!job) {
          const bodyUsernames: string[] = Array.isArray(body.usernames)
            ? body.usernames.map((value: unknown) => String(value || '').trim()).filter(Boolean)
            : [];

          const sourceResult = await fetchSyncUsernamesFromSupabase(env);
          const sourceWarnings = [...sourceResult.warnings];
          const usernames = [
            ...bodyUsernames,
            ...sourceResult.usernames
          ].map((value) => String(value || '').trim()).filter(Boolean);
          const usernameByKey = new Map<string, string>();
          usernames.forEach((username) => {
            const key = normalizeUsernameKey(username);
            if (key && !usernameByKey.has(key)) {
              usernameByKey.set(key, username);
            }
          });
          const uniqueUsernames = Array.from(usernameByKey.values());

          if (uniqueUsernames.length === 0) {
            return jsonResponse({ message: 'No usernames provided for rank sync.' }, 400);
          }

          const { excludedNames, warning: exclusionsWarning } = await fetchPersonnelExclusions(env);
          const usernamesForSync = uniqueUsernames.filter((username) => !excludedNames.has(normalizePersonnelName(username)));

          if (usernamesForSync.length === 0) {
            return jsonResponse({
              status: 'complete',
              jobId: null,
              groupId,
              totalRequested: uniqueUsernames.length,
              bodyUsernamesRequested: bodyUsernames.length,
              uniqueRequested: 0,
              processed: 0,
              total: 0,
              cursorPosition: 0,
              usernamesResolved: 0,
              unresolvedUsernames: [],
              roleLookupFailures: [],
              usernameLookupBatchDiagnostics: [],
              lookupDiagnostics: {},
              rankByUsername: {},
              synced: 0,
              failed: [],
              sourceDiagnostics: sourceResult.diagnostics,
              sourceWarnings,
              exclusionsApplied: excludedNames.size,
              exclusionsWarning,
              nextRecommendedPollAt: null,
              recommendedPollDelayMs: continuationDelayMs
            });
          }

          if (sourceWarnings.some((warning) => /missing env\.SUPABASE_URL|missing env\.SUPABASE_SERVICE_ROLE_KEY/i.test(warning)) && bodyUsernames.length > 0) {
            sourceWarnings.push('Server-side Supabase username sourcing was skipped, but request-body usernames were still processed for rank sync.');
          }

          const userIdResolution = await resolveRobloxUserIdsInBulk(usernamesForSync);
          const resolvedUserIdByUsername: Record<string, string> = {};
          userIdResolution.userIdByUsername.forEach((userId, usernameKey) => {
            const normalizedKey = normalizeUsernameKey(usernameKey);
            if (normalizedKey) {
              resolvedUserIdByUsername[normalizedKey] = String(userId);
            }
          });

          const unresolvedUsernames = Array.from(new Set(userIdResolution.unresolvedUsernames.map((username) => normalizeUsernameKey(username)).filter(Boolean)));
          const lookupDiagnostics: Record<string, LookupDiagnostic> = {};
          unresolvedUsernames.forEach((usernameKey) => {
            lookupDiagnostics[usernameKey] = {
              resolvedUserId: false,
              groupRolesCallSucceeded: false,
              matchingGroupFound: false,
              resolvedRoleName: null,
              error: 'username_unresolved'
            };
          });

          const roleLookupUsernames = Array.from(new Set(Object.keys(resolvedUserIdByUsername).map((value) => normalizeUsernameKey(value)).filter(Boolean)));

          job = {
            jobId: createSyncJobId(),
            groupId,
            createdAt: new Date().toISOString(),
            totalRequested: uniqueUsernames.length,
            bodyUsernamesRequested: bodyUsernames.length,
            uniqueRequested: Array.from(new Set(usernamesForSync.map((username) => normalizeUsernameKey(username)))).length,
            usernames: roleLookupUsernames,
            userIdByUsername: resolvedUserIdByUsername,
            cursor: 0,
            rankByUsername: {},
            unresolvedUsernames,
            roleLookupFailures: [],
            lookupDiagnostics,
            usernameLookupBatchDiagnostics: userIdResolution.batchDiagnostics,
            sourceDiagnostics: sourceResult.diagnostics,
            sourceWarnings,
            exclusionsApplied: excludedNames.size,
            exclusionsWarning,
            nextRecommendedPollAt: null,
            recommendedPollDelayMs: continuationDelayMs
          };

          if (job.usernames.length === 0) {
            return jsonResponse(buildSyncResponseFromJob(job, 'complete'));
          }
        }

        if (!job.userIdByUsername || typeof job.userIdByUsername !== 'object') {
          job.userIdByUsername = {};
        }

        const maxRoleLookupsPerInvocation = computeMaxRoleLookupsPerInvocation(env);
        const usernamesPerStep = Math.max(1, maxRoleLookupsPerInvocation);
        const batchUsernames = job.usernames.slice(job.cursor, job.cursor + usernamesPerStep);
        if (batchUsernames.length > 0) {
          const roleLookupEntries = batchUsernames
            .map((usernameKey) => {
              const normalizedKey = normalizeUsernameKey(usernameKey);
              const userId = job!.userIdByUsername[normalizedKey];
              return userId ? [normalizedKey, userId] as [string, string] : null;
            })
            .filter((entry): entry is [string, string] => Boolean(entry));

          const missingUserIdEntries = batchUsernames.filter((usernameKey) => !job!.userIdByUsername[normalizeUsernameKey(usernameKey)]);
          if (missingUserIdEntries.length > 0) {
            const unresolvedSet = new Set(job.unresolvedUsernames.map((username) => normalizeUsernameKey(username)));
            missingUserIdEntries.forEach((usernameKey) => {
              const normalizedKey = normalizeUsernameKey(usernameKey);
              unresolvedSet.add(normalizedKey);
              job!.lookupDiagnostics[normalizedKey] = {
                resolvedUserId: false,
                groupRolesCallSucceeded: false,
                matchingGroupFound: false,
                resolvedRoleName: null,
                error: 'username_unresolved'
              };
            });
            job.unresolvedUsernames = Array.from(unresolvedSet);
          }

          const result = roleLookupEntries.length > 0
            ? await fetchBulkGroupRanks(roleLookupEntries, job.groupId)
            : {
              rankByUsername: {},
              roleLookupFailures: [],
              usernamesResolved: 0,
              lookupDiagnostics: {}
            };

          Object.entries(result.rankByUsername || {}).forEach(([usernameKey, rank]) => {
            const normalizedKey = normalizeUsernameKey(usernameKey);
            if (normalizedKey) {
              // Deterministic merge: one value per username key, last write wins.
              job!.rankByUsername[normalizedKey] = String(rank);
            }
          });

          const failedRoleSet = new Set(job.roleLookupFailures.map((username) => normalizeUsernameKey(username)));
          result.roleLookupFailures.forEach((username) => {
            const normalizedKey = normalizeUsernameKey(username);
            if (normalizedKey) {
              failedRoleSet.add(normalizedKey);
            }
          });
          job.roleLookupFailures = Array.from(failedRoleSet);

          Object.entries(result.lookupDiagnostics || {}).forEach(([usernameKey, diagnostic]) => {
            const normalizedKey = normalizeUsernameKey(usernameKey);
            if (normalizedKey) {
              job!.lookupDiagnostics[normalizedKey] = diagnostic as LookupDiagnostic;
            }
          });
        }

        job.cursor += batchUsernames.length;

        if (job.cursor < job.usernames.length) {
          job.recommendedPollDelayMs = continuationDelayMs;
          job.nextRecommendedPollAt = new Date(Date.now() + continuationDelayMs).toISOString();
          await syncStore.put(`job:${job.jobId}`, JSON.stringify(job), { expirationTtl: SYNC_JOB_TTL_SECONDS });
          return jsonResponse(buildSyncResponseFromJob(job, 'in_progress'));
        }

        job.nextRecommendedPollAt = null;
        await syncStore.delete(`job:${job.jobId}`);
        return jsonResponse(buildSyncResponseFromJob(job, 'complete'));
      } catch {
        return jsonResponse({ message: 'Unable to sync Roblox ranks right now.' }, 500);
      }
    }

    // Prefer the modern assets binding `env.ASSETS` if present
    try {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetResponse = await env.ASSETS.fetch(request);
        // If asset exists, return it. If 404, fall through to SPA fallback.
        if (assetResponse && assetResponse.status !== 404) return assetResponse;
      }

      // Fallback: try the older __STATIC_CONTENT binding
      if (env.__STATIC_CONTENT && typeof env.__STATIC_CONTENT.get === 'function') {
        const resp = await env.__STATIC_CONTENT.get(request);
        if (resp) return resp;
      }

      // If request path looks like a file (has an extension), return 404
      if (url.pathname.match(/\.[a-zA-Z0-9]{1,6}$/)) {
        return new Response('Not found', { status: 404 });
      }

      // Otherwise serve index.html from the assets binding
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), request));
      }

      if (env.__STATIC_CONTENT && typeof env.__STATIC_CONTENT.get === 'function') {
        return await env.__STATIC_CONTENT.get(new Request(new URL('/index.html', request.url).toString(), request));
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response('Internal error', { status: 500 });
    }
  }
};
