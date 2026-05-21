// dialog.js — WaveDrom macro view init + AUI Dialog2 editor launcher.
// Loaded as part of the wavedrom.view web-resource context on every page
// that contains a wavedrom macro.
//
// Responsibilities:
//   1. Render SVG into each .wavedrom-preview using the lightweight view.js bundle.
//   2. Wire the Edit button to open an AUI Dialog2 that mounts the full editor.
//   3. Lazy-load the embed bundle (524 KB) only on first edit click.
//   4. On save, update the macro body via the Confluence REST API and
//      refresh the inline preview without a full page reload.

(function (AJS, $) {
  'use strict';

  // URL of the embed bundle served via the plugin web-resource download path.
  var PLUGIN_KEY = 'com.example.wavedrom.wavedrom-editor';
  var EMBED_JS_URL  = '/download/resources/' + PLUGIN_KEY + ':wavedrom-editor-bundle/embed.js';
  var EMBED_CSS_URL = '/download/resources/' + PLUGIN_KEY + ':wavedrom-editor-bundle/embed.css';

  var embedLoaded  = false;
  var embedLoading = null; // Promise

  // ── 1. Init all wavedrom macros on the page ────────────────────────

  AJS.toInit(function () {
    document.querySelectorAll('.wavedrom-macro-container').forEach(initMacro);
  });

  function initMacro(container) {
    var preview = container.querySelector('.wavedrom-preview');
    var json    = container.dataset.wavedromeJson || '{}'; // note: dataset auto-camelCases
    // dataset key for data-wavedrom-json is wavedromeJson — but let's read it safely:
    json = container.getAttribute('data-wavedrom-json') || '{}';

    if (preview && window.WavedromView) {
      try {
        preview.innerHTML = WavedromView.renderDiagram(json);
      } catch (e) {
        preview.innerHTML = '<span style="color:#b13a3a;font-size:12px;">Render error: ' + e.message + '</span>';
      }
    }

    var editBtn = container.querySelector('.wavedrom-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        openEditorDialog(container, json, function (newJson) {
          // Update in-memory JSON and re-render preview
          container.setAttribute('data-wavedrom-json', newJson);
          json = newJson;
          if (preview && window.WavedromView) {
            try { preview.innerHTML = WavedromView.renderDiagram(newJson); } catch (e) {}
          }
        });
      });
    }
  }

  // ── 2. Lazy-load the embed bundle ─────────────────────────────────

  function loadEmbedBundle() {
    if (embedLoaded) return Promise.resolve();
    if (embedLoading) return embedLoading;

    embedLoading = new Promise(function (resolve, reject) {
      // CSS
      var link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = EMBED_CSS_URL;
      document.head.appendChild(link);

      // JS
      var script = document.createElement('script');
      script.src = EMBED_JS_URL;
      script.onload = function () { embedLoaded = true; resolve(); };
      script.onerror = function () { reject(new Error('Failed to load WaveDrom editor bundle')); };
      document.head.appendChild(script);
    });

    return embedLoading;
  }

  // ── 3. AUI Dialog2 editor modal ───────────────────────────────────

  var DIALOG_ID = 'wavedrom-editor-dialog';
  var editorApi = null;

  function openEditorDialog(container, initialJson, onSave) {
    loadEmbedBundle().then(function () {
      if (!document.getElementById(DIALOG_ID)) {
        $('body').append(
          '<section id="' + DIALOG_ID + '" class="aui-dialog2 aui-dialog2-xlarge aui-layer" role="dialog">' +
            '<header class="aui-dialog2-header">' +
              '<h2 class="aui-dialog2-header-main">WaveDrom Editor</h2>' +
              '<a class="aui-dialog2-header-close">' +
                '<span class="aui-icon aui-icon-small aui-iconfont-close-dialog">Close</span>' +
              '</a>' +
            '</header>' +
            '<div class="aui-dialog2-content" style="padding:0;height:70vh;overflow:hidden">' +
              '<div id="wavedrom-editor-root" style="height:100%"></div>' +
            '</div>' +
            '<footer class="aui-dialog2-footer">' +
              '<div class="aui-dialog2-footer-actions">' +
                '<button id="wavedrom-dialog-save" class="aui-button aui-button-primary">Save</button>' +
                '<button id="wavedrom-dialog-cancel" class="aui-button aui-button-link">Cancel</button>' +
              '</div>' +
              '<div class="aui-dialog2-footer-hint" id="wavedrom-dialog-status"></div>' +
            '</footer>' +
          '</section>'
        );
      }

      var dialog  = AJS.dialog2('#' + DIALOG_ID);
      var root    = document.getElementById('wavedrom-editor-root');
      var status  = document.getElementById('wavedrom-dialog-status');
      var latestJson = initialJson;

      root.innerHTML = '';
      if (editorApi) { try { editorApi.destroy(); } catch (e) {} }

      editorApi = WavedromEditor.mount(root, {
        initial:  initialJson,
        embedded: true,
        onChange: function (_json, jsonText) { latestJson = jsonText; },
      });

      dialog.show();

      $('#wavedrom-dialog-save').off('click').on('click', function () {
        var contentId = AJS.params.pageId;
        if (!contentId) {
          setStatus(status, 'error', 'Cannot determine page ID. Copy the JSON and save manually.');
          return;
        }
        setStatus(status, 'info', 'Saving…');
        saveMacroBody(contentId, container, latestJson, function (err) {
          if (err) {
            setStatus(status, 'error', 'Save failed: ' + err);
          } else {
            onSave(latestJson);
            setStatus(status, '', '');
            dialog.hide();
          }
        });
      });

      $('#wavedrom-dialog-cancel').off('click').on('click', function () {
        dialog.hide();
      });
    }).catch(function (err) {
      AJS.flag({ type: 'error', title: 'WaveDrom', body: 'Could not load editor: ' + err.message });
    });
  }

  function setStatus(el, type, msg) {
    el.textContent = msg;
    el.style.color = type === 'error' ? '#b13a3a' : '#5a6068';
  }

  // ── 4. Save via Confluence REST API ───────────────────────────────

  function saveMacroBody(contentId, container, jsonText, callback) {
    $.ajax({
      url:      '/rest/api/content/' + contentId + '?expand=body.storage,version',
      type:     'GET',
      dataType: 'json',
    }).then(function (page) {
      var storage    = page.body.storage.value;
      var instanceId = container.id; // e.g. "wd-abc12345"
      var updated    = replaceMacroBody(storage, instanceId, jsonText);

      return $.ajax({
        url:         '/rest/api/content/' + contentId,
        type:        'PUT',
        contentType: 'application/json',
        data:        JSON.stringify({
          version: { number: page.version.number + 1 },
          title:   page.title,
          type:    page.type,
          body: {
            storage: { value: updated, representation: 'storage' },
          },
        }),
      });
    }).then(function () {
      callback(null);
    }).fail(function (xhr) {
      callback(xhr.responseText || 'HTTP ' + xhr.status);
    });
  }

  // Replace the plain-text body of the first wavedrom macro whose rendered
  // instanceId matches. Confluence storage format:
  //   <ac:structured-macro ac:name="wavedrom" ...>
  //     <ac:plain-text-body><![CDATA[...]]></ac:plain-text-body>
  //   </ac:structured-macro>
  //
  // Because storage XML doesn't carry the runtime instanceId, we replace
  // the first occurrence. For pages with multiple wavedrom macros this is
  // a known limitation — a future enhancement would use ac:macro-id.
  function replaceMacroBody(storage, _instanceId, jsonText) {
    var safe = jsonText.replace(/\]\]>/g, ']]]]><![CDATA[>');
    return storage.replace(
      /(<ac:structured-macro[^>]*\bac:name="wavedrom"[^>]*>(?:(?!<ac:structured-macro).)*?<ac:plain-text-body>)<!\[CDATA\[[\s\S]*?\]\]>(<\/ac:plain-text-body>)/,
      '$1<![CDATA[' + safe + ']]>$2'
    );
  }

}(AJS, AJS.$));
