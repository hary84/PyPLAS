# Docker による PyPLAS のイメージ化と DockerHub 公開手順

本ドキュメントでは、[Dockerfile](../Dockerfile)を利用して、
問題作成後のPyPLASをDockerイメージとしてビルドし、DockerHubへ公開するまでの最小手順を説明します。

---

## 1. イメージのビルド

プロジェクトルート（Dockerfile があるディレクトリ）で実行します。

```bash
docker build -t pyplas:1.0.0 .
```

---

## 2. コンテナの起動

```bash
docker run -p 8888:8888 pyplas:1.0.0
```

ブラウザで以下にアクセスして問題ないことを確認します。

```
http://localhost:8888
```

---

## 3. DockerHub へ公開

### ① ログイン

```bash
docker login
```

### ② タグ付け

```bash
docker tag pyplas:1.0.0 <ユーザー名>/pyplas:1.0.0
```

### ③ Push

```bash
docker push <ユーザー名>/pyplas:1.0.0
```

---

## 4. 利用者側の実行方法

```bash
docker pull <ユーザー名>/pyplas:1.0.0
docker run -p 8888:8888 <ユーザー名>/pyplas:1.0.0
```

---

## 補足

* ポートは8888番を利用しています。
* 不要ファイルを除外するため、[.dockerignore](../.dockerignore)の設定を推奨します。

---
