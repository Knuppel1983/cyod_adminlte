// /js/toestel.js
// Pagina-specifieke logica voor toestel_aankoop.html
// Gebruikt helpers uit forms.js (loadUsers, bindFormSubmit) en modal.js (showAlert)

(function () {
  const API_SAVE = '/api/post_newphone';
  const API_USER_SINGLE = ['/api/getuser']; // jouw werkende endpoint

  let budgets = { tst_budget: 0, ovg_budget: 0 };
  let lastPrefilledFor = null; // niet gebruikt voor inputs anymore, maar laten staan voor evt. toekomst

  // ───────────────────────────────────────────────────────────────────────────────
  // Helpers
  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function euro(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent =
        typeof value === 'number'
          ? `€ ${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value;
    }
  }
  function showHelp(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '';
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // Recalculate UI (zonder formatting tijdens typen; met formatting op blur/MAX/correcties)
// Recalculate UI (zonder formatting tijdens typen; met formatting op blur/MAX/correcties)
function recalcManual({ formatInputs = false } = {}) {
  const amount = euro(document.getElementById('amount')?.value);

  const availT =
    euro(
      document
        .getElementById('avail-tst')
        ?.textContent?.replace(/[^\d,.-]/g, '')
        .replace('.', '')
        .replace(',', '.')
    ) ||
    euro(budgets.tst_budget);

  const availO =
    euro(
      document
        .getElementById('avail-ovg')
        ?.textContent?.replace(/[^\d,.-]/g, '')
        .replace('.', '')
        .replace(',', '.')
    ) ||
    euro(budgets.ovg_budget);

  let usedT = euro(document.getElementById('used-tst-input')?.value);
  let usedO = euro(document.getElementById('used-ovg-input')?.value);
  let usedE = euro(document.getElementById('used-eig-input')?.value);

  // ─────────────────────────────────────────────
  // NIEUW: als amount leeg of 0 is → alle inzetten op 0
  // ─────────────────────────────────────────────
  if (!(amount > 0)) {
    usedT = 0;
    usedO = 0;
    usedE = 0;
  }

  // Validaties & clamps
  let warnT = '',
    warnO = '',
    warnOwn = '';
  let changed = false;

  // 1) Niet meer inzetten dan beschikbaar
  if (usedT > availT) {
    usedT = availT;
    warnT = 'Max. inzet toestelbudget bereikt.';
    changed = true;
  }
  if (usedO > availO) {
    usedO = availO;
    warnO = 'Max. inzet overig budget bereikt.';
    changed = true;
  }

  // 2) Totale inzet mag niet boven aankoopbedrag
  const totalUse = usedT + usedO + usedE;
  if (amount > 0 && totalUse > amount) {
    let overflow = totalUse - amount;

    if (usedE >= overflow) {
      usedE -= overflow;
      changed = true;
      overflow = 0;
      warnOwn = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
    } else {
      overflow -= usedE;
      usedE = 0;
      changed = true;

      if (usedO >= overflow) {
        usedO -= overflow;
        changed = true;
        overflow = 0;
        warnO = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
      } else {
        overflow -= usedO;
        usedO = 0;
        usedT = Math.max(0, usedT - overflow);
        changed = true;
        warnT = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
      }
    }
  }

  // Helpteksten
  showHelp('used-tst-help', warnT);
  showHelp('used-ovg-help', warnO);
  showHelp('used-eig-help', warnOwn);

  // Som‑controle en kaartkleur
  const controle = amount - (usedT + usedO + usedE);
  const controleFixed = Number(controle.toFixed(2));
  setText('sum-amount', controleFixed);

  const epsilon = 0.01; // 1 cent marge tegen floating-point ruis
  const isZero =
    isFinite(controleFixed) && Math.abs(controleFixed) < epsilon;

  const sumCard = document.getElementById('sum-card');
  if (sumCard) {
    // Als amount <= 0, beschouwen we het ook als “neutraal/ok”
    const ok = isZero || !(amount > 0);
    sumCard.classList.toggle('bg-danger-subtle', !ok);
    sumCard.classList.toggle('bg-info-subtle', ok);
  }

  // Restbudget (per potje) en optioneel totaal
  const restBudgetT = availT - usedT;
  const restBudgetO = availO - usedO;
  setText('rest-budgetT', restBudgetT);
  setText('rest-budgetO', restBudgetO);
  if (document.getElementById('rest-budget')) {
    setText('rest-budget', restBudgetT + restBudgetO);
  }

  // Input formatting alleen op blur / MAX / correcties
  if (formatInputs || changed) {
    const f2 = (v) => Number(v).toFixed(2);
    const elT = document.getElementById('used-tst-input');
    const elO = document.getElementById('used-ovg-input');
    const elW = document.getElementById('used-eig-input');

    if (elT && elT.value !== f2(usedT)) elT.value = f2(usedT);
    if (elO && elO.value !== f2(usedO)) elO.value = f2(usedO);
    if (elW && elW.value !== f2(usedE)) elW.value = f2(usedE);
  }
}

  // ───────────────────────────────────────────────────────────────────────────────
  // Budgetten ophalen voor geselecteerde gebruiker
  async function fetchUserBudgets(userId) {
    if (!userId) return;

    for (const base of API_USER_SINGLE) {
      try {
        const url = `${base}?userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url, { credentials: 'include' });
        const text = await res.text().catch(() => '');
        if (!res.ok) {
          // probeer volgende endpoint
          continue;
        }

        const data = text ? JSON.parse(text) : null;
        const u = Array.isArray(data) ? (data.length ? data[0] : null) : data;
        if (!u) throw new Error('Lege response');

        // Vul namen aan indien je API anders heet (bijv. u.budget)
        const t = Number(u.tst_budget ?? u.budget ?? 0);
        const o = Number(u.ovg_budget ?? 0);

        budgets = { tst_budget: t, ovg_budget: o };
        setText('avail-tst', t);
        setText('avail-ovg', o);

        recalcManual(); // geen formatting tijdens typen
        return; // klaar
      } catch (e) {
        console.warn('fetchUserBudgets fallback faalde:', e);
      }
    }

    // Als alle endpoints falen
    budgets = { tst_budget: 0, ovg_budget: 0 };
    setText('avail-tst', 0);
    setText('avail-ovg', 0);
    recalcManual();
    window.showAlert?.('danger', 'Kon budgetgegevens voor de gebruiker niet ophalen.');
  }

// ───────────────────────────────────────────────────────────────────────────────
// Submit
// ───────────────────────────────────────────────────────────────────────────────
async function onSubmitToestel(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = e.submitter || form.querySelector('button[type="submit"]');

  const $sel = typeof window.jQuery !== 'undefined' ? jQuery('#userSelect') : null;
  const userId = $sel && $sel.length ? parseInt($sel.val(), 10) : NaN;

  const device = (document.getElementById('deviceName')?.value || '').trim();
  const orderDate = document.getElementById('orderDate')?.value || '';
  const amount = euro(document.getElementById('amount')?.value);
  const contractStatus = document.getElementById('contractStatus')?.value || '';
  const remark = (document.getElementById('remark')?.value || '').trim();

  // ---- Required veld checks ----
  if (!userId) {
    window.showAlert?.('warning', 'Selecteer een gebruiker.');
    return;
  }
  if (!device) {
    window.showAlert?.('warning', 'Vul een toestelnaam in.');
    return;
  }
  if (!orderDate) {
    window.showAlert?.('warning', 'Kies een besteldatum.');
    return;
  }
  if (!(amount > 0)) {
    window.showAlert?.('warning', 'Voer een geldige aanschafwaarde in.');
    return;
  }
  if (!contractStatus) {
    window.showAlert?.('warning', 'Kies de contractstatus.');
    return;
  }

  // ---- SOM-CHECK: sum-amount moet 0,00 zijn ----
  const sumEl = document.getElementById('sum-amount');
  const rawText = (sumEl?.textContent || '0').trim();
  const cleaned = rawText
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const controle = parseFloat(cleaned || '0');

  if (!Number.isFinite(controle)) {
    window.showAlert?.('danger', 'Interne fout bij controle van de som (controle is geen getal).');
    return;
  }

  const epsilon = 0.01; // marge van 1 cent
  if (Math.abs(controle) > epsilon) {
    window.showAlert?.(
      'danger',
      'De som (toestelprijs - ingezet budget - eigen bijdrage) moet exact 0,00 zijn voordat je kunt opslaan.'
    );
    return; // submit niet uitvoeren
  }

  // ---- Handmatige budgetvelden ----
  const useT = euro(document.getElementById('used-tst-input')?.value);
  const useO = euro(document.getElementById('used-ovg-input')?.value);
  const useE = euro(document.getElementById('used-eig-input')?.value);

  const username = $sel && $sel.length ? jQuery('#userSelect option:selected').text() : '';
  const summary = `Gebruiker: ${username}
Toestel: ${device}
Datum: ${orderDate}
Bedrag (ex. btw): € ${fmt(amount)}
Ingezet: toestel € ${fmt(useT)} · overig € ${fmt(useO)}
Eigen bijdrage: € ${fmt(useE)}
Status: ${contractStatus}`;

  // 🔔 Vervang window.confirm door confirmModal uit /js/modal.js
  if (typeof window.confirmModal === 'function') {
    const ok = await window.confirmModal(
      'Bevestigen?\n\n' + summary,
      {
        title: 'Aankoop bevestigen',
        confirmText: 'Opslaan',
        cancelText: 'Annuleren',
        size: 'modal-md'
      }
    );
    if (!ok) return;
  } else {
    // fallback, als modal.js om wat voor reden dan ook niet geladen is
    if (!window.confirm('Bevestigen?\n\n' + summary)) return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    // ---- Payload voor jouw nieuwe API (post_newphone) ----
    const payload = {
      userId,
      deviceName: device,
      orderDate,
      amount: Number(amount.toFixed(2)),
      usedTst: Number(useT.toFixed(2)),
      usedOvg: Number(useO.toFixed(2)),
      ownContribution: Number(useE.toFixed(2)),
      contractStatus,
      remark
    };

    const resp = await fetch(API_SAVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text || '{}');
        msg = j.message || j.error || text;
      } catch {}
      throw new Error(msg || `HTTP ${resp.status}`);
    }

    window.showAlert?.('success', 'Aankoop is opgeslagen.');
    form.reset();
    recalcManual({ formatInputs: true });
  } catch (err) {
    console.error('toestel_aankoop_save error:', err);
    window.showAlert?.('danger', err.message || 'Opslaan mislukt');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

  // ───────────────────────────────────────────────────────────────────────────────
  // Bind
function bind() {
  // Select2: alleen actieve users laden (forms.js regelt init; hier alleen change)
  const hasJQ = typeof window.jQuery !== 'undefined';
  if (hasJQ && typeof jQuery.fn.select2 === 'function') {
    const $sel = jQuery('#userSelect');
    if ($sel.length) {
      // forms.js roept loadUsers(1) aan op basis van data-only-active
      $sel.on('change', function () {
        clearUserFields();
        const id = parseInt($sel.val(), 10);
        if (id) fetchUserBudgets(id);
      });
    }
  }

  // Submit
  if (typeof window.bindFormSubmit === 'function') {
    window.bindFormSubmit('toestelForm', onSubmitToestel);
  } else {
    const form = document.getElementById('toestelForm');
    if (form) form.addEventListener('submit', onSubmitToestel);
  }

  // Invoer-events
  ['amount', 'used-tst-input', 'used-ovg-input', 'used-eig-input'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === 'amount') {
      // 🔴 Speciaal gedrag voor Aanschafwaarde
      el.addEventListener('input', () => {
        const raw = el.value.trim();
        const val = euro(raw); // gebruikt je bestaande helper

        if (raw === '' || !(val > 0)) {
          // amount is leeg of 0 -> alle inzetvelden direct naar 0,00
          recalcManual({ formatInputs: true });
        } else {
          // normaal doorrekenen, maar niet formatteren tijdens typen
          recalcManual({ formatInputs: false });
        }
      });

      el.addEventListener('blur', () => recalcManual({ formatInputs: true }));
    } else {
      // Overige velden: blijven zoals het was
      el.addEventListener('input', () => recalcManual({ formatInputs: false }));
      el.addEventListener('blur', () => recalcManual({ formatInputs: true }));
    }
  });

  // MAX-knoppen (optioneel aanwezig) – ongewijzigd
  const btnT = document.getElementById('btnUsedTMax');
  if (btnT) {
    btnT.addEventListener('click', () => {
      const el = document.getElementById('used-tst-input');
      const max = Number(budgets?.tst_budget ?? 0);
      if (el) {
        el.value = max.toFixed(2);
        recalcManual({ formatInputs: true });
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
        recalcManual({ formatInputs: true });
      }
    });
  }
}
``
  
  function clearUserFields() {
    // Voeg hier jouw eigen veld-ID's toe
    const fieldsToClear = [
      'used-tst-input',
      'used-ovg-input'
    ];

    fieldsToClear.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
        // optioneel: ook input event afvuren als jouw berekening daarop reageert
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    recalcManual({ formatInputs: true });
  }  

  document.getElementById('userSelect')
    ?.addEventListener('change', clearUserFields);

  document.getElementById('btnUsedEMax').addEventListener('click', function () {
    // Gebruik dezelfde euro() helper als in recalcManual
    const amount = euro(document.getElementById('amount')?.value) || 0;

    let usedT = euro(document.getElementById('used-tst-input')?.value) || 0;
    let usedO = euro(document.getElementById('used-ovg-input')?.value) || 0;

    // Wat er nog ontbreekt t.o.v. het aankoopbedrag
    let remaining = amount - usedT - usedO;

    if (remaining < 0) remaining = 0; // geen negatieve eigen bijdrage

    const elE = document.getElementById('used-eig-input');
    if (elE) {
      elE.value = Number(remaining).toFixed(2);
    }

    // Laat jouw volledige validatie + formatting opnieuw lopen
    recalcManual({ formatInputs: true });
  });

  document.addEventListener('DOMContentLoaded', bind);
  
  
})();