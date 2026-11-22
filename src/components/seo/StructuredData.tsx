type StructuredDataValue = Record<string, unknown>;

export function StructuredData({ id, data }: { id: string; data: StructuredDataValue }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
