/**
 * Text processing utilities for Vibe Combat
 */

export function htmlToPlainText(html) {
  if (!html) return "";
  try {
    if (foundry.applications?.ux?.TextEditor?.implementation?.getText) {
      return foundry.applications.ux.TextEditor.implementation.getText(html, { preserveWhitespace: true });
    }
    if (TextEditor?.getText) {
      return TextEditor.getText(html, { preserveWhitespace: true });
    }
  } catch (err) {
    console.warn("Vibe Combat | Failed to parse HTML text.", err);
  }
  return html.replace(/<[^>]*>/g, " ");
}

export function paragraphsFromText(text) {
  const trimmed = text?.trim();
  if (!trimmed) return "<p></p>";
  const sections = trimmed.split(/\n+/).map((segment) => segment.trim()).filter(Boolean);
  if (sections.length === 0) {
    return `<p>${trimmed}</p>`;
  }
  return `<p>${sections.join("</p><p>")}</p>`;
}

export function replaceNamesWithUuids(text, items) {
  if (!text) return "";
  let output = text;
  for (const item of items) {
    if (!item.name || !item.uuid) continue;
    const pattern = new RegExp(`(?<!\\]\\{)\\b${escapeRegExp(item.name)}\\b`, "gi");
    output = output.replace(pattern, `@UUID[${item.uuid}]{${item.name}}`);
  }
  return output;
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripAbilityLabel(text, label) {
  if (!text) return "";
  const regex = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:`, "i");
  return text.replace(regex, "").trim();
}
