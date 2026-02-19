// /api/getuserdata/index.js
module.exports = async function (context, req) {
  const sql = require('mssql');

  // Optioneel: autorisatie/rol-check (support) op SWA-claims
  const principalB64 = req.headers['x-ms-client-principal'];
  if (!principalB64) { context.res = { status: 401, body: { ok:false, error:'Unauthorized' } }; return; }
  // (Hier kun je evt. support-rol afdwingen)

  const onlyActive = req.query.onlyActive ? req.query.onlyActive === '1' : null;
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;

  const connStr = process.env.SqlConnectionString;
  if (!connStr) { context.res = { status: 500, body: { ok:false, error:'SqlConnectionString missing' } }; return; }

  try {
    const pool = await sql.connect(connStr);
    const request = pool.request();

    if (userId) {
      // Detail 1 gebruiker (met budgetten)
      request.input('UserId', sql.Int, userId);
      const { recordset } = await request.query(`
        SELECT TOP (1)
          u.id         AS user_id,
          u.username   AS username,
          u.active     AS active,
          b.budget     AS tst_budget,
          r.rep_budget AS rep_budget,
          o.ovg_budget AS ovg_budget
        FROM dbo.users u
        LEFT JOIN dbo.tst_budget b ON b.user_id = u.id
        LEFT JOIN dbo.rep_budget r ON r.user_id = u.id
        LEFT JOIN dbo.ovg_budget o ON o.user_id = u.id
        WHERE u.id = @UserId;
      `);
      context.res = { status: recordset.length ? 200 : 404, body: recordset.length ? recordset[0] : { ok:false, error:'Not found' } };
      return;
    }

    // Lijst (alle of alleen actief)
    let sqlList = `
      SELECT u.id AS user_id, u.username, u.active
      FROM dbo.users u
    `;
    if (onlyActive !== null) {
      sqlList += ` WHERE u.active = ${onlyActive ? 1 : 0}`;
    }
    sqlList += ` ORDER BY u.username`;

    const { recordset } = await request.query(sqlList);
    context.res = { status: 200, body: recordset };

  } catch (err) {
    context.res = { status: 500, body: { ok:false, where:'query', error: err.message } };
  }
};