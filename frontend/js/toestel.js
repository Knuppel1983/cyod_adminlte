// /js/toestel.js
// Pagina-specifieke logica voor toestel_aankoop.html
// Gebruikt helpers uit forms.js (loadUsers, bindFormSubmit) en modal.js (showAlert)

(function () {
  const API_SAVE = '/api/toestel_aankoop_save';
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
  function recalcManual({ formatInputs = false } = {}) {
    const amount = euro(document.getElementById('amount')?.value);

    const availT =
      euro(
        document
          .getElementById('avail-tst')
          ?.textContent?.replace(/[^\d,.-]/g, '')
          .replace('.', '')
          .replace(',', '.')
      ) || euro(budgets.tst_budget);

    const availO =
      euro(
        document
          .getElementById('avail-ovg')
          ?.textContent?.replace(/[^\d,.-]/g, '')
          .replace('.', '')
          .replace(',', '.')
      ) || euro(budgets.ovg_budget);

    let usedT = euro(document.getElementById('used-tst-input')?.value);
    let usedO = euro(document.getElementById('used-ovg-input')?.value);
    let own = euro(document.getElementById('own-contrib-input')?.value);

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
    const totalUse = usedT + usedO + own;
    if (amount > 0 && totalUse > amount) {
      let overflow = totalUse - amount;

      if (own >= overflow) {
        own -= overflow;
        changed = true;
        overflow = 0;
        warnOwn = 'Inzet + eigen bijdrage is getrimd tot aanschafwaarde.';
      } else {
        overflow -= own;
        own = 0;
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
    showHelp('own-contrib-help', warnOwn);

    // Som‑controle en kaartkleur
    const controle = amount - (usedT + usedO + own);
    setText('sum-amount', Number(controle.toFixed(2)));

    const epsilon = 0.01; // 1 cent marge tegen floating-point ruis
    const isZero = isFinite(controle) && Math.abs(controle) < epsilon;
    const sumCard = document.getElementById('sum-card');
    if (sumCard) {
      sumCard.classList.toggle('bg-danger-subtle', !isZero);
      sumCard.classList.toggle('bg-info-subtle', isZero);
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
      const elW = document.getElementById('own-contrib-input');
      if (elT && elT.value !== f2(usedT)) elT.value = f2(usedT);
      if (elO && elO.value !== f2(usedO)) elO.value = f2(usedO);
      if (elW && elW.value !== f2(own)) elW.value = f2(own);
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

    // Handmatige velden gebruiken (niet automatisch berekenen)
    const useT = euro(document.getElementById('used-tst-input')?.value);
    const useO = euro(document.getElementById('used-ovg-input')?.value);
    const own = euro(document.getElementById('own-contrib-input')?.value);

    const username = $sel && $sel.length ? jQuery('#userSelect option:selected').text() : '';
    const summary = `Gebruiker: ${username}
Toestel: ${device}
Datum: ${orderDate}
Bedrag (ex. btw): € ${fmt(amount)}
Ingezet: toestel € ${fmt(useT)} · overig € ${fmt(useO)}
Eigen bijdrage: € ${fmt(own)}
Status: ${contractStatus}`;

    if (!confirm('Bevestigen?\n\n' + summary)) return;

    if (submitBtn) submitBtn.disabled = true;
    try {
      const payload = {
        userId,
        device,
        orderDate,
        amountExBtw: Number(amount.toFixed(2)),
        usedTstBudget: Number(useT.toFixed(2)),
        usedOvgBudget: Number(useO.toFixed(2)),
        ownContribution: Number(own.toFixed(2)),
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

    // Invoer-events: input = geen formatting; blur = wel formatting
    ['amount', 'used-tst-input', 'used-ovg-input', 'own-contrib-input'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => recalcManual({ formatInputs: false }));
      el.addEventListener('blur', () => recalcManual({ formatInputs: true }));
    });

    // MAX-knoppen (optioneel aanwezig)
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

  document.addEventListener('DOMContentLoaded', bind);
})();