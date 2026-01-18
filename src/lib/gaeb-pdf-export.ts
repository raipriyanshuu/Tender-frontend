import { jsPDF } from 'jspdf';

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

export function exportGAEBToPDF(
  positionen: GAEBPosition[],
  projektInfo: ProjektInfo,
  kosten: KostenZusammenfassung
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const currentDate = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  doc.setFillColor(0, 51, 102);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ANGEBOT', margin, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('abc', margin, 30);

  yPos = 50;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const infoLines = [
    { label: 'An:', value: projektInfo.auftraggeber },
    { label: 'Projekt:', value: projektInfo.projektName },
    { label: 'Projekt-Nr.:', value: projektInfo.projektNummer },
    { label: 'Angebotsdatum:', value: projektInfo.datum },
    { label: 'Erstellt am:', value: currentDate },
  ];

  infoLines.forEach(line => {
    doc.setFont('helvetica', 'bold');
    doc.text(line.label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(line.value, margin + 35, yPos);
    yPos += 7;
  });

  yPos += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Sehr geehrte Damen und Herren,', margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introText = [
    'vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für die',
    'Vermietung von Baugeräten gemäß BGL-Standard 2020 und VOB/C DIN 18299.',
    '',
    'Unser Angebot umfasst hochwertige, gewartete Baugeräte mit umfassendem Service.'
  ];

  introText.forEach(line => {
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  yPos += 10;
  addNewPageIfNeeded(20);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LEISTUNGSVERZEICHNIS', margin + 2, yPos + 3);
  yPos += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  const colWidths = [15, 80, 20, 20, 25, 25];
  const startX = margin;
  let currentX = startX;

  const headers = ['Pos.', 'Beschreibung', 'Menge', 'Einheit', 'EP (€)', 'GP (€)'];

  doc.setFillColor(220, 220, 220);
  doc.rect(startX, yPos - 5, pageWidth - 2 * margin, 8, 'F');

  headers.forEach((header, i) => {
    doc.text(header, currentX + 1, yPos);
    currentX += colWidths[i];
  });

  yPos += 8;
  doc.setFont('helvetica', 'normal');

  positionen.forEach(pos => {
    addNewPageIfNeeded(10);

    currentX = startX;

    if (pos.typ === "titel") {
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(startX, yPos - 5, pageWidth - 2 * margin, 8, 'F');

      doc.text(pos.oz, currentX + 1, yPos);
      currentX += colWidths[0];
      doc.text(pos.beschreibung, currentX + 1, yPos);

      yPos += 8;
      doc.setFont('helvetica', 'normal');
    } else {
      doc.text(pos.oz, currentX + 1, yPos);
      currentX += colWidths[0];

      const beschreibungLines = doc.splitTextToSize(pos.beschreibung, colWidths[1] - 2);
      doc.text(beschreibungLines, currentX + 1, yPos);
      currentX += colWidths[1];

      doc.text(pos.menge.toString(), currentX + 1, yPos);
      currentX += colWidths[2];

      doc.text(pos.einheit, currentX + 1, yPos);
      currentX += colWidths[3];

      doc.text(formatCurrency(pos.einzelpreis), currentX + 1, yPos);
      currentX += colWidths[4];

      doc.text(formatCurrency(pos.gesamtpreis), currentX + 1, yPos);

      yPos += Math.max(8, beschreibungLines.length * 5);
    }
  });

  yPos += 10;
  addNewPageIfNeeded(60);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('KOSTENAUFSTELLUNG', margin + 2, yPos + 3);
  yPos += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const kostenLines = [
    { label: 'Zwischensumme Gerätemiete:', value: kosten.zwischensumme },
    { label: 'Gerätetransport (Pauschale):', value: kosten.transportPauschale },
    { label: `Versicherung (${kosten.versicherungProzent}%):`, value: kosten.versicherung },
    { label: `Gewinnzuschlag (${kosten.gewinnzuschlagProzent}%):`, value: kosten.gewinnzuschlag },
  ];

  kostenLines.forEach(line => {
    doc.text(line.label, margin + 5, yPos);
    doc.text(formatCurrency(line.value), pageWidth - margin - 40, yPos);
    yPos += 7;
  });

  yPos += 5;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('NETTO-ANGEBOTSSUMME:', margin + 5, yPos);
  doc.text(formatCurrency(kosten.netto), pageWidth - margin - 40, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('MwSt. (19%):', margin + 5, yPos);
  doc.text(formatCurrency(kosten.mwst), pageWidth - margin - 40, yPos);
  yPos += 10;

  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFillColor(0, 51, 102);
  doc.rect(margin, yPos - 6, pageWidth - 2 * margin, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BRUTTO-ANGEBOTSSUMME:', margin + 5, yPos);
  doc.text(formatCurrency(kosten.brutto), pageWidth - margin - 45, yPos);

  doc.setTextColor(0, 0, 0);
  yPos += 20;

  addNewPageIfNeeded(80);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LEISTUNGSUMFANG', margin + 2, yPos + 3);
  yPos += 15;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const leistungen = [
    '• An- und Abtransport der Geräte zur Baustelle',
    '• Einweisung des Bedienerpersonals vor Ort',
    '• Wartung und Instandhaltung während der Mietzeit',
    '• 24/7 Service-Hotline bei technischen Problemen',
    '• Vollkasko-Versicherung (Selbstbehalt 500 € pro Schadensfall)',
    '• Alle Geräte geprüft nach DGUV Vorschrift 54',
    '• Technische Dokumentation (CE, Bedienungsanleitung)',
    '• Ersatzgerät bei Ausfall innerhalb 24 Stunden'
  ];

  leistungen.forEach(leistung => {
    doc.text(leistung, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 10;
  addNewPageIfNeeded(60);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 12, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('KONDITIONEN', margin + 2, yPos + 3);
  yPos += 15;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const konditionen = [
    'Gültigkeit des Angebots: 30 Tage ab Angebotsdatum',
    'Zahlungsbedingungen: 14 Tage netto nach Rechnungserhalt',
    'Mindestmietdauer: Je nach Gerät 1 Tag / 1 Woche / 1 Monat',
    'Bereitstellung: Innerhalb von 48 Stunden nach Auftragserteilung',
    'Abrechnung: Nach tatsächlichem Einsatz',
    'Preisbasis: BGL-Gerätekatalog 2020, VOB/C DIN 18299',
  ];

  konditionen.forEach(kondition => {
    doc.text(kondition, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const abschlussText = [
    'Wir hoffen, dass unser Angebot Ihren Vorstellungen entspricht und freuen uns auf',
    'eine erfolgreiche Zusammenarbeit. Für Rückfragen stehen wir Ihnen jederzeit gerne',
    'zur Verfügung.',
    '',
    'Mit freundlichen Grüßen',
  ];

  abschlussText.forEach(line => {
    addNewPageIfNeeded(10);
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('abc', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Vertrieb Baugeräte', margin, yPos);

  doc.setFillColor(0, 51, 102);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('abc | Musterstraße 123 | 12345 Musterstadt', pageWidth / 2, pageHeight - 12, { align: 'center' });
  doc.text('Tel: +49 123 456789 | E-Mail: info@abc.de | www.abc.de', pageWidth / 2, pageHeight - 7, { align: 'center' });

  const fileName = `Angebot_${projektInfo.projektNummer}_${currentDate.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
}
