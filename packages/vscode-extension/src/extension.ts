// extension.ts — VS Code extension entry for WaveDrom Visual Editor.
//
// Responsibilities:
//   1. Register a CustomTextEditorProvider for *.wavedrom.json files
//      (Phase 1 — canonical file format).
//   2. Provide a CodeLens above ```wavedrom``` fenced blocks in markdown
//      that opens the visual editor scoped to that range
//      (Phase 2 — markdown layer).
//
// The webview hosts the shared embed bundle (../media/embed.html) and
// communicates via the standard postMessage SDK contract:
//   inbound:  { type: 'init',    payload: { initial, readonly } }
//             { type: 'setJson', payload: '...' }
//   outbound: { type: 'hello' | 'ready' | 'change' | 'command', payload? }

import * as vscode from 'vscode';

const VIEW_TYPE = 'wavedrom.editor';

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new WavedromEditorProvider(ctx), {
      webviewOptions: { retainContextWhenHidden: true },
    }),

    vscode.languages.registerCodeLensProvider(
      { language: 'markdown' },
      new WavedromMarkdownLens()
    ),

    vscode.commands.registerCommand('wavedrom.openAsDiagram', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;
      await vscode.commands.executeCommand('vscode.openWith', ed.document.uri, VIEW_TYPE);
    }),

    vscode.commands.registerCommand('wavedrom.editFencedBlock',
      (uri: vscode.Uri, range: vscode.Range, source: string) => {
        const panel = vscode.window.createWebviewPanel(
          'wavedrom.fencedBlock',
          'WaveDrom (fenced block)',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'media')],
          }
        );
        panel.webview.html = WavedromEditorProvider.getHtml(ctx, panel.webview);
        // Capture only the start position — the end moves as content changes.
        const contentStart = range.start;
        panel.webview.onDidReceiveMessage(async (m) => {
          if (m.type === 'hello') {
            panel.webview.postMessage({ type: 'init', payload: { initial: normalizeJson(source) } });
          } else if (m.type === 'change') {
            const doc = await vscode.workspace.openTextDocument(uri);
            // Re-scan from contentStart to find the current closing fence.
            let endLine = contentStart.line;
            while (endLine < doc.lineCount && doc.lineAt(endLine).text.trimEnd() !== '```') {
              endLine++;
            }
            const currentRange = new vscode.Range(contentStart, new vscode.Position(endLine, 0));
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, currentRange, m.payload.jsonText + '\n');
            await vscode.workspace.applyEdit(edit);
          }
        });
      }
    )
  );
}

export function deactivate() {}

// WaveDrom files often use relaxed JS object syntax (unquoted keys).
// Normalize to strict JSON on the extension host so the webview gets valid JSON.
function detectIndent(source: string): string | number {
  const m = source.match(/\n(\s+)/);
  if (!m) return 0;
  return m[1][0] === '\t' ? '\t' : m[1].length;
}

function jsonStringify(value: unknown, indent: string | number, depth = 0): string {
  if (!indent) return JSON.stringify(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const compact = JSON.stringify(value);
  if ((compact?.length ?? 0) <= 80) return compact ?? 'null';
  const unit = typeof indent === 'number' ? ' '.repeat(indent) : indent;
  const pad = unit.repeat(depth + 1);
  const outer = unit.repeat(depth);
  if (Array.isArray(value)) {
    const items = value.map((v: unknown) => pad + jsonStringify(v, indent, depth + 1));
    return '[\n' + items.join(',\n') + '\n' + outer + ']';
  }
  const items = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
    pad + JSON.stringify(k) + ': ' + jsonStringify(v, indent, depth + 1));
  return '{\n' + items.join(',\n') + '\n' + outer + '}';
}

function normalizeJson(source: string): string {
  try {
    JSON.parse(source);
    return source;
  } catch {
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function('return (' + source + ')')();
      return jsonStringify(obj, detectIndent(source));
    } catch {
      return source;
    }
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) nonce += chars[Math.floor(Math.random() * chars.length)];
  return nonce;
}

// ── Custom editor for *.wavedrom.json ─────────────────────────────
class WavedromEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private ctx: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
    };
    panel.webview.html = WavedromEditorProvider.getHtml(this.ctx, panel.webview);

    // External edits to the file → push to the webview, unless they were ours.
    let ourEdit = false;
    const sub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (ourEdit) { ourEdit = false; return; }
      panel.webview.postMessage({ type: 'setJson', payload: document.getText() });
    });
    panel.onDidDispose(() => sub.dispose());

    panel.webview.onDidReceiveMessage(async (m) => {
      switch (m?.type) {
        case 'hello':
          panel.webview.postMessage({
            type: 'init',
            payload: { initial: normalizeJson(document.getText()) },
          });
          break;
        case 'change': {
          const text = m.payload?.jsonText ?? '';
          if (text === document.getText()) return;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            text
          );
          ourEdit = true;
          await vscode.workspace.applyEdit(edit);
          break;
        }
        case 'command':
          if (m.payload?.type === 'save') await document.save();
          break;
      }
    });
  }

  static getHtml(ctx: vscode.ExtensionContext, webview: vscode.Webview): string {
    const media = vscode.Uri.joinPath(ctx.extensionUri, 'media');
    const uri = (...parts: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(media, ...parts)).toString();
    const nonce = getNonce();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};" />
  <link rel="stylesheet" href="${uri('embed.css')}" />
</head>
<body>
  <pre id="dbg" style="font:11px monospace;padding:4px;background:#222;color:#0f0;max-height:60px;overflow:auto">WaveDrom Visual Editor v0.5.0</pre>
  <div id="root"></div>
  <script nonce="${nonce}" src="${uri('embed.js')}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const dbg = document.getElementById('dbg');
    let editorApi = null;
    window.addEventListener('message', function(ev) {
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'init') {
        const initial = m.payload && m.payload.initial;
        if (!initial) dbg.textContent += '\\nWARN: no content received';
        editorApi = WavedromEditor.mount(document.getElementById('root'), {
          initial: initial,
          embedded: true,
          onChange: function(json, jsonText) { vscode.postMessage({ type: 'change', payload: { json, jsonText } }); },
          onCommand: function(cmd) { vscode.postMessage({ type: 'command', payload: cmd }); },
        });
      } else if (m.type === 'setJson' && editorApi) {
        editorApi.setJson(m.payload);
      }
    });
    vscode.postMessage({ type: 'hello' });
  </script>
</body>
</html>`;
  }
}

// ── Markdown fenced-block CodeLens (Phase 2) ──────────────────────
class WavedromMarkdownLens implements vscode.CodeLensProvider {
  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const re = /^```wavedrom\s*$([\s\S]*?)^```\s*$/gm;
    const text = doc.getText();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = doc.positionAt(m.index + m[0].indexOf('\n') + 1);
      const end   = doc.positionAt(m.index + m[0].lastIndexOf('```'));
      const range = new vscode.Range(start, end);
      lenses.push(new vscode.CodeLens(range, {
        title: '$(edit) Edit visually',
        command: 'wavedrom.editFencedBlock',
        arguments: [doc.uri, range, m[1]],
      }));
    }
    return lenses;
  }
}
