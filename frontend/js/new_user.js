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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlerts();

    const username = (nameInput.value || '').trim();
    const peildatum = peildatumInput.value; // yyyy-mm-dd

    // Extra client-side checks naast "required"
    if (!username) {
      showAlert('Naam is verplicht.', 'danger');
      return;
    }

    if (!/^[^.\s]+\.{1}[^.\s]+$/.test(username)) {
      showAlert("Gebruik format 'voornaam.achternaam'.", 'warning');
      return;
    }

    if (!peildatum) {
      showAlert('Peildatum is verplicht.', 'danger');
      return;
    }

    try {
      const resp = await fetch('/api/newuser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          peildatum
          // eventueel straks: courant, contractvorm, leentoestel, active
        })
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data || data.success === false) {
        throw new Error(data.error || 'Onbekende fout bij aanmaken gebruiker.');
      }

      showAlert(
        `Gebruiker '${data.username}' succesvol aangemaakt (ID: ${data.userId}).`,
        'success'
      );

      form.reset();
    } catch (err) {
      console.error(err);
      showAlert(
        `Aanmaken gebruiker is mislukt: ${err.message}`,
        'danger'
      );
    }
  });

  function clearAlerts() {
    if (alertContainer) {
      alertContainer.innerHTML = '';
    }
  }

  function showAlert(message, type) {
    if (!alertContainer) {
      alert(message);
      return;
    }

    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.role = 'alert';
    div.textContent = message;

    alertContainer.appendChild(div);
  }
});