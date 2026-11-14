# 既存シミュレータの確認とIP-R5000導入の設計メモ

確認日：2026-11-13 UTC。今回は読み取り調査と資料作成。既存リポジトリの変更・push・公開操作は行っていない。

## 1. 確認した版

| 対象 | 確認結果 |
|---|---|
| [公開ページ](https://pepefukuoka-hub.github.io/work/hatsudenki-sim/) | HTML取得成功。22,246,222 bytes |
| [開発用ページ](https://pepefukuoka-hub.github.io/emergency-generator-simulator/) | HTML取得成功。上記と同じバイト列 |
| HTML SHA-256（両ページ） | `cf9f16625fc38fafa43175cddc886ef676d5f225d359a17229f09a66b976412b` |
| [指定ブランチ](https://github.com/pepefukuoka-hub/emergency-generator-simulator/tree/claude/determined-mendel-b26jq2) | `0097e5607f362d537c385717400e521ec27e8ca5` |
| main | 同じコミット `0097e5607f362d537c385717400e521ec27e8ca5` |
| ツリー | `b0fc57ccf1bcc4ab48954b3eabcad279b5bf5104` |
| 画面タイトル | 空港設備シミュレータ |

GitHubコネクタでブランチ・再帰ツリー・主要ソースを確認。Web閲覧ツールでは公開ページを取得できなかったが、HTTP取得で両HTMLの一致を確認した。実ブラウザの描画・操作・スマートフォン検証は今回未実施。リポジトリのHANDOFFが記載していた公開ページ未照合という項目について、今回HTML取得とハッシュ照合のみ補えた。コミットの固定リンクを以下の根拠とする。

## 2. 現在の試験機は別機種

現在の継電器試験機は **PRT-3M／PRT-3TR の教育用模擬**。IP-R5000ではない。公開HTMLにもPRT-3Mの表記があり、IP-R5000の文字列はない。[README](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/README.md)、[main.js L2180](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2180)

IP-R5000を加えるときは銘板の文字だけを変えると誤学習になる。操作スイッチ、端子、レンジ、電流出力の制限、トリップ検出、時間計の単位、補助電源、事前設定と試験投入の挙動を、別の機種定義として作る。既存のPRTモデルは出典と近似範囲を保ち、IP-R5000の説明書から確認した動作と混ぜない。

## 3. 技術構成と流用できる箇所

- ブラウザ用JavaScript ES modules、Three.js **0.160.0**、ビルドはesbuild **^0.25.0**。[package.json](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/package.json)
- `src/main.js`を依存・画像・GLBごと単一の`docs/index.html`に埋め込む構成。`npm run build`で生成。出力HTMLは手編集しない。[build.mjs](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/scripts/build.mjs)
- `src/relay-instruments.js`：つまみ、メーター枠・針・ガラス、端子、ケース、2Dパネルと3D部品の同期。**描画部品は流用候補**だが、IP-R5000の部品配置や寸法は新たな定義が必要。[描画ソース](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/relay-instruments.js)
- `RT`：試験機電源、つまみ、試験状態、隔離状態、リード、記録。`rtTick(dt)`：出力と継電器動作。`TESTS`：試験定義。`RDEF`：継電器整定。`TOL`：判定値。`DEV`：良否モデルの係数。
- `rtLead()`と`rtAct()`：リード接続・隔離・復旧。`rtRecord()`：記録。`guideHTML()`：手順。`window.__rt`：検証用操作API。
- 発電機の状態は`S`、`stepState(dt)`等で別管理。発電機の運転シーケンスと試験機モデルは異なる責務。将来CB連動を作る際、継電器出力→制御回路→遮断器開極→所内電源喪失を明示的なイベントで接続する。

## 4. 既存の機能と限界

| 分野 | コードで確認した内容 | IP-R5000版へ進めるときの扱い |
|---|---|---|
| OCR | 動作電流、300%・500%時間、120%・85%瞬時試験の定義 | IP-R5000説明書の各試験と、対象継電器メーカーの試験条件を照合して個別登録 |
| UVR | 動作電圧、110V→0Vの時間試験 | 予備印加・投入切替の本体挙動と対象継電器の指定条件を確認 |
| OVR | 動作電圧、整定130%の時間試験 | 試験機の選択機能と対象継電器の規定条件を区別 |
| GR/DGR | 解説のみ。`FINE`は出力模擬に使われない | 電圧・電流同時出力、方向、位相反転、試験巻線を含む新モデルが必要 |
| OVGR/64G | 11V・0.5秒の架空モデルをOVR相当で扱う | 一次側零相電圧%と二次試験入力の換算、検出器の構成が必要 |
| 復帰値 | 一部の復帰条件は状態計算に存在 | OVR/UVR復帰値の独立した計測・記録項目が必要 |
| CB連動 | リレー単体試験が中心。トリップ回路切り離しが前提 | 連動試験モードと検出経路を別に作る。単体試験の安全条件をそのまま適用しない |
| 耐電圧 | DVTを選ぶと未対応と表示 | IP-R5000のPUN、適合トランス・スライダック・リアクトルの別モデルが必要 |

根拠：[TESTS等 L2400](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2400)、[手順と解説 L2710](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2710)。

### 数値モデルを実機相当と呼べない理由

1. **継電器型式が未特定。** 整定値は写真読取りの目安で、一部は推測。OCRの300%動作時間0.4秒、64Gの整定などは明示的に架空。背面端子の名前と配列も仮の定義。[RDEF L2190](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2190)
2. 電流は設定電圧を`SERIES RESISTOR + 0.1Ω`で割る簡略計算。負担インピーダンス、力率、飽和、波形、配線の実測抵抗を再現していない。
3. 動作確認モードでは待ち時間を短縮。時間試験前の指示にも教材上の簡略化がある。カウンタの停止値に`performance.now()`依存の微小な揺らぎがあり、同じ入力による決定的な回帰試験には向かない。[rtTick L2444](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2444)
4. 判定は共通の`TOL`に依存。継電器型式・試験規格・整定条件ごとの基準ではない。OCRを含む動作値±5%などをIP-R5000固有の合否基準として引き継がない。[rtRecord L2584](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/src/main.js#L2584)
5. 極性・接地・切離し・通電中切替のUIはあるが、すべてが物理回路モデルに基づくわけではない。開始時に極性未確認が警告だけとなる箇所、隔離状態を直接切り替える箇所がある。既存の表示を実機インタロックの証拠としない。
6. 今回は静的コード確認。これらの関数を実行して動作検証したわけではない。

## 5. 実装を始める前の分離案

以下は**開発上の提案**であり、メーカーの内部設計を示すものではない。

1. `tester-profiles/ip-r5000`：確認済み操作部、レンジ、定格、信号経路、検出方式、計器精度。出典ページ・版を各データに付ける。
2. `relay-profiles`：メーカー・型式・適用版、入力定格、整定、時限曲線、復帰比、補助電源、接点方式、端子対応。未確定項目には状態フラグを付け、仮定値で実測合格を出さない。
3. `connection-model`：試験機と継電器、CT/ZCT/VT/ZPD、CB、接地・トリップ回路を接続グラフにする。ケーブル色・端子名の見た目と電気的接続を分離する。
4. `test-engine`：準備→設定→予備調整→試験投入→動作検出→記録→復旧。固定時間刻みまたはイベント時刻で計算し、描画速度で試験時間が変わらない構成にする。
5. `training-rules`：危険な操作の検出、説明、採点。実機の自動保護と教材が止める条件を別データにする。
6. `results`：試験機・継電器・整定・接続・試験点・測定値・計器不確かさ・判定根拠・版・未確定項目を保存する。

最初の縦通しは、型式が確認できたOCR一台の動作電流と動作時間。正しい準備から復旧まで動かし、その後GR/DGR/OVR/UVR、復帰値、CB連動へ広げる。耐電圧は組合せ機材と手順の別検証を行う。

## 6. 現物と追加資料が必要な項目

- 対象継電器のメーカー・型式、説明書、整定値、表面・背面端子の確認。
- 使用するIP-R5000の年式・接続方式と、手元のコード・オプション。メーカー共通写真ではコネクタ差異がある。
- 既存PRTモデルを併存させるか、IP-R5000に置き換えるかという画面方針。
- 実機の出力・トリップ検出・計器表示との照合記録。シミュレータの完成と現場での操作可能性は別に検証する。
- 既存AGENTS.mdでは写真をリポジトリに保存しない方針。今回、個人写真の取得・保存はしていない。

## 7. 次回作業への注意

[AGENTS.md](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/AGENTS.md)、[HANDOFF.md](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/HANDOFF.md)、[EQUIPMENT.md](https://github.com/pepefukuoka-hub/emergency-generator-simulator/blob/0097e5607f362d537c385717400e521ec27e8ca5/EQUIPMENT.md)を確認済み。次回は最新ブランチを再確認し、ほかのエージェントの変更を保つ。現在のAGENTSには、ソース編集時のビルド・ブラウザ検証・HANDOFF更新・公開運用が定められている。本調査はソース編集ではなく、参考資料の作成に限定した。

今回の成果物はこの作業環境のファイルであり、リポジトリや永続メモリに登録されたわけではない。次回の参照入口は `/workspace/ip-r5000/`。
