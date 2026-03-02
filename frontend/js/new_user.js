// /js/new_user.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('newUserForm');
  const nameInput = document.getElementById('newUserName');
  const peildatumInput = document.getElementById('newUserPeildatum');
  const alertContainer = document.getElementById('alertContainer');

  if (!form || !nameInput || !peildatumInput) {
    console.warn('newUserForm of inputs niet gevonden op pagina.');
    return;
  }

  // Submit koppelen aan onze async handler
  form.addEventListener('submit', onSubmitNewUser);

  // -------------------------
  // Handler: submit new user
  // -------------------------
  async function onSubmitNewUser(e) {
    e.preventDefault();
    clearAlerts();

    const form = e.currentTarget;
    const submitBtn = e.submitter || form.querySelector('button[type="submit"]');

    const username = (nameInput.value || '').trim();
    const peildatum = peildatumInput.value; // yyyy-mm-dd

    // Extra client-side checks naast "required"
    if (!username) {
      localShowAlert('danger', 'Naam is verplicht.');
      nameInput.focus();
      return;
    }

    // Formaat-check voor voornaam.achternaam (zelfde idee als in je oude code)
    if (!/^[^.\s]+\.{1}[^.\s]+$/.test(username)) {
      localShowAlert('warning', "Gebruik format 'voornaam.achternaam'.");
      nameInput.focus();
      return;
    }

    if (!peildatum) {
      localShowAlert('danger', 'Peildatum is verplicht.');
      peildatumInput.focus();
      return;
    }

    // Optioneel: peildatum netjes tonen in nl-NL formaat
    const peildatumLabel = new Date(peildatum).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // 🔔 Confirm modal zoals in je oude code
    // confirmModal komt uit /js/modal.js
    const ok = await confirmModal(
      `Nieuwe gebruiker "${username}" aanmaken met peildatum ${peildatumLabel}?`,
      {
        title: 'Bevestigen',
        confirmText: 'Aanmaken',
        cancelText: 'Annuleren',
        size: 'modal-sm'
      }
    );
    if (!ok) return;

    if (submitBtn) submitBtn.disabled = true;

    try {
      const resp = await fetch('/api/newuser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // eventueel credentials: 'include' als je cookies / Easy Auth nodig hebt
        body: JSON.stringify({ username, peildatum })
      });

      let payloadText = '';
      try {
        payloadText = await resp.text();
      } catch {
        payloadText = '';
      }

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

      // Als het wel ok is, nog proberen JSON eruit te halen (optioneel)
      let payload;
      try {
        payload = JSON.parse(payloadText || '{}');
      } catch {
        payload = {};
      }

      const newId = payload.userId ?? payload.NewUserId ?? 'onbekend';

      localShowAlert(
        'success',
        `Gebruiker "${username}" is aangemaakt (ID: ${newId}).`
      );

      form.reset();
    } catch (err) {
      console.error('newuser error:', err);
      localShowAlert('danger', err.message || 'Aanmaken is mislukt');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // -------------------------
  // Helpers
  // -------------------------

  function clearAlerts() {
    if (alertContainer) {
      alertContainer.innerHTML = '';
    }
  }

  /**
   * Laat een melding zien:
   * - via globale window.showAlert(type, message) als die bestaat
   * - én in de lokale #alertContainer als die bestaat
   */
  function localShowAlert(type, message) {
    // 1) Globale alert (bijv. toast / boven in scherm)
    if (typeof window.showAlert === 'function') {
      window.showAlert(type, message);
    }

    // 2) Lokale alert in de kaart
    if (!alertContainer) return;

    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.role = 'alert';
    div.textContent = message;

    alertContainer.appendChild(div);
  }
});