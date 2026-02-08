以下の要件を満たす技術設計ドキュメントを日本語で作成してください。

【テーマ】
AWS を用いた「招待制ユーザー登録システム」
（単一登録 + CSV 一括登録対応）

【必須出力内容】
① 全体像（前提）
② 完整な Sequence Diagram（成功・失敗・再送招待メールを含む）
③ Node.js Lambda 実装例（説明付き）

---

【① 全体像（前提）】
・管理者または CSV アップロードにより仮ユーザーを作成
・仮ユーザーは DB 上で INVITED 状態
・招待メールに含まれる URL をクリックして本登録を行う
・本登録時に Amazon Cognito へユーザーを作成
・登録完了後、DB の状態を ACTIVE に更新し登録日時を保存
・招待 URL には有効期限（例：7日）を設ける
・招待メールは再送可能とする

【使用 AWS サービス】
・Amazon API Gateway
・AWS Lambda（Node.js）
・Amazon SES
・Amazon Cognito
・Amazon RDS（PostgreSQL）
・Amazon S3
・（任意）AWS Step Functions

---

【② セキュリティ要件】
・招待 URL にはトークンを含める
・URL 用トークンは AES による暗号化（復号可能）
・DB 保存用トークンは HMAC によるハッシュ化（不可逆）
・URL 改ざん・漏洩対策を考慮する

---

【③ Sequence Diagram（必須）】
以下をすべて含めること：

● 通常登録フロー
　- 仮ユーザー作成
　- 招待メール送信
　- ユーザーによる URL クリック
　- トークン検証
　- Cognito 登録
　- DB 更新

● 失敗ケース
　- トークン不正
　- 有効期限切れ
　- 既に登録済み

● 招待メール再送フロー
　- 旧トークン無効化
　- 新トークン発行
　- 再送信

※ テキストベースのシーケンス図（ASCII）で記載すること

---

【④ Node.js Lambda 実装例】
以下の Lambda を説明付きで記載すること：

● 招待 URL 検証（Verify API）
　- AES 復号
　- HMAC 検証
　- 有効期限チェック
　- ユーザーステータス確認
　- Amazon Cognito SignUp
　- DB 更新（ACTIVE, registered_at）

● エラーハンドリング方針
　- TOKEN_MISSING
　- INVALID_TOKEN
　- TOKEN_EXPIRED
　- ALREADY_REGISTERED
　- INTERNAL_ERROR

※ コードは Node.js（JavaScript）で記載すること
※ 実装例は AWS Lambda を前提とする

---

【文体・形式】
・技術設計書として使える丁寧な日本語
・見出し付きで構造化する
・箇条書きを多用する
・README / 社内設計書に貼れる品質で出力する






---
```
sequenceDiagram
    autonumber

    participant Admin as 管理者 / システム
    participant LambdaA as Lambda A<br/>招待作成
    participant RDS as RDS PostgreSQL
    participant SES as Amazon SES
    participant User as ユーザー
    participant FE as フロントエンド（Web）
    participant APIGW as API Gateway
    participant LambdaB as Lambda B<br/>招待検証
    participant LambdaC as Lambda C<br/>登録完了処理
    participant Cognito as Amazon Cognito

    %% --- 仮ユーザー作成 ---
    Admin ->> LambdaA: ユーザー作成（email）
    LambdaA ->> RDS: INSERT user（status = INVITED）
    LambdaA ->> LambdaA: 招待トークン生成（AES + HMAC）
    LambdaA ->> RDS: INSERT invite_token（hash, 有効期限）
    LambdaA ->> SES: 登録用URL付きメール送信

    %% --- ユーザーがメールをクリック ---
    User ->> FE: 登録URLをクリック（?token=xxx）
    FE ->> APIGW: GET /verify?token=xxx
    APIGW ->> LambdaB: リクエスト転送
    LambdaB ->> LambdaB: HMAC検証 + AES復号
    LambdaB ->> RDS: invite_token を hash で検索
    LambdaB -->> FE: トークン有効 → 登録画面表示

    %% --- ユーザー登録完了 ---
    User ->> FE: パスワード入力・送信
    FE ->> APIGW: POST /signup {token, password}
    APIGW ->> LambdaC: リクエスト転送
    LambdaC ->> LambdaC: トークン再検証
    LambdaC ->> Cognito: AdminCreateUser / SignUp
    Cognito -->> LambdaC: cognito_sub
    LambdaC ->> RDS: user を REGISTERED に更新（registered_at 設定）
    LambdaC ->> RDS: invite_token を使用済みに更新
    LambdaC -->> FE: 登録成功レスポンス
```