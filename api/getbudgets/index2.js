// npm install mssql
const sql = require('mssql');

module.exports = async function (context, req) {
  context.log('=== GetUserId FUNCTION START ===');

  let pool;
  try {
    // 0) Binnenkomende headers (alleen voor debug; log geen gevoelige waarden)
    context.log('[Req] method:', req.method);
    context.log('[Req] has x-ms-client-principal:', !!req.headers['x-ms-client-principal']);

    // 1) Connection string uit SWA Application settings
    const connStr = process.env.SqlConnectionString;
    context.log('[Env] SqlConnectionString present?', !!connStr);
    if (!connStr) {
      context.log.error('[Env] SqlConnectionString missing in environment settings');
      context.res = { status: 500, body: 'DB config missing' };
      return;
    }

    // 2) Gebruiker uit EasyAuth header (x-ms-client-principal)
    const principalHeader = req.headers['x-ms-client-principal'];
    if (!principalHeader) {
      context.log.warn('[Auth] Missing x-ms-client-principal');
      context.res = { status: 401, body: 'Unauthorized' };
      return;
    }

    let principal;
    try {
      principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf8'));
    } catch (e) {
      context.log.error('[Auth] Failed to parse principal header:', e);
      context.res = { status: 400, body: 'Invalid principal header' };
      return;
    }

    // Claims kunnen in principal.userClaims of principal.claims zitten; normaliseer
    const claims = principal.userClaims || principal.claims || [];
    context.log('[Auth] claims count:', claims.length);

    const getClaim = (needle) => {
      const n = String(needle || '').toLowerCase();
      const hit = claims.find((c) => {
        const t = String(c.typ || '').toLowerCase();
        return t === n || t.endsWith('/' + n); // vangt URI-varianten af
      });
      return hit?.val || '';
    };

    // 3) Bepaal de bron voor e‑mail/UPN
    const emailOrUpn =
      getClaim('preferred_username') ||
      getClaim('emailaddress') || // soms als URI-variant
      getClaim('email') ||
      principal.userDetails || '';

    context.log('[Auth] emailOrUpn:', emailOrUpn ? '[present]' : '[empty]');
    if (!emailOrUpn) {
      context.log.warn('[Auth] No user identity found in claims/principal');
      context.res = { status: 400, body: 'No user identity found' };
      return;
    }

    // 4) Maak 'voornaam.achternaam' door alles vóór @ te nemen
    const username = emailOrUpn.split('@')[0];
    context.log('[Auth] derived username:', username);

    // 5) Query (parametrized) op dbo.users.username en haal de id op
    context.log('[SQL] Connecting to Azure SQL...');
    pool = await sql.connect(connStr);
    context.log('[SQL] Connected:', !!pool?.connected);

    context.log('[SQL] Executing query for username:', username);
    const result = await pool
      .request()
      .input('Username', sql.NVarChar(256), username)
      .query(`
        SELECT TOP (1) [id]
        FROM [dbo].[users]
        WHERE LOWER([username]) = LOWER(@Username)
      `);

    const count = result?.recordset?.length || 0;
    context.log('[SQL] Rows returned:', count);

    if (count === 0) {
      // Geen match gevonden
      context.res = {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { found: false, username, id: null }
      };
      context.log('=== GetUserId FUNCTION END (404) ===');
      return;
    }

    const { id } = result.recordset[0];

    // 6) Succes: id teruggeven als JSON
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { found: true, username, id }
    };
    context.log('[Result] found id:', id);
    context.log('=== GetUserId FUNCTION END (200) ===');
  } catch (err) {
    // Log volledige error (stack) naar serverlog; stuur generieke 500 naar client
    context.log.error('[ERROR] Unhandled exception:', err);
    context.res = { status: 500, body: 'Internal Server Error' };
  } finally {
    // Pool netjes sluiten (voorkomt resource‑lekkage bij intensief gebruik)
    if (pool && pool.close) {
      try {
        await pool.close();
        context.log('[SQL] Connection pool closed.');
      } catch (e) {
        context.log.warn('[SQL] Closing pool raised:', e?.message || e);
      }
    }
  }
};