module.exports = async function (context, req) {
  // Alleen de driver proberen te laden.
  let loaded = false;
  try {
    const sql = require('mssql');
    loaded = !!sql;
  } catch (e) {
    // Gecontroleerde fout, geen kale 500
    context.res = {
      status: 500,
      body: { ok: false, where: 'require', error: e.message }
    };
    return;
  }

  // Geen connectie, geen query: alleen bevestigen dat de driver geladen is
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      ok: true,
      step: "driver-ok",
      loaded
    }
  };
};