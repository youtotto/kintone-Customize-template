(function () {
    'use strict';

    /**
     * =========================================================
     *  プロセス遷移後 コピー／計算 テンプレート
     * ---------------------------------------------------------
     *  できること
     *   - プロセス遷移後に、同一レコード内の値を別フィールドへコピー
     *   - プロセス遷移後に、条件に応じた計算結果を別フィールドへセット
     *
     *  基本の流れ
     *   1. process.proceed で「次ステータス」を取得
     *   2. sessionStorage に一時保存
     *   3. detail.show で再表示されたタイミングで REST 更新
     *
     *  向いている用途
     *   - ステータス遷移時のスナップショット保存
     *   - 次工程用の項目コピー
     *   - 条件分岐によるフラグ設定
     * =========================================================
     */

    const APP_ID = kintone.app.getId();

    // アプリ単位で一意になるようにキーを作成
    const STORAGE_KEY = `process-copy-pending-${APP_ID}`;
    const PROCESSING_KEY = `process-copy-processing-${APP_ID}`;

    /**
     * =========================================================
     * 設定エリア
     * =========================================================
     */

    /**
     * ステータスごとのコピー定義
     *
     * 書き方：
     * '次ステータス名': [
     *   { from: 'コピー元フィールドコード', to: 'コピー先フィールドコード' }
     * ]
     */
    const COPY_RULES_BY_NEXT_STATUS = {
        'ステータスA': [
            { from: '元フィールド1', to: '先フィールド1' },
            { from: '元フィールド2', to: '先フィールド2' }
        ],

        'ステータスB': [
            { from: '元フィールド3', to: '先フィールド3' }
        ]
    };

    /**
     * ステータスごとの計算定義
     *
     * 書き方：
     * '次ステータス名': [
     *   {
     *     to: '計算結果を書き込むフィールドコード',
     *     calc: (record) => {
     *       // event.record を使って自由に計算
     *       return 'セットする値';
     *     }
     *   }
     * ]
     */
    const CALC_RULES_BY_NEXT_STATUS = {
        'ステータスB': [
            {
                to: '判定結果フィールド',
                calc: (record) => {
                    const category = record['区分']?.value;
                    const amount = Number(record['金額']?.value || 0);

                    if (category === '特別' && amount >= 100000) {
                        return '要確認';
                    }
                    return '通常';
                }
            }
        ]
    };

    /**
     * =========================================================
     * sessionStorage 操作
     * =========================================================
     */

    function savePendingProcessCopy(data) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getPendingProcessCopy() {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[process-copy] sessionStorage parse error:', e);
            sessionStorage.removeItem(STORAGE_KEY);
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

    /**
     * =========================================================
     * 更新データ生成
     * =========================================================
     */

    function buildUpdateRecord(record, copyRules, calcRules) {
        const updateRecord = {};

        // -------------------------
        // コピー処理
        // -------------------------
        (copyRules || []).forEach(({ from, to }) => {
            if (!record[from] || !record[to]) return;

            // 必要に応じて以下のように上書き条件を調整可能
            // if (record[to].value) return; // 既に値があれば上書きしない

            updateRecord[to] = { value: record[from].value };
        });

        // -------------------------
        // 計算処理
        // -------------------------
        (calcRules || []).forEach(({ to, calc }) => {
            if (!record[to]) return;

            try {
                const value = calc(record);
                updateRecord[to] = { value };
            } catch (e) {
                console.error(`[process-calc] 計算エラー: ${to}`, e);
            }
        });

        return updateRecord;
    }

    /**
     * REST API で同一レコード更新
     */
    async function updateRecordByRest(recordId, updateRecord) {
        const body = {
            app: APP_ID,
            id: recordId,
            record: updateRecord
        };

        console.log('[process-copy] PUT body =', JSON.stringify(body, null, 2));

        return kintone.api(
            kintone.api.url('/k/v1/record.json', true),
            'PUT',
            body
        );
    }

    /**
     * =========================================================
     * 1. プロセス遷移時
     * =========================================================
     */
    kintone.events.on('app.record.detail.process.proceed', function (event) {
        const nextStatus = event.nextStatus && event.nextStatus.value;
        console.log('[process-copy] process.proceed fired. nextStatus =', nextStatus);

        const copyRules = COPY_RULES_BY_NEXT_STATUS[nextStatus];
        const calcRules = CALC_RULES_BY_NEXT_STATUS[nextStatus];

        // コピーも計算も無いステータスなら何もしない
        if ((!copyRules || copyRules.length === 0) && (!calcRules || calcRules.length === 0)) {
            console.log('[process-copy] 対象外ステータスのためスキップ');
            return event;
        }

        savePendingProcessCopy({
            appId: APP_ID,
            recordId: event.record.$id.value,
            nextStatus: nextStatus,
            savedAt: Date.now()
        });

        console.log('[process-copy] pending saved =', {
            appId: APP_ID,
            recordId: event.record.$id.value,
            nextStatus: nextStatus
        });

        return event;
    });

    /**
     * =========================================================
     * 2. 詳細画面再表示時
     * =========================================================
     */
    kintone.events.on('app.record.detail.show', async function (event) {
        const pending = getPendingProcessCopy();
        console.log('[process-copy] detail.show fired. pending =', pending, 'event.recordId =', event.recordId);

        if (!pending) {
            return event;
        }

        if (String(pending.appId) !== String(APP_ID) || String(pending.recordId) !== String(event.recordId)) {
            console.log('[process-copy] appId/recordId 不一致のためスキップ');
            return event;
        }

        if (isProcessing()) {
            console.log('[process-copy] 処理中のためスキップ');
            return event;
        }

        try {
            setProcessing(true);

            const copyRules = COPY_RULES_BY_NEXT_STATUS[pending.nextStatus];
            const calcRules = CALC_RULES_BY_NEXT_STATUS[pending.nextStatus];

            const updateRecord = buildUpdateRecord(event.record, copyRules, calcRules);
            console.log('[process-copy] updateRecord =', updateRecord);

            if (Object.keys(updateRecord).length === 0) {
                console.log('[process-copy] 更新対象なし');
                clearPendingProcessCopy();
                setProcessing(false);
                return event;
            }

            await updateRecordByRest(event.recordId, updateRecord);

            console.log('[process-copy] PUT success');

            clearPendingProcessCopy();
            setProcessing(false);

            location.reload();
            return event;

        } catch (error) {
            console.error('[process-copy] REST update error:', error);
            alert('[process-copy] 更新に失敗しました。コンソールを確認してください。');

            clearPendingProcessCopy();
            setProcessing(false);
            return event;
        }
    });

})();