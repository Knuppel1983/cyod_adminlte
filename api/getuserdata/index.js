// api/getuserdata/index.js
const sql = require('mssql');

module.exports = async function (context, req) {
  try {
    // 1) (Optioneel) extra defense: rol check via header x-ms-client-principal
    //    Alleen doen als je dit echt wilt afdwingen in de function zelf
    // const principalHeader = req.headers['x-ms-client-principal'];
    // if (!principalHeader) {
    //   context.res = { status: 401, body: 'Unauthorized' };
    //   return;
    // }
    // const principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf8'));
    // const roles = principal?.userRoles || [];
    // if (!roles.includes('support')) {
    //   context.res = { status: 403, body: 'Forbidden' };
    //   return;
    // }

    // 2) Verbind met SQL
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (!connStr) {
      throw new Error('SQL_CONNECTION_STRING ontbreekt in app settings');
    }

    const pool = await sql.connect(connStr);

    // 3) SQL: let op dat hier GEEN HTML-entities in staan (<=, >=, <, >)
    const query = `
      SELECT
          a.[id]                              AS user_id,
          a.[username],
          b.[budget]                          AS tst_budget,
          c.[rep_budget]                      AS rep_budget,
          d.[ovg_budget]                      AS ovg_budget,
          CAST(COALESCE(b.[budget], 0) + COALESCE(d.[ovg_budget], 0) AS DECIMAL(18,2)) AS totaal_inzetbaar,        -- tst + ovg
          CAST(COALESCE(b.[budget], 0) + COALESCE(d.[ovg_budget], 0) + COALESCE(c.[rep_budget], 0) AS DECIMAL(18,2)) AS totaal_inzetbaar_pd, -- tst + ovg + rep
          CONVERT(VARCHAR(10), DATEADD(YEAR, 3, e.[peildatum]), 105) AS peildatum,  -- dd-mm-yyyy
          CASE
            WHEN e.[peildatum] IS NULL THEN NULL
            WHEN CAST(DATEADD(YEAR, 3, e.[peildatum]) AS date) <= CAST(GETDATE() AS date) THEN 0
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(DATEADD(YEAR, 3, e.[peildatum]) AS date))
          END AS days_to_peildatum
      FROM   dbo.[users]        AS a
      LEFT JOIN dbo.[tst_budget] AS b ON b.[user_id] = a.[id]
      LEFT JOIN dbo.[rep_budget] AS c ON c.[user_id] = a.[id]
      LEFT JOIN dbo.[ovg_budget] AS d ON d.[user_id] = a.[id]
      LEFT JOIN dbo.[peildatum]  AS e ON e.[user_id] = a.[id]
      -- geen WHERE (dus alle users)
      ORDER BY a.[username];
    `;

    const result = await pool.request().query(query);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result.recordset
    };
  } catch (err) {
    // Log voor diagnose
    context.log.error('getuserdata error:', err);

    // Nette foutmelding terug
    context.res = {
      status: 500,
      body: {
        error: 'Internal Server Error',
        message: err.message
        // In productie: geef geen stack terug aan client
        // stack: err.stack
      }
    };
  } finally {
    // Optional: pool sluiten (mssql houdt singleton aan; meestal niet nodig)
    // sql.close(); // alleen als je expliciet wilt sluiten
  }
};