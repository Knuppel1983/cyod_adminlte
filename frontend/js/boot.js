    async function getPrincipal() {
      if (window.__principal) return window.__principal;

      const res  = await fetch('/.auth/me', { credentials: 'include' });
      const json = await res.json();

      const principal =
        (json && json.clientPrincipal) ? json.clientPrincipal :
        (Array.isArray(json) && json.length > 0) ? json[0] :
        null;

      // Normaliseer: claims naar userClaims voor compat
      if (principal && !principal.userClaims && principal.claims) {
        principal.userClaims = principal.claims;
      }

      window.__principal = principal;
      return principal;
    }

    // 👉 Nieuwe helper: check op SWA role
    function hasRole(principal, roleName) {
      const roles = principal?.userRoles || [];
      return roles.includes(roleName);
    }

    (async function boot() {
      try {
        const principal = await getPrincipal();
        const isSupport = hasRole(principal, 'support');
        console.log('[isSupport role]', isSupport, principal?.userRoles);

        // 1) Toggle layout class voor CSS-varianten
        document.documentElement.classList.toggle('support', isSupport);
        document.documentElement.classList.toggle('default', !isSupport);

      if (isSupport) {
        $(function () {
            $('#userdata').DataTable({
                processing: true,
                deferRender: true,
                pageLength: 100,
                order: [[1, 'asc']],
                ajax: {
                  url: '/api/getuserdata?onlyActive=1',   // of '/api/support/getuserdata' als jouw function.json zo route
                  type: 'GET',
                  dataSrc: ''                // <<< BELANGRIJK: omdat de API een root-array retourneert
                },
                columns: [
                  { data: 'user_id' },
                  { data: 'username' },

                  // €-kolommen met NL-opmaak
                  { data: 'tst_budget',           render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
                  { data: 'rep_budget',           render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
                  { data: 'ovg_budget',           render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
                  { data: 'totaal_inzetbaar',     render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
                  { data: 'totaal_inzetbaar_pd',  render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },        
                  
                  // Peildatum: toon NL, sorteer op ISO
                  {
                  data: 'peildatum',
                    render: function (data, type, row) {
                      if (!data) return data; // safety
                      // data = '31-12-2025'
                      const [d, m, y] = data.split('-');
                      const iso = `${y}-${m}-${d}`; // '2025-12-31'

                      if (type === 'sort' || type === 'type') return iso; // sorteren op ISO
                      return data; // weergave blijft NL-formaat
                    }
                  },
                  { data: 'days_to_peildatum', className: 'text-end' }
                ]
            });
        });
      }


      } finally {
        document.documentElement.classList.remove('app-booting');
      }
    })();
    
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