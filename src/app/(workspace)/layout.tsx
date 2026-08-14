import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
export const metadata: Metadata = {
  title: "KYAKUMAP — 顧客情報を、つなげて読む",
  description: "社内に散らばる記録を、顧客・関係者・判断材料へ対応づける営業準備AI。",
};
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-lavender text-indigo-950">
      <header className="brand-header">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/customers" className="brand-lockup">
            <BrandMark className="size-10" />
            <span>
              <strong>KYAKUMAP</strong>
              <small>顧客情報を、つなげて読む</small>
            </span>
          </Link>
          <nav aria-label="メインナビゲーション">
            <Link href="/customers" className="brand-nav-link">
              顧客一覧
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9">{children}</main>
    </div>
  );
}
