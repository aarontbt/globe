import type { IncomingMessage, ServerResponse } from "node:http";

// Only the platform-provided request/response surface used by our handlers.
// Keeping these structural types local avoids depending on Vercel's build runtime.
export type ApiRequest = IncomingMessage & {
  query: Partial<Record<string, string | string[]>>;
};

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(body: unknown): ApiResponse;
};
