      async function init() {
        // === Minimale check: element + jQuery + plugin ===
        const hasJQ = typeof window.jQuery !== 'undefined';
        const $userSelect = hasJQ ? $('#userSelect') : null;
        const hasUserSelect = !!($userSelect && $userSelect.length);

        if (hasUserSelect && typeof $.fn.select2 === 'function') {
          // Init Select2
          $userSelect.select2({
            placeholder: 'Bezig met ophalen gebruikers...',
            allowClear: true
          });

          // Alleen users laden als de select er ook is
          try {
            await loadUsers();
          } catch (e) {
            console.error('[init] loadUsers() faalde:', e);
            window.showAlert?.('danger', 'Kon gebruikers niet ophalen.');
          }
        } else {
          // Optioneel: logging zodat je weet waarom er niets gebeurde
          if (!hasUserSelect) console.debug('[init] #userSelect niet aanwezig — sla Select2/init over');
          else console.warn('[init] Select2 plugin niet beschikbaar — sla Select2/init over');
        }

        // Event‑handler alleen als formulier bestaat (kleine extra hardening)
        const form = document.getElementById('userActiveForm');
        if (form && !form.__onSubmitBound) {
          form.addEventListener('submit', onSubmit);
          form.__onSubmitBound = true; // voorkom dubbele binding bij herhaaldelijke inits
        }
      }

      async function loadUsers(onlyActive = 0) {
        try {
          const res = await fetch(`/api/getuserdata?onlyActive=${onlyActive ? 1 : 0}`, { credentials: 'include' });
          if (!res.ok) throw new Error('Kon gebruikers niet laden');
          const users = await res.json();

          // Defensief: element opnieuw ophalen en checken
          if (typeof window.jQuery === 'undefined') return;
          const $sel = $('#userSelect');
          if (!$sel.length) return; // als element niet bestaat, niets doen

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

        // Defensief: jQuery + element check
        if (typeof window.jQuery === 'undefined' || !$('#userSelect').length) {
          window.showAlert?.('warning', 'Selecteer een gebruiker.');
          return;
        }

        var userId = parseInt($('#userSelect').val(), 10);
        if (!userId) {
          window.showAlert?.('warning', 'Selecteer een gebruiker.');
          return;
        }

        var selectedText = $('#userSelect option:selected').text();
        var active = parseInt(document.querySelector('input[name="active"]:checked').value, 10);
        var actionText = active === 1 ? 'ACTIVEREN' : 'DEACTIVEREN';


        const ok = await confirmModal(
          `Weet je zeker dat je de gebruiker "${selectedText}" wilt ${actionText}?`,
          {
            title: 'Bevestigen',
            confirmText: 'Ja, uitvoeren',
            cancelText: 'Nee, annuleren',
            size: 'modal-sm' // of '' / 'modal-lg' / 'modal-xl'
          }
        );
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
          try { payloadText = await resp.text(); } catch (_) {}

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

          window.showAlert?.('success', 'Status opgeslagen.');
          await loadUsers(0);
        } catch (err) {
          console.error('user_setactive error:', err);
          window.showAlert?.('danger', err.message || 'Onbekende fout bij opslaan');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }

      document.addEventListener('DOMContentLoaded', init);