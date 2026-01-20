import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { toSanitizedMarkdownHtml } from "../markdown";
import type { MessageGroup } from "../types/chat-types";
import { classifyMessage } from "./message-classifier";
import {
  extractText,
  extractThinking,
  formatReasoningMarkdown,
} from "./message-extract";
import { extractToolCards, renderToolCardSidebar } from "./tool-cards";

export function renderReadingIndicatorGroup() {
  return html`
    <div class="chat-group assistant">
      ${renderAvatar("assistant")}
      <div class="chat-group-messages">
        <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
          <span class="chat-reading-indicator__dots">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderStreamingGroup(
  text: string,
  startedAt: number,
  onOpenSidebar?: (content: string) => void,
) {
  const timestamp = new Date(startedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return html`
    <div class="chat-group assistant">
      ${renderAvatar("assistant")}
      <div class="chat-group-messages">
        ${renderGroupedMessage(
          {
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: startedAt,
          },
          { isStreaming: true, showReasoning: false },
          onOpenSidebar,
        )}
        <div class="chat-group-footer">
          <span class="chat-sender-name">Assistant</span>
          <span class="chat-group-timestamp">${timestamp}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderMessageGroup(
  group: MessageGroup,
  opts: { onOpenSidebar?: (content: string) => void; showReasoning: boolean },
) {
  const roleKind = group.role;
  const who =
    roleKind === "user"
      ? "You"
      : roleKind === "assistant"
        ? "Assistant"
        : roleKind === "tool"
          ? "Tool"
          : roleKind === "system"
            ? "System"
            : roleKind;
  const roleClass =
    roleKind === "user"
      ? "user"
      : roleKind === "assistant"
        ? "assistant"
        : roleKind === "tool"
          ? "tool"
          : "other";
  const timestamp = new Date(group.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return html`
    <div class="chat-group ${roleClass}">
      ${renderAvatar(roleKind)}
      <div class="chat-group-messages">
        ${group.messages.map((item, index) =>
          renderGroupedMessage(
            item.message,
            {
              isStreaming:
                group.isStreaming && index === group.messages.length - 1,
              showReasoning: opts.showReasoning,
            },
            opts.onOpenSidebar,
          ),
        )}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${who}</span>
          <span class="chat-group-timestamp">${timestamp}</span>
        </div>
      </div>
    </div>
  `;
}

function renderAvatar(role: string) {
  const initial =
    role === "user" ? "U" : role === "assistant" ? "A" : role === "tool" ? "⚙" : "?";
  const className =
    role === "user"
      ? "user"
      : role === "assistant"
        ? "assistant"
        : role === "tool"
          ? "tool"
          : "other";
  return html`<div class="chat-avatar ${className}">${initial}</div>`;
}

function renderGroupedMessage(
  message: unknown,
  opts: { isStreaming: boolean; showReasoning: boolean },
  onOpenSidebar?: (content: string) => void,
) {
  const classification = classifyMessage(message);
  const roleLower = classification.roleRaw.toLowerCase();
  const isToolResult =
    classification.hasToolResults ||
    roleLower === "toolresult" ||
    roleLower === "tool_result" ||
    (classification.isToolLike && !classification.hasText);

  const toolCards = extractToolCards(message);
  const hasToolCards = toolCards.length > 0;

  const extractedText = extractText(message);
  const extractedThinking =
    opts.showReasoning && classification.roleKind === "assistant"
      ? extractThinking(message)
      : null;
  const markdownBase = extractedText?.trim() ? extractedText : null;
  const reasoningMarkdown = extractedThinking
    ? formatReasoningMarkdown(extractedThinking)
    : null;
  const markdown = markdownBase;

  const bubbleClasses = [
    "chat-bubble",
    opts.isStreaming ? "streaming" : "",
    "fade-in",
  ]
    .filter(Boolean)
    .join(" ");

  if (!markdown && hasToolCards && isToolResult) {
    return html`${toolCards.map((card) =>
      renderToolCardSidebar(card, onOpenSidebar),
    )}`;
  }

  if (!markdown && !hasToolCards) return nothing;

  return html`
    <div class="${bubbleClasses}">
      ${reasoningMarkdown
        ? html`<div class="chat-thinking">${unsafeHTML(
            toSanitizedMarkdownHtml(reasoningMarkdown),
          )}</div>`
        : nothing}
      ${markdown
        ? html`<div class="chat-text">${unsafeHTML(toSanitizedMarkdownHtml(markdown))}</div>`
        : nothing}
      ${toolCards.map((card) => renderToolCardSidebar(card, onOpenSidebar))}
    </div>
  `;
}
