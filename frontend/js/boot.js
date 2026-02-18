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