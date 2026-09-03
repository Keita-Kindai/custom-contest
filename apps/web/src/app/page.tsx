import { projectSummary } from "@custom-contest/contracts";

const nextSteps = [
  "Claude Designの成果物を docs/design に保存する",
  "機能境界ごとにADRを作る",
  "主要フローのシーケンス図を作る",
  "Fake ACのBattle modeから実装する",
];

export default function Home() {
  return (
    <main>
      <section className="panel">
        <p className="eyebrow">ENVIRONMENT READY</p>
        <h1>{projectSummary.name}</h1>
        <p className="lead">{projectSummary.tagline}</p>
        <ol>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="note">
          このページは起動確認用です。正式なUIはClaude Designの画面仕様を取り込んでから実装します。
        </p>
      </section>
    </main>
  );
}
