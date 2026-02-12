// /api/TestDbConnection/index.js
// npm install mssql  (in /api)
const sql = require('mssql');

module.exports = async function (context, req) {
  let pool;
  try {
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      context.res = { status: 500, body: { ok: false, error: 'Connection string missing' } };
      return;
    }

    // Probeer te verbinden
    pool = await sql.connect(connStr);

    // Minimale, generieke query (afhankelijk van niets)
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
    // Geef herkenbare info terug; geen geheimen
    context.res = {
      status: 500,
      body: {
        ok: false,
        error: err.message,
        code: err.code ?? null,         // bv. ESERVFAIL, ECONNRESET
        number: err.number ?? null,     // SQL Server error nr, bv. 18456 (Login failed)
        state: err.state ?? null,       // SQL state
        class: err.class ?? null        // severity
      }
    };
  } finally {
    if (pool && pool.close) await pool.close();
  }
};