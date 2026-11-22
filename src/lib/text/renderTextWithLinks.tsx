import { Fragment, type MouseEvent, type ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/g;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]]+$/;

export type RenderTextWithLinksOptions = {
  linkClassName: string;
  onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

export function renderTextWithLinks(
  text: string,
  { linkClassName, onLinkClick }: RenderTextWithLinksOptions,
): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  const re = new RegExp(URL_RE);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    let raw = match[0];

    const trailingMatch = raw.match(TRAILING_PUNCTUATION_RE);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    if (trailing) raw = raw.slice(0, -trailing.length);

    if (start > cursor) nodes.push(text.slice(cursor, start));

    const href = raw.startsWith("www.") ? `https://${raw}` : raw;
    nodes.push(
      <a
        key={`link-${key}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onLinkClick}
        className={linkClassName}
      >
        {raw}
      </a>,
    );
    key += 1;

    if (trailing) nodes.push(trailing);
    cursor = start + raw.length + trailing.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}
