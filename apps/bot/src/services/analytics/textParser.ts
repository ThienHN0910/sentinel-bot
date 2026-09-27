import { STOP_WORDS } from '@sentinel/shared';

export function tokenizeMessage(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // remove links
    .replace(/<[@#&][!&]?\d+>/g, '') // remove Discord mentions/channels/roles
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip special chars keeping unicode letters
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

export function extractMentions(content: string): string[] {
  const matches = content.match(/<@!?(\d+)>/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/<@!?/, '').replace('>', ''));
}
