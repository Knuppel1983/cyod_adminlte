// /api/TestDbConnection/index.js
module.exports = async function (context, req) {
  let sql;
  try {
    // Probeer de driver te laden pas in runtime
    sql = require('mssql');
  } catch (e) {
    context.res = {
      status: 500,
      body: { ok: false, where: 'require', error: 'Cannot find module mssql', detail: e.message }
    };
    return;
  }

  let pool;
  try {
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.res = { status: 500, body: { ok: false, error: 'Connection string missing' } };
      return;
    }

    pool = await sql.connect(connStr);
    const r = await pool.request().query('SELECT 1 AS test; SELECT DB_NAME() AS db; SELECT SUSER_SNAME() AS login;');

    context.res = {
      status: 200,
      body: {
        ok: true,
        result: r.recordsets?.[0] ?? [],
        db:      r.recordsets?.[1]?.[0]?.db ?? null,
        login:   r.recordsets?.[2]?.[0]?.login ?? null
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: {
        ok: false,
        where: 'connect/query',
        error: err.message,
        code: err.code ?? null,
        number: err.number ?? null,
        state: err.state ?? null,
        class: err.class ?? null
      }
    };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};