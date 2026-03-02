      // Maak showAlert globaal (werkt ook met type="module")
      window.showAlert = function (type, msg) {
        // type: 'success' | 'danger' | 'warning' | 'info' | ...
        var id = 'alert-' + Date.now();
        var html =
          '<div id="' + id + '" class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
            msg +
          '</div>';

        var container = document.getElementById('alertContainer');
        if (!container) {
          // Als de container er niet is, val terug op native alert
          alert(msg);
          return;
        }
        container.insertAdjacentHTML('beforeend', html);

        // Automatisch sluiten na 6 sec
        setTimeout(function () {
          var el = document.getElementById(id);
          if (el) {
            try { $(el).alert('close'); } catch (_) { el.remove(); }
          }
        }, 6000);
      };
      
      
      
      // Globale confirmModal helper (Bootstrap 5 + AdminLTE)
window.confirmModal = function (message, options) {
  options = options || {};
  const titleText    = options.title       || 'Bevestigen';
  const confirmText  = options.confirmText || 'OK';
  const cancelText   = options.cancelText  || 'Annuleren';
  const sizeClass    = options.size        || ''; // bijv. 'modal-sm', 'modal-md', 'modal-lg'

  return new Promise(function (resolve) {
    // 1. Zoek of maak een globale confirm-modal
    let modalEl = document.getElementById('globalConfirmModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'globalConfirmModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');

      modalEl.innerHTML = `
        <div class="modal-dialog ${sizeClass}">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
            </div>
            <div class="modal-body confirm-modal-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary btn-cancel" data-bs-dismiss="modal"></button>
              <button type="button" class="btn btn-primary btn-confirm"></button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    // 2. Elementen ophalen
    const titleEl    = modalEl.querySelector('.modal-title');
    const bodyEl     = modalEl.querySelector('.modal-body');
    const btnCancel  = modalEl.querySelector('.btn-cancel');
    const btnConfirm = modalEl.querySelector('.btn-confirm');
    const dialogEl   = modalEl.querySelector('.modal-dialog');

    // 3. Size class updaten
    dialogEl.className = 'modal-dialog ' + sizeClass;

    // 4. Teksten zetten
    titleEl.textContent    = titleText;
    btnCancel.textContent  = cancelText;
    btnConfirm.textContent = confirmText;

    // 5. Newlines als echte regels tonen
    bodyEl.classList.add('confirm-modal-preline');
    bodyEl.textContent = message; // textContent → veilig, geen HTML injectie

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

    let resolved = false;

    function cleanup(result) {
      if (resolved) return;
      resolved = true;

      btnConfirm.removeEventListener('click', onConfirm);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);

      resolve(result);
    }

    function onConfirm() {
      bsModal.hide();
      cleanup(true);
    }

    function onHidden() {
      // Als user sluit met X of buiten de modal klikt → beschouwen als "Annuleren"
      cleanup(false);
    }

    btnConfirm.addEventListener('click', onConfirm);
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });

    bsModal.show();
  });
};