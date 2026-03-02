import crossAssetData from "../../data/banker-cross-asset.json";

const formattedTime = new Date(crossAssetData.asOf).toLocaleString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

const formatVal = (v: number) => (v >= 1000 ? v.toLocaleString() : v.toString());

const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const CONDENSED = "'Barlow Condensed', system-ui, sans-serif";

const textPrimary = "rgba(255,255,255,0.9)";
const textSecondary = "rgba(255,255,255,0.5)";

const SIGNAL_COLORS: Record<string, string> = {
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
};

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

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.05)",
  padding: "12px 14px",
};

type Asset = (typeof crossAssetData.categories)[0]["assets"][0];

function AssetRow({ a }: { a: Asset }) {
  const changeColor = a.change1d.startsWith("+")
    ? "#f87171"
    : a.change1d.startsWith("-")
    ? "#34d399"
    : textPrimary;
  const absZ = Math.abs(a.zscore);
  const zColor =
    absZ >= 2 ? "#f87171" : absZ >= 1.5 ? "#fb923c" : "rgba(255,255,255,0.28)";
  const sigColor = SIGNAL_COLORS[a.signal] || textSecondary;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto auto",
        gap: "0 10px",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: 12, color: textPrimary }}>{a.name}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: textPrimary,
          fontFamily: MONO,
          whiteSpace: "nowrap",
        }}
      >
        {formatVal(a.current)}
        {a.unit && (
          <span
            style={{ fontSize: 9, color: textSecondary, marginLeft: 3 }}
          >
            {a.unit}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: changeColor,
          fontFamily: MONO,
          minWidth: 46,
          textAlign: "right",
        }}
      >
        {a.change1d}
      </span>
      <span
        style={{
          fontSize: 10,
          color: zColor,
          fontFamily: MONO,
          minWidth: 38,
          textAlign: "right",
        }}
      >
        {a.zscore > 0 ? "+" : ""}
        {a.zscore.toFixed(1)}σ
      </span>
      <span
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: sigColor,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export default function CrossAssetDashboard() {
  const { categories } = crossAssetData;

  const gridCats = categories.filter((c) => c.id !== "fx");
  const fxCat = categories.find((c) => c.id === "fx");

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
      {/* Timestamp */}
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.3)",
          marginBottom: 16,
          fontFamily: MONO,
        }}
      >
        As of {formattedTime}
      </div>

      {/* 2×2 grid — Energy, EM Rates, Credit, Equities */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {gridCats.map((cat) => (
          <div key={cat.id} style={cardStyle}>
            <p style={sectionHeader}>{cat.label}</p>
            {cat.assets.map((a) => (
              <AssetRow key={a.id} a={a} />
            ))}
          </div>
        ))}
      </div>

      {/* EM FX — full-width tiles */}
      {fxCat && (
        <div style={cardStyle}>
          <p style={sectionHeader}>{fxCat.label}</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
            }}
          >
            {fxCat.assets.map((a) => {
              const changeColor = a.change1d.startsWith("+")
                ? "#f87171"
                : "#34d399";
              const sigColor = SIGNAL_COLORS[a.signal] || textSecondary;
              const absZ = Math.abs(a.zscore);
              const zColor =
                absZ >= 2
                  ? "#f87171"
                  : absZ >= 1.5
                  ? "#fb923c"
                  : "rgba(255,255,255,0.28)";

              return (
                <div
                  key={a.id}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    borderRadius: 6,
                    padding: "10px 10px 8px",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: CONDENSED,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: textPrimary,
                      fontFamily: MONO,
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {formatVal(a.current)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: changeColor,
                        fontFamily: MONO,
                      }}
                    >
                      {a.change1d}
                    </span>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: sigColor,
                        display: "inline-block",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: zColor,
                      fontFamily: MONO,
                    }}
                  >
                    {a.zscore > 0 ? "+" : ""}
                    {a.zscore.toFixed(1)}σ
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
