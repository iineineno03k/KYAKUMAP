import "server-only";
import { readSubmittedNotionReports } from "@/server/notion/client";
import type { SourceConnector } from "./types";
export const notionConnector: SourceConnector = {
  sourceType: "notion",
  async fetchDocuments() {
    const reports = await readSubmittedNotionReports();
    return reports
      .filter((report) => report.pageId && report.body)
      .map((report) => ({
        sourceType: "notion" as const,
        externalId: report.pageId,
        sourceUrl: report.pageUrl || null,
        title: report.title || report.customerName || "Notion営業記録",
        authorLabel: report.authorName || null,
        occurredAt: new Date(
          (report.reportDate || report.lastEditedAt) + (report.reportDate ? "T00:00:00+09:00" : ""),
        ),
        rawText: report.body,
        externalUpdatedAt: new Date(report.lastEditedAt),
      }));
  },
};
