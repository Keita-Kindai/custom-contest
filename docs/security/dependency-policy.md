# Dependency admission policy

新しいライブラリ、GitHub Action、Docker image、画像・fontなどのassetへ同じ審査を適用します。

## npm packageを追加する手順

1. 標準APIまたは既存依存で満たせるか確認する。
2. package名、目的、直接利用箇所、代替案をinventoryに記録する。
3. 公式registryのrepository、license、Node対応範囲を確認する。
4. repositoryのrelease履歴、maintainer、未解決security issueを確認する。
5. install scriptと要求権限を確認する。
6. exact versionで追加し、lockfileを更新する。
7. `pnpm audit --prod`、`pnpm check`、差分確認を実行する。

## 更新する手順

- DependabotのPRを一つずつ検証する。
- major updateはADRまたは既存ADRの再検討として扱う。
- 緊急security updateは影響範囲と検証結果をPRへ記録する。

## install script

pnpmが保留したbuild scriptは、package、実行内容、必要性を確認してから許可一覧へ追加します。
許可しない場合は、同じ機能を提供するinstall script不要のpackageまたは標準APIを選びます。

## GitHub Actionsとcontainer

- Actionはcommit SHAで固定し、コメントにrelease tagを残す。
- Containerはversion tagとdigestを固定する。
- digest確認前はローカル検証用候補として扱い、本番・CIに使用しない。
