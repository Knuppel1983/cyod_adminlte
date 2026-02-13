// /api/getbasevalues/index.js
module.exports = async function (context, req) {
  // 0) Driver laden (blijft binnen de handler → als het faalt, sturen we nette JSON terug)
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    context.res = { status: 500, body: { ok: false, where: 'require', error: e.message } };
    return;
  }

  // 1) Connection string ophalen (SWA → Settings → Configuration → Application settings)
  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  // 2) Query: username → user_id + budget (LEFT JOIN zodat budget optioneel is)
  let pool;
  try {
    pool = await sql.connect(connStr);

    const query = `
      SELECT TOP(1) * FROM dbo.[waardes]
    `;

    const r = await pool.request()
      .query(query);

    if (r.recordset.length === 0) {
      // geen data
      context.res = {
        status: 404,
        body: { ok: false, found: false, username }
      };
      return;
    }

    const row = r.recordset[0];
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ok: true,
        tst_value: row.telefoobedrag,
        rep_value: row.reparatiebedrag,
        minuse_value: row.min_gebruik,
        queryrun_value: row.query_gedraaid
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