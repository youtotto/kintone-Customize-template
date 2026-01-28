(function () {
  'use strict';

  const CONFIG = {
    SUBTABLE_CODE: '撮影明細',
    TARGET_RICHTEXT_CODE: '撮影明細サマリー',

    COLUMNS: [
      { label: '氏名',     code: '氏名' },
      { label: '種別', code: 'SATUKB' },
      { label: '続柄',     code: '続柄' },
      { label: '年齢', code: '年齢' },
    ],

    // ← 文字列のみ：行内の「顧客レコード番号」で appId=6 をリンク
    LINK_SPECS: [
      { textCode: '氏名', idCode: '顧客レコード番号', appId: 6 },
    ],

    // ← 非表示にしたいフィールド（LINK_SPECSとは独立）
    HIDE_FIELD_CODES: [
      'KOKNO',
      '顧客レコード番号',
      'AGECALC_BIRTHD',
      // '内部メモ',
      // '非公開フラグ',
    ],

    NUMERIC_COLS: new Set(['年齢', 'KOKCD']),
    skipIf: (_row) => false,
  };

  // ========== Utils ==========
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const toNum = (v) => {
    const raw = (typeof v === 'object' && v && 'value' in v) ? v.value : v;
    const n = Number(String(raw ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const recordUrl = (appId, recId) => `${location.origin}/k/${appId}/show#record=${recId}`;

  // textCode → spec
  const linkSpecByTextCode = Object.fromEntries(
    (CONFIG.LINK_SPECS || []).map(s => [s.textCode, s])
  );

  function cellText(row, code) {
    const f = row?.[code];
    if (!f) return '';
    const v = f.value;
    if (Array.isArray(v)) return v.map(e => e?.name ?? e?.code ?? e).join(', ');
    if (typeof v === 'number') return String(v);
    return String(v ?? '');
  }

  // 文字列idCodeのみ想定のリンク生成
  function renderCellHtml(row, code) {
    const text = cellText(row, code);
    const spec = linkSpecByTextCode[code]; // 例：氏名セルのリンク仕様
    if (spec?.idCode) {
      const recId = toNum(row?.[spec.idCode]?.value);
      if (recId > 0) {
        const href = recordUrl(spec.appId, recId);
        return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text || `#${recId}`)}</a>`;
      }
    }
    return esc(text);
  }

  function buildHtmlTable(record) {
    const st = record[CONFIG.SUBTABLE_CODE]?.value || [];
    const rows = [];

    for (const r of st) {
      const row = r?.value || {};
      if (CONFIG.skipIf(row)) continue;

      const tds = CONFIG.COLUMNS.map(({ code }) => {
        const valHtml = renderCellHtml(row, code);
        const right = CONFIG.NUMERIC_COLS.has(code) ? 'text-align:right;' : '';
        return `<td style="padding:6px 10px; ${right}">${valHtml}</td>`;
      });

      rows.push(`<tr>${tds.join('')}</tr>`);
    }

    if (!rows.length) return '';

    const thead = `
      <thead>
        <tr>
          ${CONFIG.COLUMNS.map(({ label }) =>
            `<th style="text-align:left; padding:8px 10px; border-bottom:1px solid #ddd;">${esc(label)}</th>`
          ).join('')}
        </tr>
      </thead>`.trim();

    const tbody = `<tbody>${rows.join('')}</tbody>`;

    return `
      <div>
        <table style="border-collapse:collapse; width:100%; max-width:100%;">
          ${thead}
          ${tbody}
        </table>
      </div>
    `.trim();
  }

  // ===== 画面表示時：任意フィールドの非表示 & リッチテキスト編集不可 =====
  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show',
    'mobile.app.record.create.show',
    'mobile.app.record.edit.show',
    'mobile.app.record.detail.show'
  ], (event) => {
    const rec = event.record;

    if (rec[CONFIG.TARGET_RICHTEXT_CODE]) {
      rec[CONFIG.TARGET_RICHTEXT_CODE].disabled = true;
    }

    const toHide = Array.from(new Set(CONFIG.HIDE_FIELD_CODES || []));
    toHide.forEach(code => {
      try { kintone.app.record.setFieldShown(code, false); } catch {}
    });

    return event;
  });

  // ===== 保存時：サマリーHTMLを書き込み =====
  kintone.events.on([
    'app.record.create.submit',
    'app.record.edit.submit',
    'mobile.app.record.create.submit',
    'mobile.app.record.edit.submit'
  ], (event) => {
    const rec = event.record;
    const html = buildHtmlTable(rec);
    if (rec[CONFIG.TARGET_RICHTEXT_CODE]) {
      rec[CONFIG.TARGET_RICHTEXT_CODE].value = html;
      rec[CONFIG.TARGET_RICHTEXT_CODE].disabled = true;
    }
    return event;
  });

})();