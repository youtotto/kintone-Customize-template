(function () {
  'use strict';

  /**
   * フィールドを「表示/非表示」制御するソース
   * - detail / create / edit で利用可能
   * - ステータスやフィールド値で条件分岐
   */

  // =========================================================
  // 設定（ここだけ触ればOK）
  // =========================================================
  const CONFIG = {
    triggers: [
      'app.record.detail.show',
      'app.record.create.show',
      'app.record.edit.show'
    ],

    rules: [
      // -------------------------
      // 例1: 常に非表示
      // -------------------------
      {
        when: { always: true },
        hide: ['GRP_BASIC', 'KOKCD']
      },

      // -------------------------
      // 例2: ステータスが「顧客登録中」のとき非表示
      // ※プロセス管理のステータスフィールドコードは "ステータス" で event.record に入る前提
      // -------------------------
      {
        when: { statusIn: ['顧客登録中'] },
        hide: ['ADDR1', 'ADDR2']
      },

      // -------------------------
      // 例3: フィールド値で非表示（単一条件）
      // -------------------------
      {
        when: { fieldEq: { code: 'CATEGORY', value: '社内' } },
        hide: ['TEL1']
      },

      // -------------------------
      // 例4: AND条件（複数条件）
      // -------------------------
      {
        when: {
          and: [
            { statusIn: ['確認中', '見積完了'] },
            { fieldNe: { code: 'IS_PUBLIC', value: '公開' } }
          ]
        },
        hide: ['SECRET_MEMO']
      },

      // -------------------------
      // 例5: OR条件（複数条件）
      // -------------------------
      {
        when: {
          or: [
            { fieldEmpty: 'ZIP' },
            { fieldEq: { code: 'COUNTRY', value: 'JP' } }
          ]
        },
        hide: ['OVERSEAS_ADDR']
      }
    ]
  };

  // =========================================================
  // 共通ユーティリティ
  // =========================================================
  function getFieldValue(record, code) {
    if (!record || !record[code]) return undefined;
    const v = record[code].value;

    // フィールド型によって value の形が違うので、よく使うケースを吸収
    // - USER/ORGANIZATION/GROUP: 配列
    // - CHECK_BOX/MULTI_SELECT: 配列
    // - その他: 文字列/数値/真偽/null
    return v;
  }

  function getStatusValue(record) {
    // kintoneのプロセス管理のステータスは、通常 event.record["ステータス"].value で取得できる想定
    // 環境でフィールド名が違う場合はここを変える（例: 'Status'）
    return getFieldValue(record, 'ステータス');
  }

  function isEmptyValue(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'string') return v.trim() === '';
    return false;
  }

  // =========================================================
  // 条件判定
  // =========================================================
  function evalCondition(cond, record) {
    if (!cond) return true;

    // always
    if (cond.always) return true;

    // AND/OR
    if (Array.isArray(cond.and)) return cond.and.every(c => evalCondition(c, record));
    if (Array.isArray(cond.or)) return cond.or.some(c => evalCondition(c, record));

    // status
    if (Array.isArray(cond.statusIn)) {
      const st = getStatusValue(record);
      return cond.statusIn.includes(st);
    }
    if (Array.isArray(cond.statusNotIn)) {
      const st = getStatusValue(record);
      return !cond.statusNotIn.includes(st);
    }

    // field eq/ne
    if (cond.fieldEq) {
      const v = getFieldValue(record, cond.fieldEq.code);
      return v === cond.fieldEq.value;
    }
    if (cond.fieldNe) {
      const v = getFieldValue(record, cond.fieldNe.code);
      return v !== cond.fieldNe.value;
    }

    // field in/notIn
    if (cond.fieldIn) {
      const v = getFieldValue(record, cond.fieldIn.code);
      return cond.fieldIn.values.includes(v);
    }
    if (cond.fieldNotIn) {
      const v = getFieldValue(record, cond.fieldNotIn.code);
      return !cond.fieldNotIn.values.includes(v);
    }

    // empty/notEmpty
    if (cond.fieldEmpty) {
      const v = getFieldValue(record, cond.fieldEmpty);
      return isEmptyValue(v);
    }
    if (cond.fieldNotEmpty) {
      const v = getFieldValue(record, cond.fieldNotEmpty);
      return !isEmptyValue(v);
    }

    return false;
  }

  function unique(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  // =========================================================
  // メイン
  // =========================================================
  kintone.events.on(CONFIG.triggers, function (event) {
    const record = event.record;

    // 条件に合致したルールのhideを集約
    const hideTargets = [];
    CONFIG.rules.forEach(rule => {
      if (evalCondition(rule.when, record)) {
        (rule.hide || []).forEach(code => hideTargets.push(code));
      }
    });

    unique(hideTargets).forEach(code => {
      try {
        kintone.app.record.setFieldShown(code, false);
      } catch (e) {
        // グループ/スペース/存在しないコード等で落ちないように
        console.warn('[hideFields] setFieldShown failed:', code, e);
      }
    });

    return event;
  });

})();
