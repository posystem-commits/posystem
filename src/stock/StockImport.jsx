"use client";

import React, { useMemo, useRef, useState } from "react";
import { buildPlan, readItems, parseCsv, STOCK_UNITS } from "./importLogic";

// "Import from Excel" on the Stock screen (managers only). Pick a spreadsheet, check the preview, confirm.
// The screen never writes anything until the manager confirms, and nothing is ever deleted.

const T = {
  en: {
    title: "Import stock from Excel",
    intro: "Upload a spreadsheet with one row per item: the item name, its current balance and its measuring unit. New items are added and existing items get their balance updated. Nothing is ever deleted.",
    choose: "Choose Excel file",
    formats: "Excel (.xlsx) or CSV. Columns can be in any order, with English or Arabic headings.",
    template: "Download template",
    current: "Download current stock",
    reading: "Reading the file…",
    errRead: "Couldn't read that file. Save it as .xlsx or .csv and try again.",
    errXls: "Old .xls files aren't supported. In Excel choose Save As → Excel Workbook (.xlsx).",
    errEmpty: "I couldn't find any items. The sheet needs a column with the item names and one with the balances.",
    cNew: "new",
    cUpdate: "updated",
    cSame: "unchanged",
    cSkip: "skipped",
    cError: "problems",
    updateExisting: "Also update the balance of items that already exist",
    untouched: "Items that are not in the sheet are left untouched.",
    thRow: "Row",
    thItem: "Item",
    thBalance: "Balance",
    thUnit: "Unit",
    thWhat: "What happens",
    aAdd: "New item",
    aUpdate: "Update",
    aSame: "No change",
    aSkip: "Skipped",
    aError: "Problem",
    was: "was {{old}}",
    onlyProblems: "Show only rows that need attention",
    importBtn: "Import {{n}} item(s)",
    cancel: "Cancel",
    back: "Choose another file",
    close: "Close",
    doneTitle: "Done",
    done: "{{added}} added, {{updated}} updated. The Stock screen is up to date.",
    queued: "You appear to be offline — the change is saved on this device and will reach the server when the connection returns.",
    importing: "Importing…",
    notes: { no_name: "no item name", dup: "listed again further down, so the last one is used", no_balance: "no balance", bad_balance: "the balance is not a number", negative: "the balance is negative", unit_mismatch: "the sheet says {{sheet}} but this item is counted in {{item}}", exists: "already in stock (not changed)", same: "no change", no_unit: "no unit", custom_unit: "new unit \"{{unit}}\"" },
    sample: ["Lamb rack", "Olive oil", "Lemons", "Flour"],
    sheetStock: "Stock",
    sheetUnits: "Units",
    hItem: "Item",
    hBalance: "Balance",
    hUnit: "Unit",
  },
  ar: {
    title: "استيراد المخزون من إكسل",
    intro: "ارفع ملفًا فيه صف لكل صنف: اسم الصنف ورصيده الحالي ووحدة القياس. تُضاف الأصناف الجديدة ويُحدَّث رصيد الأصناف الموجودة. لا يُحذف أي شيء أبدًا.",
    choose: "اختر ملف إكسل",
    formats: "ملف إكسل (.xlsx) أو CSV. يمكن ترتيب الأعمدة كما تشاء وبعناوين عربية أو إنجليزية.",
    template: "تنزيل نموذج",
    current: "تنزيل المخزون الحالي",
    reading: "جارٍ قراءة الملف…",
    errRead: "تعذّرت قراءة هذا الملف. احفظه بصيغة .xlsx أو .csv وحاول مجددًا.",
    errXls: "ملفات .xls القديمة غير مدعومة. في إكسل اختر حفظ باسم ← مصنف إكسل (.xlsx).",
    errEmpty: "لم أجد أي أصناف. يحتاج الملف إلى عمود لأسماء الأصناف وعمود للأرصدة.",
    cNew: "جديد",
    cUpdate: "محدَّث",
    cSame: "دون تغيير",
    cSkip: "متخطى",
    cError: "مشكلات",
    updateExisting: "حدّث أيضًا رصيد الأصناف الموجودة",
    untouched: "الأصناف غير الموجودة في الملف تبقى كما هي.",
    thRow: "الصف",
    thItem: "الصنف",
    thBalance: "الرصيد",
    thUnit: "الوحدة",
    thWhat: "ما سيحدث",
    aAdd: "صنف جديد",
    aUpdate: "تحديث",
    aSame: "دون تغيير",
    aSkip: "متخطى",
    aError: "مشكلة",
    was: "كان {{old}}",
    onlyProblems: "أظهر الصفوف التي تحتاج انتباهًا فقط",
    importBtn: "استيراد {{n}} صنف",
    cancel: "إلغاء",
    back: "اختيار ملف آخر",
    close: "إغلاق",
    doneTitle: "تم",
    done: "أُضيف {{added}} وحُدِّث {{updated}}. شاشة المخزون محدّثة.",
    queued: "يبدو أنك غير متصل — التغيير محفوظ على هذا الجهاز وسيصل إلى الخادم عند عودة الاتصال.",
    importing: "جارٍ الاستيراد…",
    notes: { no_name: "لا يوجد اسم للصنف", dup: "مكرر لاحقًا في الملف، لذا يُؤخذ الأخير", no_balance: "لا يوجد رصيد", bad_balance: "الرصيد ليس رقمًا", negative: "الرصيد سالب", unit_mismatch: "الملف يقول {{sheet}} لكن هذا الصنف يُحسب بـ {{item}}", exists: "موجود بالفعل (لم يتغير)", same: "دون تغيير", no_unit: "لا توجد وحدة", custom_unit: "وحدة جديدة \"{{unit}}\"" },
    sample: ["كتف ضأن", "زيت زيتون", "ليمون", "دقيق"],
    sheetStock: "المخزون",
    sheetUnits: "الوحدات",
    hItem: "الصنف",
    hBalance: "الرصيد",
    hUnit: "الوحدة",
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

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function writeWorkbook(sheets) {
  const mod = await import("write-excel-file/browser");
  const writeXlsxFile = mod.default;
  const head = (v) => ({ value: v, fontWeight: "bold" });
  const data = sheets.map((s) => ({ sheet: s.name, columns: s.widths.map((width) => ({ width })), data: s.rows.map((row, i) => row.map((v) => (i === 0 && s.header ? head(v) : v))) }));
  return writeXlsxFile(data).toBlob();
}

export default function StockImportModal({ isRtl, theme, ingredients, onApply, onClose }) {
  const t = T[isRtl ? "ar" : "en"];
  const [stage, setStage] = useState("pick"); // pick | preview | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const plan = useMemo(() => buildPlan(items, ingredients, { updateExisting }), [items, ingredients, updateExisting]);
  const importable = plan.counts.add + plan.counts.update;

  const downloadTemplate = async () => {
    const blob = await writeWorkbook([
      { name: t.sheetStock, header: true, widths: [30, 14, 12], rows: [[t.hItem, t.hBalance, t.hUnit], [t.sample[0], 2.5, "kg"], [t.sample[1], 4, "L"], [t.sample[2], 30, "pcs"], [t.sample[3], 12, "kg"]] },
      { name: t.sheetUnits, header: true, widths: [14], rows: [[t.hUnit], ...STOCK_UNITS.map((u) => [u])] },
    ]);
    download(blob, "stock-template.xlsx");
  };
  const downloadCurrent = async () => {
    const list = Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name));
    const blob = await writeWorkbook([{ name: t.sheetStock, header: true, widths: [30, 14, 12], rows: [[t.hItem, t.hBalance, t.hUnit], ...list.map((i) => [i.name, i.stock, i.unit])] }]);
    download(blob, "stock-current.xlsx");
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
        found = readItems(parseCsv(await file.text()));
      } else {
        const mod = await import("read-excel-file/browser");
        const sheets = await mod.default(file);
        for (const sh of sheets) {
          const r = readItems(sh.data || []);
          if (r.items.length > 0) {
            found = r;
            break;
          }
        }
      }
      if (!found || found.items.length === 0) {
        setError(t.errEmpty);
      } else {
        setItems(found.items.slice(0, 3000));
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
      const r = await onApply(items, updateExisting);
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
  const card = { background: "var(--surface)", border: "1px solid var(--border, #3A404C)", borderRadius: 14, padding: 22, width: "100%", maxWidth: 780, maxHeight: "90vh", overflowY: "auto", color: "var(--text-primary)" };
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
              <button type="button" style={btn} onClick={downloadCurrent}>{t.current}</button>
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
                    {[t.thRow, t.thItem, t.thBalance, t.thUnit, t.thWhat].map((h) => (
                      <th key={h} style={{ textAlign: isRtl ? "right" : "left", padding: "8px 10px", color: "var(--text-muted, #9CA1AC)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border, #3A404C)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 400).map((r, i) => (
                    <tr key={`${r.row}-${i}`} style={{ opacity: r.action === "skip" || r.action === "same" ? 0.65 : 1 }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-faint, #8A8F99)", fontFamily: "IBM Plex Mono, monospace" }}>{r.row}</td>
                      <td style={{ padding: "6px 10px" }}>{r.name || "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "IBM Plex Mono, monospace", direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{r.qty === null ? "—" : r.qty}</td>
                      <td style={{ padding: "6px 10px", direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{r.unit || "—"}</td>
                      <td style={{ padding: "6px 10px", color: colorOf(r) }}>
                        <b style={{ fontWeight: 600 }}>{labelOf(r)}</b>
                        {r.action === "update" && r.existingStock !== null && <span style={{ color: "var(--text-faint, #8A8F99)" }}> · {fill(t.was, { old: `${r.existingStock} ${r.existingUnit}` })}</span>}
                        {r.note && <span style={{ color: "var(--text-muted, #9CA1AC)" }}> · {r.code && t.notes[r.code] ? fill(t.notes[r.code], r.vars) : r.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length > 400 && <div style={{ fontSize: 11.5, color: "var(--text-faint, #8A8F99)", marginTop: 6 }}>+ {shown.length - 400}</div>}
            {error && <div style={{ marginTop: 10, fontSize: 13, color: "#E3A79C" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" style={{ ...btn, border: "1px solid var(--border, #3A404C)", color: "var(--text-muted, #9CA1AC)" }} disabled={busy} onClick={() => { setStage("pick"); setItems([]); setError(""); }}>{t.back}</button>
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
