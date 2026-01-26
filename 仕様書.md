# Kuromi List 仕様書（現状 Web/PWA）

## 1. 概要
Kuromi List は、Kuromi テイストのデザインを持つリアルタイム共有ショッピングリストです。Web ブラウザから利用でき、PWA として iOS のホーム画面に追加してアプリのように起動できます。データは Firebase Realtime Database を用いて同期します。

## 2. 対象範囲
- 現状の Web / PWA 機能のみ
- Firebase Realtime Database 連携まで
- 認証・権限管理・通知・分析は対象外

## 3. 画面一覧
1. メイン画面（/）
   - リスト入力・一覧表示・共有リンク・操作ボタンを含む単一画面

## 4. 機能要件
### 4.1 リスト操作
- 項目追加
  - 入力欄に品名を入力し「Add」で追加
  - 数量（Qty）を指定可能
  - 同名（前後空白除去 + 大文字小文字無視）の項目が存在する場合は新規作成せず数量を加算
- 完了切替
  - 項目左の骷髅アイコンで完了/未完了を切替
  - 完了時は取り消し線 + 透過表示
- 数量変更
  - + / - ボタンで増減
  - 数量入力欄の直接入力も可能（Enter or フォーカスアウトで確定）
  - 1 未満は 1 に正規化
- 削除
  - 項目右の骷髅アイコンで削除
  - 削除時は左へスライドするアニメーション
- 全削除
  - 「Clear」ボタンで全項目削除
  - 確認ダイアログを表示

### 4.2 表示・状態
- 画面上に「items 数」「remaining 数」「Shared list」を表示
- Firebase 同期中は「Syncing…」を表示
- 共有リンクはサイトのルート URL を表示・コピー

### 4.3 共有方式
- 全ユーザー共通のリスト（ルーム固定）
  - 参照パス: `rooms/global`
  - URL に room パラメータは使用しない

## 5. データ構造
Firebase Realtime Database のデータ構造:

```
rooms/
  global/
    items/
      {id}/
        text: string
        completed: boolean
        quantity: number
        createdAt: number (Unix epoch ms)
```

ソート順:
- `createdAt` 昇順

## 6. 同期・ロジック概要
- 読み込み:
  - `onValue(ref(database, "rooms/global/items"), ...)`
- 追加:
  - `push` により新規 ID を発行
  - 重複名は `update` で数量加算
- 更新:
  - 完了切替、数量変更は `update`
- 削除:
  - `remove` で単体削除または全削除

## 7. UI/UX 要件（現状）
### 7.1 デザイン
- Goth-Pastel 風の Kuromi テーマ
- 背景: パステルグラデーション + 小さな骷髅パターン
- 主要カード: ダーク半透明 + 紫の縁取り
- フォント: ZCOOL KuaiLe

### 7.2 レスポンシブ
- モバイル最適化
  - ヘッダは右寄せ・小さめに調整
  - ボタンは Add / Clear を同一行に配置
  - URL 入力と Copy ボタンを同一行に配置
  - リスト項目は 1 行配置（長い場合は自動改行）

## 8. PWA 要件
- Manifest: `/public/manifest.json`
  - `name`: `库洛米清单`
  - `short_name`: `库洛米清单`
  - `display`: `standalone`
  - `start_url`: `/`
  - `theme_color`: `#0b0614`
  - `background_color`: `#f7f1ff`
  - `icons`: 192/512 PNG
- iOS 対応 meta:
  - `apple-mobile-web-app-capable: yes`
  - `apple-mobile-web-app-status-bar-style: black`
  - `apple-mobile-web-app-title: 库洛米清单`
  - `apple-touch-icon: /apple-touch-icon.png`

### iOS インストール手順
Safari でサイトを開き、共有メニューから「ホーム画面に追加」。

## 9. 非機能要件
- 対応環境
  - モダンブラウザ（Chrome/Safari/Edge）
  - iOS Safari で PWA 起動
- パフォーマンス
  - ページ初期描画は 3 秒以内を目標
- 信頼性
  - 同期は Firebase に依存
  - オフライン対応は未実装

## 10. 環境変数
以下を Vercel などに設定すること:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 11. 運用・デプロイ
- デプロイ: Vercel を想定
- Firebase Realtime Database のルールは開発時に read/write 許可が必要

## 12. 既知の制限
- 認証・権限管理なし（誰でも閲覧/編集可能）
- 共有は「全ユーザー共通 1 リスト」固定
- オフライン対応なし
