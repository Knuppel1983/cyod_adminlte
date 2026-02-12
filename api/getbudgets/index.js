// /api/getprofile/index.js
module.exports = async function (context, req) {
  // 0) Driver laden (in de handler -> gecontroleerde fout i.p.v. kale 500)
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    context.res = { status: 500, body: { ok: false, where: 'require', error: e.message } };
    return;
  }

  // 1) Claims -> username (SWA zet claims in deze header als je route authenticated is)
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
    context.res = { status: 400, body: { ok: false, where: 'claims-parse', error: e.message } };
    return;
  }

  // 2) Connection string (SWA -> Application settings -> environment variable)
  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  // 3) Eén query -> 1 resultset met 3 kolommen (LEFT JOIN zodat ontbrekende regels null geven)
  const query = `
    SELECT
      a.[username]                         AS username,
      b.[budget]                           AS tst_budget,
      c.[rep_budget]                       AS rep_budget,
      d.[ovg_budget]                       AS ovg_budget
    FROM dbo.[users] AS a
    LEFT JOIN dbo.[tst_budget] AS b ON b.[user_id] = a.[id]
    LEFT JOIN dbo.[rep_budget] AS c ON c.[user_id] = a.[id]
    LEFT JOIN dbo.[ovg_budget] AS d ON d.[user_id] = a.[id]
    WHERE a.[username] = @Username;
  `;

  let pool;
  try {
    pool = await sql.connect(connStr);

    const r = await pool.request()
      .input('Username', sql.NVarChar(256), username)
      .query(query);

    if (r.recordset.length === 0) {
      context.res = { status: 404, body: { ok: false, found: false, username } };
      return;
    }

    const row = r.recordset[0];

    // 4) Één JSON-object met 3 outputwaardes (en user-info)
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        user: { username },        // voeg hier evt. a.id toe via extra select of subselect
        tst_budget: row.tst_budget,
        rep_budget: row.rep_budget,
        ovg_budget: row.ovg_budget
      }
    };

  } catch (err) {
    // Gecontroleerde fout (geen kale 500)
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
