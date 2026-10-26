"use client";

import React, { useMemo, useRef, useState } from "react";
import { buildPlan, readCustomers, exportRows } from "./importLogic";
import { parseCsv } from "../stock/importLogic";

// "Import from Excel" / "Export to Excel" on the Customers screen (managers only). The screen never writes anything
// until the manager confirms the preview, and nothing is ever deleted.

const T = {
  en: {
    title: "Import customers from Excel",
    intro: "Upload a spreadsheet with one row per customer: name, phone and address (order count and last-order date are used too if present). New phone numbers are added; customers who already exist are matched by phone number. Nothing is ever deleted.",
    choose: "Choose Excel file",
    formats: "Excel (.xlsx) or CSV. Columns can be in any order, with English or Arabic headings. The phone column is required.",
    template: "Download template",
    reading: "Reading the file…",
    errRead: "Couldn't read that file. Save it as .xlsx or .csv and try again.",
    errXls: "Old .xls files aren't supported. In Excel choose Save As → Excel Workbook (.xlsx).",
    errEmpty: "I couldn't find any customers. The sheet needs a column with phone numbers.",
    cNew: "new",
    cUpdate: "updated",
    cSame: "unchanged",
    cSkip: "skipped",
    cError: "problems",
    updateExisting: "Also update the name and address of customers who already exist",
    untouched: "Customers who are not in the sheet are left untouched, and blank cells never erase what is stored.",
    thRow: "Row",
    thName: "Name",
    thPhone: "Phone",
    thAddress: "Address",
    thWhat: "What happens",
    aAdd: "New customer",
    aUpdate: "Update",
    aSame: "No change",
    aSkip: "Skipped",
    aError: "Problem",
    was: "was “{{old}}”",
    onlyProblems: "Show only rows that need attention",
    importBtn: "Import {{n}} customer(s)",
    back: "Choose another file",
    close: "Close",
    doneTitle: "Done",
    done: "{{added}} added, {{updated}} updated. The Customers screen is up to date.",
    queued: "You appear to be offline — the change is saved on this device and will reach the server when the connection returns.",
    importing: "Importing…",
    notes: { bad_phone: "no valid phone number", dup: "listed again further down, so the last one is used", exists: "already a customer (not changed)", same: "no change" },
    sheet: "Customers",
    hName: "Name",
    hPhone: "Phone",
    hAddress: "Address",
    hOrders: "Orders",
    hLast: "Last order",
    sample: [["Sara Ahmed", "01012345678", "12 Nile Street, Maadi"], ["Omar Khaled", "01112345678", "Zamalek, building 4"]],
  },
  ar: {
    title: "استيراد العملاء من إكسل",
    intro: "ارفع ملفًا فيه صف لكل عميل: الاسم والهاتف والعنوان (ويُستفاد أيضًا من عدد الطلبات وتاريخ آخر طلب إن وُجدا). تُضاف أرقام الهواتف الجديدة، ويُطابَق العملاء الموجودون برقم الهاتف. لا يُحذف أي شيء أبدًا.",
    choose: "اختر ملف إكسل",
    formats: "ملف إكسل (.xlsx) أو CSV. يمكن ترتيب الأعمدة كما تشاء وبعناوين عربية أو إنجليزية. عمود الهاتف مطلوب.",
    template: "تنزيل نموذج",
    reading: "جارٍ قراءة الملف…",
    errRead: "تعذّرت قراءة هذا الملف. احفظه بصيغة .xlsx أو .csv وحاول مجددًا.",
    errXls: "ملفات .xls القديمة غير مدعومة. في إكسل اختر حفظ باسم ← مصنف إكسل (.xlsx).",
    errEmpty: "لم أجد أي عملاء. يحتاج الملف إلى عمود لأرقام الهواتف.",
    cNew: "جديد",
    cUpdate: "محدَّث",
    cSame: "دون تغيير",
    cSkip: "متخطى",
    cError: "مشكلات",
    updateExisting: "حدّث أيضًا اسم وعنوان العملاء الموجودين",
    untouched: "العملاء غير الموجودين في الملف يبقون كما هم، والخلايا الفارغة لا تمحو شيئًا مخزّنًا.",
    thRow: "الصف",
    thName: "الاسم",
    thPhone: "الهاتف",
    thAddress: "العنوان",
    thWhat: "ما سيحدث",
    aAdd: "عميل جديد",
    aUpdate: "تحديث",
    aSame: "دون تغيير",
    aSkip: "متخطى",
    aError: "مشكلة",
    was: "كان «{{old}}»",
    onlyProblems: "أظهر الصفوف التي تحتاج انتباهًا فقط",
    importBtn: "استيراد {{n}} عميل",
    back: "اختيار ملف آخر",
    close: "إغلاق",
    doneTitle: "تم",
    done: "أُضيف {{added}} وحُدِّث {{updated}}. شاشة العملاء محدّثة.",
    queued: "يبدو أنك غير متصل — التغيير محفوظ على هذا الجهاز وسيصل إلى الخادم عند عودة الاتصال.",
    importing: "جارٍ الاستيراد…",
    notes: { bad_phone: "لا يوجد رقم هاتف صالح", dup: "مكرر لاحقًا في الملف، لذا يُؤخذ الأخير", exists: "عميل موجود بالفعل (لم يتغير)", same: "دون تغيير" },
    sheet: "العملاء",
    hName: "الاسم",
    hPhone: "الهاتف",
    hAddress: "العنوان",
    hOrders: "الطلبات",
    hLast: "آخر طلب",
    sample: [["سارة أحمد", "01012345678", "١٢ شارع النيل، المعادي"], ["عمر خالد", "01112345678", "الزمالك، عمارة ٤"]],
  },
};

const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ""));

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};

async function writeWorkbook(sheetName, header, widths, rows) {
  const mod = await import("write-excel-file/browser");
  const writeXlsxFile = mod.default;
  const data = [{ sheet: sheetName, columns: widths.map((width) => ({ width })), data: [header.map((v) => ({ value: v, fontWeight: "bold" })), ...rows] }];
  return writeXlsxFile(data).toBlob();
}

// Export every customer (name, phone, address, order count, last order) as an Excel file. The phone is written as text
// so Excel keeps its leading zero.
export async function exportCustomersFile(customers, isRtl) {
  const t = T[isRtl ? "ar" : "en"];
  const list = exportRows(customers);
  const blob = await writeWorkbook(t.sheet, [t.hName, t.hPhone, t.hAddress, t.hOrders, t.hLast], [28, 16, 40, 10, 14], list.map((c) => [c.name, String(c.phone), c.address, c.orders, c.lastOrder]));
  download(blob, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return list.length;
}

export default function CustomersImportModal({ isRtl, theme, customers, onApply, onClose }) {
  const t = T[isRtl ? "ar" : "en"];
  const [stage, setStage] = useState("pick"); // pick | preview | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const plan = useMemo(() => buildPlan(rows, customers, { updateExisting }), [rows, customers, updateExisting]);
  const importable = plan.counts.add + plan.counts.update;

  const downloadTemplate = async () => {
    const blob = await writeWorkbook(t.sheet, [t.hName, t.hPhone, t.hAddress], [28, 16, 40], t.sample);
    download(blob, "customers-template.xlsx");
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setBusy(true);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xls")) throw new Error("xls");
      let found = null;
      if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
        found = readCustomers(parseCsv(await file.text()));
      } else {
        const mod = await import("read-excel-file/browser");
        const sheets = await mod.default(file);
        for (const sh of sheets) {
          const r = readCustomers(sh.data || []);
          if (r.customers.length > 0) {
            found = r;
            break;
          }
        }
      }
      if (!found || found.customers.length === 0) {
        setError(t.errEmpty);
      } else {
        setRows(found.customers.slice(0, 20000));
        setStage("preview");
      }
    } catch (e) {
      setError(e && e.message === "xls" ? t.errXls : t.errRead);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await onApply(rows, updateExisting);
      setResult(r);
      setStage("done");
    } catch (e) {
      setError(t.errRead);
    } finally {
      setBusy(false);
    }
  };

  const colorOf = (r) => (r.level === "error" ? "#E3A79C" : r.level === "warn" ? "#E3C98A" : r.action === "add" ? "#9FCB8E" : r.action === "update" ? theme.secondaryLight : "var(--text-faint, #6E7580)");
  const labelOf = (r) => ({ add: t.aAdd, update: t.aUpdate, same: t.aSame, skip: t.aSkip, error: t.aError }[r.action]);
  const shown = plan.rows.filter((r) => !onlyProblems || r.level !== "ok" || r.action === "error");
  const chip = (n, label, color) => (
    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: `1px solid ${color}`, color }}>
      <b style={{ fontFamily: "IBM Plex Mono, monospace" }}>{n}</b> {label}
    </span>
  );
  const card = { background: "var(--surface)", border: "1px solid var(--border, #3A404C)", borderRadius: 14, padding: 22, width: "100%", maxWidth: 820, maxHeight: "90vh", overflowY: "auto", color: "var(--text-primary)" };
  const btn = { padding: "9px 16px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }} onClick={() => !busy && onClose()}>
      <div style={card} onClick={(e) => e.stopPropagation()} dir={isRtl ? "rtl" : "ltr"}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{t.title}</div>

        {stage === "pick" && (
          <>
            <div style={{ fontSize: 13, color: "var(--text-muted, #9CA1AC)", lineHeight: 1.6, marginBottom: 16 }}>{t.intro}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <label style={{ ...btn, background: theme.primary, border: "none", color: "#FBF8F2", fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
                {busy ? t.reading : t.choose}
                <input ref={inputRef} type="file" accept=".xlsx,.csv,.txt,.xls" disabled={busy} style={{ display: "none" }} onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
              </label>
              <button type="button" style={btn} onClick={downloadTemplate}>{t.template}</button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-faint, #8A8F99)" }}>{t.formats}</div>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: "#E3A79C" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" style={{ ...btn, border: "1px solid var(--border, #3A404C)", color: "var(--text-muted, #9CA1AC)" }} onClick={onClose}>{t.close}</button>
            </div>
          </>
        )}

        {stage === "preview" && (
          <>
            <div style={{ fontSize: 12, color: "var(--text-faint, #8A8F99)", marginBottom: 10, direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{fileName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {chip(plan.counts.add, t.cNew, "#9FCB8E")}
              {chip(plan.counts.update, t.cUpdate, theme.secondaryLight)}
              {chip(plan.counts.same, t.cSame, "#8A8F99")}
              {plan.counts.skip > 0 && chip(plan.counts.skip, t.cSkip, "#E3C98A")}
              {plan.counts.error > 0 && chip(plan.counts.error, t.cError, "#E3A79C")}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              {t.updateExisting}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 6, color: "var(--text-muted, #9CA1AC)", cursor: "pointer" }}>
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
              {t.onlyProblems}
            </label>
            <div style={{ fontSize: 11.5, color: "var(--text-faint, #8A8F99)", marginBottom: 10 }}>{t.untouched}</div>

            <div style={{ border: "1px solid var(--border, #3A404C)", borderRadius: 10, overflow: "auto", maxHeight: "46vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
                    {[t.thRow, t.thName, t.thPhone, t.thAddress, t.thWhat].map((h) => (
                      <th key={h} style={{ textAlign: isRtl ? "right" : "left", padding: "8px 10px", color: "var(--text-muted, #9CA1AC)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border, #3A404C)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 400).map((r, i) => (
                    <tr key={`${r.row}-${i}`} style={{ opacity: r.action === "skip" || r.action === "same" ? 0.65 : 1 }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-faint, #8A8F99)", fontFamily: "IBM Plex Mono, monospace" }}>{r.row}</td>
                      <td style={{ padding: "6px 10px" }}>{r.name || "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "IBM Plex Mono, monospace", direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{r.phone || "—"}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted, #9CA1AC)" }}>{r.address || "—"}</td>
                      <td style={{ padding: "6px 10px", color: colorOf(r) }}>
                        <b style={{ fontWeight: 600 }}>{labelOf(r)}</b>
                        {r.action === "update" && r.changes.includes("name") && r.existingName && <span style={{ color: "var(--text-faint, #8A8F99)" }}> · {fill(t.was, { old: r.existingName })}</span>}
                        {r.note && <span style={{ color: "var(--text-muted, #9CA1AC)" }}> · {r.code && t.notes[r.code] ? t.notes[r.code] : r.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length > 400 && <div style={{ fontSize: 11.5, color: "var(--text-faint, #8A8F99)", marginTop: 6 }}>+ {shown.length - 400}</div>}
            {error && <div style={{ marginTop: 10, fontSize: 13, color: "#E3A79C" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" style={{ ...btn, border: "1px solid var(--border, #3A404C)", color: "var(--text-muted, #9CA1AC)" }} disabled={busy} onClick={() => { setStage("pick"); setRows([]); setError(""); }}>{t.back}</button>
              <button type="button" disabled={busy || importable === 0} onClick={confirm} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: busy || importable === 0 ? "default" : "pointer", opacity: busy || importable === 0 ? 0.5 : 1 }}>
                {busy ? t.importing : fill(t.importBtn, { n: importable })}
              </button>
            </div>
          </>
        )}

        {stage === "done" && result && (
          <>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: "#9FCB8E", margin: "6px 0 8px" }}>✓ {t.doneTitle}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{fill(t.done, { added: result.added, updated: result.updated })}</div>
            {result.saved === false && <div style={{ fontSize: 12.5, color: "#E3C98A", marginTop: 8 }}>{t.queued}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" onClick={onClose} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t.close}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
