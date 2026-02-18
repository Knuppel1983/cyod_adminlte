// /js/custom.js
// Versie voor cache-busting (optioneel te gebruiken in fetch-urls)
const __APP_VERSION__ = '20260218';


// Toon elke error en verwijder 'app-booting' zodat je nooit wit blijft
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.error || e.message, e);
  document.documentElement.classList.remove('app-booting');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[GLOBAL PROMISE REJECTION]', e.reason);
  document.documentElement.classList.remove('app-booting');
});



// ---- Helpers: 1x toevoegen ----
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
}

// ===== Sidebar include + active/open =====
async function loadSidebar(hostId, url) {
  const host = document.getElementById(hostId);
  if (!host) return;

  try {
    const res = await fetch(`${url}?v=${__APP_VERSION__}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    host.innerHTML = html;

    // ACTIVE LINK DETECTIE
    const current = normalizePath(location.pathname);

    // Markeer actieve link
    const links = host.querySelectorAll('a.nav-link[href]');
    let activeLink = null;

    // 1) Exacte match eerst
    for (const a of links) {
      const href = normalizePath(a.getAttribute('href'));
      if (href && href === current) { activeLink = a; break; }
    }

    // 2) Fallback: longest prefix match (handig voor sectie root)
    if (!activeLink) {
      let best = { len: -1, el: null };
      for (const a of links) {
        const href = normalizePath(a.getAttribute('href'));
        if (!href || href === '#') continue;
        if (current.startsWith(href) && href.length > best.len) {
          best = { len: href.length, el: a };
        }
      }
      activeLink = best.el;
    }

    if (activeLink) {
      activeLink.classList.add('active');

      // Als dit item in een treeview zit, open de parent(s)
      const item = activeLink.closest('.nav-item');
      if (item) {
        // Open directe parent .has-treeview
        const parentTree = item.closest('.has-treeview');
        if (parentTree) {
          parentTree.classList.add('menu-open');
          const parentLink = parentTree.querySelector('> a.nav-link');
          if (parentLink) parentLink.classList.add('active');
        }

        // (Optioneel) Open hogere niveaus als je nested treeviews gebruikt
        let ancestor = parentTree?.parentElement?.closest('.has-treeview');
        while (ancestor) {
          ancestor.classList.add('menu-open');
          const alink = ancestor.querySelector('> a.nav-link');
          if (alink) alink.classList.add('active');
          ancestor = ancestor.parentElement?.closest('.has-treeview');
        }
      }
    }

    // ADMINLTE RE-INIT (indien nodig)
    if (window.jQuery && window.$ && $.fn.Treeview) {
      $('[data-widget="treeview"]').Treeview('init');
    } else if (window.AdminLTE && window.AdminLTE.Treeview) {
      document.querySelectorAll('[data-widget="treeview"]').forEach(el => {
        try { new window.AdminLTE.Treeview(el); } catch (e) { /* ignore */ }
      });
    }
  } catch (err) {
    console.error('Sidebar laden mislukt:', err);
    host.innerHTML = `
      <div class="p-3 text-danger">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Kon navigatie niet laden.
      </div>`;
  }
}

function normalizePath(pathname) {
  // Verwijder query/hash en normaliseer '/index.html' en trailing slash
  try {
    const url = new URL(pathname, location.origin);
    let p = url.pathname;
    p = p.replace(/\/index\.html?$/i, '/'); // index.html -> /
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1); // trailing slash weg (behalve root)
    return p || '/';
  } catch {
    // Fallback als URL constructor faalt
    let p = String(pathname || '/');
    p = p.replace(/\/index\.html?$/i, '/');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
  }
}

// ====== Color Mode Toggler (Bootstrap 5) ======
(function () {
  'use strict';

  let storedTheme = localStorage.getItem('theme');
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
    if (!themeSwitcher) return;

    const themeSwitcherText = document.querySelector('#bd-theme-text');
    const activeThemeIcon = document.querySelector('.theme-icon-active i');
    const btnToActive = document.querySelector(`[data-bs-theme-value="${theme}"]`);
    if (!btnToActive) return;

    const iconClass = btnToActive.querySelector('i')?.getAttribute('class') || '';

    for (const element of document.querySelectorAll('[data-bs-theme-value]')) {
      element.classList.remove('active');
      element.setAttribute('aria-pressed', 'false');
    }

    btnToActive.classList.add('active');
    btnToActive.setAttribute('aria-pressed', 'true');
    if (activeThemeIcon) activeThemeIcon.setAttribute('class', iconClass);

    const themeSwitcherLabel = `${themeSwitcherText?.textContent || 'Thema'} (${btnToActive.dataset.bsThemeValue})`;
    themeSwitcher.setAttribute('aria-label', themeSwitcherLabel);

    if (focus) themeSwitcher.focus();
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
        storedTheme = theme;
        setTheme(theme);
        showActiveTheme(theme, true);
      });
    }
  });
})();

// Globale alert helper
window.showAlert = function (type, msg) {
  // type: 'success' | 'danger' | 'warning' | 'info' | ...
  var id = 'alert-' + Date.now();
  // Bootstrap 5 close button
  var html =
    '<div id="' + id + '" class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
      msg +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
    '</div>';

  var container = document.getElementById('alertContainer');
  if (!container) {
    alert(msg);
    return;
  }
  container.insertAdjacentHTML('beforeend', html);

  // Automatisch sluiten na 6 sec
  setTimeout(function () {
    var el = document.getElementById(id);
    if (el) {
      try { window.jQuery && $(el).alert('close'); } catch (_) { el.remove(); }
    }
  }, 6000);
};

// ====== Pagina init ======
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 1) Sidebar laden
  await loadSidebar('sidebar', '/partials/sidebar.html');

  // 2) Auth & role toggles
  const principal = await getPrincipal();
  const isSupport = hasRole(principal, 'support');
  console.log('[isSupport role]', isSupport, principal?.userRoles);

  document.documentElement.classList.toggle('support', isSupport);
  document.documentElement.classList.toggle('default', !isSupport);

  // 3) UI vullen met user info
  (async function paintUi() {
    try {
      console.log('[paintUi] start');
      const p = principal || await getPrincipal();
      console.log('[paintUi] principal:', p);

      const name = getDisplayName(p);
      console.log('[paintUi] computed name:', name);

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

      if (spanTop) {
        const email = (p?.userDetails && String(p.userDetails).trim()) || '';
        const safe = email || ((name && name.trim()) ? name : 'Niet ingelogd');
        spanTop.textContent = safe;
        spanTop.classList.remove('d-none');
        console.log('[paintUi] userDisplay (email) set to:', safe);
      } else {
        console.warn('[paintUi] #userDisplay not found in DOM');
      }

      if (spanHdr)  { spanHdr.textContent  = name || ''; console.log('[paintUi] userDisplayHeader set'); }
      if (spanMail) { spanMail.textContent = (p?.userDetails) || ''; console.log('[paintUi] userEmailHeader set'); }

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

  // 4) Budgetten + progress bars (alleen als de elementen bestaan)
  (async function loadBudgets() {
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

      if (elTstBase)    elTstBase.textContent    = data.tst_value ?? '';
      if (elRepBase)    elRepBase.textContent    = data.rep_value ?? '';
      if (elMinUseBase) elMinUseBase.textContent = data.minuse_value ?? '';

      if (elQueryRun) {
        const dateStr = data?.queryrun_value;
        if (dateStr && String(dateStr).trim()) {
          elQueryRun.textContent = `Onderstaand jouw budgetten bijgewerkt tot ${dateStr}.`;
        } else {
          elQueryRun.textContent = `Er ging iets mis.`;
        }
      }

      if (elTst) elTst.textContent = fmt(data.tst_budget);
      if (elRep) elRep.textContent = fmt(data.rep_budget);
      if (elOvg) elOvg.textContent = fmt(data.ovg_budget);
      if (elPeildatum) {
        const dateStr = data?.peildatum;
        elPeildatum.textContent = (dateStr && String(dateStr).trim()) ? `${dateStr}` : '\u00A0';
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
          elRepMsg.textContent = '\u00A0';
        }
      }

      if (elOvgMsg) {
        const ovgRaw = Number(data?.ovg_budget);
        if (Number.isFinite(ovgRaw) && ovgRaw === 0) {
          elOvgMsg.textContent = 'Inzetbaar voor toestel of reparaties.';
        } else {
          elOvgMsg.textContent = 'Inzetbaar voor toestel of reparaties.';
        }
      }

      // Progress 'tst'
      const MAX_TST = 600;
      const raw = Number(data?.tst_budget);
      const ratio = isFinite(raw) && raw > 0 ? raw / MAX_TST : 0;
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      const bar = document.getElementById('val-tst-progress');
      if (bar) {
        bar.style.width = `${pct}%`;
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
      } else {
        console.warn("Element met id 'val-tst-progress' niet gevonden.");
      }

      // Progress 'peildatum'
      const sqlStr = data?.peildatum;
      const sqlDate = parseDutchDate(sqlStr);
      let pctQuery = 0;

      if (sqlDate) {
        const end = new Date(sqlDate.getFullYear(), sqlDate.getMonth(), sqlDate.getDate());
        const start = addYears(end, -3);

        const now = new Date();
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        pctQuery = percentBetween(today0, start, end);
      } else {
        console.warn("[Peildatum] Kon SQL-datum niet parsen → pctQuery = 0%");
      }

      const bar2 = document.getElementById('val-peildatum-progress');
      if (bar2) {
        bar2.style.width = `${pctQuery}%`;
        bar2.setAttribute('aria-valuenow', String(pctQuery));
        bar2.setAttribute('aria-valuemin', '0');
        bar2.setAttribute('aria-valuemax', '100');
      } else {
        console.warn("Element met id 'val-peildatum-progress' niet gevonden.");
      }

      // Totalen
      const totinzpd = (data.totaal_inzetbaar_pd + ((data.tst_value / (data.minuse_value * 365)) * data.days_to_peildatum)).toFixed(2);

      if (elTotaal)        elTotaal.textContent = `${fmt(data.totaal_inzetbaar)}`;
      if (elTotaalPDtitle) elTotaalPDtitle.textContent = `Op peildatum (${data?.peildatum}):`;
      if (elTotaalPD)      elTotaalPD.textContent = `${fmt(totinzpd)}`;
    } catch (e) {
      console.error('Fetch failed', e);
    }
  })();

  // 5) Support DataTable (alleen als rol + element aanwezig)
  if (typeof window.jQuery !== 'undefined' && $('#userdata').length) {
    if (isSupport) {
      $('#userdata').DataTable({
        processing: true,
        deferRender: true,
        pageLength: 100,
        order: [[1, 'asc']],
        ajax: {
          url: '/api/getuserdata',
          type: 'GET',
          dataSrc: '' // root-array
        },
        columns: [
          { data: 'user_id' },
          { data: 'username' },
          { data: 'tst_budget',          render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
          { data: 'rep_budget',          render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
          { data: 'ovg_budget',          render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
          { data: 'totaal_inzetbaar',    render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
          { data: 'totaal_inzetbaar_pd', render: $.fn.dataTable.render.number('.', ',', 2, '€ '), className: 'text-end' },
          {
            data: 'peildatum',
            render: function (data, type) {
              if (!data) return data;
              const [d, m, y] = data.split('-');
              const iso = `${y}-${m}-${d}`;
              if (type === 'sort' || type === 'type') return iso;
              return data;
            }
          },
          { data: 'days_to_peildatum', className: 'text-end' }
        ]
      });
    }
  }

  // 6) Users admin (Select2 + submit), alleen als form aanwezig
  if (document.getElementById('userActiveForm')) {
    // Init Select2
    if (typeof window.jQuery !== 'undefined' && $('#userSelect').length) {
      $('#userSelect').select2({
        placeholder: 'Gebruikers ophalen...',
        allowClear: true
      });
    }

    await loadUsers();

    document.getElementById('userActiveForm').addEventListener('submit', onSubmit);
  }
}

// ===== Users admin helpers =====
async function loadUsers(onlyActive = 0) {
  try {
    const res = await fetch(`/api/getuserdata?onlyActive=${onlyActive ? 1 : 0}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Kon gebruikers niet laden');
    const users = await res.json();

    if (typeof window.jQuery === 'undefined') return;
    const $sel = $('#userSelect');
    if (!$sel.length) return;

    $sel.empty();

    users.forEach(u => {
      const text = `${u.username} ${u.active ? '(actief)' : '(inactief)'}`;
      const option = new Option(text, u.user_id, false, false);
      $sel.append(option);
    });

    $sel.trigger('change');
  } catch (e) {
    window.showAlert?.('danger', e.message);
  }
}

async function onSubmit(e) {
  e.preventDefault();

  if (typeof window.jQuery === 'undefined') return;

  var userId = parseInt($('#userSelect').val(), 10);
  if (!userId) {
    window.showAlert?.('warning', 'Selecteer een gebruiker.');
    return;
  }

  var selectedText = $('#userSelect option:selected').text();
  var active = parseInt(document.querySelector('input[name="active"]:checked').value, 10);
  var actionText = active === 1 ? 'ACTIVEREN' : 'DEACTIVEREN';

  var ok = window.confirm('Weet je zeker dat je de gebruiker "' + selectedText + '" wilt ' + actionText + '?');
  if (!ok) return;

  var submitBtn = document.querySelector('#userActiveForm button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const resp = await fetch('/api/user_setactive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: userId, active: active })
    });

    console.log('user_setactive status:', resp.status);

    let payloadText = '';
    try {
      payloadText = await resp.text(); // eerst tekst ophalen
    } catch (_) {}

    console.log('response headers:', [...resp.headers.entries()]);

    if (!resp.ok) {
      let errMsg = '';
      try {
        const maybeJson = JSON.parse(payloadText || '{}');
        errMsg = maybeJson.error || maybeJson.message || payloadText || 'Onbekende fout';
      } catch (e2) {
        errMsg = payloadText || ('HTTP ' + resp.status);
      }
      throw new Error(errMsg);
    }

    // Succes
    window.showAlert?.('success', 'Status opgeslagen.');
    await loadUsers(0);
  } catch (err) {
    console.error('user_setactive error:', err);
    window.showAlert?.('danger', err.message || 'Onbekende fout bij opslaan');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}