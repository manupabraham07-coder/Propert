import React, { useState, useEffect, useRef } from "react";
import { Plus, X, MapPin, Phone, User, Ruler, IndianRupee, Image as ImageIcon, Trash2, Search, FileStack, Download, Home, Pencil, Briefcase } from "lucide-react";
import * as XLSX from "xlsx";

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Malayalam:wght@500;700&family=Manjari:wght@400;700&display=swap');
:root { --paper:#EFF0E4; --paper-line:#DBDCC7; --ink:#24322B; --ink-soft:#5B6B5F; --teal:#1F5B4C; --teal-dark:#153F35; --stamp:#A6431C; }
* { box-sizing:border-box; }
.font-display { font-family:'Noto Serif Malayalam', serif; }
.font-body { font-family:'Manjari', sans-serif; }
@keyframes logoPop { 0% { transform: scale(0.65); opacity:0; } 65% { transform: scale(1.08); opacity:1; } 100% { transform: scale(1); opacity:1; } }
@keyframes ringExpand { 0% { transform: scale(0.8); opacity:0; } 100% { transform: scale(1); opacity:0.5; } }
@keyframes fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
@keyframes splashOut { to { opacity:0; transform: scale(0.98); } }
.splash-logo { animation: logoPop 0.6s cubic-bezier(.34,1.56,.64,1) both; }
.splash-ring { animation: ringExpand 0.7s ease both; }
.splash-text { animation: fadeUp 0.5s ease 0.3s both; }
.splash-sub { animation: fadeUp 0.5s ease 0.42s both; }
.splash-exit { animation: splashOut 0.35s ease forwards; }
`;

const TYPES = ["ഭൂമി", "വീട്", "ഫ്ലാറ്റ്", "വാണിജ്യം"];
const PURPOSES = ["വില്പന", "വാടക"];
const STATUSES_SALE = ["ലഭ്യമാണ്", "ചർച്ചയിൽ", "വിറ്റു"];
const STATUSES_RENT = ["ലഭ്യമാണ്", "ചർച്ചയിൽ", "വാടകയ്ക്ക് കൊടുത്തു"];
const FURNISHING = ["ഫർണിഷ്ഡ്", "സെമി ഫർണിഷ്ഡ്", "അൺഫർണിഷ്ഡ്"];
const AMENITIES = ["വെള്ളം", "ഇലക്ട്രിസിറ്റി", "ടാർ റോഡ്", "ബസ് റൂട്ട്", "ഡ്രെയിനേജ്"];
const STATUS_COLOR = { "ലഭ്യമാണ്": "#1F5B4C", "ചർച്ചയിൽ": "#B8791A", "വിറ്റു": "#A6431C", "വാടകയ്ക്ക് കൊടുത്തു": "#A6431C" };

function LogoMark({ size = 60, ring = true, className = "" }) {
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: "50%", border: `2px solid #F4F1E4`,
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0,
      }}
    >
      {ring && (
        <div className="splash-ring" style={{ position: "absolute", inset: size * 0.12, borderRadius: "50%", border: "1px solid rgba(244,241,228,0.5)" }} />
      )}
      <Home size={size * 0.42} color="#F4F1E4" strokeWidth={1.8} />
    </div>
  );
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 480;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const emptyForm = {
  type: TYPES[0], purpose: PURPOSES[0], status: STATUSES_SALE[0], price: "", location: "", size: "",
  rentAmount: "", deposit: "", furnishing: "", availableFrom: "",
  surveyNumber: "", landmark: "", roadWidth: "", amenities: [], negotiable: false,
  ownerName: "", ownerContact: "", brokerId: "", notes: "", photo: "",
};

const emptyBrokerForm = { name: "", contact: "", agency: "", area: "", commission: "", notes: "" };

export default function PropertyLedger() {
  const [view, setView] = useState("properties");
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const fileInputRef = useRef(null);

  const [brokers, setBrokers] = useState([]);
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [brokerForm, setBrokerForm] = useState(emptyBrokerForm);
  const [editingBrokerId, setEditingBrokerId] = useState(null);
  const [savingBroker, setSavingBroker] = useState(false);
  const [confirmDeleteBroker, setConfirmDeleteBroker] = useState(null);

  useEffect(() => {
    loadAll();
    loadBrokers();
    const t1 = setTimeout(() => setSplashFading(true), 950);
    const t2 = setTimeout(() => setSplashVisible(false), 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const listed = await window.storage.list("property:", false);
      const keys = listed?.keys || [];
      const items = [];
      for (const k of keys) {
        try {
          const res = await window.storage.get(k, false);
          if (res?.value) items.push(JSON.parse(res.value));
        } catch (e) {
          // skip unreadable entry
        }
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProperties(items);
    } catch (e) {
      setError("ഡാറ്റ ലോഡ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch {
      setError("ഫോട്ടോ പ്രോസസ് ചെയ്യുന്നതിൽ പിശക്.");
    }
  }

  async function saveProperty() {
    if (!form.location.trim()) {
      setError("ലൊക്കേഷൻ നിർബന്ധമാണ്.");
      return;
    }
    setSaving(true);
    setError("");
    const id = editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { ...form, id, createdAt: form.createdAt || Date.now() };
    try {
      const result = await window.storage.set(`property:${id}`, JSON.stringify(record), false);
      if (!result) throw new Error("save failed");
      setProperties((prev) =>
        editingId ? prev.map((x) => (x.id === id ? record : x)) : [record, ...prev]
      );
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (e) {
      setError("സേവ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു, വീണ്ടും ശ്രമിക്കുക.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p) {
    setForm({ ...emptyForm, ...p });
    setEditingId(p.id);
    setError("");
    setShowForm(true);
  }

  async function deleteProperty(id) {
    try {
      await window.storage.delete(`property:${id}`, false);
      setProperties((p) => p.filter((x) => x.id !== id));
    } catch {
      setError("ഡിലീറ്റ് ചെയ്യുന്നതിൽ പിശക്.");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function loadBrokers() {
    try {
      const listed = await window.storage.list("broker:", false);
      const keys = listed?.keys || [];
      const items = [];
      for (const k of keys) {
        try {
          const res = await window.storage.get(k, false);
          if (res?.value) items.push(JSON.parse(res.value));
        } catch (e) {
          // skip unreadable entry
        }
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBrokers(items);
    } catch (e) {
      setError("ബ്രോക്കർ ഡാറ്റ ലോഡ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു.");
    }
  }

  async function saveBroker() {
    if (!brokerForm.name.trim()) {
      setError("ബ്രോക്കറുടെ പേര് നിർബന്ധമാണ്.");
      return;
    }
    setSavingBroker(true);
    setError("");
    const id = editingBrokerId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { ...brokerForm, id, createdAt: brokerForm.createdAt || Date.now() };
    try {
      const result = await window.storage.set(`broker:${id}`, JSON.stringify(record), false);
      if (!result) throw new Error("save failed");
      setBrokers((prev) =>
        editingBrokerId ? prev.map((x) => (x.id === id ? record : x)) : [record, ...prev]
      );
      setBrokerForm(emptyBrokerForm);
      setEditingBrokerId(null);
      setShowBrokerForm(false);
    } catch (e) {
      setError("സേവ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു, വീണ്ടും ശ്രമിക്കുക.");
    } finally {
      setSavingBroker(false);
    }
  }

  function openEditBroker(b) {
    setBrokerForm({ ...emptyBrokerForm, ...b });
    setEditingBrokerId(b.id);
    setError("");
    setShowBrokerForm(true);
  }

  async function deleteBroker(id) {
    try {
      await window.storage.delete(`broker:${id}`, false);
      setBrokers((b) => b.filter((x) => x.id !== id));
    } catch {
      setError("ഡിലീറ്റ് ചെയ്യുന്നതിൽ പിശക്.");
    } finally {
      setConfirmDeleteBroker(null);
    }
  }

  function brokerName(id) {
    const b = brokers.find((x) => x.id === id);
    return b ? b.name : "";
  }

  function exportToExcel() {
    if (properties.length === 0) {
      setError("എക്സ്പോർട്ട് ചെയ്യാൻ ഡാറ്റ ഒന്നും ഇല്ല.");
      return;
    }
    try {
      const headers = [
        "നമ്പർ", "തരം", "വിഭാഗം", "സ്റ്റാറ്റസ്", "ലൊക്കേഷൻ", "ലാൻഡ്മാർക്ക്", "വില",
        "വിലപേശാം", "വാടക (മാസം)", "അഡ്വാൻസ്", "ഫർണിഷിംഗ്", "ലഭ്യമായ തീയതി",
        "സൈസ്", "സർവേ നമ്പർ", "റോഡ് വീതി", "സൗകര്യങ്ങൾ",
        "ഉടമയുടെ പേര്", "കോൺടാക്റ്റ്", "ബ്രോക്കർ", "കുറിപ്പുകൾ", "ചേർത്ത തീയതി",
      ];
      const dateStr = new Date().toISOString().slice(0, 10);
      const dataRows = properties
        .slice()
        .reverse()
        .map((p, i) => [
          i + 1,
          p.type || "",
          p.purpose || "",
          p.status || "",
          p.location || "",
          p.landmark || "",
          p.purpose === "വാടക" ? "" : (p.price || ""),
          p.negotiable ? "ഉണ്ട്" : "ഇല്ല",
          p.purpose === "വാടക" ? (p.rentAmount || "") : "",
          p.purpose === "വാടക" ? (p.deposit || "") : "",
          p.furnishing || "",
          p.availableFrom || "",
          p.size || "",
          p.surveyNumber || "",
          p.roadWidth || "",
          (p.amenities || []).join(", "),
          p.ownerName || "",
          p.ownerContact || "",
          brokerName(p.brokerId),
          p.notes || "",
          p.createdAt ? new Date(p.createdAt).toLocaleDateString("ml-IN") : "",
        ]);

      const aoa = [
        ["പ്രോപ്പർട്ടി രജിസ്റ്റർ"],
        [`തീയതി: ${dateStr}    ആകെ എൻട്രികൾ: ${properties.length}`],
        [],
        headers,
        ...dataRows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const lastCol = headers.length - 1;

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      ];

      ws["!cols"] = [
        { wch: 5 }, { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
        { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 11 },
        { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 18 },
        { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 11 },
      ];

      // A4 print setup: landscape, fit to one page wide, small margins
      ws["!pageSetup"] = { paperSize: 9, orientation: "landscape", fitToWidth: 1, fitToHeight: 0, scale: 100 };
      ws["!fitToPage"] = true;
      ws["!margins"] = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 };
      ws["!printHeader"] = true;

      const wb = XLSX.utils.book_new();
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Sheets = [{ Hidden: 0 }];
      XLSX.utils.book_append_sheet(wb, ws, "പ്രോപ്പർട്ടികൾ");

      if (brokers.length > 0) {
        const brokerHeaders = ["നമ്പർ", "പേര്", "കോൺടാക്റ്റ്", "ഏജൻസി", "പ്രവർത്തന മേഖല", "കമ്മീഷൻ", "കുറിപ്പുകൾ"];
        const brokerRows = brokers
          .slice()
          .reverse()
          .map((b, i) => [i + 1, b.name || "", b.contact || "", b.agency || "", b.area || "", b.commission || "", b.notes || ""]);
        const brokerAoa = [
          ["ബ്രോക്കർമാർ"],
          [`തീയതി: ${dateStr}    ആകെ എൻട്രികൾ: ${brokers.length}`],
          [],
          brokerHeaders,
          ...brokerRows,
        ];
        const bws = XLSX.utils.aoa_to_sheet(brokerAoa);
        const bLastCol = brokerHeaders.length - 1;
        bws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: bLastCol } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: bLastCol } },
        ];
        bws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 26 }];
        bws["!pageSetup"] = { paperSize: 9, orientation: "landscape", fitToWidth: 1, fitToHeight: 0, scale: 100 };
        bws["!fitToPage"] = true;
        bws["!margins"] = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 };
        XLSX.utils.book_append_sheet(wb, bws, "ബ്രോക്കർമാർ");
      }

      XLSX.writeFile(wb, `property-ledger-${dateStr}.xlsx`);
    } catch (e) {
      setError("എക്സ്പോർട്ട് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു.");
    }
  }

  const filtered = properties.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [p.location, p.type, p.purpose, p.status, p.ownerName, p.price, p.rentAmount, p.landmark, p.surveyNumber, brokerName(p.brokerId)].join(" ").toLowerCase().includes(q);
  });

  const filteredBrokers = brokers.filter((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.contact, b.agency, b.area].join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="font-body" style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink)" }}>
      <style>{FONT_STYLE}</style>

      {splashVisible && (
        <div
          className={splashFading ? "splash-exit" : ""}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "var(--teal-dark)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
          }}
        >
          <div className="splash-logo">
            <LogoMark size={72} />
          </div>
          <div className="font-display splash-text" style={{ color: "#F4F1E4", fontSize: 21, fontWeight: 700 }}>
            പ്രോപ്പർട്ടി രജിസ്റ്റർ
          </div>
          <div className="splash-sub" style={{ color: "rgba(244,241,228,0.65)", fontSize: 12.5 }}>
            നിങ്ങളുടെ സ്വകാര്യ പ്രോപ്പർട്ടി ലെഡ്ജർ
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "var(--teal-dark)", color: "#F4F1E4", padding: "22px 18px 26px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, rgba(244,241,228,0.06) 28px)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark size={34} ring={false} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.75, fontSize: 11, letterSpacing: "0.14em" }}>
                <span>PROPERTY LEDGER</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>പ്രോപ്പർട്ടി രജിസ്റ്റർ</h1>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
              {view === "properties" ? `ആകെ എൻട്രികൾ: ${properties.length}` : `ആകെ ബ്രോക്കർമാർ: ${brokers.length}`}
            </p>
            <button
              onClick={exportToExcel}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "rgba(244,241,228,0.14)",
                color: "#F4F1E4", border: "1px solid rgba(244,241,228,0.35)", borderRadius: 8,
                padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Download size={13} /> എക്സൽ
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        <button
          onClick={() => { setView("properties"); setQuery(""); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 0", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: view === "properties" ? "1.5px solid var(--teal)" : "1.5px solid var(--paper-line)",
            background: view === "properties" ? "var(--teal)" : "#fff",
            color: view === "properties" ? "#fff" : "var(--ink-soft)",
          }}
        >
          <FileStack size={14} /> പ്രോപ്പർട്ടികൾ
        </button>
        <button
          onClick={() => { setView("brokers"); setQuery(""); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 0", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: view === "brokers" ? "1.5px solid var(--teal)" : "1.5px solid var(--paper-line)",
            background: view === "brokers" ? "var(--teal)" : "#fff",
            color: view === "brokers" ? "#fff" : "var(--ink-soft)",
          }}
        >
          <Briefcase size={14} /> ബ്രോക്കർമാർ
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid var(--paper-line)", borderRadius: 10, padding: "9px 12px" }}>
          <Search size={16} color="var(--ink-soft)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "properties" ? "ലൊക്കേഷൻ, തരം, ഉടമ എന്നിവ തിരയുക" : "പേര്, ഏജൻസി, ഏരിയ എന്നിവ തിരയുക"}
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent", color: "var(--ink)", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ margin: "12px 16px 0", background: "#FBEAE3", color: "var(--stamp)", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* List */}
      <div style={{ padding: "14px 16px 100px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && <div style={{ textAlign: "center", padding: 30, color: "var(--ink-soft)" }}>ലോഡ് ചെയ്യുന്നു...</div>}

        {view === "properties" && !loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-soft)" }}>
            <FileStack size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {properties.length === 0 ? "ഇതുവരെ എൻട്രികൾ ഇല്ല" : "ഫലങ്ങളൊന്നും കിട്ടിയില്ല"}
            </div>
            <div style={{ fontSize: 13 }}>{properties.length === 0 ? "താഴെയുള്ള + ബട്ടൺ അമർത്തി ആദ്യത്തെ പ്രോപ്പർട്ടി ചേർക്കുക" : "വേറെ വാക്കുകൾ ഉപയോഗിച്ച് നോക്കൂ"}</div>
          </div>
        )}

        {view === "properties" && filtered.map((p, idx) => (
          <div
            key={p.id}
            onClick={() => confirmDelete !== p.id && openEdit(p)}
            style={{ background: "#FFFFFF", border: "1px solid var(--paper-line)", borderRadius: 12, overflow: "hidden", position: "relative", cursor: "pointer" }}
          >
            <div style={{ display: "flex" }}>
              {p.photo ? (
                <img src={p.photo} alt="" style={{ width: 96, height: 96, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 96, height: 96, flexShrink: 0, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageIcon size={22} color="var(--paper-line)" />
                </div>
              )}
              <div style={{ padding: "10px 12px", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.04em" }}>{p.type}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: p.purpose === "വാടക" ? "#B8791A" : "var(--teal)",
                      background: p.purpose === "വാടക" ? "#FBF0DD" : "#E7EFEB", borderRadius: 4, padding: "1px 6px",
                    }}>
                      {p.purpose || "വില്പന"}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'Noto Serif Malayalam', serif", fontSize: 10, fontWeight: 700,
                    color: STATUS_COLOR[p.status] || "var(--stamp)",
                    border: `1.5px solid ${STATUS_COLOR[p.status] || "var(--stamp)"}`, borderRadius: 5, padding: "1px 6px",
                    transform: "rotate(-4deg)", whiteSpace: "nowrap",
                  }}>
                    {p.status || "ലഭ്യമാണ്"}
                  </div>
                </div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 700, margin: "2px 0", display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin size={13} color="var(--ink-soft)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location}</span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12.5, color: "var(--ink-soft)", flexWrap: "wrap" }}>
                  {p.purpose === "വാടക" ? (
                    <>
                      {p.rentAmount && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><IndianRupee size={11} />{p.rentAmount}/മാസം</span>}
                      {p.deposit && <span>അഡ്വാൻസ്: {p.deposit}</span>}
                    </>
                  ) : (
                    p.price && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><IndianRupee size={11} />{p.price}{p.negotiable ? " (വിലപേശാം)" : ""}</span>
                  )}
                  {p.size && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Ruler size={11} />{p.size}</span>}
                </div>
                {p.purpose === "വാടക" && (p.furnishing || p.availableFrom) && (
                  <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--ink-soft)", marginTop: 2, flexWrap: "wrap" }}>
                    {p.furnishing && <span>{p.furnishing}</span>}
                    {p.availableFrom && <span>ലഭ്യം: {p.availableFrom}</span>}
                  </div>
                )}
              </div>
            </div>
            {(p.landmark || p.surveyNumber || p.roadWidth || (p.amenities && p.amenities.length > 0)) && (
              <div style={{ borderTop: "1px dashed var(--paper-line)", padding: "8px 12px", fontSize: 12, color: "var(--ink-soft)" }}>
                {p.landmark && <div style={{ marginBottom: 2 }}>📍 {p.landmark}</div>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {p.surveyNumber && <span>സർവേ നമ്പർ: {p.surveyNumber}</span>}
                  {p.roadWidth && <span>റോഡ്: {p.roadWidth}</span>}
                </div>
                {p.amenities && p.amenities.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    {p.amenities.map((a) => (
                      <span key={a} style={{ background: "var(--paper)", border: "1px solid var(--paper-line)", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{a}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {p.notes && (
              <div style={{ borderTop: "1px dashed var(--paper-line)", padding: "8px 12px", fontSize: 12.5, color: "var(--ink)", fontStyle: "italic" }}>
                “{p.notes}”
              </div>
            )}
            {(p.ownerName || p.ownerContact) && (
              <div style={{ borderTop: "1px dashed var(--paper-line)", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                <div style={{ display: "flex", gap: 14, color: "var(--ink-soft)", flexWrap: "wrap" }}>
                  {p.ownerName && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><User size={12} />{p.ownerName}</span>}
                  {p.ownerContact && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Phone size={12} />{p.ownerContact}</span>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                    style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", padding: 4 }}
                    aria-label="എഡിറ്റ് ചെയ്യുക"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }}
                    style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", padding: 4 }}
                    aria-label="ഡിലീറ്റ് ചെയ്യുക"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
            {!(p.ownerName || p.ownerContact) && (
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                  style={{ border: "none", background: "rgba(255,255,255,0.85)", borderRadius: 6, color: "var(--ink-soft)", cursor: "pointer", padding: 4 }}
                  aria-label="എഡിറ്റ് ചെയ്യുക"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }}
                  style={{ border: "none", background: "rgba(255,255,255,0.85)", borderRadius: 6, color: "var(--ink-soft)", cursor: "pointer", padding: 4 }}
                  aria-label="ഡിലീറ്റ് ചെയ്യുക"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {confirmDelete === p.id && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", inset: 0, background: "rgba(36,50,43,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
                <div style={{ color: "#F4F1E4", fontSize: 13, textAlign: "center" }}>ഈ എൻട്രി ഡിലീറ്റ് ചെയ്യണോ?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => deleteProperty(p.id)} style={{ background: "var(--stamp)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ഡിലീറ്റ് ചെയ്യുക</button>
                  <button onClick={() => setConfirmDelete(null)} style={{ background: "transparent", color: "#F4F1E4", border: "1px solid rgba(244,241,228,0.4)", borderRadius: 7, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>വേണ്ട</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setForm(emptyForm); setEditingId(null); setError(""); setShowForm(true); }}
        style={{
          position: "fixed", bottom: 20, right: 20, width: 54, height: 54, borderRadius: "50%",
          background: "var(--teal)", color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(31,91,76,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
        aria-label="പുതിയത് ചേർക്കുക"
      >
        <Plus size={26} />
      </button>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,50,43,0.55)", display: "flex", alignItems: "flex-end", zIndex: 50 }}>
          <div style={{ background: "var(--paper)", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "18px 18px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
                {editingId ? "പ്രോപ്പർട്ടി എഡിറ്റ് ചെയ്യുക" : "പുതിയ പ്രോപ്പർട്ടി"}
              </div>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ border: "none", background: "#fff", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>വിഭാഗം</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {PURPOSES.map((pu) => (
                    <button
                      key={pu}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          purpose: pu,
                          status: pu === "വാടക" ? STATUSES_RENT[0] : STATUSES_SALE[0],
                        }))
                      }
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        border: form.purpose === pu ? "1.5px solid var(--teal-dark)" : "1.5px solid var(--paper-line)",
                        background: form.purpose === pu ? "var(--teal-dark)" : "#fff",
                        color: form.purpose === pu ? "#fff" : "var(--ink)",
                      }}
                    >
                      {pu}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>തരം</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                        border: form.type === t ? "1.5px solid var(--teal)" : "1.5px solid var(--paper-line)",
                        background: form.type === t ? "var(--teal)" : "#fff",
                        color: form.type === t ? "#fff" : "var(--ink)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="ലൊക്കേഷൻ *" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="സ്ഥലം, പഞ്ചായത്ത്/നഗരം" />

              <div>
                <label style={labelStyle}>സ്റ്റാറ്റസ്</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(form.purpose === "വാടക" ? STATUSES_RENT : STATUSES_SALE).map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      style={{
                        padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                        border: form.status === s ? `1.5px solid ${STATUS_COLOR[s]}` : "1.5px solid var(--paper-line)",
                        background: form.status === s ? STATUS_COLOR[s] : "#fff",
                        color: form.status === s ? "#fff" : "var(--ink)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {form.purpose === "വാടക" ? (
                <>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <Field label="വാടക (മാസം)" value={form.rentAmount} onChange={(v) => setForm((f) => ({ ...f, rentAmount: v }))} placeholder="ഉദാ: 12000" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="അഡ്വാൻസ്/ഡെപ്പോസിറ്റ്" value={form.deposit} onChange={(v) => setForm((f) => ({ ...f, deposit: v }))} placeholder="ഉദാ: 2 മാസം" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>ഫർണിഷിംഗ്</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {FURNISHING.map((fn) => (
                        <button
                          key={fn}
                          onClick={() => setForm((f) => ({ ...f, furnishing: f.furnishing === fn ? "" : fn }))}
                          style={{
                            padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                            border: form.furnishing === fn ? "1.5px solid var(--teal)" : "1.5px solid var(--paper-line)",
                            background: form.furnishing === fn ? "var(--teal)" : "#fff",
                            color: form.furnishing === fn ? "#fff" : "var(--ink)",
                          }}
                        >
                          {fn}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="ലഭ്യമായ തീയതി" value={form.availableFrom} onChange={(v) => setForm((f) => ({ ...f, availableFrom: v }))} placeholder="ഉദാ: ഉടനെ / ആഗസ്റ്റ് 15" />
                </>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <Field label="വില" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="ഉദാ: 45 ലക്ഷം" />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={form.negotiable} onChange={(e) => setForm((f) => ({ ...f, negotiable: e.target.checked }))} />
                    വിലപേശാം
                  </label>
                </div>
              )}

              <Field label="സൈസ്" value={form.size} onChange={(v) => setForm((f) => ({ ...f, size: v }))} placeholder="ഉദാ: 10 സെന്റ് / 1800 sqft" />
              <Field label="സർവേ നമ്പർ" value={form.surveyNumber} onChange={(v) => setForm((f) => ({ ...f, surveyNumber: v }))} placeholder="സർവേ / ഡോക്യുമെന്റ് നമ്പർ" />
              <Field label="അടുത്തുള്ള സ്ഥലങ്ങൾ" value={form.landmark} onChange={(v) => setForm((f) => ({ ...f, landmark: v }))} placeholder="ഉദാ: സ്കൂളിന് സമീപം" />
              <Field label="റോഡ് വീതി" value={form.roadWidth} onChange={(v) => setForm((f) => ({ ...f, roadWidth: v }))} placeholder="ഉദാ: 12 അടി" />

              <div>
                <label style={labelStyle}>സൗകര്യങ്ങൾ</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {AMENITIES.map((a) => {
                    const active = form.amenities.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            amenities: active ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
                          }))
                        }
                        style={{
                          padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          border: active ? "1.5px solid var(--teal)" : "1.5px solid var(--paper-line)",
                          background: active ? "var(--teal)" : "#fff",
                          color: active ? "#fff" : "var(--ink)",
                        }}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="ഉടമയുടെ പേര്" value={form.ownerName} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder="ഉടമ" />
              <Field label="കോൺടാക്റ്റ് നമ്പർ" value={form.ownerContact} onChange={(v) => setForm((f) => ({ ...f, ownerContact: v }))} placeholder="ഫോൺ നമ്പർ" type="tel" inputMode="numeric" />

              <div>
                <label style={labelStyle}>കുറിപ്പുകൾ</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="മറ്റ് വിവരങ്ങൾ, ഓർമ്മിക്കേണ്ട കാര്യങ്ങൾ..."
                  rows={3}
                  style={{
                    width: "100%", border: "1px solid var(--paper-line)", borderRadius: 8, padding: "10px 12px",
                    fontSize: 14, background: "#fff", color: "var(--ink)", fontFamily: "inherit", outline: "none", resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>ഫോട്ടോ</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "1.5px dashed var(--paper-line)", borderRadius: 10, padding: form.photo ? 0 : 20,
                    textAlign: "center", cursor: "pointer", background: "#fff", overflow: "hidden",
                  }}
                >
                  {form.photo ? (
                    <img src={form.photo} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ color: "var(--ink-soft)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <ImageIcon size={22} />
                      ഫോട്ടോ ചേർക്കാൻ ടാപ്പ് ചെയ്യുക
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={saveProperty}
                disabled={saving}
                style={{
                  marginTop: 6, background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10,
                  padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1, fontFamily: "inherit",
                }}
              >
                {saving ? "സേവ് ചെയ്യുന്നു..." : editingId ? "അപ്ഡേറ്റ് ചെയ്യുക" : "സേവ് ചെയ്യുക"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 5, fontWeight: 700 };

function Field({ label, value, onChange, placeholder, type = "text", inputMode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", border: "1px solid var(--paper-line)", borderRadius: 8, padding: "10px 12px",
          fontSize: 14, background: "#fff", color: "var(--ink)", fontFamily: "inherit", outline: "none",
        }}
      />
    </div>
  );
}
