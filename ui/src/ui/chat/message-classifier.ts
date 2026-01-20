import { extractRawText, extractThinking } from "./message-extract";

export type RoleKind = "assistant" | "user" | "tool" | "system" | "other";

export type MessageClassification = {
  roleRaw: string;
  roleKind: RoleKind;
  hasText: boolean;
  hasThinking: boolean;
  hasToolCalls: boolean;
  hasToolResults: boolean;
  isToolLike: boolean;
  displayLabel: string;
};

const TOOL_CALL_TYPES = new Set([
  "toolcall",
  "tool_call",
  "tooluse",
  "tool_use",
  "toolcall",
  "tooluse",
  "functioncall",
]);

const TOOL_RESULT_TYPES = new Set(["toolresult", "tool_result"]);

export function classifyMessage(message: unknown): MessageClassification {
  const m = message as Record<string, unknown>;
  const roleRaw = typeof m.role === "string" ? m.role : "unknown";
  const roleLower = roleRaw.toLowerCase();

  const content = Array.isArray(m.content)
    ? (m.content as Array<Record<string, unknown>>)
    : [];

  const hasText = Boolean(extractRawText(message)?.trim());
  const hasThinking = Boolean(extractThinking(message)?.trim());
  const hasToolCalls = content.some((item) => {
    const kind = String(item.type ?? "").toLowerCase();
    if (TOOL_CALL_TYPES.has(kind)) return true;
    return typeof item.name === "string" && (item.arguments ?? item.args ?? item.input) != null;
  });
  const hasToolResults = content.some((item) =>
    TOOL_RESULT_TYPES.has(String(item.type ?? "").toLowerCase()),
  );

  const hasToolId =
    typeof m.toolCallId === "string" ||
    typeof m.tool_call_id === "string" ||
    typeof m.toolUseId === "string" ||
    typeof m.tool_use_id === "string";
  const hasToolName =
    typeof m.toolName === "string" || typeof m.tool_name === "string";

  const isRoleTool =
    roleLower === "tool" ||
    roleLower === "toolresult" ||
    roleLower === "tool_result" ||
    roleLower === "function";

  const isToolLike =
    isRoleTool || hasToolId || hasToolName || hasToolCalls || hasToolResults;

  let roleKind: RoleKind;
  if (roleLower === "user") {
    roleKind = "user";
  } else if (roleLower === "assistant") {
    roleKind = isToolLike && !hasText ? "tool" : "assistant";
  } else if (roleLower === "system") {
    roleKind = "system";
  } else if (isRoleTool) {
    roleKind = "tool";
  } else if (isToolLike && !hasText) {
    roleKind = "tool";
  } else {
    roleKind = "other";
  }

  const displayLabel =
    roleKind === "assistant"
      ? "Assistant"
      : roleKind === "user"
        ? "You"
        : roleKind === "tool"
          ? "Tool"
          : roleKind === "system"
            ? "System"
            : roleRaw;

  return {
    roleRaw,
    roleKind,
    hasText,
    hasThinking,
    hasToolCalls,
    hasToolResults,
    isToolLike,
    displayLabel,
  };
}
