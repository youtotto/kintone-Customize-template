(function () {
  'use strict';

  /**
   * =========================================================
   * kintone プロセス連動コピー JSテンプレート
   * =========================================================
   *
   * ■ 概要
   * プロセス管理のアクション実行後に、
   * 同一レコード内のフィールド値を別フィールドへコピーします。
   *
   * ■ 設計方針
   * - process.proceed では REST 更新しない
   * - process.proceed では sessionStorage に「更新予約」だけ保存
   * - ステータス更新後の detail.show で REST API 更新する
   * - 二重実行防止あり
   * - 現在ステータス、アクション名、遷移後ステータスでルールを判定する
   */

  // =========================================================
  // 設定エリア
  // =========================================================

  const CONFIG = {
    debug: true,

    options: {
      // コピー先に値がある場合も上書きする
      overwrite: true,

      // コピー元が空の場合はコピーしない
      skipIfEmpty: false,

      // REST更新後に画面を再読み込みする
      reloadAfterUpdate: true,

      // 更新予約の有効期限（分）
      expireMinutes: 5
    },

    rules: [
      {
        name: 'コピー設定名',       // 任意の管理名
        fromStatus: '未処理',      // 現在のステータス
        action: '処理開始',        // 押されたアクション名
        toStatus: '処理中',        // 遷移後ステータス

        // コピー対象フィールド
        mappings: [
          {
            from: '文字列',
            to: '数値',
            overwrite: true,      // 省略した場合は CONFIG.options.overwrite を使用
            skipIfEmpty: false    // 省略した場合は CONFIG.options.skipIfEmpty を使用
          }
        ]
      }

      // 複数ルールを追加する場合
      // ,
      // {
      //   name: 'コピー設定名',
      //   fromStatus: '現在のステータス名',
      //   action: 'アクション名',
      //   toStatus: '遷移後ステータス名',
      //   mappings: [
      //     { from: 'コピー元フィールドコード', to: 'コピー先フィールドコード' }
      //   ]
      // }
    ]
  };

  // =========================================================
  // 定数
  // =========================================================

  const APP_ID = kintone.app.getId();
  const STORAGE_KEY = `process-copy-pending-${APP_ID}`;
  const PROCESSING_KEY = `process-copy-processing-${APP_ID}`;

  // =========================================================
  // 共通ログ
  // =========================================================

  function debugLog(...args) {
    if (CONFIG.debug) {
      console.log('[process-copy]', ...args);
    }
  }

  function warnLog(...args) {
    console.warn('[process-copy]', ...args);
  }

  function errorLog(...args) {
    console.error('[process-copy]', ...args);
  }

  // =========================================================
  // sessionStorage 操作
  // =========================================================

  function savePendingProcessCopy(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getPendingProcessCopy() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      warnLog('sessionStorage の解析に失敗しました。', error);
      clearPendingProcessCopy();
      return null;
    }
  }

  function clearPendingProcessCopy() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function isProcessing() {
    return sessionStorage.getItem(PROCESSING_KEY) === '1';
  }

  function setProcessing(flag) {
    if (flag) {
      sessionStorage.setItem(PROCESSING_KEY, '1');
    } else {
      sessionStorage.removeItem(PROCESSING_KEY);
    }
  }

  // =========================================================
  // ルール判定
  // =========================================================

  function findMatchedRule(event) {
    return CONFIG.rules.find((rule) => {
      return (
        rule.fromStatus === event.status.value &&
        rule.action === event.action.value &&
        rule.toStatus === event.nextStatus.value
      );
    });
  }

  function findRuleFromPending(pending) {
    return CONFIG.rules.find((rule) => {
      return (
        rule.name === pending.ruleName &&
        rule.fromStatus === pending.fromStatus &&
        rule.action === pending.action &&
        rule.toStatus === pending.toStatus
      );
    });
  }

  // =========================================================
  // 判定関数
  // =========================================================

  function isExpired(savedAt) {
    if (!savedAt) return true;

    const expireMs = CONFIG.options.expireMinutes * 60 * 1000;
    return Date.now() - savedAt > expireMs;
  }

  function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  function getMappingOption(mapping, optionName) {
    if (mapping[optionName] !== undefined) {
      return mapping[optionName];
    }

    return CONFIG.options[optionName];
  }

  function shouldCopyField(fromField, toField, mapping) {
    const overwrite = getMappingOption(mapping, 'overwrite');
    const skipIfEmpty = getMappingOption(mapping, 'skipIfEmpty');

    if (skipIfEmpty && isEmptyValue(fromField.value)) {
      debugLog(`コピー元が空のためスキップ: ${mapping.from}`);
      return false;
    }

    if (!overwrite && !isEmptyValue(toField.value)) {
      debugLog(`コピー先に値があるためスキップ: ${mapping.to}`);
      return false;
    }

    return true;
  }

  // =========================================================
  // コピー用 record 作成
  // =========================================================

  function buildUpdateRecordFromMappings(record, mappings) {
    const updateRecord = {};

    mappings.forEach((mapping) => {
      const { from, to } = mapping;

      if (!record[from]) {
        warnLog(`コピー元フィールドが見つかりません: ${from}`);
        return;
      }

      if (!record[to]) {
        warnLog(`コピー先フィールドが見つかりません: ${to}`);
        return;
      }

      const fromField = record[from];
      const toField = record[to];

      if (!shouldCopyField(fromField, toField, mapping)) {
        return;
      }

      updateRecord[to] = {
        value: fromField.value
      };

      debugLog(`コピー対象: ${from} → ${to}`, fromField.value);
    });

    return updateRecord;
  }

  // =========================================================
  // REST API 更新
  // =========================================================

  async function updateRecordByRest(recordId, updateRecord) {
    const body = {
      app: APP_ID,
      id: recordId,
      record: updateRecord
    };

    return kintone.api(
      kintone.api.url('/k/v1/record.json', true),
      'PUT',
      body
    );
  }

  // =========================================================
  // 1. プロセス実行前イベント
  // =========================================================

  kintone.events.on('app.record.detail.process.proceed', function (event) {
    const matchedRule = findMatchedRule(event);

    if (!matchedRule) {
      debugLog('一致するコピー設定がありません。', {
        fromStatus: event.status.value,
        action: event.action.value,
        toStatus: event.nextStatus.value
      });
      return event;
    }

    savePendingProcessCopy({
      appId: APP_ID,
      recordId: event.record.$id.value,
      ruleName: matchedRule.name,
      fromStatus: event.status.value,
      action: event.action.value,
      toStatus: event.nextStatus.value,
      savedAt: Date.now()
    });

    debugLog(`コピー予約を保存しました: ${matchedRule.name}`);

    return event;
  });

  // =========================================================
  // 2. 詳細画面表示イベント
  // =========================================================

  kintone.events.on('app.record.detail.show', async function (event) {
    const pending = getPendingProcessCopy();

    if (!pending) {
      return event;
    }

    if (isExpired(pending.savedAt)) {
      debugLog('コピー予約が期限切れのため削除します。');
      clearPendingProcessCopy();
      return event;
    }

    if (
      String(pending.appId) !== String(APP_ID) ||
      String(pending.recordId) !== String(event.recordId)
    ) {
      debugLog('別レコードのコピー予約のため無視します。');
      return event;
    }

    if (isProcessing()) {
      debugLog('コピー処理中のためスキップします。');
      return event;
    }

    const matchedRule = findRuleFromPending(pending);

    if (!matchedRule) {
      warnLog('保存されたコピー予約に一致するルールが見つかりません。', pending);
      clearPendingProcessCopy();
      return event;
    }

    try {
      setProcessing(true);

      const updateRecord = buildUpdateRecordFromMappings(
        event.record,
        matchedRule.mappings
      );

      if (Object.keys(updateRecord).length === 0) {
        debugLog('更新対象フィールドがありません。');
        clearPendingProcessCopy();
        setProcessing(false);
        return event;
      }

      await updateRecordByRest(event.recordId, updateRecord);

      debugLog(`プロセス連動コピーが完了しました: ${matchedRule.name}`);

      clearPendingProcessCopy();
      setProcessing(false);

      if (CONFIG.options.reloadAfterUpdate) {
        location.reload();
      }

      return event;
    } catch (error) {
      errorLog('REST API 更新に失敗しました。', error);

      clearPendingProcessCopy();
      setProcessing(false);

      event.error = `プロセス連動コピーに失敗しました。${error.message || error}`;
      return event;
    }
  });
})();