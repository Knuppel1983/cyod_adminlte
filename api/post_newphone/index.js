// api/post_newphone/index.js

const sql = require('mssql');

/**
 * SQL-configuratie
 * Pas deze waarden aan (liefst via process.env.* variabelen)
 */
// Connectiestring
const connStr = process.env.SqlConnectionString;
if (!connStr) {
  context.res = { status: 500, body: { error: 'SqlConnectionString ontbreekt in app settings' } };
  return;
}

/**
 * Azure Function entrypoint
 */
module.exports = async function (context, req) {
  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      body: { error: 'Only POST is allowed' }
    };
    return;
  }

  const body = req.body || {};

  const {
    userId,
    deviceName,
    orderDate,
    amount,
    usedTst,
    usedOvg,
    ownContribution,
    contractStatus,
    remark
  } = body;

  // Basisvalidatie (minimaal gelijk aan wat je vroeger in PHP verwachtte)
  if (!userId || !deviceName || !orderDate || !contractStatus) {
    context.res = {
      status: 400,
      body: { error: 'userId, deviceName, orderDate en contractStatus zijn verplicht.' }
    };
    return;
  }

  // Converteer waardes naar getallen (voor de zekerheid)
  const usedTstNum = Number(usedTst || 0);
  const usedOvgNum = Number(usedOvg || 0);
  const ownContributionNum = Number(ownContribution || 0);
  const amountNum = amount != null ? Number(amount) : null;

  // Optionele controle of bedragen optellen tot de toestelprijs
  if (amountNum != null) {
    const sum = usedTstNum + usedOvgNum + ownContributionNum;
    const diff = Math.abs(sum - amountNum);

    // Sta een kleine afrondingsfout toe (0.01)
    if (diff > 0.01) {
      context.res = {
        status: 400,
        body: {
          error: 'Som van toestelbudget + overig budget + eigen bijdrage komt niet overeen met de aanschafwaarde.',
          details: { amount: amountNum, sumUsed: sum }
        }
      };
      return;
    }
  }

  try {
    // 1. Connectie openen (pool wordt hergebruikt binnen de function runtime)
    const pool = await sql.connect(connStr);

    // 2. Stored procedure aanroepen met parameters
    const request = pool.request()
      .input('UserId',           sql.Int,           userId)
      .input('Toestel',          sql.NVarChar(50),  deviceName)
      .input('Besteldatum',      sql.Date,         orderDate)      // 'YYYY-MM-DD' is ok
      .input('IngToestelBudget', sql.Decimal(18, 2), usedTstNum)
      .input('IngOverigBudget',  sql.Decimal(18, 2), usedOvgNum)
      .input('EigenBijdrage',    sql.Decimal(18, 2), ownContributionNum)
      .input('Contractstatus',   sql.NVarChar(50),  contractStatus)
      .input('Opmerking',        sql.NVarChar(sql.MAX), remark || null);

    await request.execute('dbo.usp_NewToestelAankoop');

    context.res = {
      status: 200,
      body: {
        success: true,
        message: 'Toestel aankoop succesvol geregistreerd.'
      }
    };
  } catch (err) {
    context.log.error('Error in new-phone API:', err);

    context.res = {
      status: 500,
      body: {
        error: 'Er is een fout opgetreden bij het wegschrijven van de aankoop.',
        details: err.message
      }
    };
  }
};