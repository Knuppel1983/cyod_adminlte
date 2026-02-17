// api/getuserdata/index.js
const sql = require('mssql');

module.exports = async function (context, req) {
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
  const rows = await pool.request().query(`
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
  `);

  return {
    status: 200,
    body: rows.recordset
  };
};