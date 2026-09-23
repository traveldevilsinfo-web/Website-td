import { marked } from "marked";

// Content is authored by trusted admins; raw HTML in markdown passes through.
export const md = (s: string | null | undefined) => (s ? (marked.parse(s, { async: false }) as string) : "");
