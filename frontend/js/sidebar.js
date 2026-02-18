      async function loadSidebar(hostId, url) {
        const host = document.getElementById(hostId);
        if (!host) return;

        try {
          // Zet cache policy naar wens. In dev: no-cache. In prod: default of 'force-cache'.
          const res = await fetch(`${url}?v=20260218`, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();
          host.innerHTML = html;

          // === ACTIVE LINK DETECTIE ===
          // Normaliseer huidige pad: verwijder trailing '/index.html' en trailing slash.
          const current = normalizePath(location.pathname);

          // Markeer actieve link
          const links = host.querySelectorAll('a.nav-link[href]');
          let activeLink = null;

          // 1) Exacte match eerst
          for (const a of links) {
            const href = normalizePath(a.getAttribute('href'));
            if (href && href === current) { activeLink = a; break; }
          }

          // 2) Falls back: longest prefix match (handig voor sectie root)
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

          // === ADMINLTE RE-INIT (indien nodig) ===
          // AdminLTE v3/v4: treeview werkt via data-widget="treeview".
          // Als je het gevoel hebt dat de dropdowns niet reageren, kun je (afhankelijk van versie)
          // een (re)init forceren. Vaak is het niet nodig, omdat het via event delegation werkt.
          // Voor sommige bundles helpt dit:
          if (window.jQuery && window.$ && $.fn.Treeview) {
            // jQuery initialisatie fallback (ouder)
            $('[data-widget="treeview"]').Treeview('init');
          } else if (window.AdminLTE && window.AdminLTE.Treeview) {
            // Nieuwere API (indien aanwezig)
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

      // Laad de sidebar
      loadSidebar('sidebar', '/partials/sidebar.html');