import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { toSanitizedMarkdownHtml } from "../markdown";
import { classifyMessage } from "./message-classifier";
import {
  extractText,
  extractThinking,
  formatReasoningMarkdown,
} from "./message-extract";
import { extractToolCards, renderToolCardLegacy } from "./tool-cards";

export type LegacyToolOutputProps = {
  isToolOutputExpanded?: (id: string) => boolean;
  onToolOutputToggle?: (id: string, expanded: boolean) => void;
};

export function renderReadingIndicator() {
  return html`
    <div class="chat-line assistant">
      <div class="chat-msg">
        <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
          <span class="chat-reading-indicator__dots">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderMessage(
  message: unknown,
  props?: LegacyToolOutputProps,
  opts?: { streaming?: boolean; showReasoning?: boolean },
) {
  const m = message as Record<string, unknown>;
  const classification = classifyMessage(message);
  const toolCards = extractToolCards(message);
  const hasToolCards = toolCards.length > 0;
  const isToolResult =
    classification.hasToolResults ||
    classification.roleRaw.toLowerCase() === "toolresult" ||
    classification.roleRaw.toLowerCase() === "tool_result" ||
    (classification.isToolLike && !classification.hasText);
  const extractedText = extractText(message);
  const extractedThinking =
    opts?.showReasoning && classification.roleKind === "assistant"
      ? extractThinking(message)
      : null;
  const contentText = typeof m.content === "string" ? m.content : null;
  const fallback = hasToolCards ? null : JSON.stringify(message, null, 2);

  const display =
    !isToolResult && extractedText?.trim()
      ? { kind: "text" as const, value: extractedText }
      : !isToolResult && contentText?.trim()
        ? { kind: "text" as const, value: contentText }
        : !isToolResult && fallback
          ? { kind: "json" as const, value: fallback }
          : null;

  const markdownBase =
    display?.kind === "json"
      ? ["```json", display.value, "```"].join("\n")
      : (display?.value ?? null);
  const reasoningMarkdown = extractedThinking
    ? formatReasoningMarkdown(extractedThinking)
    : null;
  const markdown = markdownBase;

  const timestamp =
    typeof m.timestamp === "number" ? new Date(m.timestamp).toLocaleTimeString() : "";

  const roleKind = classification.roleKind;
  const klass =
    roleKind === "assistant"
      ? "assistant"
      : roleKind === "user"
        ? "user"
        : roleKind === "tool"
          ? "tool"
          : "other";
  const who =
    roleKind === "assistant"
      ? "Assistant"
      : roleKind === "user"
        ? "You"
        : roleKind === "tool"
          ? "Tool"
          : roleKind === "system"
            ? "System"
            : classification.roleRaw;

  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  const toolCardBase =
    toolCallId ||
    (typeof m.id === "string" ? m.id : "") ||
    (typeof m.messageId === "string" ? m.messageId : "") ||
    (typeof m.timestamp === "number" ? String(m.timestamp) : "tool-card");

  return html`
    <div class="chat-line ${klass}">
      <div class="chat-msg">
        <div class="chat-bubble ${opts?.streaming ? "streaming" : ""}">
          ${reasoningMarkdown
            ? html`<div class="chat-thinking">${unsafeHTML(
                toSanitizedMarkdownHtml(reasoningMarkdown),
              )}</div>`
            : nothing}
          ${markdown
            ? html`<div class="chat-text">${unsafeHTML(toSanitizedMarkdownHtml(markdown))}</div>`
            : nothing}
          ${toolCards.map((card, index) =>
            renderToolCardLegacy(card, {
              id: `${toolCardBase}:${index}`,
              expanded: props?.isToolOutputExpanded
                ? props.isToolOutputExpanded(`${toolCardBase}:${index}`)
                : false,
              onToggle: props?.onToolOutputToggle,
            }),
          )}
        </div>
        <div class="chat-stamp mono">
          ${who}${timestamp ? html` · ${timestamp}` : nothing}
        </div>
      </div>
    </div>
  `;
}
