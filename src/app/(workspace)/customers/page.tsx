import { ArrowUpRight, CalendarDays, CircleAlert, Network, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { conversationQuestions } from "./conversation-questions";
import { getCustomerCards } from "./queries";

export const dynamic = "force-dynamic";

function dateLabel(value: Date | null) {
  if (!value) return "予定なし";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(value);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const customers = await getCustomerCards();
  const { q = "" } = await searchParams;
  const query = q.trim().toLocaleLowerCase("ja-JP");
  const visibleCustomers = query
    ? customers.filter((customer) =>
        [customer.name, customer.company, customer.role].some((value) =>
          value.toLocaleLowerCase("ja-JP").includes(query),
        ),
      )
    : customers;

  return (
    <div className="pb-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="game-kicker">顧客マップ</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-indigo-950 sm:text-5xl">
            顧客情報を、つなげて読む
          </h1>
          <p className="mt-3 text-sm font-medium text-indigo-950/60">
            社内の記録を人物・関係・判断材料へ対応づけ、次の訪問に必要な情報を整理します。
          </p>
        </div>
        <div className="customer-count">
          <span>次回訪問あり</span>
          <strong>{customers.length}</strong>
          <span>人</span>
        </div>
      </header>

      <search>
        <form action="/customers" className="customer-search">
          <label className="customer-search-field">
            <span className="sr-only">顧客を検索</span>
            <Search className="size-5 shrink-0 text-indigo-950/45" aria-hidden="true" />
            <input name="q" type="search" defaultValue={q} placeholder="名前・会社・役職で検索" />
          </label>
          <button type="submit">検索</button>
        </form>
      </search>

      {query ? (
        <p className="mt-4 text-xs font-bold text-indigo-950/55">
          「{q.trim()}」の検索結果 {visibleCustomers.length}人
        </p>
      ) : null}

      {visibleCustomers.length ? (
        <section
          aria-label="訪問予定の顧客"
          className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleCustomers.map((customer) => {
            const nextQuestion = customer.firstCheck
              ? conversationQuestions(customer.firstCheck)[0]
              : null;
            const hasNewDiscovery = Boolean(customer.ready && customer.discovery);
            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className={`customer-card accent-${customer.accent} group`}
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b-2 border-indigo-950 bg-white">
                  <Image
                    src={customer.imageUrl}
                    alt={`${customer.name}さん`}
                    fill
                    className="object-cover object-[center_25%] transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading={customer.id === "person-sato" ? "eager" : "lazy"}
                  />
                  <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border-2 border-indigo-950 bg-white px-3 py-1.5 text-[10px] font-black text-indigo-950 shadow-[2px_2px_0_#1e1b4b]">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {dateLabel(customer.nextContactAt)}
                  </span>
                </div>

                <div className="flex min-h-64 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-indigo-950/55">
                        {customer.company}・{customer.role}
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-indigo-950">
                        {customer.name}
                      </h2>
                    </div>
                    <ArrowUpRight
                      className="size-5 shrink-0 text-indigo-950 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </div>

                  <div
                    className={`mt-4 flex min-h-28 flex-1 flex-col justify-center rounded-2xl p-4 ${
                      hasNewDiscovery ? "bg-yellow-100" : "bg-indigo-50"
                    }`}
                  >
                    {hasNewDiscovery ? (
                      <p className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-coral">
                        <Network className="size-3.5" aria-hidden="true" />
                        新しくつながった情報
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-indigo-950/45">
                        <CircleAlert className="size-3.5 text-coral" aria-hidden="true" />
                        次に確認
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-6 font-black text-indigo-950">
                      {hasNewDiscovery
                        ? customer.discovery
                        : (nextQuestion ?? "訪問前の確認事項はありません。")}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t-2 border-indigo-950/10 pt-3">
                    <p className="text-xs font-bold text-indigo-950/55">
                      {customer.checkCount > 0 ? `未確認 ${customer.checkCount}件` : "訪問準備済み"}
                    </p>
                    <span className="flex items-center gap-1 text-xs font-black text-indigo-950">
                      顧客マップを開く
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="customer-search-empty" aria-live="polite">
          <Search className="size-6" aria-hidden="true" />
          <h2>該当する顧客が見つかりません</h2>
          <p>名前・会社・役職を変えて検索してください。</p>
          <Link href="/customers">検索をクリア</Link>
        </section>
      )}
    </div>
  );
}
