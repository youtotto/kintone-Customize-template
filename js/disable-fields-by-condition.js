(function () {
  'use strict';

  /**
   * フィールドを「編集不可（disabled）」にするソース
   * - create / edit で有効（detailでは編集しないので基本対象外）
   * - ステータスやフィールド値で条件分岐
   */

  // =========================================================
  // 設定（ここだけ触ればOK）
  // =========================================================
  const CONFIG = {
    triggers: [
      'app.record.create.show',
      'app.record.edit.show'
    ],

    rules: [
      // -------------------------
      // 例1: 常に編集不可
      // -------------------------
      {
        when: { always: true },
        disable: ['ADDR1', 'ADDR2']
      },

      // -------------------------
      // 例2: ステータスが「確認中」のとき編集不可
      // -------------------------
      {
        when: { statusIn: ['確認中'] },
        disable: ['KOKCD']
      },

      // -------------------------
      // 例3: フィールド値で編集不可
      // -------------------------
      {
        when: { fieldEq: { code: 'LOCK_FLG', value: '1' } },
        disable: ['TEL1', 'ZIP']
      }
    ]
  };

  // =========================================================
  // 共通ユーティリティ（hide側と同等）
  // =========================================================
  function getFieldValue(record, code) {
    if (!record || !record[code]) return undefined;
    return record[code].value;
  }

  function getStatusValue(record) {
    return getFieldValue(record, 'ステータス');
  }

  function isEmptyValue(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'string') return v.trim() === '';
    return false;
  }

  function evalCondition(cond, record) {
    if (!cond) return true;
    if (cond.always) return true;

    if (Array.isArray(cond.and)) return cond.and.every(c => evalCondition(c, record));
    if (Array.isArray(cond.or)) return cond.or.some(c => evalCondition(c, record));

    if (Array.isArray(cond.statusIn)) {
      const st = getStatusValue(record);
      return cond.statusIn.includes(st);
    }
    if (Array.isArray(cond.statusNotIn)) {
      const st = getStatusValue(record);
      return !cond.statusNotIn.includes(st);
    }

    if (cond.fieldEq) {
      const v = getFieldValue(record, cond.fieldEq.code);
      return v === cond.fieldEq.value;
    }
    if (cond.fieldNe) {
      const v = getFieldValue(record, cond.fieldNe.code);
      return v !== cond.fieldNe.value;
    }

    if (cond.fieldIn) {
      const v = getFieldValue(record, cond.fieldIn.code);
      return cond.fieldIn.values.includes(v);
    }
    if (cond.fieldNotIn) {
      const v = getFieldValue(record, cond.fieldNotIn.code);
      return !cond.fieldNotIn.values.includes(v);
    }

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

    const disableTargets = [];
    CONFIG.rules.forEach(rule => {
      if (evalCondition(rule.when, record)) {
        (rule.disable || []).forEach(code => disableTargets.push(code));
      }
    });

    unique(disableTargets).forEach(code => {
      if (!record[code]) return; // 存在しない/権限で取れない等
      record[code].disabled = true;
    });

    return event;
  });

})();
