import sanctionsData from "../../data/banker-sanctions.json";

const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const CONDENSED = "'Barlow Condensed', system-ui, sans-serif";

const textPrimary = "rgba(255,255,255,0.9)";
const textSecondary = "rgba(255,255,255,0.5)";

const sectionHeader: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.28)",
  margin: 0,
  marginBottom: 10,
  fontFamily: CONDENSED,
};

const STATUS_COLORS: Record<string, string> = {
  active: "#34d399",
  pending: "#fbbf24",
  lifted: "rgba(255,255,255,0.28)",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f87171",
  high: "#fdba74",
  medium: "#fbbf24",
};

const AUTHORITY_COLORS: Record<string, string> = {
  OFAC: "#38bdf8",
  EU: "#c4b5fd",
  UN: "#94a3b8",
};

const TABLE_COLUMNS: { label: string; align: "center" | "left" }[] = [
  { label: "Date", align: "center" },
  { label: "Auth", align: "center" },
  { label: "Status", align: "center" },
  { label: "Description", align: "left" },
];

export default function SanctionsTrackerPanel() {
  const { sanctionsEntries, redFlagClients, evidenceLinks } = sanctionsData;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        padding: 20,
        color: textPrimary,
      }}
    >
      {/* 2-column split */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>

        {/* Left — Sanctions Entries table */}
        <div>
          <p style={sectionHeader}>Sanctions Entries</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.28)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "4px 8px",
                      textAlign: col.align,
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      whiteSpace: "nowrap",
                      fontFamily: CONDENSED,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sanctionsEntries.map((e) => {
                const statusColor = STATUS_COLORS[e.status] || textSecondary;
                const authorityColor =
                  AUTHORITY_COLORS[e.authority] || "#22d3ee";
                return (
                  <tr key={e.id}>
                    <td
                      style={{
                        fontSize: 10,
                        color: textSecondary,
                        padding: "6px 8px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        whiteSpace: "nowrap",
                        fontFamily: MONO,
                      }}
                    >
                      {e.date}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: authorityColor + "14",
                          color: authorityColor,
                          fontFamily: CONDENSED,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {e.authority}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: statusColor + "14",
                          color: statusColor,
                          textTransform: "capitalize",
                          fontFamily: CONDENSED,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td
                      style={{
                        fontSize: 11,
                        color: textPrimary,
                        padding: "6px 8px",
                        lineHeight: 1.4,
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      {e.description}
                      <div
                        style={{
                          fontSize: 9,
                          color: textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {e.affectedEntities.join(", ")}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right — Red-Flag Clients + Evidence Lineage */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Red-Flag Clients */}
          <div>
            <p style={sectionHeader}>Red-Flag Clients</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {redFlagClients.map((c) => {
                const sevColor = SEVERITY_COLORS[c.severity] || textSecondary;
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderLeft: `3px solid ${sevColor}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: textPrimary,
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: sevColor + "14",
                          color: sevColor,
                          textTransform: "uppercase",
                          fontFamily: CONDENSED,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {c.severity}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {c.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evidence Lineage */}
          <div>
            <p style={sectionHeader}>Evidence Lineage</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {evidenceLinks.map((link) => (
                <div
                  key={link.id}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11,
                        color: "#38bdf8",
                        textDecoration: "none",
                        lineHeight: 1.3,
                      }}
                    >
                      {link.title}
                    </a>
                    <span
                      style={{
                        fontSize: 9,
                        color: textSecondary,
                        whiteSpace: "nowrap",
                        fontFamily: MONO,
                        flexShrink: 0,
                      }}
                    >
                      {link.date}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                    {link.source}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
