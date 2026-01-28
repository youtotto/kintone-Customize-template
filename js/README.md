# JS Templates（kintone カスタマイズ用テンプレート集）

kintone の「JavaScript / CSS カスタマイズ」にそのまま登録して使える  
汎用カスタマイズ JS をまとめたディレクトリです。

- 外部ライブラリなし
- CONFIG を書き換えるだけで利用可能
- 商用利用 OK（MIT）

---

## 📁 テンプレ一覧

### 🟦 入力補助（Input Assist）

| ファイル名                            | 概要                                | 主な用途             |
| -------------------------------- | --------------------------------- | ---------------- |
| `dropdown-to-fields-autofill.js` | ドロップダウン選択で複数フィールド自動入力               | プラン反映 / テンプレ入力   |
| `auto-lookup.js`                 | ルックアップ値の自動取得                        | ルックアップ漏れ防止       |
| `field-hide-disabled.js`         | フィールド非表示・入力不可化                      | 権限制御・操作抑制        |
| `normalize-fields.js`            | 保存時に半角英数字へ整形                        | 電話番号・郵便番号整形      |
| `auto-number-on-save.js`         | レコード保存時に自動採番                        | 見積番号/伝票番号生成      |
| `subtable-lookup-selector.js`    | ボタン選択でサブテーブルへ行追加＋ルックアップ自動取得      | 候補選択 UI の構築       |

### 🟧 表示改善・ナビゲーション（UI / UX）

| ファイル名                           | 概要                 | 主な用途        |
| ------------------------------- | ------------------ | ----------- |
| `field-value-group-switcher.js`         | fieldの値に応じてグループの表示切り替え    | 長いフォームを分割   |
| `group-tab-switcher.js`         | グループフィールドをタブ化    | 長いフォームを分割   |
| `label-navigator.js`            | ラベルから“目次”を生成     | 項目ジャンプ      |
| `index-quick-switch-buttons.js` | 一覧ビュー切替ボタン       | 現場向けナビ設定    |
| `sidebar-closed.js`             | サイドバーを自動で閉じる     | 入力集中モード     |
| `group-navigator.js`            | グループから“目次”を生成　　| 項目ジャンプ      |

### 🟩 データ品質・バリデーション（Validation）

| ファイル名                | 概要                    | 主な用途         |
| -------------------- | --------------------- | ------------ |
| `field-validator.js` | 複雑な条件式でバリデーション（保存前チェック） | 入力チェックの高度化 |

### 🟪 自動化（Automation）

| ファイル名                        | 概要             | 主な用途     |
| ---------------------------- | -------------- | -------- |
| `progress-to-next-status.js` | 保存後ステータス自動遷移 | 承認フロー自動化 |

---

## 🚀 共通の使い方

1. **テンプレートを選ぶ**  
   このディレクトリの `.js` を 1 つ選びます。

2. **ファイルをダウンロード**  
   GitHub 上でファイルを開き、`Download raw file` などで取得します。  
   （Toolkit を使用する場合は、Templates タブから直接開けます）

3. **kintone に登録**  
   アプリ設定 → JavaScript/CSS カスタマイズ より  
   対象アプリのデスクトップ（必要ならモバイル）に JS を登録します。

4. **CONFIG を自分のアプリに合わせて書き換え**  
   各テンプレートの先頭付近には、必ず `CONFIG` ブロックがあります。

   ```js
   const CONFIG = {
     fieldCode: '顧客名',
     targetView: '今日',
     tableCode: '明細',
     // ...
   };
   ```
   ここを自分のアプリのフィールドコードやビュー名に合わせて修正してください。
   
---

## 📘 テンプレ別：詳細ガイド

### 🔹 field-hide-disabled.js
特定のフィールドを「非表示」または「入力不可」にするテンプレ

#### 📌 使い所
- 権限によって表示したくない項目を隠す
- 変更されると困る項目を入力不可にしたい
- 編集画面だけ「非表示」などの制御が必要

#### 🛠 CONFIG例
```js
hiddenFields: ['GRP_BASIC', 'KOKCD'],   // 非表示
disabledFields: ['ADDR1', 'ADDR2'],     // 入力不可
```

---

### 🔹 field-validator.js
複合条件によるフィールドバリデーション（保存前チェック）

#### 📌 使い所
- 「顧客名が test ならエラー」などの条件チェック
- 他フィールドを参照した複雑な制御
- 条件エラーの詳細メッセージを自動生成したい

#### 🛠 CONFIG例
```js
validationFields: [
  {
    fieldCode: '顧客名',
    conditionMode: 'or',
    conditions: [
      { op: 'equals', value: 'test' },
      { op: 'equals', value: 'test2' }
    ],
    message: 'auto'
  }
]
```

---

### 🔹 group-tab-switcher.js
グループフィールドを “タブUI” として切り替えるテンプレ

#### 📌 使い所
- 長いフォームをタブで切り替えたい
- グループフィールドを使って画面を分割したい
- 管理者用タブなど、特定のグループだけ見せたい

#### 🛠 CONFIG例
```js
tabSpace: 'TAB_MENU',
tabs: [
  { label: '基本', group: 'grp01', activeBg: 'mint' },
  { label: '詳細', group: 'grp02', activeBg: 'pale' }
]
```

---

### 🔹 index-quick-switch-buttons.js
一覧画面ヘッダに “ビュー切替ボタン” を配置するテンプレ

#### 📌 使い所
- 一覧ビューが多く、迷いやすい
- 現場のオペレーションに合わせたナビゲーションを置きたい
- 外部リンクもまとめて置きたい

#### 🛠 CONFIG例
```js
buttons: [
  { label: "概要", viewId: 5758653, width: 60, bg: 'overview' },
  { label: "料金", viewId: 5758650, width: 80, bg: 'pricing' },
  { label: "外部サイト", href: "https://example.com", width: 90 }
]
```

---

### 🔹 auto-lookup.js
通常フィールド & サブテーブルのルックアップを “自動取得”

#### 📌 使い所
- ルックアップ元が既に入っているのに「未取得」状態を自動解決したい
- サブテーブル内のルックアップ忘れを防止したい

#### 🛠 CONFIG例
```js
lookupFields: ['顧客コード'],
subtableLookups: [{ table: '明細', column: '商品名' }]
```

---

### 🔹 normalize-fields.js
保存時に文字列を半角英数字に正規化するテンプレ

#### 📌 使い所
- 郵便番号・電話番号・型番などの入力ブレをなくしたい
- 全角 → 半角変換
- 記号（ハイフンなど）を「残す／捨てる」をフィールドごとに設定したい

#### 🛠 CONFIG例
```js
FIELDS_KEEP_SYMBOLS: ['POSTAL'],       // 許容記号を残す
FIELDS_REMOVE_SYMBOLS: ['TELNO'],      // 記号を全部消す
ALLOWED_SYMBOLS: '-_.@/'               // 残す記号
```

---

### 🔹 auto-number-on-save.js
保存時に「日付＋接頭辞＋連番」で自動採番

#### 📌 使い所
- 見積番号・伝票番号・受注番号を自動生成
- 「YYYYMMDD-E001」形式の採番が欲しい
- 手動入力を防ぎたい

#### 🛠 CONFIG例
```js
TARGET_FIELD: '見積番号',
DATE_PATTERN: 'yyyyMMdd',
DELIMITER: '-',
PREFIX: 'E',
SEQ_WIDTH: 3
```

---

### 🔹 dropdown-to-fields-autofill.js
ドロップダウン選択 → 複数フィールド自動入力

#### 📌 使い所
- プラン選択 → 説明／金額／納期 を自動で埋めたい
- カタログ情報のテンプレ化
- 選択肢ごとのテンプレ反映

#### 🛠 CONFIG例
```js
mapping: {
  'ライト': { 説明: 'ライトプラン', 金額: '30000' },
  'プレミアム': { 説明: '最上位プラン', 金額: '80000' }
},
overwrite: true
```

---

### 🔹 sidebar-closed.js
レコード画面のコメント／履歴サイドバーを自動で閉じる

#### 📌 使い所
- フォーム入力に集中してほしい
- “履歴を見るために勝手に開いてしまう” を防ぎたい
- 限られた画面スペースを広く使いたい

#### 🛠 CONFIG例
// 設定不要。デフォルトで全画面に適用される

---

### 🔹 label-navigator.js
フォームのラベル（項目名）から“ミニ目次”を生成するUI

#### 📌 使い所
- 長いフォームでスクロールが大変
- 「基本情報」→「詳細」などに即ジャンプしたい
- 編集画面でも迷いたくない

#### 🛠 CONFIG例
```js
items: [
  { text: '基本情報', level: 0 },
  { text: '顧客情報', level: 1 },
  { text: '詳細メモ', level: 0 }
],
panelHeight: '30vh',
openOnInit: true
```

---

### 🔹 group-navigator.js
フォームのグループから“ミニ目次”を生成するUI

#### 📌 使い所
- 長いフォームでスクロールが大変
- 「基本情報」→「詳細」などに即ジャンプしたい
- 編集画面でも迷いたくない

#### 🛠 CONFIG例
```js
items: [
  { text: '基本情報', level: 0 },
  { text: '顧客情報', level: 1 },
  { text: '詳細メモ', level: 0 }
],
panelHeight: '30vh',
openOnInit: true
```

---

### 🔹 progress-to-next-status.js
保存後にプロセス管理のステータスを自動で次に進める

#### 📌 使い所
- 自動承認
- 作業ステータスの漏れ防止
- 人手で押す必要のないフローを自動化

#### 🛠 CONFIG例
```js
trigger: 'app.record.create.submit.success',
current: '下書き',
next: '承認依頼'
```

---

### 🔹 subtable-lookup-selector.js
参照アプリから候補をボタン化 → クリックでサブテーブル行追加＋ルックアップ実行

#### 📌 使い所
- 家族、プラン、商品など「選択UI」化したい
- 候補をボタンにして直感的に選ばせたい
- ルックアップ取得まで一気通貫にしたい

#### 🛠 CONFIG例
```js
sourceAppId: 12,
sourceFilterField: '顧客ID',
sourceKeyField: '商品コード',
sourceLabelField: '商品名',

targetFilterField: '顧客ID',
spaceCode: 'BTN_AREA',

tableCode: '明細',
subtableSetField: '商品コード'
```

---

### 🔹 field-value-group-switcher.js

フィールドの値に応じて、表示するグループを切り替えるテンプレート

（タブUIは使わず、条件に合うグループだけを表示）

#### 📌 使い所
- 申請種別・問い合わせ種別などに応じて、入力フォームを出し分けたい
- 1画面に全部詰め込まず、必要な項目だけ見せたい
- タブUIは使わず、kintone標準のグループ表示制御で完結させたい

例：
- 種別A → グループAのみ表示
- 種別B → グループBのみ表示
- 未選択 → 何も表示しない／共通グループだけ表示

#### 🧠 動作概要

- 画面表示時、すべての対象グループを一旦非表示
- 指定フィールドの「値」を取得
- 値に対応するグループ 1つだけを表示
- create / edit 画面では、フィールド変更にもリアルタイム追従

#### 🛠 CONFIG例
```js
const CONFIG = {
  EVENTS: [
    "app.record.detail.show",
    "app.record.create.show",
    "app.record.edit.show"
  ],

  // 判定に使うフィールドコード
  SWITCH_FIELD_CODE: "switch_field",

  // 値 → 表示するグループ
  VALUE_GROUP_MAP: {
    "OPTION_A": "GROUP_A",
    "OPTION_B": "GROUP_B",
    "OPTION_C": "GROUP_C"
  },

  // 未入力・未定義時に表示するグループ（不要なら null）
  DEFAULT_GROUP: null
};
```