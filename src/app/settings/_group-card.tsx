"use client";
import type { Field, Group } from "./_groups";

interface GroupCardProps {
  group: Group;
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
}

/** A field is shown unless it has `showIf` and none of its conditions match the
 *  current values (used to reveal only the selected provider's key/model). */
function isVisible(f: Field, values: Record<string, string>): boolean {
  if (!f.showIf || f.showIf.length === 0) return true;
  return f.showIf.some((c) => c.in.includes((values[c.key] ?? "").trim()));
}

function FieldRow({
  f,
  values,
  setValues,
}: {
  f: Field;
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
}) {
  const missing = f.required && !values[f.key];
  const set = (v: string) => setValues({ ...values, [f.key]: v });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <label
          className="label"
          style={{ margin: 0, color: f.required ? "var(--danger)" : "var(--fg)", fontWeight: 600, letterSpacing: "0.01em" }}
        >
          {f.label ?? f.key}
        </label>
        {f.required && <span style={{ color: "var(--danger)", fontSize: 10.5, fontWeight: 700 }}>required</span>}
      </div>

      {f.type === "select" && f.options ? (
        <select className="input" value={values[f.key] ?? ""} onChange={(e) => set(e.target.value)} style={{ cursor: "pointer" }}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.multiline ? (
        <textarea
          className="textarea"
          value={values[f.key] ?? ""}
          placeholder={f.examples ? `e.g. ${f.examples}` : ""}
          onChange={(e) => set(e.target.value)}
          rows={Math.max(2, Math.min(6, (values[f.key] ?? "").split(/\n/).length + 1))}
          maxLength={f.maxLength}
          style={{ borderColor: missing ? "var(--danger)" : undefined }}
        />
      ) : (
        <input
          className="input"
          value={values[f.key] ?? ""}
          placeholder={f.examples ? `e.g. ${f.examples}` : ""}
          onChange={(e) => set(e.target.value)}
          maxLength={f.maxLength}
          style={{ borderColor: missing ? "var(--danger)" : undefined }}
        />
      )}

      <div style={{ color: "var(--fg-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-line" }}>{f.desc}</div>
      {f.examples && f.type !== "select" && (
        <div className="mono faint" style={{ fontSize: 11, marginTop: 3 }}>
          {f.examples}
        </div>
      )}
    </div>
  );
}

/** Renders one settings group. Collapsible groups render as a closed <details>
 *  so all the advanced/technical settings stay out of the way by default. */
export function GroupCard({ group, values, setValues }: GroupCardProps) {
  const visible = group.fields.filter((f) => isVisible(f, values));
  if (visible.length === 0) return null;

  const body = (
    <div style={{ display: "grid", gap: 16 }}>
      {visible.map((f) => (
        <FieldRow key={f.key} f={f} values={values} setValues={setValues} />
      ))}
    </div>
  );

  if (group.collapsed) {
    return (
      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, listStyle: "revert" }}>
          {group.title} <span className="faint" style={{ fontSize: 11, fontWeight: 400 }}>— advanced, optional</span>
        </summary>
        {group.subtitle && (
          <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 14px", lineHeight: 1.55 }}>
            {group.subtitle}
          </p>
        )}
        <div style={{ marginTop: group.subtitle ? 0 : 12 }}>{body}</div>
      </details>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: group.required ? "rgba(248,113,113,0.4)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>{group.title}</h2>
        {group.required && (
          <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            REQUIRED
          </span>
        )}
      </div>
      {group.subtitle && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 16, lineHeight: 1.55 }}>
          {group.subtitle}
        </p>
      )}
      {body}
    </div>
  );
}
