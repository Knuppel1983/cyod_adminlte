      // Maak showAlert globaal (werkt ook met type="module")
window.showAlert = function (type, msg) {
  var id = 'alert-' + Date.now();

  // Nieuwe regels omzetten naar <br>
  var htmlMsg = String(msg).replace(/\n/g, '<br>');

  var html =
    '<div id="' + id + '" class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
      htmlMsg +
    '</div>';

  var container = document.getElementById('alertContainer');
  if (!container) {
    alert(msg);
    return;
  }
  container.insertAdjacentHTML('beforeend', html);

  setTimeout(function () {
    var el = document.getElementById(id);
    if (el) {
      try { $(el).alert('close'); } catch (_) { el.remove(); }
    }
  }, 6000);
};
``