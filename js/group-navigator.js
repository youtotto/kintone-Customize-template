/*
 * kintone 画面用：ミニ目次（TOC）テンプレート
 * - レコード詳細 / 編集画面に「目次」ボタン＋パネルを表示
 * - グループ見出し（span.group-label-gaia）のテキストを探して、クリックでスクロール
 * - Observer を使わず、複数回 render して kintone の遅延描画に追従
 */
(function () {
  'use strict';

  /* =========================================================================
   * 設定（ここだけ触ればカスタマイズできる）
   * ========================================================================= */
  const CONFIG = {
    // 表示対象：詳細 / 編集
    showOnDetail: true,
    showOnEdit: true,

    // スクロール時の上方向オフセット（kintoneヘッダー分など）
    scrollOffset: 240,

    // 初期状態でパネルを開くか
    openOnInit: true,

    // パネル高さ（vh, px などOK）
    panelHeight: '30vh',

    // 目次項目：text = グループ見出しの表示名（完全一致）
    // level = インデント（階層表現。0/1/2...）
    items: [
      { text: '基本情報', level: 0 },
      { text: '住所', level: 0 },
      { text: '取引履歴', level: 0 },
    ],
  };

  /* =========================================================================
   * DOM ID（重複生成を防ぐため固定IDで管理）
   * ========================================================================= */
  const STYLE_ID = 'toc-mini-style';
  const BTN_ID = 'toc-mini-btn';
  const PANEL_ID = 'toc-mini-panel';

  /* =========================================================================
   * CSS注入：1回だけ head に style を追加
   * ========================================================================= */
  const injectStyle = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    // ※テンプレ公開用：必要最小限のスタイルを直書き
    style.textContent = `
      .toc-btn{
        position:fixed;right:16px;bottom:16px;width:96px;height:40px;line-height:40px;
        background:#007bff;color:#fff;text-align:center;border-radius:8px;font-weight:700;cursor:pointer;
        box-shadow:0 2px 6px rgba(0,0,0,.18);z-index:2001;user-select:none;
      }
      .toc-panel{
        position:fixed;right:16px;bottom:-60vh;width:260px;background:#fff;border:1px solid #e5e7eb;
        border-radius:10px;padding:16px 20px;overflow-y:auto;box-shadow:0 -6px 18px rgba(0,0,0,.18);
        transition:bottom .25s ease;z-index:2000;
      }
      .toc-list{list-style:none;padding:0;margin:0;}
      .toc-list li{margin:6px 0;}
      .toc-link{color:#007bff;text-decoration:none;cursor:pointer;}
      .toc-muted{color:#6b7280;font-size:12px;margin-top:10px;line-height:1.4;}
    `;
    document.head.appendChild(style);
  };

  /* =========================================================================
   * 文字列正規化：空白の揺れを吸収して「完全一致」判定を安定させる
   * ========================================================================= */
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  /* =========================================================================
   * 検索対象：kintone グループ見出し
   * - 詳細/編集画面でグループのラベルが span.group-label-gaia に入る想定
   * ========================================================================= */
  const GROUP_TITLE_SELECTOR = 'span.group-label-gaia';

  /**
   * 指定テキストと「完全一致」するグループ見出し要素を探す
   * - CONFIG.items の text を使って探す
   * - record-gaia（kintoneのレコード領域）があればそこを優先して探索
   */
  function findGroupTitleExact(text) {
    const target = norm(text);
    const root = document.getElementById('record-gaia') || document.body;
    const els = Array.from(root.querySelectorAll(GROUP_TITLE_SELECTOR));

    for (const el of els) {
      if (norm(el.textContent) === target) return el;
    }
    return null;
  }

  /**
   * UI削除：再レンダリング時に重複を作らない
   */
  function removeUi() {
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(BTN_ID)?.remove();
  }

  /**
   * スクロール：対象要素までスムーズに移動
   * - CONFIG.scrollOffset 分だけ上にずらす（固定ヘッダー対策）
   */
  function scrollToEl(el) {
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY - CONFIG.scrollOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  /* =========================================================================
   * メイン描画：ボタン＆パネル生成
   * ========================================================================= */
  function render() {
    // まず既存UIを消してクリーンに作り直す
    removeUi();

    // ボタン（右下固定）
    const btn = document.createElement('div');
    btn.id = BTN_ID;
    btn.className = 'toc-btn';
    btn.textContent = '目次';

    // パネル（右下スライド）
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'toc-panel';
    panel.style.height = CONFIG.panelHeight;

    // 目次リスト
    const ul = document.createElement('ul');
    ul.className = 'toc-list';

    // 検出ログ（表示用）
    const hits = [];
    const misses = [];

    // items をもとに DOM を探して、見つかったものだけ目次化
    CONFIG.items.forEach((item) => {
      const el = findGroupTitleExact(item.text);
      if (!el) {
        misses.push(item.text);
        return;
      }

      hits.push(item.text);

      const li = document.createElement('li');
      li.style.paddingLeft = `${(item.level || 0) * 18}px`; // 階層インデント

      const a = document.createElement('a');
      a.className = 'toc-link';
      a.textContent = item.text;
      a.href = '#';

      // クリックで対象のグループ見出しへスクロール
      a.onclick = (e) => {
        e.preventDefault();
        scrollToEl(el);
      };

      li.appendChild(a);
      ul.appendChild(li);
    });

    panel.appendChild(ul);

    // 開閉制御（bottom のみを動かしてスライド）
    let open = false;
    const openPanel = () => {
      open = true;
      panel.style.bottom = '64px'; // ボタンの上に出す
    };
    const closePanel = () => {
      open = false;
      panel.style.bottom = `-${CONFIG.panelHeight}`; // 見えない位置へ
    };

    btn.onclick = () => (open ? closePanel() : openPanel());

    // record-gaia 内に入れる（なければ body）
    (document.getElementById('record-gaia') || document.body).append(btn, panel);

    // 初期状態
    if (CONFIG.openOnInit) openPanel();
    else closePanel();
  }

  /* =========================================================================
   * 起動：kintoneは描画が段階的に行われることがある
   * - Observer を使わず、数回 render して「後から出てくる要素」を拾う
   * ========================================================================= */
  function boot() {
    render();
    setTimeout(render, 300);
    setTimeout(render, 800);
    setTimeout(render, 1400);
  }

  /* =========================================================================
   * kintoneイベント：詳細/編集表示のタイミングで起動
   * ========================================================================= */
  kintone.events.on(['app.record.detail.show', 'app.record.edit.show'], (ev) => {
    injectStyle();

    if (ev.type === 'app.record.detail.show' && CONFIG.showOnDetail) boot();
    if (ev.type === 'app.record.edit.show' && CONFIG.showOnEdit) boot();

    return ev;
  });
})();
