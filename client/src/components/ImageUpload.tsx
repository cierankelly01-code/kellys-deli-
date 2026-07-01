import { useState, type ChangeEvent } from "react";
import { adminApi } from "../lib/admin";

export function ImageUpload({ value, onChange, label = "Photo" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      onChange(url);
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="field">
      <label>{label}</label>
      {value && <div className="img-preview" style={{ backgroundImage: `url(${value})` }} />}
      <div className="row">
        <label className="btn btn-secondary file-btn" style={{ width: "auto" }}>
          {busy ? "Uploading…" : value ? "Replace photo" : "📷 Upload photo"}
          <input type="file" accept="image/*" onChange={pick} hidden />
        </label>
        {value && <button className="btn-ghost" type="button" onClick={() => onChange("")}>Remove</button>}
      </div>
      {err && <p className="danger" style={{ marginTop: 6 }}>{err}</p>}
    </div>
  );
}
