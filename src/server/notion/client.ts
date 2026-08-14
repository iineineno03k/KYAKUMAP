import "server-only";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

type JsonObject = Record<string, unknown>;

export type NotionDailyReport = {
  pageId: string;
  pageUrl: string;
  lastEditedAt: string;
  title: string;
  authorName: string;
  customerName: string;
  reportDate: string;
  activityType: string | null;
  body: string;
};

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}が設定されていません`);
  return value;
}

async function notionFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${env("NOTION_API_TOKEN")}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as JsonObject;
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => object(item)?.plain_text)
    .filter((item): item is string => typeof item === "string")
    .join("");
}

function property(properties: JsonObject, name: string): JsonObject | null {
  return object(properties[name]);
}

function titleProperty(properties: JsonObject, name: string) {
  return richText(property(properties, name)?.title);
}

function textProperty(properties: JsonObject, name: string) {
  return richText(property(properties, name)?.rich_text);
}

function selectProperty(properties: JsonObject, name: string) {
  const selected = object(property(properties, name)?.select);
  return typeof selected?.name === "string" ? selected.name : "";
}

function dateProperty(properties: JsonObject, name: string) {
  const date = object(property(properties, name)?.date);
  return typeof date?.start === "string" ? date.start.slice(0, 10) : "";
}

function blockText(block: JsonObject) {
  const type = typeof block.type === "string" ? block.type : "";
  const value = object(block[type]);
  return richText(value?.rich_text).trim();
}

async function blockChildren(blockId: string): Promise<JsonObject[]> {
  const blocks: JsonObject[] = [];
  let cursor: string | undefined;
  do {
    const suffix = new URLSearchParams({
      page_size: "100",
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const response = await notionFetch(`/blocks/${blockId}/children?${suffix}`);
    const results = Array.isArray(response.results) ? response.results : [];
    blocks.push(...results.flatMap((item) => (object(item) ? [object(item) as JsonObject] : [])));
    cursor =
      response.has_more && typeof response.next_cursor === "string"
        ? response.next_cursor
        : undefined;
  } while (cursor);
  return blocks;
}

async function pageBody(pageId: string) {
  const lines: string[] = [];
  const walk = async (parentId: string, depth: number) => {
    if (depth > 2) return;
    for (const block of await blockChildren(parentId)) {
      const text = blockText(block);
      if (text) lines.push(text);
      if (block.has_children === true && typeof block.id === "string") {
        await walk(block.id, depth + 1);
      }
    }
  };
  await walk(pageId, 0);
  return lines.join("\n").trim();
}

export async function readSubmittedNotionReports(): Promise<NotionDailyReport[]> {
  const pages: JsonObject[] = [];
  let cursor: string | undefined;
  do {
    const response = await notionFetch(`/data_sources/${env("NOTION_DATA_SOURCE_ID")}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 100,
        filter: { property: "状態", select: { equals: "提出済み" } },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    const results = Array.isArray(response.results) ? response.results : [];
    pages.push(...results.flatMap((item) => (object(item) ? [object(item) as JsonObject] : [])));
    cursor =
      response.has_more && typeof response.next_cursor === "string"
        ? response.next_cursor
        : undefined;
  } while (cursor);

  return Promise.all(
    pages.map(async (page) => {
      const properties = object(page.properties) ?? {};
      const bodyFromBlocks = typeof page.id === "string" ? await pageBody(page.id) : "";
      return {
        pageId: typeof page.id === "string" ? page.id : "",
        pageUrl: typeof page.url === "string" ? page.url : "",
        lastEditedAt:
          typeof page.last_edited_time === "string"
            ? page.last_edited_time
            : new Date().toISOString(),
        title: titleProperty(properties, "営業記録") || titleProperty(properties, "日報"),
        authorName: selectProperty(properties, "担当者") || textProperty(properties, "担当者"),
        customerName: selectProperty(properties, "案件") || textProperty(properties, "案件"),
        reportDate: dateProperty(properties, "日付"),
        activityType:
          selectProperty(properties, "活動種別") || textProperty(properties, "活動種別") || null,
        body: bodyFromBlocks || textProperty(properties, "本文"),
      };
    }),
  );
}
