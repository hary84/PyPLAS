# PyPLAS

**Python Programming Learning Assistant System**

PyPLASは、Pythonの独学学習を支援するために開発された学習支援システムです。
特に **pandas** と **scikit-learn** を用いた機械学習プログラミング学習に特化しています。

---

## 🎯 概要

近年、機械学習の重要性はますます高まっています。しかし、初学者にとっては

* Pythonの文法理解
* データ処理（pandas）の扱い
* 機械学習モデル構築（scikit-learn）
* 実行環境の構築

といった点が大きなハードルとなります。

**PyPLAS** は、これらの課題を解決するために開発された
「ブラウザ上で完結する機械学習学習支援システム」です。

---

## 👨‍🏫 想定利用者

* 機械学習を独学で学びたい学生
* 大学でPython機械学習を教える教員
* 演習形式で学習管理を行いたい教育機関

---

## 🚀 主な特徴

### 1️⃣ ブラウザ上でコード実行

* ローカル環境構築の負担を軽減
* すぐにコードを書いて実行可能

### 2️⃣ 空欄補充問題

* コードの重要部分を補完する形式
* 文法理解やAPI理解の定着を促進

### 3️⃣ コード記述問題

* 実際にコードを書いて問題を解く形式
* 実践的なスキル習得を支援

### 4️⃣ 演習問題の作成機能（開発者モード）

* PyPLAS内で演習問題の作成が可能
* 教員や開発者が問題を追加・編集可能

---

## 🧠 対象分野

* pandasを用いたデータ前処理
* scikit-learnを用いた機械学習モデル構築
* Pythonによる機械学習プログラミング

---



## 🛠️ 導入方法

### 1. リポジトリをクローン

```bash
git clone https://github.com/hary84/PyPLAS.git
cd PyPLAS
```

---

### 2. Python仮想環境の作成（Python 3.9）

```bash
python -m venv .venv
source .venv/bin/activate   # Linux / Mac
.venv\Scripts\activate      # Windows
```

---

### 3. 必要ライブラリのインストール

```bash
pip install -r requirements.txt
```

---

### 4. アプリケーションの起動

```bash
python run.py [-d] [-p <port>]
```

#### オプション

| オプション       | 説明                    |
| ----------- | --------------------- |
| `-d`        | 開発者モードで起動（問題作成機能を有効化） |
| `-p <port>` | 使用するポート番号を指定         |

例：

```bash
python run.py -d -p 8000
```

---

### 5. ブラウザでアクセス

```
http://localhost:<port>
```

例（ポート指定なしの場合）：

```
http://localhost:8888
```

---

## 🔗 リンク

### 1. [DockerHub](https://hub.docker.com/r/ryoh84/pyplas) 

システムの有効性評価で利用したDockerイメージ  
チュートリアルと演習問題を実装済み

### 2. [GitHub](https://github.com/hary84/PyPLAS)

システムのソースコード
演習問題を一から用意する際に利用

---



