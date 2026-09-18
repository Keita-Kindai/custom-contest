import type { Metadata } from "next";
import Link from "next/link";

import { PracticeShell } from "./_practice/practice-shell";
import "./landing.css";

export const metadata: Metadata = {
  title: "問題セットを探す・作る — Custom Contest",
  description: "公開問題セットを探し、自分のセットを作って、解いた記録を残す。",
};

export default function Home() {
  return (
    <PracticeShell>
      <div className="landing">
        <section className="landing-intro" aria-labelledby="landing-title">
          <div className="landing-intro-copy">
            <p className="landing-eyebrow">CUSTOM CONTEST / PRACTICE</p>
            <h1 id="landing-title">解きたい問題を、<br />自分の順番に。</h1>
            <p className="landing-lead">
              公開された問題セットから始めても、自分で一問ずつ選んでもいい。
              練習の道筋を作り、解いた記録をセットごとに残せます。
            </p>
            <div className="landing-actions">
              <Link className="landing-action-primary" href="/discover">
                問題セットを探す <span aria-hidden="true">→</span>
              </Link>
              <Link className="landing-action-secondary" href="/sets/new">
                自分で作る <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className="landing-signin-note">
              公開セットはログインなしで閲覧できます。作成と記録にはログインが必要です。
            </p>
          </div>
          <div className="landing-intro-index" aria-label="練習の進め方">
            <span className="landing-index-heading">この場所でできること</span>
            <span><b>01</b> 探す</span>
            <span><b>02</b> 組み立てる</span>
            <span><b>03</b> 解き進める</span>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="landing-workflow-title">
          <div className="landing-workflow-heading">
            <p className="landing-eyebrow">ひとつのセットから始める</p>
            <h2 id="landing-workflow-title">探す。組む。続ける。</h2>
          </div>
          <ol className="landing-workflow-list">
            <li className="landing-workflow-step">
              <span className="landing-step-number" aria-hidden="true">01</span>
              <div className="landing-step-copy">
                <h3>公開セットを探す</h3>
                <p>タグや想定者から、今の自分に合う問題セットを見つけます。ログイン前でも閲覧できます。</p>
                <Link href="/discover">Discoverへ <span aria-hidden="true">↗</span></Link>
              </div>
              <div className="landing-step-detail" aria-hidden="true">
                <span>DISCOVER</span>
                <strong>公開された問題セット</strong>
                <small>人気順・新着順から選ぶ</small>
              </div>
            </li>
            <li className="landing-workflow-step">
              <span className="landing-step-number" aria-hidden="true">02</span>
              <div className="landing-step-copy">
                <h3>自分のセットを組む</h3>
                <p>問題を検索して追加し、順番を変え、公開・限定公開・非公開から共有範囲を選べます。</p>
                <Link href="/sets/new">問題セットを作る <span aria-hidden="true">↗</span></Link>
              </div>
              <div className="landing-step-detail" aria-hidden="true">
                <span>CREATE</span>
                <strong>一問ずつ、好きな順番に</strong>
                <small>下書きから始めてもいい</small>
              </div>
            </li>
            <li className="landing-workflow-step">
              <span className="landing-step-number" aria-hidden="true">03</span>
              <div className="landing-step-copy">
                <h3>解いた記録を残す</h3>
                <p>未着手・自力で解いた・解説を見て解いた、という状態をセットごとに記録できます。</p>
                <Link href="/library">マイページへ <span aria-hidden="true">↗</span></Link>
              </div>
              <div className="landing-step-detail" aria-hidden="true">
                <span>PROGRESS</span>
                <strong>練習の続きを見つける</strong>
                <small>作成・保存・最近見たセット</small>
              </div>
            </li>
          </ol>
        </section>

        <section className="landing-close" aria-labelledby="landing-close-title">
          <div>
            <p className="landing-eyebrow">次の一問へ</p>
            <h2 id="landing-close-title">まずは、ひとつ探してみる。</h2>
          </div>
          <Link className="landing-action-primary" href="/discover">
            公開セットを見る <span aria-hidden="true">→</span>
          </Link>
        </section>
        <footer className="landing-footer">
          <span>Custom Contest</span>
          <span>問題セットを探し、作り、解き進める。</span>
        </footer>
      </div>
    </PracticeShell>
  );
}
