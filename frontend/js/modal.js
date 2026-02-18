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