export type SourceType = "notion" | "slack" | "crm" | "teams" | "email";
export type IngestedDocument = {
  sourceType: SourceType;
  externalId: string;
  sourceUrl: string | null;
  title: string;
  authorLabel: string | null;
  occurredAt: Date;
  rawText: string;
  externalUpdatedAt: Date | null;
};
export interface SourceConnector {
  sourceType: SourceType;
  fetchDocuments(): Promise<IngestedDocument[]>;
}
