// /js/toestel.js
// Pagina-specifieke logica voor toestel_aankoop.html
// Gebruikt helpers uit forms.js (loadUsers, bindFormSubmit) en modal.js (showAlert)

(function(){
  const API_SAVE = '/api/toestel_aankoop_save'; // << wijzig indien jouw API anders heet
  const API_USER_SINGLE = ['/api/getuserdata', '/api/getuser']; // probeert op volgorde

  let budgets = { tst_budget: 0, ovg_budget: 0 };

  function fmt(n){
    if(n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('nl-NL', {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = (typeof value === 'number') ? `€ ${fmt(value)}` : value;
  }

  function euro(val){
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  function recalc(){
    const amount = euro(document.getElementById('amount')?.value);
    // beschikbare budgets
    const availT = euro(budgets.tst_budget);
    const availO = euro(budgets.ovg_budget);

    let useT = Math.min(amount, availT);
    let remaining = amount - useT;
    let useO = Math.min(remaining, availO);
    let own = Math.max(0, amount - useT - useO);
    const restBudget = (availT + availO) - (useT + useO);

    setText('sum-amount', amount);
    setText('used-tst', useT);
    setText('used-ovg', useO);
    setText('own-contrib', own);
    setText('rest-budget', restBudget);
  }

  async function fetchUserBudgets(userId){
    for (const base of API_USER_SINGLE){
      try{
        const url = `${base}?userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, {credentials:'include'});
        if(!res.ok) continue;
        const data = await res.json();
        // data kan object of array zijn
        const u = Array.isArray(data) ? (data.length ? data[0] : null) : data;
        if(!u) continue;
        const t = Number(u.tst_budget ?? 0);
        const o = Number(u.ovg_budget ?? 0);
        budgets = { tst_budget: t, ovg_budget: o };
        setText('avail-tst', t);
        setText('avail-ovg', o);
        recalc();
        return;
      }catch(e){
        // probeer volgende endpoint
      }
    }
    // Als alles faalt
    budgets = { tst_budget: 0, ovg_budget: 0 };
    setText('avail-tst', 0);
    setText('avail-ovg', 0);
    recalc();
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
      recalc();
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
    if(amountEl) amountEl.addEventListener('input', recalc);

    // reset
    const btnReset = document.getElementById('btnReset');
    if(btnReset){ btnReset.addEventListener('click', function(){
      const form = document.getElementById('toestelForm');
      if(form) form.reset();
      recalc();
    }); }
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
