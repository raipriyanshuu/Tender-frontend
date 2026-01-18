import * as XLSX from 'xlsx';

interface Room {
  id: number;
  name: string;
  gebaeude: string;
  raumTyp: string;
  flaeche: number;
  haeufM: number;
  qmh: number;
  stdM: number;
  eurM: number;
}

interface ExportParameters {
  stundensatz: number;
  materialKostenProQm: number;
  margeProzent: number;
}

interface ExportTotals {
  gesamtFlaeche?: number;
  gesamtStd?: number;
  gesamtLohnkosten: number;
  gesamtMaterial: number;
  zwischensumme: number;
  marge: number;
  angebotspreisMonat: number;
  angebotspreisJahr: number;
}

export function exportToExcel(
  raeume: Room[],
  parameters: ExportParameters,
  totals: ExportTotals
) {
  const workbook = XLSX.utils.book_new();
  const currentDate = new Date().toLocaleDateString('de-DE');
  const tenderNumber = `AV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const totalFlaeche = raeume.reduce((sum, r) => sum + r.flaeche, 0);
  const totalStd = raeume.reduce((sum, r) => sum + r.stdM, 0);

  const avgHaeufigkeitProWoche = 5;
  const wochenProMonat = 4.3;
  const reinigungenProMonat = avgHaeufigkeitProWoche * wochenProMonat;
  const entfernungKm = 12;
  const kostenProKm = 0.80;
  const fahrtkosten = entfernungKm * 2 * kostenProKm * reinigungenProMonat;
  const sonderleistungen = 800.00;

  const sheet1Data: any[][] = [
    ['KALKULATION - Gebäudereinigung und Facility Services Verwaltungsgebäude – Stadt Stade'],
    ['Firma:', '[Firmenname des Bieters]'],
    ['Erstellt am:', currentDate],
    [''],
    ['HAUPTBERECHNUNGEN'],
    ['Position', 'Beschreibung', 'Wert', 'Zielfeld'],
    [''],
    ['PREISE'],
    [1, 'Monatlicher Gesamtpreis (netto)', totals.angebotspreisMonat, 'Preisblatt Pos. 1.1'],
    [2, 'Jahresgesamtpreis (netto)', totals.angebotspreisJahr, 'Preisblatt Pos. 1.2'],
    [3, 'Reinigungskosten / Monat', totals.gesamtLohnkosten, 'Preisblatt Pos. 2.1'],
    [4, 'Fahrtkosten / Monat', fahrtkosten, 'Preisblatt Pos. 2.2'],
    [5, 'Materialkosten / Monat', totals.gesamtMaterial, 'Preisblatt Pos. 2.3'],
    [6, 'Sonderleistungen / Monat', sonderleistungen, 'Preisblatt Pos. 2.4'],
    [''],
    ['MENGEN & FLÄCHEN'],
    [1, 'Reinigungsfläche gesamt', `${totalFlaeche.toFixed(0)} m²`, 'Leistungsverzeichnis Pos. 1'],
    [2, 'Reinigungen pro Woche', `${avgHaeufigkeitProWoche}x`, 'Leistungsverzeichnis Pos. 2'],
    [3, 'Entfernung Depot-Objekt', `${entfernungKm} km`, 'Leistungsverzeichnis Pos. 3'],
    [''],
    ['DETAILLIERTE AUFSCHLÜSSELUNG'],
    ['Komponente', 'Berechnung', 'Betrag (EUR)'],
    ['Reinigungsfläche', `${totalFlaeche.toFixed(0)} m²`],
    ['Reinigungen pro Woche', `${avgHaeufigkeitProWoche}x`],
    ['Wochen pro Monat', wochenProMonat.toFixed(1)],
    ['Reinigungen pro Monat', reinigungenProMonat.toFixed(1)],
    [''],
    ['Stundensatz', `${parameters.stundensatz.toFixed(2)} EUR/Std`],
    ['Gesamtstunden / Monat', `${totalStd.toFixed(2)} Std`],
    ['Lohnkosten', `${totalStd.toFixed(2)} Std × ${parameters.stundensatz.toFixed(2)} EUR`, totals.gesamtLohnkosten],
    [''],
    ['Entfernung (einfach)', `${entfernungKm} km`],
    ['Kosten pro km', `${kostenProKm.toFixed(2)} EUR`],
    ['Fahrten pro Monat', `${reinigungenProMonat.toFixed(1)} × 2`, (reinigungenProMonat * 2).toFixed(0)],
    ['Fahrtkosten gesamt', `${entfernungKm} × 2 × ${kostenProKm.toFixed(2)} × ${reinigungenProMonat.toFixed(1)}`, fahrtkosten],
    [''],
    ['Materialkosten / Monat', '', totals.gesamtMaterial],
    ['Sonderleistungen / Monat', '', sonderleistungen],
    [''],
    ['ZWISCHENSUMME', '', totals.zwischensumme],
    [`Marge (${parameters.margeProzent.toFixed(0)}%)`, `${totals.zwischensumme.toFixed(2)} × ${parameters.margeProzent}%`, totals.marge],
    [''],
    ['GESAMTPREIS / MONAT (netto)', '', totals.angebotspreisMonat],
    ['GESAMTPREIS / JAHR (netto)', '', totals.angebotspreisJahr],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 18 }, { wch: 25 }];

  const currencyFormat = '#,##0.00';

  ['C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C30', 'C34', 'C37', 'C38', 'C40', 'C41', 'C43', 'C44'].forEach(cell => {
    if (ws1[cell]) {
      ws1[cell].z = currencyFormat;
      ws1[cell].t = 'n';
    }
  });

  XLSX.utils.book_append_sheet(workbook, ws1, 'Kalkulation');

  const roomListData: (string | number)[][] = [
    ['RAUMLISTE'],
    [''],
    ['Vergabenummer:', tenderNumber],
    ['Datum:', currentDate],
    [''],
    ['Objekt', 'Raum-Nr.', 'Raum-Name', 'Raum-Typ', 'Fläche (m²)', 'Häuf./M', 'qm/h', 'Std./M', 'EUR/M'],
  ];

  const gebaeude = [...new Set(raeume.map(r => r.gebaeude))];

  gebaeude.forEach(geb => {
    const gebaeudeRaeume = raeume.filter(r => r.gebaeude === geb);
    gebaeudeRaeume.forEach((raum, idx) => {
      const raumNr = `${String(idx + 1).padStart(2, '0')}`;
      roomListData.push([
        raum.gebaeude,
        raumNr,
        raum.name,
        raum.raumTyp,
        raum.flaeche,
        raum.haeufM,
        raum.qmh,
        raum.stdM,
        raum.eurM
      ]);
    });
  });

  roomListData.push(['']);
  roomListData.push(['ZUSAMMENFASSUNG', '', '', '', '', '', '', '', '']);
  roomListData.push(['Gesamtfläche (m²)', '', '', '', totalFlaeche, '', '', '', '']);
  roomListData.push(['Gesamtstunden/Monat', '', '', '', '', '', '', totalStd, '']);
  roomListData.push(['Lohnkosten/Monat (EUR)', '', '', '', '', '', '', '', totals.gesamtLohnkosten]);
  roomListData.push(['Materialkosten/Monat (EUR)', '', '', '', '', '', '', '', totals.gesamtMaterial]);
  roomListData.push(['Zwischensumme (EUR)', '', '', '', '', '', '', '', totals.zwischensumme]);
  roomListData.push([`Marge ${parameters.margeProzent}% (EUR)`, '', '', '', '', '', '', '', totals.marge]);
  roomListData.push(['GESAMTPREIS/MONAT (EUR)', '', '', '', '', '', '', '', totals.angebotspreisMonat]);
  roomListData.push(['GESAMTPREIS/JAHR (EUR)', '', '', '', '', '', '', '', totals.angebotspreisJahr]);
  roomListData.push(['']);
  roomListData.push(['']);
  roomListData.push(['RAUMTYP-PROFILE (Kalkulationsgrundlage)', '', '', '', '', '', '', '', '']);
  roomListData.push(['Raumtyp', 'qm/h', 'Häufigkeit/M', 'Beschreibung', '', '', '', '', '']);
  roomListData.push(['Flur', 200, 15.83, 'Hochfrequentierte Verkehrsflächen', '', '', '', '', '']);
  roomListData.push(['Sanitär', 25, 15.83, 'Intensive Reinigung mit Desinfektion', '', '', '', '', '']);
  roomListData.push(['Küchen/Speiseraum', 40, 15.83, 'Lebensmittelbereiche mit Hygienestandards', '', '', '', '', '']);
  roomListData.push(['Klassen/Gruppenraum', 80, 8.25, 'Unterrichts- und Gruppenräume', '', '', '', '', '']);
  roomListData.push(['Lager', 400, 0.92, 'Geringer Reinigungsaufwand', '', '', '', '', '']);
  roomListData.push(['Bibliothek', 150, 6.67, 'Staub- und papierintensive Bereiche', '', '', '', '', '']);
  roomListData.push(['Büro', 120, 15.83, 'Standard Büroräume', '', '', '', '', '']);

  const ws2 = XLSX.utils.aoa_to_sheet(roomListData);
  ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];

  ['E7', 'F7', 'G7', 'H7', 'I7'].forEach((col, idx) => {
    for (let i = 7; i < 7 + gebaeude.length * 10; i++) {
      const cell = `${col}${i}`;
      if (ws2[cell]) {
        ws2[cell].z = currencyFormat;
      }
    }
  });

  XLSX.utils.book_append_sheet(workbook, ws2, 'Raumliste');

  const preisblattData: (string | number)[][] = [
    ['PREISBLATT - ÖFFENTLICHE AUSSCHREIBUNG'],
    [''],
    ['Ausschreibung:', 'Unterhalts- und Glasreinigung Verwaltungsgebäude'],
    ['Vergabenummer:', tenderNumber],
    ['Auftraggeber:', 'Stadt Stade - Gebäudemanagement'],
    ['Bieter:', '[Firmenname des Bieters]'],
    ['Datum:', currentDate],
    [''],
    [''],
    ['LOS 1: UNTERHALTSREINIGUNG'],
    [''],
    ['Pos.', 'Leistungsbeschreibung', 'Einheit', 'Menge', 'EP netto (EUR)', 'GP netto (EUR)'],
    [''],
    ['1.1', 'Unterhaltsreinigung Verwaltungsgebäude', 'Monat', 12, totals.angebotspreisMonat, totals.angebotspreisJahr],
    ['1.1.1', '  - Lohnkosten', 'pauschal', '', '', totals.gesamtLohnkosten * 12],
    ['1.1.2', '  - Materialkosten', 'pauschal', '', '', totals.gesamtMaterial * 12],
    ['1.1.3', '  - Fahrtkosten', 'pauschal', '', '', fahrtkosten * 12],
    ['1.1.4', '  - Sonderleistungen', 'pauschal', '', '', sonderleistungen * 12],
    ['1.1.5', `  - Marge (${parameters.margeProzent}%)`, 'pauschal', '', '', totals.marge * 12],
    [''],
    ['', '', '', '', 'Summe Los 1:', totals.angebotspreisJahr],
    [''],
    [''],
    ['LOS 2: GLASREINIGUNG'],
    [''],
    ['2.1', 'Glasreinigung Außen (4x jährlich)', 'Einsatz', 4, totals.angebotspreisMonat * 0.15, totals.angebotspreisMonat * 0.15 * 4],
    ['2.2', 'Glasreinigung Innen (2x jährlich)', 'Einsatz', 2, totals.angebotspreisMonat * 0.08, totals.angebotspreisMonat * 0.08 * 2],
    [''],
    ['', '', '', '', 'Summe Los 2:', totals.angebotspreisMonat * 0.15 * 4 + totals.angebotspreisMonat * 0.08 * 2],
    [''],
    [''],
    ['LOS 3: GRUNDREINIGUNG'],
    [''],
    ['3.1', 'Grundreinigung Hartböden (1x jährlich)', 'Einsatz', 1, totals.angebotspreisMonat * 0.8, totals.angebotspreisMonat * 0.8],
    ['3.2', 'Teppichtiefenreinigung (1x jährlich)', 'Einsatz', 1, totalFlaeche * 0.25, totalFlaeche * 0.25],
    [''],
    ['', '', '', '', 'Summe Los 3:', totals.angebotspreisMonat * 0.8 + totalFlaeche * 0.25],
    [''],
    [''],
    ['GESAMTANGEBOT (3 Jahre Vertragslaufzeit)'],
    [''],
    ['', 'Jahressumme alle Lose netto:', '', '', '', totals.angebotspreisJahr + (totals.angebotspreisMonat * 0.15 * 4 + totals.angebotspreisMonat * 0.08 * 2) + totals.angebotspreisMonat * 0.8 + totalFlaeche * 0.25],
    ['', 'Gesamtsumme 3 Jahre netto:', '', '', '', (totals.angebotspreisJahr + (totals.angebotspreisMonat * 0.15 * 4 + totals.angebotspreisMonat * 0.08 * 2) + totals.angebotspreisMonat * 0.8 + totalFlaeche * 0.25) * 3],
    ['', 'MwSt. (19%):', '', '', '', (totals.angebotspreisJahr + (totals.angebotspreisMonat * 0.15 * 4 + totals.angebotspreisMonat * 0.08 * 2) + totals.angebotspreisMonat * 0.8 + totalFlaeche * 0.25) * 3 * 0.19],
    ['', 'GESAMTSUMME 3 Jahre brutto:', '', '', '', (totals.angebotspreisJahr + (totals.angebotspreisMonat * 0.15 * 4 + totals.angebotspreisMonat * 0.08 * 2) + totals.angebotspreisMonat * 0.8 + totalFlaeche * 0.25) * 3 * 1.19],
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(preisblattData);
  ws4['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 20 }];

  ['E14', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F21', 'E26', 'F26', 'E27', 'F27', 'F29',
   'E34', 'F34', 'F35', 'F37', 'F42', 'F43', 'F44', 'F45'].forEach(cell => {
    if (ws4[cell]) {
      ws4[cell].z = currencyFormat;
      ws4[cell].t = 'n';
    }
  });

  XLSX.utils.book_append_sheet(workbook, ws4, 'Preisblatt');

  const personalData: (string | number)[][] = [
    ['PERSONALEINSATZPLANUNG'],
    [''],
    ['Vergabenummer:', tenderNumber],
    ['Objekt:', 'Verwaltungsgebäude Stadt Stade'],
    ['Reinigungsfläche (m²):', totalFlaeche],
    ['Monatliche Arbeitsstunden:', totalStd],
    [''],
    [''],
    ['PERSONALÜBERSICHT'],
    [''],
    ['Funktion', 'Anzahl', 'Qualifikation', 'Einsatzzeit', 'Std./Woche', 'Std./Monat'],
    ['Objektleitung', 1, 'Meister Gebäudereinigung', 'Mo-Fr 07:00-09:00', 10, 43],
    ['Vorarbeiter', 1, 'Gebäudereiniger mit 5+ Jahren', 'Mo-Fr 06:00-10:00', 20, 86],
    ['Reinigungskräfte', Math.ceil(totalStd / 80), 'Ausgebildete Reinigungskräfte', 'Mo-Fr 06:00-10:00', Math.ceil(totalStd / 4.3), totalStd],
    ['Springer', 1, 'Erfahrene Reinigungskräfte', 'Nach Bedarf', 10, 43],
    [''],
    ['', '', '', 'SUMME:', Math.ceil(totalStd / 4.3) + 40, totalStd + 172],
    [''],
    [''],
    ['LOHNKOSTENKALKULATION'],
    [''],
    ['Position', 'Wert', 'Einheit', 'Bemerkung'],
    ['Grundlohn Gebäudereiniger', 14.20, 'EUR/Std', 'Tarifvertrag 2025'],
    ['Sozialversicherung AG', 19.80, '%', 'Arbeitgeberanteil'],
    ['Rentenversicherung', 9.45, '%', ''],
    ['Krankenversicherung', 7.35, '%', ''],
    ['Pflegeversicherung', 1.70, '%', ''],
    ['Arbeitslosenversicherung', 1.30, '%', ''],
    ['Unfallversicherung (BG)', 1.25, '%', 'BG BAU'],
    ['Urlaubsgeld', 8.33, '%', '1 Monatsgehalt'],
    ['Weihnachtsgeld', 8.33, '%', '1 Monatsgehalt'],
    ['Lohnfortzahlung (Krankheit)', 4.00, '%', 'Durchschnitt'],
    ['Gemeinkosten', 15.50, '%', 'Verwaltung, Fahrzeuge, etc.'],
    [''],
    ['Kalkulatorischer Verrechnungssatz:', parameters.stundensatz, 'EUR/Std', 'inkl. aller Nebenkosten'],
    [''],
    [''],
    ['QUALIFIKATIONEN & ANFORDERUNGEN'],
    [''],
    ['- Alle Mitarbeiter mit polizeilichem Führungszeugnis'],
    ['- Deutschkenntnisse mindestens B1'],
    ['- Regelmäßige Schulungen in Hygienevorschriften'],
    ['- Objektspezifische Einweisung vor Arbeitsbeginn'],
    ['- ISO 9001:2015 zertifiziertes Qualitätsmanagement'],
  ];

  const ws5 = XLSX.utils.aoa_to_sheet(personalData);
  ws5['!cols'] = [{ wch: 32 }, { wch: 15 }, { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, ws5, 'Personal');

  const materialPlanData: (string | number)[][] = [
    ['MATERIAL- UND GERÄTEPLANUNG'],
    [''],
    ['Vergabenummer:', tenderNumber],
    ['Objekt:', 'Verwaltungsgebäude Stadt Stade'],
    ['Reinigungsfläche (m²):', totalFlaeche],
    [''],
    [''],
    ['REINIGUNGSMITTEL (monatlicher Bedarf)'],
    [''],
    ['Artikel', 'Verbrauch', 'Einheit', 'EP (EUR)', 'GP (EUR)'],
    ['Universalreiniger (Konzentrat)', Math.ceil(totalFlaeche / 500), 'Liter', 8.50, Math.ceil(totalFlaeche / 500) * 8.50],
    ['Sanitärreiniger', Math.ceil(totalFlaeche / 800), 'Liter', 12.00, Math.ceil(totalFlaeche / 800) * 12.00],
    ['Glasreiniger', Math.ceil(totalFlaeche / 1500), 'Liter', 6.50, Math.ceil(totalFlaeche / 1500) * 6.50],
    ['Desinfektionsmittel', Math.ceil(totalFlaeche / 600), 'Liter', 15.00, Math.ceil(totalFlaeche / 600) * 15.00],
    ['Bodenpflege', Math.ceil(totalFlaeche / 1000), 'Liter', 18.00, Math.ceil(totalFlaeche / 1000) * 18.00],
    ['Handseife', Math.ceil(totalFlaeche / 50), 'Stück', 2.50, Math.ceil(totalFlaeche / 50) * 2.50],
    ['Papierhandtücher', Math.ceil(totalFlaeche / 25), 'Packung', 12.00, Math.ceil(totalFlaeche / 25) * 12.00],
    ['Toilettenpapier', Math.ceil(totalFlaeche / 30), 'Packung', 8.00, Math.ceil(totalFlaeche / 30) * 8.00],
    ['Müllbeutel 60L', Math.ceil(totalFlaeche / 15), 'Stück', 0.25, Math.ceil(totalFlaeche / 15) * 0.25],
    ['Mikrofasertücher', Math.ceil(totalFlaeche / 100), 'Stück', 3.50, Math.ceil(totalFlaeche / 100) * 3.50],
    ['Moppbezüge', Math.ceil(totalFlaeche / 200), 'Stück', 8.00, Math.ceil(totalFlaeche / 200) * 8.00],
    [''],
    ['', '', '', 'Summe Material/Monat:', totals.gesamtMaterial],
    ['', '', '', 'Materialkosten pro m²:', parameters.materialKostenProQm],
    [''],
    [''],
    ['MASCHINEN UND GERÄTE'],
    [''],
    ['Gerät', 'Anzahl', 'Typ/Modell', 'Einsatzbereich'],
    ['Staubsauger (Trocken)', 2, 'Professioneller Bodensauger', 'Teppichböden, Textilien'],
    ['Nass-/Trockensauger', 1, 'Industriesauger', 'Nassreinigung, Notfälle'],
    ['Einscheibenmaschine', 1, 'Bodenreinigungsmaschine', 'Grundreinigung Hartböden'],
    ['Reinigungswagen komplett', Math.ceil(totalStd / 100), 'Professioneller Servicewagen', 'Unterhaltsreinigung'],
    ['Teleskopstangen-Set', 1, 'Glasreinigungssystem', 'Glasreinigung'],
    [''],
    [''],
    ['UMWELTSTANDARDS'],
    [''],
    ['- Alle Reinigungsmittel mit EU Ecolabel oder Blauem Engel zertifiziert'],
    ['- REACH-konforme Produkte'],
    ['- Biologisch abbaubare Inhaltsstoffe'],
    ['- Dosiersysteme zur Vermeidung von Überdosierung'],
    ['- Recycling-Quote Verpackungen > 90%'],
  ];

  const ws6 = XLSX.utils.aoa_to_sheet(materialPlanData);
  ws6['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, ws6, 'Material');

  const leistungsverzeichnisData: (string | number)[][] = [
    ['LEISTUNGSVERZEICHNIS'],
    [''],
    ['Vergabenummer:', tenderNumber],
    ['Auftraggeber:', 'Stadt Stade'],
    ['Objekt:', 'Verwaltungsgebäude'],
    ['Vertragslaufzeit:', '36 Monate'],
    [''],
    [''],
    ['1. UNTERHALTSREINIGUNG'],
    [''],
    ['1.1 Täglich zu reinigende Bereiche (Mo-Fr)'],
    [''],
    ['Bereich', 'Fläche (m²)', 'Tätigkeiten'],
  ];

  const taeglicheRaeume = raeume.filter(r => r.haeufM >= 15);
  taeglicheRaeume.forEach(r => {
    leistungsverzeichnisData.push([r.name, r.flaeche, `${r.raumTyp}-Reinigung nach Standard`]);
  });

  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['1.2 Wöchentlich zu reinigende Bereiche']);
  leistungsverzeichnisData.push(['']);

  const woechentlicheRaeume = raeume.filter(r => r.haeufM >= 4 && r.haeufM < 15);
  woechentlicheRaeume.forEach(r => {
    leistungsverzeichnisData.push([r.name, r.flaeche, `${r.raumTyp}-Reinigung nach Standard`]);
  });

  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['1.3 Monatlich zu reinigende Bereiche']);
  leistungsverzeichnisData.push(['']);

  const monatlicheRaeume = raeume.filter(r => r.haeufM > 0 && r.haeufM < 4);
  monatlicheRaeume.forEach(r => {
    leistungsverzeichnisData.push([r.name, r.flaeche, `${r.raumTyp}-Reinigung nach Standard`]);
  });

  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['2. REINIGUNGSSTANDARDS']);
  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['Raumtyp', 'Tätigkeiten', 'Qualitätskriterien']);
  leistungsverzeichnisData.push(['Sanitär', 'WC-Becken, Waschbecken, Spiegel, Armaturen, Böden, Abfallbehälter, Verbrauchsmaterial auffüllen', 'Streifenfrei, desinfiziert, keine Gerüche']);
  leistungsverzeichnisData.push(['Flur', 'Böden feucht wischen, Handläufe, Türklinken, Schalter', 'Sauber, rutschfest, griffbereit']);
  leistungsverzeichnisData.push(['Büro', 'Böden, Oberflächen, Papierkörbe, Türklinken', 'Staubfrei, ordentlich']);
  leistungsverzeichnisData.push(['Küche', 'Oberflächen, Geräte, Böden, Abfall', 'Hygienisch, fettfrei']);
  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['3. QUALITÄTSSICHERUNG']);
  leistungsverzeichnisData.push(['']);
  leistungsverzeichnisData.push(['- Wöchentliche Eigenkontrollen durch Vorarbeiter']);
  leistungsverzeichnisData.push(['- Monatliche Begehung mit Auftraggeber']);
  leistungsverzeichnisData.push(['- Dokumentation aller Reinigungsleistungen']);
  leistungsverzeichnisData.push(['- Reaktionszeit bei Reklamationen: max. 24 Stunden']);
  leistungsverzeichnisData.push(['- Notfallreinigung innerhalb 4 Stunden']);

  const ws7 = XLSX.utils.aoa_to_sheet(leistungsverzeichnisData);
  ws7['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, ws7, 'Leistungsverzeichnis');

  const agbData: (string | number)[][] = [
    ['ALLGEMEINE VERTRAGSBEDINGUNGEN'],
    [''],
    ['1. VERTRAGSGEGENSTAND'],
    [''],
    ['Der Auftragnehmer verpflichtet sich zur Durchführung von Reinigungsdienstleistungen'],
    ['gemäß dem beigefügten Leistungsverzeichnis und Preisblatt.'],
    [''],
    [''],
    ['2. VERTRAGSLAUFZEIT'],
    [''],
    ['2.1 Beginn:', '01.03.2026'],
    ['2.2 Ende:', '28.02.2029'],
    ['2.3 Laufzeit:', '36 Monate'],
    ['2.4 Option:', '2 x 12 Monate Verlängerung'],
    [''],
    [''],
    ['3. VERGÜTUNG'],
    [''],
    ['3.1 Monatspreis netto:', totals.angebotspreisMonat],
    ['3.2 Jahrespreis netto:', totals.angebotspreisJahr],
    ['3.3 Zahlungsziel:', '30 Tage netto'],
    ['3.4 Rechnungsstellung:', 'Monatlich im Nachhinein'],
    [''],
    [''],
    ['4. PREISANPASSUNG'],
    [''],
    ['4.1 Anpassung bei Tariflohnerhöhungen entsprechend dem prozentualen Anteil'],
    ['4.2 Ankündigungsfrist: 3 Monate'],
    ['4.3 Nachweis durch Tarifvertrag erforderlich'],
    [''],
    [''],
    ['5. HAFTUNG UND VERSICHERUNG'],
    [''],
    ['5.1 Betriebshaftpflicht:', '5.000.000 EUR Personenschäden'],
    ['5.2 Sachschäden:', '1.000.000 EUR'],
    ['5.3 Schlüsselversicherung:', '100.000 EUR'],
    [''],
    [''],
    ['6. KÜNDIGUNG'],
    [''],
    ['6.1 Ordentliche Kündigung:', '6 Monate zum Vertragsende'],
    ['6.2 Außerordentliche Kündigung:', 'Bei schwerwiegenden Vertragsverletzungen'],
    [''],
    [''],
    ['7. DATENSCHUTZ'],
    [''],
    ['Der Auftragnehmer verpflichtet sich zur Einhaltung der DSGVO.'],
    ['Alle Mitarbeiter sind auf das Datengeheimnis verpflichtet.'],
    [''],
    [''],
    ['8. SCHLUSSBESTIMMUNGEN'],
    [''],
    ['8.1 Gerichtsstand:', 'Stade'],
    ['8.2 Anwendbares Recht:', 'Deutsches Recht'],
    ['8.3 Schriftformerfordernis für Änderungen'],
    [''],
    [''],
    ['UNTERSCHRIFTEN'],
    [''],
    [''],
    ['_______________________________', '', '_______________________________'],
    ['Auftraggeber', '', 'Auftragnehmer'],
    ['Stadt Stade', '', '[Firmenname des Bieters]'],
    [''],
    [''],
    ['Ort, Datum:', '', 'Ort, Datum:'],
  ];

  const ws8 = XLSX.utils.aoa_to_sheet(agbData);
  ws8['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 40 }];

  ['B19', 'B20'].forEach(cell => {
    if (ws8[cell]) {
      ws8[cell].z = currencyFormat;
      ws8[cell].t = 'n';
    }
  });

  XLSX.utils.book_append_sheet(workbook, ws8, 'Vertragsbedingungen');

  const fileName = `Kalkulation_Gebaeudereinigung_${tenderNumber}_${currentDate.replace(/\./g, '-')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
