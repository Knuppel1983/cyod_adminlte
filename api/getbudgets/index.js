module.exports = async function (context, req) {
  // 1) Driver laden
  let sql;
  try {
    sql = require('mssql');
  } catch (e) {
    context.res = {
      status: 500,
      body: { ok: false, where: 'require', error: e.message }
    };
    return;
  }

  // 2) Connection string ophalen
  const connStr = process.env.SqlConnectionString;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'SqlConnectionString missing' } };
    return;
  }

  let pool;
  try {
    // 3) Connectie openen
    pool = await sql.connect(connStr);

    // **HIER staat Stap C – mini-query SELECT 1**
    const result = await pool.request().query('SELECT 1 AS test;');

    // 4) Response sturen
    context.res = {
      status: 200,
      body: {
        ok: true,
        step: 'query-ok',
        test: result.recordset[0].test
      }
    };

  } catch (err) {
    context.res = {
      status: 500,
      body: {
        ok: false,
        where: 'query',
        error: err.message,
        number: err.number ?? null
      }
    };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};