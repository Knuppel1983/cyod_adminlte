// api/getuserdata/index.js
const sql = require('mssql');

module.exports = async function (context, req) {
  
  const onlyActiveFlag = req.query && req.query.onlyActive === '1' ? 1 : 0;
  
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
    const connStr = process.env.SqlConnectionString;
    if (!connStr) {
      throw new Error('SQL_CONNECTION_STRING ontbreekt in app settings');
    }

    const pool = await sql.connect(connStr);
  

    // 3) SQL: let op dat hier GEEN HTML-entities in staan (<=, >=, <, >)
    const result = await pool.request()
      .input('onlyActive', sql.Bit, onlyActiveFlag)
      .execute('dbo.userbudgets_list');

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