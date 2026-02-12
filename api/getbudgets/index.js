// /api/getbudgets/index.js
module.exports = async function (context, req) {
  // 0) Driver laden (blijft binnen de handler → als het faalt, sturen we nette JSON terug)
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    context.res = { status: 500, body: { ok: false, where: 'require', error: e.message } };
    return;
  }

  // 1) Claims uit SWA (SWA plaatst de claims in deze header als de gebruiker is ingelogd)
  const p = req.headers['x-ms-client-principal'];
  if (!p) {
    context.res = { status: 401, body: { ok: false, error: 'Unauthorized' } };
    return;
  }

  let username = '';
  try {
    const principal = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    const claims = principal.userClaims || principal.claims || [];
    const get = (key) => {
      const k = key.toLowerCase();
      const hit = claims.find(c => {
        const t = (c.typ || '').toLowerCase();
        return t === k || t.endsWith('/' + k);
      });
      return hit?.val || '';
    };

    const email = get('preferred_username') || get('email') || principal.userDetails || '';
    username = (email || '').split('@')[0];

    if (!username) {
      context.res = { status: 400, body: { ok: false, error: 'Cannot derive username from claims' } };
      return;
    }
  } catch (e) {
    context.res = { status: 400, body: { ok: false, where: 'claims', error: e.message } };
    return;
  }

  // 2) Connection string ophalen (SWA → Settings → Configuration → Application settings)
  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  // 3) Query: username → user_id + budget (LEFT JOIN zodat budget optioneel is)
  let pool;
  try {
    pool = await sql.connect(connStr);

    const query = `
      SELECT TOP (1)
             u.[id]     AS user_id,
             b.[budget] AS budget
      FROM   dbo.[users] AS u
      LEFT JOIN dbo.[tst_budget] AS b
             ON b.[user_id] = u.[id]
      WHERE  u.[username] = @Username;  -- aanname: kolom is case-insensitief gecolloceerd
    `;

    const r = await pool.request()
      .input('Username', sql.NVarChar(256), username)
      .query(query);

    if (r.recordset.length === 0) {
      // gebruiker niet gevonden
      context.res = {
        status: 404,
        body: { ok: false, found: false, username }
      };
      return;
    }

    const row = r.recordset[0];
    context.res = {
      status: 200,
      body: {
        ok: true,
        user: { id: row.user_id, username },
        budget: row.budget // kan null zijn bij LEFT JOIN
      }
    };

  } catch (err) {
    // Gecontroleerde fout met diagnostiek (geen secrets)
    context.res = {
      status: 500,
      body: {
        ok: false,
        where: 'query',
        error: err.message,
        number: err.number ?? null,
        state: err.state ?? null,
        code: err.code ?? null
      }
    };
  } finally {
    if (pool && pool.close) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
};