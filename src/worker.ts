async function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
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
      `https://groups.roblox.com/v1/users/${encodeURIComponent(String(userId))}/groups/roles`,
      { method: 'GET' },
      1,
      250,
      5000,
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
const BULK_ROLE_CONCURRENCY = 4;

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
  label = 'roblox-fetch'
) {
  let attempt = 0;
  let delayMs = Math.max(100, initialDelayMs);
  const maxDelayMs = 1500;

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
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, maxDelayMs)
        : Math.min(delayMs, maxDelayMs);
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

async function resolveRobloxUserIdsInBulk(usernames: string[]) {
  const uniqueUsernames = Array.from(new Set(usernames.map((username) => username.trim()).filter(Boolean)));
  const userIdByUsername = new Map<string, string>();
  const unresolvedUsernames = new Set<string>();

  for (const usernameBatch of chunk(uniqueUsernames, BULK_USERNAME_BATCH_SIZE)) {
    console.log(`[bulk-user-ids] processing batch size ${usernameBatch.length}`);
    let response: Response;
    try {
      response = await fetchWithRetry(
        'https://users.roblox.com/v1/usernames/users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: usernameBatch, excludeBannedUsers: false })
        },
        1,
        300,
        4500,
        'bulk-user-ids'
      );
    } catch {
      usernameBatch.forEach((username) => unresolvedUsernames.add(username));
      continue;
    }

    if (!response.ok) {
      usernameBatch.forEach((username) => unresolvedUsernames.add(username));
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
  }

  return {
    userIdByUsername,
    unresolvedUsernames: Array.from(unresolvedUsernames)
  };
}

async function fetchBulkGroupRanks(usernames: string[], groupId: string) {
  const { userIdByUsername, unresolvedUsernames } = await resolveRobloxUserIdsInBulk(usernames);
  const entries = Array.from(userIdByUsername.entries());
  const rankByUsername: Record<string, string> = {};
  const roleLookupFailures: string[] = [];

  for (let index = 0; index < entries.length; index += BULK_ROLE_CONCURRENCY) {
    const segment = entries.slice(index, index + BULK_ROLE_CONCURRENCY);
    const segmentResults = await Promise.all(segment.map(async ([usernameKey, userId]) => {
      let response: Response;
      try {
        response = await fetchWithRetry(
          `https://groups.roblox.com/v1/users/${encodeURIComponent(userId)}/groups/roles`,
          { method: 'GET' },
          1,
          250,
          4500,
          'bulk-group-roles'
        );
      } catch {
        return { usernameKey, ok: false, roleName: null as string | null };
      }

      if (!response.ok) {
        return { usernameKey, ok: false, roleName: null as string | null };
      }

      const payload = await response.json().catch(() => ({}));
      const groupRole = Array.isArray(payload?.data)
        ? payload.data.find((entry: any) => String(entry?.group?.id) === String(groupId))
        : null;

      if (!groupRole?.role?.name) {
        return {
          usernameKey,
          ok: false,
          roleName: null as string | null
        };
      }

      return {
        usernameKey,
        ok: true,
        roleName: String(groupRole.role.name)
      };
    }));

    segmentResults.forEach((result) => {
      if (!result.ok || !result.roleName) {
        roleLookupFailures.push(result.usernameKey);
        return;
      }
      rankByUsername[result.usernameKey] = result.roleName;
    });

    if (index + BULK_ROLE_CONCURRENCY < entries.length) {
      await sleep(80);
    }
  }

  return {
    rankByUsername,
    unresolvedUsernames,
    roleLookupFailures,
    usernamesResolved: entries.length
  };
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
          `https://groups.roblox.com/v1/users/${encodeURIComponent(resolvedUserId)}/groups/roles`,
          { method: 'GET' },
          1,
          250,
          5000,
          'user-rank'
        );

        if (!response.ok) {
          return jsonResponse({ message: 'Unable to fetch Roblox group rank.', rank: 'Unranked', found: false }, 502);
        }

        const payload = await response.json().catch(() => ({}));
        const groupRole = Array.isArray(payload?.data)
          ? payload.data.find((entry: any) => String(entry?.group?.id) === String(groupId))
          : null;

        return jsonResponse({
          robloxId: resolvedUserId,
          groupId,
          rank: groupRole?.role?.name ? String(groupRole.role.name) : 'Unranked',
          found: Boolean(groupRole?.role?.name)
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
        const body = await request.json().catch(() => ({}));
        const groupId = String(body.groupId || env.ROBLOX_GROUP_ID || '5531725');
        const usernames: string[] = Array.isArray(body.usernames)
          ? body.usernames.map((value: unknown) => String(value || '').trim()).filter(Boolean)
          : [];

        if (usernames.length === 0) {
          return jsonResponse({ message: 'No usernames provided for rank sync.' }, 400);
        }

        const { excludedNames, warning: exclusionsWarning } = await fetchPersonnelExclusions(env);
        const usernamesForSync = usernames.filter((username) => !excludedNames.has(normalizePersonnelName(username)));

        if (usernamesForSync.length === 0) {
          return jsonResponse({
            groupId,
            totalRequested: usernames.length,
            uniqueRequested: 0,
            usernamesResolved: 0,
            unresolvedUsernames: [],
            roleLookupFailures: [],
            rankByUsername: {},
            synced: 0,
            failed: [],
            exclusionsApplied: excludedNames.size,
            exclusionsWarning
          });
        }

        const result = await fetchBulkGroupRanks(usernamesForSync, groupId);
        const failed = Array.from(new Set([
          ...result.unresolvedUsernames,
          ...result.roleLookupFailures
        ]));
        return jsonResponse({
          groupId,
          totalRequested: usernames.length,
          uniqueRequested: Array.from(new Set(usernamesForSync.map((username) => username.toLowerCase()))).length,
          usernamesResolved: result.usernamesResolved,
          unresolvedUsernames: result.unresolvedUsernames,
          roleLookupFailures: result.roleLookupFailures,
          rankByUsername: result.rankByUsername,
          synced: result.usernamesResolved,
          failed,
          exclusionsApplied: excludedNames.size,
          exclusionsWarning
        });
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
