import * as XLSX from 'xlsx';

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

interface ProjektInfo {
  projektName: string;
  auftraggeber: string;
  projektNummer: string;
  datum: string;
}

interface KostenZusammenfassung {
  zwischensumme: number;
  transportPauschale: number;
  versicherung: number;
  versicherungProzent: number;
  gewinnzuschlag: number;
  gewinnzuschlagProzent: number;
  netto: number;
  mwst: number;
  brutto: number;
}

export function exportGAEBToExcel(
  positionen: GAEBPosition[],
  projektInfo: ProjektInfo,
  kosten: KostenZusammenfassung
) {
  const workbook = XLSX.utils.book_new();
  const currentDate = new Date().toLocaleDateString('de-DE');

  const headerData: any[][] = [
    ['GAEB 2020 - BAUGERÄTE-KALKULATION'],
    ['abc'],
    [''],
    ['Projekt:', projektInfo.projektName],
    ['Auftraggeber:', projektInfo.auftraggeber],
    ['Projekt-Nr.:', projektInfo.projektNummer],
    ['Datum:', projektInfo.datum],
    ['Erstellt am:', currentDate],
    [''],
    [''],
  ];

  const positionenHeader = [
    ['Pos.', 'Beschreibung', 'Menge', 'Einheit', 'EP netto (€)', 'GP netto (€)', 'BGL-Code'],
    [''],
  ];

  const positionenData = positionen.map(pos => {
    if (pos.typ === "titel") {
      return [pos.oz, pos.beschreibung, '', '', '', '', ''];
    }
    return [
      pos.oz,
      pos.beschreibung,
      pos.menge,
      pos.einheit,
      pos.einzelpreis.toFixed(2),
      pos.gesamtpreis.toFixed(2),
      pos.bglCode || ''
    ];
  });

  const kostenData: any[][] = [
    [''],
    ['KOSTENAUFSTELLUNG NACH VOB/C DIN 18299'],
    [''],
    ['Zwischensumme Gerätemiete', '', '', '', '', kosten.zwischensumme.toFixed(2)],
    ['Gerätetransport (Pauschale)', '', '', '', '', kosten.transportPauschale.toFixed(2)],
    [`Versicherung (${kosten.versicherungProzent}%)`, '', '', '', '', kosten.versicherung.toFixed(2)],
    [`Gewinnzuschlag (${kosten.gewinnzuschlagProzent}%)`, '', '', '', '', kosten.gewinnzuschlag.toFixed(2)],
    [''],
    ['NETTO-ANGEBOTSSUMME', '', '', '', '', kosten.netto.toFixed(2)],
    ['MwSt. (19%)', '', '', '', '', kosten.mwst.toFixed(2)],
    [''],
    ['BRUTTO-ANGEBOTSSUMME', '', '', '', '', kosten.brutto.toFixed(2)],
  ];

  const allData = [...headerData, ...positionenHeader, ...positionenData, ...kostenData];

  const ws1 = XLSX.utils.aoa_to_sheet(allData);

  ws1['!cols'] = [
    { wch: 10 },
    { wch: 50 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 }
  ];

  const currencyFormat = '#,##0.00 €';
  const startRow = headerData.length + positionenHeader.length;

  for (let i = 0; i < positionenData.length; i++) {
    const rowNum = startRow + i + 1;
    ['E', 'F'].forEach(col => {
      const cell = `${col}${rowNum}`;
      if (ws1[cell] && ws1[cell].v !== '') {
        ws1[cell].z = currencyFormat;
        ws1[cell].t = 'n';
      }
    });
  }

  const kostenStartRow = startRow + positionenData.length;
  [4, 5, 6, 7, 9, 10, 12].forEach(offset => {
    const cell = `F${kostenStartRow + offset}`;
    if (ws1[cell]) {
      ws1[cell].z = currencyFormat;
      ws1[cell].t = 'n';
    }
  });

  XLSX.utils.book_append_sheet(workbook, ws1, 'Angebot');

  const bglData: any[][] = [
    ['BGL GERÄTEKATALOG 2020'],
    [''],
    ['Code', 'Bezeichnung', 'Einheit', 'Verrechnungssatz'],
    [''],
    ['01.01', 'Hydraulikbagger 20t mit Fahrer', 'Tag', '450,00 €'],
    ['01.02', 'Radlader 5t mit Fahrer', 'Tag', '380,00 €'],
    ['02.01', 'LKW-Transport bis 12t', 'Tag', '280,00 €'],
    ['03.01', 'Turmdrehkran 50m Ausladung', 'Tag', '850,00 €'],
    ['03.02', 'Mobilkran 50t', 'Std', '180,00 €'],
    ['04.01', 'Rüttelplatte 200kg', 'Tag', '45,00 €'],
    ['04.02', 'Vibrationswalze 3t', 'Tag', '320,00 €'],
    ['05.01', 'Fassadengerüst inkl. Auf-/Abbau', 'm²', '8,50 €'],
    ['05.02', 'Arbeitskorb/Hebebühne 15m', 'Tag', '220,00 €'],
    ['06.01', 'Stromerzeuger 100 kVA', 'Tag', '85,00 €'],
    ['06.02', 'Baustromverteiler 32A/400V', 'Tag', '25,00 €'],
    ['07.01', 'Baucontainer 20\' (Büro)', 'Monat', '180,00 €'],
    ['07.02', 'Baustellentoilette', 'Monat', '95,00 €'],
    ['08.01', 'Betonmischer 200L', 'Tag', '35,00 €'],
    ['08.02', 'Abbruchhammer elektrisch', 'Tag', '55,00 €'],
    [''],
    [''],
    ['HINWEISE ZUR KALKULATION'],
    [''],
    ['1. Alle Preise verstehen sich netto zzgl. 19% MwSt.'],
    ['2. Verrechnungssätze gemäß BGL-Katalog 2020'],
    ['3. Transport von/zur Baustelle separat ausgewiesen'],
    ['4. Versicherung deckt Sachschäden während der Mietzeit'],
    ['5. Wartung und Instandhaltung im Mietpreis enthalten'],
    ['6. Bei Geräten mit Fahrer: 8 Stunden Arbeitstag inkl.'],
    ['7. Überstunden nach Vereinbarung möglich'],
    ['8. Mindestmietdauer: 1 Tag / 1 Woche / 1 Monat je nach Gerät'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(bglData);
  ws2['!cols'] = [{ wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, ws2, 'BGL-Katalog');

  const vertragData: any[][] = [
    ['VERTRAGSBEDINGUNGEN BAUGERÄTE-VERMIETUNG'],
    [''],
    ['ALLGEMEINE GESCHÄFTSBEDINGUNGEN'],
    [''],
    ['1. VERTRAGSGEGENSTAND'],
    ['Der Vermieter vermietet dem Mieter die im Angebot aufgeführten Baugeräte'],
    ['gemäß BGL-Standard 2020 nach VOB/C DIN 18299.'],
    [''],
    ['2. MIETZEIT UND MIETPREIS'],
    ['2.1 Mietbeginn:', 'Nach Vereinbarung'],
    ['2.2 Mietende:', 'Nach Projektabschluss'],
    ['2.3 Abrechnung:', 'Nach tatsächlichem Einsatz'],
    ['2.4 Zahlungsziel:', '14 Tage netto'],
    [''],
    ['3. TRANSPORT UND ÜBERGABE'],
    ['3.1 An- und Abtransport erfolgt durch den Vermieter'],
    ['3.2 Bereitstellungszeit max. 48 Stunden nach Auftragserteilung'],
    ['3.3 Übergabe erfolgt vor Ort mit Übergabeprotokoll'],
    [''],
    ['4. PFLICHTEN DES MIETERS'],
    ['4.1 Bedienung nur durch fachkundiges Personal'],
    ['4.2 Einhaltung der Betriebsvorschriften'],
    ['4.3 Meldung von Schäden unverzüglich'],
    ['4.4 Sorgfältige Behandlung der Mietgeräte'],
    [''],
    ['5. WARTUNG UND REPARATUR'],
    ['5.1 Regelmäßige Wartung durch Vermieter'],
    ['5.2 Reparaturen bei Verschleiß kostenlos'],
    ['5.3 Schäden durch unsachgemäße Bedienung trägt der Mieter'],
    [''],
    ['6. HAFTUNG UND VERSICHERUNG'],
    ['6.1 Vollkaskoversicherung im Mietpreis enthalten'],
    ['6.2 Selbstbehalt: 500 € pro Schadensfall'],
    ['6.3 Diebstahl unverzüglich der Polizei melden'],
    [''],
    ['7. KÜNDIGUNG'],
    ['7.1 Ordentliche Kündigung: 7 Tage zum Monatsende'],
    ['7.2 Außerordentliche Kündigung bei Zahlungsverzug'],
    [''],
    ['8. SICHERHEITSVORSCHRIFTEN'],
    ['8.1 Einhaltung der DGUV Vorschrift 38 (Bauarbeiten)'],
    ['8.2 Prüfung der Geräte vor jedem Einsatz'],
    ['8.3 Bedienungsanleitung ist zu beachten'],
    ['8.4 Persönliche Schutzausrüstung erforderlich'],
    [''],
    ['9. GEWÄHRLEISTUNG'],
    ['9.1 Geräte sind funktionstüchtig und betriebsbereit'],
    ['9.2 Bei Mängeln kostenloser Austausch innerhalb 24 Stunden'],
    [''],
    ['10. SCHLUSSBESTIMMUNGEN'],
    ['10.1 Gerichtsstand: Standort des Vermieters'],
    ['10.2 Es gilt deutsches Recht'],
    [''],
    [''],
    ['TECHNISCHE DOKUMENTATION'],
    [''],
    ['Folgende Unterlagen werden mit den Geräten übergeben:'],
    ['- Bedienungsanleitung in deutscher Sprache'],
    ['- Prüfprotokoll (DGUV Vorschrift 54)'],
    ['- CE-Konformitätserklärung'],
    ['- Wartungsnachweis'],
    ['- Sicherheitsdatenblätter (bei Bedarf)'],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(vertragData);
  ws3['!cols'] = [{ wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, ws3, 'Vertragsbedingungen');

  const fileName = `GAEB_Angebot_${projektInfo.projektNummer}_${currentDate.replace(/\./g, '-')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
