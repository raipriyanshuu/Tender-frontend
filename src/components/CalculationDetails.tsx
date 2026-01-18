import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Download, Save, FileText, Trash2, Plus, Info } from "lucide-react";
import { exportGAEBToExcel } from "@/lib/gaeb-excel-export";
import { exportGAEBToPDF } from "@/lib/gaeb-pdf-export";

interface GAEBPosition {
  id: number;
  oz: string;
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  gesamtpreis: number;
  typ: "titel" | "position" | "summe";
  ebene: number;
  bglCode?: string;
}

const BGL_CATEGORIES = [
  { code: "01.01", name: "Bagger (Hydraulikbagger)", einheit: "Tag", preis: 450 },
  { code: "01.02", name: "Radlader", einheit: "Tag", preis: 380 },
  { code: "02.01", name: "LKW (bis 12t)", einheit: "Tag", preis: 280 },
  { code: "03.01", name: "Turmdrehkran", einheit: "Tag", preis: 850 },
  { code: "03.02", name: "Mobilkran", einheit: "Std", preis: 180 },
  { code: "04.01", name: "Rüttelplatte", einheit: "Tag", preis: 45 },
  { code: "04.02", name: "Vibrationswalze", einheit: "Tag", preis: 320 },
  { code: "05.01", name: "Gerüst Fassade", einheit: "m²", preis: 8.5 },
  { code: "05.02", name: "Arbeitskorb/Hebebühne", einheit: "Tag", preis: 220 },
  { code: "06.01", name: "Stromerzeuger 100 kVA", einheit: "Tag", preis: 85 },
  { code: "06.02", name: "Baustromverteiler", einheit: "Tag", preis: 25 },
  { code: "07.01", name: "Baucontainer 20'", einheit: "Monat", preis: 180 },
  { code: "07.02", name: "Baustellentoilette", einheit: "Monat", preis: 95 },
  { code: "08.01", name: "Betonmischer 200L", einheit: "Tag", preis: 35 },
  { code: "08.02", name: "Abbruchhammer", einheit: "Tag", preis: 55 },
];

export function CalculationDetails() {
  const [projektInfo, setProjektInfo] = useState({
    projektName: "Baustelleneinrichtung A7 Hamburg",
    auftraggeber: "DEGES GmbH",
    projektNummer: "2025-001",
    datum: new Date().toISOString().split("T")[0],
  });

  const [showBGLCatalog, setShowBGLCatalog] = useState(false);
  const [geraeteTransportPauschale, setGeraeteTransportPauschale] = useState(2500);
  const [versicherungProzent, setVersicherungProzent] = useState(3);
  const [gewinnzuschlagProzent, setGewinnzuschlagProzent] = useState(12);

  const [positionen, setPositionen] = useState<GAEBPosition[]>([
    { id: 1, oz: "01", beschreibung: "Baustelleneinrichtung", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 2, oz: "01.01", beschreibung: "Hydraulikbagger 20t mit Fahrer", menge: 30, einheit: "Tag", einzelpreis: 450, gesamtpreis: 13500, typ: "position", ebene: 2, bglCode: "01.01" },
    { id: 3, oz: "01.02", beschreibung: "Radlader 5t mit Fahrer", menge: 30, einheit: "Tag", einzelpreis: 380, gesamtpreis: 11400, typ: "position", ebene: 2, bglCode: "01.02" },

    { id: 4, oz: "02", beschreibung: "Transport und Logistik", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 5, oz: "02.01", beschreibung: "LKW-Transport bis 12t", menge: 8, einheit: "Tag", einzelpreis: 280, gesamtpreis: 2240, typ: "position", ebene: 2, bglCode: "02.01" },

    { id: 6, oz: "03", beschreibung: "Hebe- und Fördergeräte", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 7, oz: "03.01", beschreibung: "Turmdrehkran 50m Ausladung", menge: 60, einheit: "Tag", einzelpreis: 850, gesamtpreis: 51000, typ: "position", ebene: 2, bglCode: "03.01" },
    { id: 8, oz: "03.02", beschreibung: "Arbeitskorb/Hebebühne 15m", menge: 20, einheit: "Tag", einzelpreis: 220, gesamtpreis: 4400, typ: "position", ebene: 2, bglCode: "05.02" },

    { id: 9, oz: "04", beschreibung: "Verdichtungsgeräte", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 10, oz: "04.01", beschreibung: "Vibrationswalze 3t", menge: 15, einheit: "Tag", einzelpreis: 320, gesamtpreis: 4800, typ: "position", ebene: 2, bglCode: "04.02" },

    { id: 11, oz: "05", beschreibung: "Gerüste und Arbeitsbühnen", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 12, oz: "05.01", beschreibung: "Fassadengerüst inkl. Auf-/Abbau", menge: 450, einheit: "m²", einzelpreis: 8.5, gesamtpreis: 3825, typ: "position", ebene: 2, bglCode: "05.01" },

    { id: 13, oz: "06", beschreibung: "Energieversorgung", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 14, oz: "06.01", beschreibung: "Stromerzeuger 100 kVA", menge: 90, einheit: "Tag", einzelpreis: 85, gesamtpreis: 7650, typ: "position", ebene: 2, bglCode: "06.01" },
    { id: 15, oz: "06.02", beschreibung: "Baustromverteiler 32A/400V", menge: 90, einheit: "Tag", einzelpreis: 25, gesamtpreis: 2250, typ: "position", ebene: 2, bglCode: "06.02" },

    { id: 16, oz: "07", beschreibung: "Baustelleneinrichtung sonstige", menge: 0, einheit: "", einzelpreis: 0, gesamtpreis: 0, typ: "titel", ebene: 1 },
    { id: 17, oz: "07.01", beschreibung: "Baucontainer 20' (Büro)", menge: 5, einheit: "Monat", einzelpreis: 180, gesamtpreis: 900, typ: "position", ebene: 2, bglCode: "07.01" },
    { id: 18, oz: "07.02", beschreibung: "Baustellentoilette", menge: 5, einheit: "Monat", einzelpreis: 95, gesamtpreis: 475, typ: "position", ebene: 2, bglCode: "07.02" },
  ]);

  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);

  const calculatePosition = (pos: GAEBPosition) => {
    if (pos.typ === "titel" || pos.typ === "summe") return { ...pos, gesamtpreis: 0 };
    const gesamtpreis = pos.menge * pos.einzelpreis;
    return { ...pos, gesamtpreis };
  };

  const updatePosition = (id: number, field: keyof GAEBPosition, value: any) => {
    setPositionen(prev => prev.map(pos => {
      if (pos.id === id) {
        const updated = { ...pos, [field]: value };
        return calculatePosition(updated);
      }
      return pos;
    }));
  };

  const deletePosition = (id: number) => {
    setPositionen(prev => prev.filter(pos => pos.id !== id));
  };

  const addPosition = (bglCode?: string) => {
    const newId = Math.max(...positionen.map(p => p.id), 0) + 1;
    const bglItem = bglCode ? BGL_CATEGORIES.find(c => c.code === bglCode) : null;

    const newPos: GAEBPosition = {
      id: newId,
      oz: `99.${newId}`,
      beschreibung: bglItem ? bglItem.name : "Neue Position",
      menge: 1,
      einheit: bglItem ? bglItem.einheit : "Tag",
      einzelpreis: bglItem ? bglItem.preis : 0,
      gesamtpreis: bglItem ? bglItem.preis : 0,
      typ: "position",
      ebene: 2,
      bglCode: bglCode,
    };
    setPositionen(prev => [...prev, calculatePosition(newPos)]);
    setShowBGLCatalog(false);
  };

  const totals = useMemo(() => {
    const summePositionen = positionen
      .filter(p => p.typ === "position")
      .reduce((sum, p) => sum + p.gesamtpreis, 0);

    const transport = geraeteTransportPauschale;
    const versicherung = (summePositionen * versicherungProzent) / 100;
    const zwischensumme = summePositionen + transport + versicherung;
    const gewinnzuschlag = (zwischensumme * gewinnzuschlagProzent) / 100;
    const gesamtsummeNetto = zwischensumme + gewinnzuschlag;
    const mwst = gesamtsummeNetto * 0.19;
    const gesamtsummeBrutto = gesamtsummeNetto + mwst;

    return {
      summePositionen,
      transport,
      versicherung,
      zwischensumme,
      gewinnzuschlag,
      gesamtsummeNetto,
      mwst,
      gesamtsummeBrutto,
    };
  }, [positionen, geraeteTransportPauschale, versicherungProzent, gewinnzuschlagProzent]);

  const handleExportExcel = () => {
    const kostenData = {
      zwischensumme: totals.summePositionen,
      transportPauschale: totals.transport,
      versicherung: totals.versicherung,
      versicherungProzent: versicherungProzent,
      gewinnzuschlag: totals.gewinnzuschlag,
      gewinnzuschlagProzent: gewinnzuschlagProzent,
      netto: totals.gesamtsummeNetto,
      mwst: totals.mwst,
      brutto: totals.gesamtsummeBrutto,
    };
    exportGAEBToExcel(positionen, projektInfo, kostenData);
  };

  const handleExportPDF = () => {
    const kostenData = {
      zwischensumme: totals.summePositionen,
      transportPauschale: totals.transport,
      versicherung: totals.versicherung,
      versicherungProzent: versicherungProzent,
      gewinnzuschlag: totals.gewinnzuschlag,
      gewinnzuschlagProzent: gewinnzuschlagProzent,
      netto: totals.gesamtsummeNetto,
      mwst: totals.mwst,
      brutto: totals.gesamtsummeBrutto,
    };
    exportGAEBToPDF(positionen, projektInfo, kostenData);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />GAEB-Leistungsverzeichnis (BGL 2020 konform)
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />PDF Angebot
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportExcel}>
                <Download className="mr-2 h-4 w-4" />Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-blue-50 rounded-lg">
            <div>
              <div className="text-xs text-zinc-600 mb-1">Projektname</div>
              <Input
                value={projektInfo.projektName}
                onChange={(e) => setProjektInfo({ ...projektInfo, projektName: e.target.value })}
                className="h-8 text-sm font-medium"
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600 mb-1">Auftraggeber</div>
              <Input
                value={projektInfo.auftraggeber}
                onChange={(e) => setProjektInfo({ ...projektInfo, auftraggeber: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600 mb-1">Projekt-Nr.</div>
              <Input
                value={projektInfo.projektNummer}
                onChange={(e) => setProjektInfo({ ...projektInfo, projektNummer: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600 mb-1">Datum</div>
              <Input
                type="date"
                value={projektInfo.datum}
                onChange={(e) => setProjektInfo({ ...projektInfo, datum: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => setShowBGLCatalog(!showBGLCatalog)}>
              <Plus className="mr-1 h-3 w-3" />
              {showBGLCatalog ? "Katalog ausblenden" : "BGL-Katalog öffnen"}
            </Button>
          </div>

          {showBGLCatalog && (
            <div className="rounded-lg border bg-amber-50 p-4">
              <div className="font-medium mb-3 text-sm">BGL 2020 Gerätekatalog</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {BGL_CATEGORIES.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => addPosition(item.code)}
                    className="flex items-center justify-between p-2 bg-white rounded border hover:bg-amber-100 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{item.code}</span>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-xs text-zinc-600">
                      {item.preis.toFixed(2)} €/{item.einheit}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium w-20">OZ</th>
                  <th className="text-left p-2 font-medium">Beschreibung / BGL-Code</th>
                  <th className="text-right p-2 font-medium w-24">Menge</th>
                  <th className="text-left p-2 font-medium w-20">Einheit</th>
                  <th className="text-right p-2 font-medium w-32">Einzelpreis €</th>
                  <th className="text-right p-2 font-medium w-32">Gesamtpreis €</th>
                  <th className="text-center p-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {positionen.map((pos) => {
                  if (pos.typ === "titel") {
                    return (
                      <tr key={pos.id} className="bg-blue-50 font-semibold border-t-2">
                        <td className="p-2">{pos.oz}</td>
                        <td colSpan={5} className="p-2">{pos.beschreibung}</td>
                        <td className="text-center p-2">
                          <button
                            onClick={() => deletePosition(pos.id)}
                            className="p-1 hover:bg-red-200 rounded text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={pos.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        <Input
                          value={pos.oz}
                          onChange={(e) => updatePosition(pos.id, 'oz', e.target.value)}
                          className="w-16 h-7 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={pos.beschreibung}
                          onChange={(e) => updatePosition(pos.id, 'beschreibung', e.target.value)}
                          className="h-7 text-sm"
                        />
                        {pos.bglCode && (
                          <span className="text-xs text-zinc-500 ml-1">BGL {pos.bglCode}</span>
                        )}
                      </td>
                      <td className="text-right p-2">
                        <Input
                          type="number"
                          step="1"
                          value={pos.menge}
                          onChange={(e) => updatePosition(pos.id, 'menge', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right font-mono h-7 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={pos.einheit}
                          onChange={(e) => updatePosition(pos.id, 'einheit', e.target.value)}
                          className="w-16 h-7 text-xs"
                        />
                      </td>
                      <td className="text-right p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={pos.einzelpreis}
                          onChange={(e) => updatePosition(pos.id, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="w-28 text-right font-mono h-7 text-sm"
                        />
                      </td>
                      <td className="text-right p-2 font-mono font-semibold text-sm">
                        {pos.gesamtpreis.toFixed(2)}
                      </td>
                      <td className="text-center p-2">
                        <button
                          onClick={() => deletePosition(pos.id)}
                          className="p-1 hover:bg-red-200 rounded text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-3">
            <div className="font-semibold mb-3">Kalkulation & Zuschläge (VOB/C DIN 18299)</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">Gerätetransport Pauschale (€)</div>
                <Input
                  type="number"
                  step="100"
                  value={geraeteTransportPauschale}
                  onChange={(e) => setGeraeteTransportPauschale(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
                <div className="text-xs text-zinc-500 mt-1">Anlieferung + Rückholung</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Versicherung (%)</div>
                <Input
                  type="number"
                  step="0.5"
                  value={versicherungProzent}
                  onChange={(e) => setVersicherungProzent(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
                <div className="text-xs text-zinc-500 mt-1">All-Risk Geräteversicherung</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Gewinnzuschlag (%)</div>
                <Input
                  type="number"
                  step="1"
                  value={gewinnzuschlagProzent}
                  onChange={(e) => setGewinnzuschlagProzent(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
                <div className="text-xs text-zinc-500 mt-1">Marge + Risiko + Verwaltung</div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Summe Positionen</span>
                  <span className="font-semibold font-mono">{totals.summePositionen.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Transport</span>
                  <span className="font-semibold font-mono">{totals.transport.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Versicherung ({versicherungProzent}%)</span>
                  <span className="font-semibold font-mono">{totals.versicherung.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Zwischensumme</span>
                  <span className="font-semibold font-mono">{totals.zwischensumme.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gewinnzuschlag ({gewinnzuschlagProzent}%)</span>
                  <span className="font-semibold font-mono">{totals.gewinnzuschlag.toFixed(2)} €</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-lg bg-white border-2 border-blue-600 p-4">
                  <div className="text-sm text-zinc-600 mb-1">Angebotspreis Netto</div>
                  <div className="text-3xl font-bold text-blue-900 font-mono">{totals.gesamtsummeNetto.toFixed(2)} €</div>
                </div>
                <div className="rounded-lg bg-white border border-slate-400 p-3">
                  <div className="flex justify-between text-xs text-zinc-600 mb-1">
                    <span>zzgl. 19% MwSt.</span>
                    <span className="font-mono">{totals.mwst.toFixed(2)} €</span>
                  </div>
                  <div className="text-xl font-semibold text-slate-800 font-mono">{totals.gesamtsummeBrutto.toFixed(2)} €</div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-blue-700 bg-blue-100 rounded p-3 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Hinweis:</span> Diese Kalkulation basiert auf der BGL 2020 (Baugeräteliste) und ist VOB/C DIN 18299 konform.
                Alle Preise sind Richtpreise und können je nach Projektanforderungen, Standort und Verfügbarkeit variieren.
                EFB-Preis 221-223 Positionen für Baustelleneinrichtung sind berücksichtigt.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
