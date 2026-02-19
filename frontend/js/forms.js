
      // Bind éénmalig een submit-handler aan een formulier-id (als het bestaat)
      function bindFormSubmit(formId, handler) {
        const form = document.getElementById(formId);
        if (!form) return;                           // formulier ontbreekt op deze pagina → klaar
        if (form.__onSubmitBound) return;            // voorkom dubbele binding
        form.addEventListener('submit', handler);
        form.__onSubmitBound = true;
      }


      async function init() {
        // === Select2 init (ongewijzigd) ===
        const hasJQ = typeof window.jQuery !== 'undefined';
        const $userSelect = hasJQ ? $('#userSelect') : null;
        const hasUserSelect = !!($userSelect && $userSelect.length);

        if (hasUserSelect && typeof $.fn.select2 === 'function') {
          $userSelect.select2({ placeholder: 'Bezig met ophalen gebruikers...', allowClear: true });
          try { await loadUsers(); }
          catch (e) { console.error('[init] loadUsers() faalde:', e); window.showAlert?.('danger', 'Kon gebruikers niet ophalen.'); }
        } else {
          if (!hasUserSelect) console.debug('[init] #userSelect niet aanwezig — sla Select2/init over');
          else console.warn('[init] Select2 plugin niet beschikbaar — sla Select2/init over');
        }

        // === Form bindings ===
        bindFormSubmit('userActiveForm', onSubmitUserActive); // jouw bestaande pagina
        bindFormSubmit('newUserForm', onSubmitNewUser);       // nieuwe pagina

        // Je kunt hier zonder zorgen meerdere bindFormSubmit-aanroepen doen; als het formulier
        // niet bestaat op deze pagina, gebeurt er niets.
      }



      async function init() {
        const hasJQ = typeof window.jQuery !== 'undefined';
        const $userSelect = hasJQ ? $('#userSelect') : null;
        const hasUserSelect = !!($userSelect && $userSelect.length);

        if (hasUserSelect && typeof $.fn.select2 === 'function') {
          // 👉 lees de flag uit de host-wrapper
          const host = document.getElementById('userSelectHost');
          const onlyActive = host?.dataset?.onlyActive === '1';

          $userSelect.select2({ placeholder: 'Bezig met ophalen gebruikers...', allowClear: true });
          try {
            // 👉 roep je bestaande loader aan met de juiste flag
            await loadUsers(onlyActive ? 1 : 0);
          } catch (e) {
            console.error('[init] loadUsers() faalde:', e);
            window.showAlert?.('danger', 'Kon gebruikers niet ophalen.');
          }
        } else {
          if (!hasUserSelect) console.debug('[init] #userSelect niet aanwezig — sla Select2/init over');
          else console.warn('[init] Select2 plugin niet beschikbaar — sla Select2/init over');
        }

        // Bestaande form-bindings mogen blijven staan
        bindFormSubmit('userActiveForm', onSubmitUserActive);
        bindFormSubmit('newUserForm', onSubmitNewUser);
      }



      
      
      
       async function loadUsers(onlyActive = 0) {
         try {
           const res = await fetch(`/api/getuserdata?onlyActive=${onlyActive ? 1 : 0}`, { credentials: 'include' });
           if (!res.ok) throw new Error('Kon gebruikers niet laden');
          let users = await res.json();
          // (optioneel maar robuust) client-side filter als extra vangnet:
          if (onlyActive) { users = users.filter(u => u.active); }

           if (typeof window.jQuery === 'undefined') return;
           const $sel = $('#userSelect');
           if (!$sel.length) return;

           $sel.empty();
          // Map voor snelle lookup (globaal opslaan)
          window.__usersById = Object.create(null);

          users.forEach(u => {
            const text = `${u.username} ${u.active ? '(actief)' : '(inactief)'}`;
            const opt = new Option(text, u.user_id, false, false);
            // status zichtbaar maken aan de client
            opt.dataset.active = u.active ? '1' : '0';
            $sel.append(opt);
            window.__usersById[u.user_id] = u;
          });

           $sel.trigger('change');
         } catch (e) {
           window.showAlert?.('danger', e.message);
         }
       }
            
      
      
      
      
      function updateToggleButtonFromSelection() {
        const $sel = (typeof window.jQuery !== 'undefined') ? $('#userSelect') : null;
        const btn = document.getElementById('toggleActiveBtn');
        const target = document.getElementById('targetActive');
        if (!$sel || !$sel.length || !btn || !target) return;

        const userId = parseInt($sel.val(), 10);
        if (!userId) {
          // geen selectie: terug naar default
          btn.textContent = 'Activeren';
          btn.classList.remove('btn-outline-success');
          btn.classList.add('btn-outline-danger');
          target.value = '1';
          return;
        }

        // 1) eerst kijken of het option data-active heeft
        const opt = $sel.find('option:selected')[0];
        let isActive = false;
        if (opt && typeof opt.dataset?.active !== 'undefined') {
          isActive = opt.dataset.active === '1';
        } else if (window.__usersById && window.__usersById[userId]) {
          // 2) anders uit de map
          isActive = !!window.__usersById[userId].active;
        }

        if (isActive) {
          // user is actief -> knop voor "Deactiveren" en targetActive=0
          btn.textContent = 'Deactiveren';
          btn.classList.remove('btn-outline-danger');
          btn.classList.add('btn-outline-success');
          target.value = '0';
        } else {
          // user is inactief -> knop voor "Activeren" en targetActive=1
          btn.textContent = 'Activeren';
          btn.classList.remove('btn-outline-success');
          btn.classList.add('btn-outline-danger');
          target.value = '1';
        }
      }
      
      
      
      
      
      
      


      // === A) Bestaande handler voor user activeren/deactiveren ===
      async function onSubmitUserActive(e) {
        e.preventDefault();

        // Defensief: jQuery + element check
        if (typeof window.jQuery === 'undefined' || !$('#userSelect').length) {
          window.showAlert?.('warning', 'Selecteer een gebruiker.');
          return;
        }

        const userId = parseInt($('#userSelect').val(), 10);
        if (!userId) {
          window.showAlert?.('warning', 'Selecteer een gebruiker.');
          return;
        }

        const selectedText = $('#userSelect option:selected').text();
        const active = parseInt(document.querySelector('input[name="active"]:checked').value, 10);
        const actionText = active === 1 ? 'ACTIVEREN' : 'DEACTIVEREN';

        const ok = await confirmModal(
          `Weet je zeker dat je de gebruiker "${selectedText}" wilt ${actionText}?`,
          { title: 'Bevestigen', confirmText: 'Ja, uitvoeren', cancelText: 'Nee, annuleren', size: 'modal-sm' }
        );
        if (!ok) return;

        const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
          const resp = await fetch('/api/user_setactive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, active })
          });

          let payloadText = '';
          try { payloadText = await resp.text(); } catch {}

          if (!resp.ok) {
            let errMsg = '';
            try {
              const maybeJson = JSON.parse(payloadText || '{}');
              errMsg = maybeJson.error || maybeJson.message || payloadText || 'Onbekende fout';
            } catch {
              errMsg = payloadText || ('HTTP ' + resp.status);
            }
            throw new Error(errMsg);
          }

          window.showAlert?.('success', 'Status opgeslagen.');
          await loadUsers(0);
        } catch (err) {
          console.error('user_setactive error:', err);
          window.showAlert?.('danger', err.message || 'Onbekende fout bij opslaan');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }

      // === B) Nieuwe handler voor "Nieuwe gebruiker" formulier ===
      async function onSubmitNewUser(e) {
        e.preventDefault();

        const form = e.currentTarget;
        const submitBtn = e.submitter || form.querySelector('button[type="submit"]');

        const username = (form.querySelector('#username')?.value || '').trim();
        if (!username) {
          window.showAlert?.('warning', 'Vul een gebruikersnaam in (formaat: voornaam.achternaam).');
          form.querySelector('#username')?.focus();
          return;
        }

        // Optioneel: basisvalidatie op het gewenste formaat
        // if (!/^[a-z0-9]+(?:\.[a-z0-9]+)+$/i.test(username)) {
        //   window.showAlert?.('warning', 'Gebruik het formaat voornaam.achternaam');
        //   return;
        // }

        const ok = await confirmModal(
          `Nieuwe gebruiker "${username}" aanmaken?`,
          { title: 'Bevestigen', confirmText: 'Aanmaken', cancelText: 'Annuleren', size: 'modal-sm' }
        );
        if (!ok) return;

        if (submitBtn) submitBtn.disabled = true;

        try {
          const resp = await fetch('/api/user_create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
          });

          let payloadText = '';
          try { payloadText = await resp.text(); } catch {}

          if (!resp.ok) {
            let errMsg = '';
            try {
              const maybeJson = JSON.parse(payloadText || '{}');
              errMsg = maybeJson.error || maybeJson.message || payloadText || 'Onbekende fout';
            } catch {
              errMsg = payloadText || ('HTTP ' + resp.status);
            }
            throw new Error(errMsg);
          }

          window.showAlert?.('success', `Gebruiker "${username}" is aangemaakt.`);
          // formulier leegmaken
          form.reset();
        } catch (err) {
          console.error('user_create error:', err);
          window.showAlert?.('danger', err.message || 'Aanmaken is mislukt');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }
      document.addEventListener('DOMContentLoaded', init);
