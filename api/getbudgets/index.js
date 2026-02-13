// /api/getbudgets/index.js
module.exports = async function (context, req) {
  // 0) Driver laden
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    context.res = { status: 500, body: { ok: false, where: 'require', error: e.message } };
    return;
  }

  // 1) Claims uit SWA
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
      context.res = { status: 400, body: { ok: false, where: 'claims', error: 'Cannot derive username from claims' } };
      return;
    }
  } catch (e) {
    context.res = { status: 400, body: { ok: false, where: 'claims', error: e.message } };
    return;
  }

  // 2) Connection string
  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  // 3) Queries (één batch, twee SELECTs)
  let pool;
  try {
    pool = await sql.connect(connStr);

    const request = pool.request();
    request.multiple = true; // ← belangrijk voor meerdere recordsets
    request.input('Username', sql.NVarChar(256), username);

    const batch = `
      -- Resultset 1: user + budgets
      SELECT TOP (1)
             a.[id]            AS user_id,
             b.[budget]        AS tst_budget,
             c.[rep_budget]    AS rep_budget,
             d.[ovg_budget]    AS ovg_budget
      FROM   dbo.[users] AS a
      LEFT JOIN dbo.[tst_budget] AS b ON b.[user_id] = a.[id]
      LEFT JOIN dbo.[rep_budget] AS c ON c.[user_id] = a.[id]
      LEFT JOIN dbo.[ovg_budget] AS d ON d.[user_id] = a.[id]
      WHERE  a.[username] = @Username;

      -- Resultset 2: globale waardes
      SELECT TOP (1)
             [telefoonbedrag]   AS tst_value,
             [reparatiebedrag] AS rep_value,
             [min_gebruik]     AS minuse_value,
             CONVERT(VARCHAR(10), [query_gedraaid], 105) AS queryrun_value  -- dd-mm-yyyy
      FROM dbo.[waardes];
    `;

    const result = await request.query(batch);

    const userRows   = result.recordsets?.[0] || [];
    const valuesRows = result.recordsets?.[1] || [];

    if (userRows.length === 0) {
      context.res = { status: 404, body: { ok: false, found: false, username } };
      return;
    }

    const userRow   = userRows[0];
    const valuesRow = valuesRows[0] || {};

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        user: { id: userRow.user_id, username },

        // budgets per gebruiker
        tst_budget: userRow.tst_budget,
        rep_budget: userRow.rep_budget,
        ovg_budget: userRow.ovg_budget,

        // globale waardes (kunnen null zijn als er geen rij in dbo.waardes staat)
        tst_value:       valuesRow.tst_value       ?? null,
        rep_value:       valuesRow.rep_value       ?? null,
        minuse_value:    valuesRow.minuse_value    ?? null,
        queryrun_value:  valuesRow.queryrun_value  ?? null
      }
    };

  } catch (err) {
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