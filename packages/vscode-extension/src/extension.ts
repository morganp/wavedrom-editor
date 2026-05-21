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
      async (uri: vscode.Uri, range: vscode.Range, source: string) => {
        // Phase 2 — open a webview panel scoped to this fenced block.
        // The panel uses the same embed SDK; on save we write the new JSON
        // back into the document at `range`.
        const panel = vscode.window.createWebviewPanel(
          'wavedrom.fencedBlock',
          'WaveDrom (fenced block)',
          vscode.ViewColumn.Beside,
          { enableScripts: true, retainContextWhenHidden: true }
        );
        const doc = await vscode.workspace.openTextDocument(uri);
        const initial = source;

        panel.webview.html = WavedromEditorProvider.getHtml(ctx, panel.webview);
        panel.webview.onDidReceiveMessage(async (m) => {
          if (m.type === 'hello') {
            panel.webview.postMessage({ type: 'init', payload: { initial } });
          } else if (m.type === 'change') {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, range, m.payload.jsonText);
            await vscode.workspace.applyEdit(edit);
          }
        });
      }
    )
  );
}

export function deactivate() {}

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
    panel.webview.options = { enableScripts: true };
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
            payload: { initial: document.getText() },
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
        content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${uri('embed.css')}" />
  <style>
    :root {
      --bg:     var(--vscode-editor-background, #fafaf7);
      --panel:  var(--vscode-editorWidget-background, #ffffff);
      --ink:    var(--vscode-editor-foreground, #1f2328);
      --ink-2:  var(--vscode-descriptionForeground, #4a5057);
      --ink-3:  var(--vscode-disabledForeground, #8a8f96);
      --line:   var(--vscode-editorWidget-border, #e7e6e1);
      --line-2: var(--vscode-panel-border, #ededea);
      --accent: var(--vscode-focusBorder, #2860b8);
      --warn:   var(--vscode-editorWarning-foreground, #b8702c);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${uri('embed.js')}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    WavedromEditor.postMessageHost(document.getElementById('root'), {
      targetWindow: { postMessage: (m) => vscode.postMessage(m) },
    });
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
