import {
    Document,
    Page,
    StyleSheet,
    Text,
    View
} from "@react-pdf/renderer/lib/react-pdf.browser";

type CoordinationAiSection = {
  heading: string;
  body: string;
};

export function CoordinationAiDocument({
  title,
  generatedAt,
  sections,
}: {
  title: string;
  generatedAt: string;
  sections: CoordinationAiSection[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Gerado em {generatedAt}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body || "-"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 32,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#111827",
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  meta: {
    fontSize: 10,
    color: "#4b5563",
    marginBottom: 6,
  },
  section: {
    gap: 4,
    marginBottom: 6,
  },
  heading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  body: {
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  },
});
