import "server-only";
import { notionConnector } from "./notion-connector";
import { persistDocuments } from "./persist-documents";
export async function syncNotionSourceDocuments() {
  return persistDocuments(await notionConnector.fetchDocuments());
}
