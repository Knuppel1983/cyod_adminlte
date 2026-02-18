// /js/custom.js
// Versie voor cache-busting (optioneel te gebruiken in fetch-urls)
const __APP_VERSION__ = '20260218';

    // ---- Helpers: 1x toevoegen ----

    // Parse "DD-MM-YYYY" veilig naar een Date in lokale tijd (00:00)
    function parseDutchDate(ddmmyyyy) {
      if (!ddmmyyyy) return null;
      const parts = String(ddmmyyyy).trim().split('-');
      if (parts.length !== 3) return null;
      const [ddStr, mmStr, yyyyStr] = parts;
      const dd = parseInt(ddStr, 10);
      const mm = parseInt(mmStr, 10);
      const yyyy = parseInt(yyyyStr, 10);
      if (!yyyy || !mm || !dd) return null;

      // Let op: maand is 0-based in JS
      const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);

      // Validatie: JS corrigeert automatisch out-of-range; check componenten
      if (d.getFullYear() !== yyyy || d.getMonth() !== (mm - 1) || d.getDate() !== dd) {
        return null;
      }
      return d;
    }

    // Kalenderjaren optellen/aftrekken: houdt rekening met schrikkeldagen
    function addYears(date, years) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      d.setFullYear(d.getFullYear() + years);
      return d;
    }

    // Percentage van 'value' tussen start en end. Clamp 0..100 en rond op hele %
    function percentBetween(value, start, end) {
      const startMs = +start;
      const endMs = +end;
      const valueMs = +value;
      if (!isFinite(startMs) || !isFinite(endMs) || !isFinite(valueMs)) return 0;
      if (endMs <= startMs) return 100; // fallback: voorkom /0; hoort niet voor te komen
      const ratio = (valueMs - startMs) / (endMs - startMs);
      return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    }
    
    function getDisplayName(principal) {
      if (!principal) return null;

      // SWA kan 'claims' of 'userClaims' gebruiken afhankelijk van flow/config
      const claims = principal.userClaims || principal.claims || [];

      // exacte/robuste claim-lookup: match 'name' of URI die eindigt op '/name'
      const get = (key) => {
        const k = key.toLowerCase();
        const hit = claims.find(c => {
          const typ = (c.typ || '').toLowerCase();
          return typ === k || typ.endsWith('/' + k);
        });
        return hit?.val?.trim() || '';
      };

      // 1) Voornaam + achternaam (als aanwezig)
      const given  = get('given_name');
      const family = get('family_name');
      if (given || family) return [given, family].filter(Boolean).join(' ').trim();

      // 2) Volledige weergavenaam
      const full = get('name');
      if (full) return full;

      // 3) Geen zichtbare fallback naar e‑mail
      return 'Gebruiker';
    };

    (async function paintUi() {
      try {
        console.log('[paintUi] start');

        // 1) Principal ophalen
        const p = await getPrincipal();
        console.log('[paintUi] principal:', p);

        // 2) Weergavenaam bepalen
        const name = getDisplayName(p);
        console.log('[paintUi] computed name:', name);

        // 3) Doelelementen zoeken
        const spanTop  = document.getElementById('userDisplay');
        const spanHdr  = document.getElementById('userDisplayHeader');
        const spanMail = document.getElementById('userEmailHeader');
        const header   = document.getElementById('welcomeHeader');

        console.log('[paintUi] nodes found:', {
          userDisplay: !!spanTop,
          userDisplayHeader: !!spanHdr,
          userEmailHeader: !!spanMail,
          welcomeHeader: !!header
        });

        // 4) Schrijven naar navbar (toon e-mail in plaats van naam)
        if (spanTop) {
          const email = (p?.userDetails && String(p.userDetails).trim()) || '';
          const safe = email || ((name && name.trim()) ? name : 'Niet ingelogd');
          spanTop.textContent = safe;
          spanTop.classList.remove('d-none');
          console.log('[paintUi] userDisplay (email) set to:', safe);
        } else {
          console.warn('[paintUi] #userDisplay not found in DOM');
        }


        // 5) Schrijven naar dropdown
        if (spanHdr)  { spanHdr.textContent  = name || ''; console.log('[paintUi] userDisplayHeader set'); }
        if (spanMail) { spanMail.textContent = (p?.userDetails) || ''; console.log('[paintUi] userEmailHeader set'); }

        // 6) Welkom-kop
        if (header) {
          header.textContent = name ? `Welkom ${name}` : 'Welkom';
          console.log('[paintUi] welcomeHeader set');
        } else {
          console.warn('[paintUi] #welcomeHeader not found in DOM');
        }

        console.log('[paintUi] done');
      } catch (e) {
        console.error('Auth paintUi error:', e);
      }
    })();
    

    (async function () {
      try {
        const res = await fetch('/api/getbudgets', { credentials: 'include' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('API error', res.status, text);
          return;
        }
      const data = await res.json();
      console.log('API ok', data);
      const fmt = (n) =>
        (n == null
          ? '—'
          : `€ ${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

      // Bestaande waardes invullen
      const elTstBase = document.getElementById('tstValue');
      const elRepBase = document.getElementById('repValue');
      const elMinUseBase = document.getElementById('minuseValue');
      const elQueryRun = document.getElementById('budget_date');
      
      const elTst = document.getElementById('val-tst');
      const elRep = document.getElementById('val-rep');
      const elOvg = document.getElementById('val-ovg');
      const elPeildatum = document.getElementById('val-peildatum');
      const elTstMsg = document.getElementById('val-tst-message');
      const elRepMsg = document.getElementById('val-rep-message');
      const elOvgMsg = document.getElementById('val-ovg-message');
      const elTotaal = document.getElementById('totaal');
      const elTotaalPD = document.getElementById('totaal_pd');
      const elTotaalPDtitle = document.getElementById('totaal_pd_title');

      // Basiswaarden
      if (elTstBase)    elTstBase.textContent    = data.tst_value ?? '';
      if (elRepBase)    elRepBase.textContent    = data.rep_value ?? '';
      if (elMinUseBase) elMinUseBase.textContent = data.minuse_value ?? '';
      if (elQueryRun)   elQueryRun.textContent   = data.queryrun_value ?? '';


      // Inzetbaar budget huidig
      // const elTotInz = Number(data.tst_budget + data.ovg_budget);
      const elTotInz = Number(data.totaal_inzetbaar);
      console.log("[Budget2] Totaal inzetbaar:", elTotInz);

      // Inzetbaar budget vanaf peildatum
      // const elTotInzPD = Number(data.tst_budget + data.ovg_budget + data.rep_budget);
      const elTotInzPD = Number(data.totaal_inzetbaar_pd);
      console.log("[Budget2] Totaal inzetbaar vanaf peildatum:", elTotInzPD);
      const sqlStr = data?.peildatum;


      if (elQueryRun) {
        const dateStr = data?.queryrun_value; // bv. "13-02-2026"
        if (dateStr && String(dateStr).trim()) {
          elQueryRun.textContent = `Onderstaand jouw budgetten bijgewerkt tot ${dateStr}.`;
        } else {
          // Geen datum beschikbaar → laat het leeg (nbsp)
        elQueryRun.textContent = `Er ging iets mis.`;
        }
      }

      if (elTst) elTst.textContent = fmt(data.tst_budget);
      if (elRep) elRep.textContent = fmt(data.rep_budget);
      if (elOvg) elOvg.textContent = fmt(data.ovg_budget);
      if (elPeildatum) {
        const dateStr = data?.peildatum; // bv. "13-02-2026"
        if (dateStr && String(dateStr).trim()) {
          elPeildatum.textContent = `${dateStr}`;
        } else {
          // Geen datum beschikbaar → laat het leeg (nbsp)
          elPeildatum.textContent = '\u00A0';
        }
      }
      
      if (elTstMsg) {
      const monthly = (data.tst_value / 36).toLocaleString('nl-NL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
        elTstMsg.textContent = `Groeit met ~ € ${monthly} per maand.`;
      }
      
      if (elRepMsg) {
        const repRaw = Number(data?.rep_budget);
        const repBaseValue = Number(data?.rep_value);
        if (Number.isFinite(repRaw) && repRaw === repBaseValue) {
          elRepMsg.textContent = 'Nog geen reparaties, goed bezig!';
        } else {
          // Terug naar non‑breaking space (zelfde als &nbsp; in HTML)
          elRepMsg.textContent = '\u00A0';
        }
      }
      if (elOvgMsg) {
        const ovgRaw = Number(data?.ovg_budget);
        if (Number.isFinite(ovgRaw) && ovgRaw === 0) {
          elOvgMsg.textContent = 'Inzetbaar voor toestel of reparaties.';
        } else {
          // Terug naar non‑breaking space (zelfde als &nbsp; in HTML)
          elOvgMsg.textContent = 'Inzetbaar voor toestel of reparaties.';
          // elOvgMsg.textContent = '\u00A0';
        }
      }

      // ── Nieuw: progress voor 'tst' ──────────────────────────────────────────────
      // 100% = 600
      const MAX_TST = 600;
      const raw = Number(data?.tst_budget);
      // als data.tst_budget geen getal is → 0
      const ratio = isFinite(raw) && raw > 0 ? raw / MAX_TST : 0;
      // clamp naar 0..100 en afronden naar integer
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));

      // Element met id 'val-tst-progress' verwacht (de binnenste .progress-bar)
      const bar = document.getElementById('val-tst-progress');
      if (bar) {
        bar.style.width = `${pct}%`;

        // optioneel: ARIA updaten (als je progress via ARIA leest)
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        
        console.log("[Peildatum] Width van val-tst-progress gezet op:", pct + "%");
      } else {
        // Handige waarschuwing als het element (nog) niet bestaat
        console.warn("Element met id 'val-tst-progress' niet gevonden.");
      }
      // ───────────────────────────────────────────────────────────────────────────


      // ── Nieuw: progress voor 'peildatum' ──────────────────────────────────────────────
      //const sqlStr = data?.peildatum;
      const sqlDate = parseDutchDate(sqlStr);

      let pctQuery = 0;

      if (sqlDate) {
        const end = new Date(sqlDate.getFullYear(), sqlDate.getMonth(), sqlDate.getDate());
        const start = addYears(end, -3);

        const now = new Date();
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        pctQuery = percentBetween(today0, start, end);

        // Extra inzicht: ruwe ratio-info
        const totalMs = end - start;
        const progressedMs = today0 - start;


        // Edge-case logs
      } else {
        console.warn("[Peildatum] Kon SQL-datum niet parsen → pctQuery = 0%");
      }

      // Element met id 'val-peildatum-progress' (de binnenste .progress-bar)
      const bar2 = document.getElementById('val-peildatum-progress');
      if (bar2) {
        bar2.style.width = `${pctQuery}%`;

        // optioneel: ARIA updaten (als je progress via ARIA leest)
        bar2.setAttribute('aria-valuenow', String(pctQuery));
        bar2.setAttribute('aria-valuemin', '0');
        bar2.setAttribute('aria-valuemax', '100');

        console.log("[Peildatum] Width van val-peildatum-progress gezet op:", pctQuery + "%");
      } else {
        console.warn("Element met id 'val-peildatum-progress' niet gevonden.");
      }
      // ───────────────────────────────────────────────────────────────────────────
      
      
      // totalen
      const totinzpd = (data.totaal_inzetbaar_pd + ((data.tst_value / (data.minuse_value * 365)) * data.days_to_peildatum)).toFixed(2)
      
      if (elTotaal) elTotaal.textContent = `${fmt(data.totaal_inzetbaar)}`;
      if (elTotaalPDtitle) elTotaalPDtitle.textContent = `Op peildatum (${sqlStr}):`;
      // if (elTotaalPD) elTotaalPD.textContent = `${fmt(data.totaal_inzetbaar_pd)}`;
      if (elTotaalPD) elTotaalPD.textContent = `${fmt(totinzpd)}`;
      //Je kunt op dit moment ${elTotInz} inzetten, en vanaf ${sqlStr}, ${elTotInz}.

      
      console.log("days_to_peildatum:", data.days_to_peildatum);
      console.log("hallo Jumbo");
      

    } catch (e) {
      console.error('Fetch failed', e);
    }
  })();
  
  
      /**
     * Toont een Bootstrap 5 modal als bevestigingsdialoog.
     * Returnt een Promise<boolean>: true = bevestigd, false = geannuleerd.
     *
     * Valt terug op window.confirm als Bootstrap modal niet beschikbaar is.
     */
    function confirmModal(message, {
      title = 'Bevestigen',
      confirmText = 'Ja',
      cancelText = 'Nee',
      size = '',        // 'modal-sm' | 'modal-lg' | 'modal-xl' of leeg
      iconHtml = '<i class="fas fa-question-circle me-2"></i>'
    } = {}) {
      // Fallback als Bootstrap JS niet geladen is
      const hasBS = typeof bootstrap !== 'undefined' && bootstrap.Modal;
      if (!hasBS) {
        try { return Promise.resolve(window.confirm(message)); }
        catch { return Promise.resolve(false); }
      }

      // Zoek of maak de modal container
      let host = document.getElementById('app-confirm-modal');
      if (!host) {
        host = document.createElement('div');
        host.id = 'app-confirm-modal';
        host.className = 'modal fade';
        host.tabIndex = -1;
        host.setAttribute('aria-hidden', 'true');

        host.innerHTML = `
          <div class="modal-dialog ${size}">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title d-flex align-items-center">${iconHtml}<span class="title"></span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
              </div>
              <div class="modal-body">
                <p class="message mb-0"></p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary btn-cancel" data-bs-dismiss="modal"></button>
                <button type="button" class="btn btn-primary btn-confirm"></button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(host);
      }

      // Vul content
      host.querySelector('.title').textContent = title;
      host.querySelector('.message').textContent = message;
      host.querySelector('.btn-confirm').textContent = confirmText;
      host.querySelector('.btn-cancel').textContent = cancelText;

      const bsModal = bootstrap.Modal.getOrCreateInstance(host, { backdrop: 'static', keyboard: false });

      return new Promise((resolve) => {
        const btnConfirm = host.querySelector('.btn-confirm');
        const btnCancel  = host.querySelector('.btn-cancel');

        const done = (val) => {
          // cleanup listeners
          btnConfirm.removeEventListener('click', onConfirm);
          btnCancel .removeEventListener('click', onCancel);
          host.removeEventListener('hidden.bs.modal', onHidden);
          resolve(val);
        };
        const onConfirm = () => { bsModal.hide(); done(true); };
        const onCancel  = () => { /* hide event volgt via data-bs-dismiss */ };
        const onHidden  = () => { done(false); };

        btnConfirm.addEventListener('click', onConfirm, { once: true });
        btnCancel .addEventListener('click', onCancel,  { once: true });
        host.addEventListener('hidden.bs.modal', onHidden, { once: true });

        // Toon modal en zet focus op confirm-knop
        bsModal.show();
        setTimeout(() => btnConfirm.focus(), 50);
      });
    }
  
  
  
  
  // Color Mode Toggler
      (() => {
        'use strict';

        let storedTheme = localStorage.getItem('theme');
        // const storedTheme = localStorage.getItem('theme');


        // NIEUW: bij eerste bezoek default naar 'auto'
          if (storedTheme == null) {
            localStorage.setItem('theme', 'auto');
            storedTheme = 'auto';
          }


        const getPreferredTheme = () => {
          if (storedTheme) {
            return storedTheme;
          }

          return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        };

        const setTheme = function (theme) {
          if (theme === 'auto' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
          } else {
            document.documentElement.setAttribute('data-bs-theme', theme);
          }
        };

        setTheme(getPreferredTheme());

        const showActiveTheme = (theme, focus = false) => {
          const themeSwitcher = document.querySelector('#bd-theme');

          if (!themeSwitcher) {
            return;
          }

          const themeSwitcherText = document.querySelector('#bd-theme-text');
          const activeThemeIcon = document.querySelector('.theme-icon-active i');
          const btnToActive = document.querySelector(`[data-bs-theme-value="${theme}"]`);
          const svgOfActiveBtn = btnToActive.querySelector('i').getAttribute('class');

          for (const element of document.querySelectorAll('[data-bs-theme-value]')) {
            element.classList.remove('active');
            element.setAttribute('aria-pressed', 'false');
          }

          btnToActive.classList.add('active');
          btnToActive.setAttribute('aria-pressed', 'true');
          activeThemeIcon.setAttribute('class', svgOfActiveBtn);
          const themeSwitcherLabel = `${themeSwitcherText.textContent} (${btnToActive.dataset.bsThemeValue})`;
          themeSwitcher.setAttribute('aria-label', themeSwitcherLabel);

          if (focus) {
            themeSwitcher.focus();
          }
        };

        globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (storedTheme !== 'light' || storedTheme !== 'dark') {
            setTheme(getPreferredTheme());
          }
        });

        globalThis.addEventListener('DOMContentLoaded', () => {
          showActiveTheme(getPreferredTheme());

          for (const toggle of document.querySelectorAll('[data-bs-theme-value]')) {
            toggle.addEventListener('click', () => {
              const theme = toggle.getAttribute('data-bs-theme-value');
              localStorage.setItem('theme', theme);
              setTheme(theme);
              showActiveTheme(theme, true);
            });
          }
        });
      })();