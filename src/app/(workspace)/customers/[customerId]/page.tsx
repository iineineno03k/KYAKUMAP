import { ArrowLeft, CalendarDays } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { conversationQuestions } from "../conversation-questions";
import { CustomerAiChat } from "./_components/customer-ai-chat";
import { StrategyBoard } from "./_components/strategy-board";
import { getCustomerBoard } from "./queries";
export const dynamic = "force-dynamic";
function dateLabel(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Tokyo",
      }).format(value)
    : "未定";
}
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const data = await getCustomerBoard(customerId);
  if (!data) notFound();
  const suggestedQuestions = data.moves.flatMap(({ label }) => conversationQuestions(label));
  return (
    <div className="pb-10">
      <Link
        href="/customers"
        className="mb-5 inline-flex items-center gap-1 text-sm font-black text-indigo-950/60 hover:text-indigo-950"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        顧客一覧
      </Link>
      <header className={`profile-hero accent-${data.customer.accent}`}>
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-[1.6rem] border-2 border-indigo-950 bg-white shadow-[5px_5px_0_#1e1b4b] sm:w-40">
          <Image
            src={data.customer.imageUrl}
            alt={`${data.customer.name}さん`}
            fill
            className="object-cover object-[center_25%]"
            sizes="160px"
            loading="eager"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="game-kicker">顧客マップ</p>
          <p className="mt-3 text-sm font-black text-indigo-950/55">
            {data.customer.company}・{data.customer.role}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-indigo-950 sm:text-5xl">
            {data.customer.name}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 font-bold text-indigo-950/65">
            「{data.customer.catchphrase}」
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full border-2 border-indigo-950 bg-white px-3 py-1.5">
              {data.customer.salesProfile.age ?? "年齢未確認"}
            </span>
            <span className="rounded-full border-2 border-indigo-950 bg-white px-3 py-1.5">
              担当 {data.customer.ownerName}
            </span>
            <span className="flex items-center gap-1 rounded-full border-2 border-indigo-950 bg-white px-3 py-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              次回 {dateLabel(data.customer.nextContactAt)}
            </span>
          </div>
        </div>
      </header>
      <section className="customer-basics" aria-label="基本プロフィール">
        <div>
          <p className="game-kicker">PROFILE</p>
          <h2>基本プロフィール</h2>
        </div>
        <dl>
          <div>
            <dt>所属・役職</dt>
            <dd>
              {data.customer.company}・{data.customer.role}
            </dd>
          </div>
          <div>
            <dt>年齢</dt>
            <dd>{data.customer.salesProfile.age ?? "未確認"}</dd>
          </div>
          <div>
            <dt>経歴</dt>
            <dd>{data.customer.salesProfile.career ?? "未確認"}</dd>
          </div>
          <div>
            <dt>担当範囲</dt>
            <dd>{data.customer.salesProfile.responsibility ?? "未確認"}</dd>
          </div>
        </dl>
      </section>
      <StrategyBoard
        customerId={data.customer.id}
        salesProfile={data.customer.salesProfile}
        panels={data.panels.map(({ id, title, icon, status, summary, unlockHint, items }) => ({
          id,
          title,
          icon,
          status,
          summary,
          unlockHint,
          items: items.map(
            ({
              id: itemId,
              label,
              status: itemStatus,
              valueText,
              unlockHint: itemHint,
              weight,
            }) => ({
              id: itemId,
              label,
              status: itemStatus,
              valueText,
              unlockHint: itemHint,
              weight,
            }),
          ),
        }))}
        evidence={data.evidence.map(
          ({ id, panelId, fact, sourceLabel, authorName, sourceUrl }) => ({
            id,
            panelId,
            fact,
            sourceLabel,
            authorName,
            sourceUrl,
          }),
        )}
        graph={data.graph}
        nextQuestion={suggestedQuestions[0] ?? null}
      >
        <CustomerAiChat
          customerId={data.customer.id}
          customerName={data.customer.name}
          customerImageUrl={data.customer.imageUrl}
          sectionId="customer-ai"
          suggestedQuestions={suggestedQuestions.slice(0, 4)}
        />
      </StrategyBoard>
    </div>
  );
}
