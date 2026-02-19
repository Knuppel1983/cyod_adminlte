// /js/toestel.js
// Pagina-specifieke logica voor toestel_aankoop.html
// Gebruikt helpers uit forms.js (loadUsers, bindFormSubmit) en modal.js (showAlert)

(function(){
  const API_SAVE = '/api/toestel_aankoop_save'; // << wijzig indien jouw API anders heet
  const API_USER_SINGLE = ['/api/getuserdata', '/api/getuser']; // probeert op volgorde

  let lastPrefilledFor = null; // onthoud voor welke userId we velden hebben vooringevuld
  let budgets = { tst_budget: 0, ovg_budget: 0 };


  function fmt(n){
    if(n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('nl-NL', {minimumFractionDigits:2, maximumFractionDigits:2});
  }

// Helpers
function euro(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (typeof value === 'number')
    ? `€ ${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : value;
}
function showHelp(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

// Aangenomen dat je ergens budgets bijhoudt (zoals eerder):
// let budgets = { tst_budget: 0, ovg_budget: 0 };

function recalcManual() {
  const amount = euro(document.getElementById('amount')?.value); // Som (aanschaf)
  const availT = euro(document.getElementById('avail-tst')?.textContent?.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || euro(budgets.tst_budget);
  const availO = euro(document.getElementById('avail-ovg')?.textContent?.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || euro(budgets.ovg_budget);

  let usedT = euro(document.getElementById('used-tst-input')?.value);
  let usedO = euro(document.getElementById('used-ovg-input')?.value);
  let own   = euro(document.getElementById('own-contrib-input')?.value);

  // Basis validaties & clamps
  let warnT = '', warnO = '', warnOwn = '';

  // 1) Niet meer inzetten dan beschikbaar
  if (usedT > availT) { usedT = availT; warnT = 'Max. inzet toestelbudget bereikt.'; }
  if (usedO > availO) { usedO = availO; warnO = 'Max. inzet overig budget bereikt.'; }

  // 2) Totale inzet mag niet boven aankoopbedrag
  const totalUse = usedT + usedO + own;
  if (amount > 0 && totalUse > amount) {
    // Eerst eigen bijdrage terugschalen, dan overig, dan toestel (zachte prioriteit)
    let overflow = totalUse - amount;

    if (own >= overflow) {
      own -= overflow; overflow = 0;
      warnOwn = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
    } else {
      overflow -= own;
      own = 0;
      if (usedO >= overflow) {
        usedO -= overflow; overflow = 0;
        warnO = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
      } else {
        overflow -= usedO;
        usedO = 0;
        // Wat resteert, trim van usedT
        usedT = Math.max(0, usedT - overflow);
        warnT = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
      }
    }
  }

  // Schrijf helpteksten
  showHelp('used-tst-help', warnT);
  showHelp('used-ovg-help', warnO);
  showHelp('own-contrib-help', warnOwn);

  // Som (aanschaf) is gewoon het amount
  const controle =  amount - (usedT + usedO + own);
  setText('sum-amount', controle);

  // Restbudget na aankoop: alleen t.o.v. beschikbare budgetten
  const restBudget = (availT + availO) - (usedT + usedO);
  setText('rest-budget', restBudget);

  // Zorg dat de inputs de (eventueel getrimde) waarden tonen
  const f2 = v => (Number(v).toFixed(2));
  const elT = document.getElementById('used-tst-input');
  const elO = document.getElementById('used-ovg-input');
  const elW = document.getElementById('own-contrib-input');
  if (elT && elT.value !== f2(usedT)) elT.value = f2(usedT);
  if (elO && elO.value !== f2(usedO)) elO.value = f2(usedO);
  if (elW && elW.value !== f2(own))   elW.value = f2(own);
}

// Bind events (in jouw bestaande bind()/init)
document.addEventListener('DOMContentLoaded', () => {
  ['amount', 'used-tst-input', 'used-ovg-input', 'own-contrib-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalcManual);
  });
  
  const btnT = document.getElementById('btnUsedTMax');
  if (btnT) {
    btnT.addEventListener('click', () => {
      const el = document.getElementById('used-tst-input');
      const max = Number(budgets?.tst_budget ?? 0);
      if (el) {
        el.value = max.toFixed(2);
        recalcManual();
      }
    });
  }
  const btnO = document.getElementById('btnUsedOMax');
  if (btnO) {
    btnO.addEventListener('click', () => {
      const el = document.getElementById('used-ovg-input');
      const max = Number(budgets?.ovg_budget ?? 0);
      if (el) {
        el.value = max.toFixed(2);
        recalcManual();
      }
    });
  }
});


async function fetchUserBudgets(userId){
  for (const base of API_USER_SINGLE){
    try{
      const url = `${base}?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, {credentials:'include'});
      if(!res.ok) continue;

      const data = await res.json();
      const u = Array.isArray(data) ? (data.length ? data[0] : null) : data;
      if(!u) continue;

      const t = Number(u.tst_budget ?? 0);
      const o = Number(u.ovg_budget ?? 0);

      budgets = { tst_budget: t, ovg_budget: o };
      setText('avail-tst', t);
      setText('avail-ovg', o);

      // PREFILL OP ÉCHTE GEBRUIKERSWISSEL
      if (userId !== lastPrefilledFor) {
        // — KIES ÉÉN VAN DEZE BLOCJES —

        // (A) Alleen 'ingezet toestelbudget' automatisch vullen met beschikbaar TST:
        const elUsedT = document.getElementById('used-tst-input');
        if (elUsedT) elUsedT.value = t.toFixed(2);

        // Optioneel: de andere twee leeg/0 maken
        const elUsedO = document.getElementById('used-ovg-input');
        const elOwn   = document.getElementById('own-contrib-input');
        if (elUsedO) elUsedO.value = '0.00';
        if (elOwn)   elOwn.value   = '0.00';

        // (B) Wil je liever alle drie prefillen (bijv. toestel = TST, rest = 0):
        // const elUsedT = document.getElementById('used-tst-input');
        // const elUsedO = document.getElementById('used-ovg-input');
        // const elOwn   = document.getElementById('own-contrib-input');
        // if (elUsedT) elUsedT.value = t.toFixed(2);
        // if (elUsedO) elUsedO.value = '0.00';
        // if (elOwn)   elOwn.value   = '0.00';

        lastPrefilledFor = userId;
      }
      // PREFILL OP ÉCHTE GEBRUIKERSWISSEL

      recalcManual();
      return;
    }catch(e){
      // probeer volgende endpoint
    }
  }
  // Als alles faalt
  budgets = { tst_budget: 0, ovg_budget: 0 };
  setText('avail-tst', 0);
  setText('avail-ovg', 0);

  // Reset inputs bij fout (je kunt dit ook leeg laten)
  const elUsedT = document.getElementById('used-tst-input');
  const elUsedO = document.getElementById('used-ovg-input');
  const elOwn   = document.getElementById('own-contrib-input');
  if (elUsedT) elUsedT.value = '';
  if (elUsedO) elUsedO.value = '';
  if (elOwn)   elOwn.value   = '';

  lastPrefilledFor = null;
  recalcManual();
  window.showAlert?.('danger', 'Kon budgetgegevens voor de gebruiker niet ophalen.');
}



  async function onSubmitToestel(e){
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = e.submitter || form.querySelector('button[type="submit"]');

    // verplichte velden
    const $sel = (typeof window.jQuery !== 'undefined') ? jQuery('#userSelect') : null;
    const userId = $sel && $sel.length ? parseInt($sel.val(), 10) : NaN;
    const device = (document.getElementById('deviceName')?.value || '').trim();
    const orderDate = document.getElementById('orderDate')?.value || '';
    const amount = euro(document.getElementById('amount')?.value);
    const contractStatus = document.getElementById('contractStatus')?.value || '';
    const remark = (document.getElementById('remark')?.value || '').trim();

    if(!userId){ window.showAlert?.('warning', 'Selecteer een gebruiker.'); return; }
    if(!device){ window.showAlert?.('warning', 'Vul een toestelnaam in.'); return; }
    if(!orderDate){ window.showAlert?.('warning', 'Kies een besteldatum.'); return; }
    if(!(amount > 0)){ window.showAlert?.('warning', 'Voer een geldige aanschafwaarde in.'); return; }
    if(!contractStatus){ window.showAlert?.('warning', 'Kies de contractstatus.'); return; }

    // berekende waarden
    const availT = euro(budgets.tst_budget);
    const availO = euro(budgets.ovg_budget);
    const useT = Math.min(amount, availT);
    const useO = Math.min(Math.max(0, amount - useT), availO);
    const own = Math.max(0, amount - useT - useO);

    const username = ($sel && $sel.length)
      ? jQuery('#userSelect option:selected').text()
      : '';

    const summary = `Gebruiker: ${username}
    Toestel: ${device}
    Datum: ${orderDate}
    Bedrag (ex. btw): € ${fmt(amount)}
    Ingezet: toestel € ${fmt(useT)} · overig € ${fmt(useO)}
    Eigen bijdrage: € ${fmt(own)}
    Status: ${contractStatus}`;

    if (!confirm('Bevestigen?\n\n' + summary)) return;

    if(submitBtn) submitBtn.disabled = true;
    try{
      const payload = {
        userId: userId,
        device: device,
        orderDate: orderDate,
        amountExBtw: Number(amount.toFixed(2)),
        usedTstBudget: Number(useT.toFixed(2)),
        usedOvgBudget: Number(useO.toFixed(2)),
        ownContribution: Number(own.toFixed(2)),
        contractStatus: contractStatus,
        remark: remark
      };
      const resp = await fetch(API_SAVE, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const text = await resp.text().catch(()=> '');
      if(!resp.ok){
        // probeer message uit JSON te halen
        let msg = text;
        try { const j = JSON.parse(text || '{}'); msg = j.message || j.error || text; } catch {}
        throw new Error(msg || ('HTTP ' + resp.status));
      }
      window.showAlert?.('success', 'Aankoop is opgeslagen.');
      form.reset();
      recalcManual();
    }catch(err){
      console.error('toestel_aankoop_save error:', err);
      window.showAlert?.('danger', err.message || 'Opslaan mislukt');
    }finally{
      if(submitBtn) submitBtn.disabled = false;
    }
  }

  function bind(){
    // Select2 init + actieve users laden
    const hasJQ = (typeof window.jQuery !== 'undefined');
    if(hasJQ && typeof jQuery.fn.select2 === 'function'){
      const $sel = jQuery('#userSelect');
      if($sel.length){
        $sel.select2({ placeholder: 'Bezig met ophalen gebruikers...', allowClear: true });
        // laad alleen actieve users voor support
        if(typeof window.loadUsers === 'function'){
          try { window.loadUsers(1); } catch(e) {}
        }
        $sel.on('change', function(){
          const id = parseInt($sel.val(), 10);
          if(id) fetchUserBudgets(id);
        });
      }
    }

    // form submit via helper uit forms.js
    if(typeof window.bindFormSubmit === 'function'){
      window.bindFormSubmit('toestelForm', onSubmitToestel);
    } else {
      // fallback
      const form = document.getElementById('toestelForm');
      if(form) form.addEventListener('submit', onSubmitToestel);
    }

    // recalc bij input
    const amountEl = document.getElementById('amount');
    if(amountEl) amountEl.addEventListener('input', recalcManual);

    // reset
    const btnReset = document.getElementById('btnReset');
    if(btnReset){ btnReset.addEventListener('click', function(){
      const form = document.getElementById('toestelForm');
      if(form) form.reset();
      recalcManual();
    }); }
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
