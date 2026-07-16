async function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
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
    const userResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });

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
    const userDetailsResponse = await fetch(`https://users.roblox.com/v1/users/${usernameCheck.robloxId}`);
    if (!userDetailsResponse.ok) {
      return { verified: false, message: 'Unable to read the Roblox profile description right now.' };
    }

    const userDetails = await userDetailsResponse.json().catch(() => ({}));
    const description = String(userDetails?.description || '');

    if (!description.includes(code)) {
      return { verified: false, message: 'Code not found on your profile — make sure you saved it and try again' };
    }

    return { verified: true, robloxId: usernameCheck.robloxId, description: userDetails?.displayName || usernameCheck.displayName || '' };
  } catch {
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

    const rolesResponse = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
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

// Worker that serves static assets from the built-in assets binding and falls back to index.html for SPA routes
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

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
