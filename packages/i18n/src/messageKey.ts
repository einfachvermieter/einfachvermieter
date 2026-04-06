export type MessageKey = {
  key: string;
  params?: Record<string, unknown>;
};

export const messageKey = (
  key: string,
  params?: Record<string, unknown>,
): string => JSON.stringify({ key, params } satisfies MessageKey);

export const parseMessageKey = (raw: string): MessageKey | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<MessageKey>;

    if (typeof parsed?.key === "string") {
      return { key: parsed.key, params: parsed.params };
    }
  } catch {
    return null;
  }
  return null;
};
