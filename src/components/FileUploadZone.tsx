import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, Eye } from 'lucide-react';
// import { fileUploadService, UploadBatch, FileUpload } from '@/lib/file-upload-service';

// N8N Webhook URL - Update this with your actual webhook URL
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/tender-upload';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface FileUploadZoneProps {
  onTenderCreated: (tenderId: string) => void;
}

const DetailSection: React.FC<{
  title: string;
  icon: string;
  items: string[];
  alertType?: 'error' | 'warning' | 'info';
}> = ({ title, icon, items, alertType }) => {
  if (!items || items.length === 0) return null;

  const bgColor = alertType === 'error'
    ? 'bg-red-50 border-red-200'
    : alertType === 'warning'
    ? 'bg-yellow-50 border-yellow-200'
    : 'bg-gray-50 border-gray-200';

  const textColor = alertType === 'error'
    ? 'text-red-900'
    : alertType === 'warning'
    ? 'text-yellow-900'
    : 'text-gray-900';

  return (
    <div className={`border-b pb-4 ${alertType ? `${bgColor} border rounded-lg p-4 -mx-4 mb-2` : ''}`}>
      <h4 className={`font-semibold mb-3 flex items-center gap-2 ${textColor}`}>
        <span>{icon}</span>
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className={`text-sm flex items-start gap-2 ${textColor}`}>
            <span className="mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onTenderCreated }) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const validFiles = filesArray.filter(file => {
      const isValid =
        file.type.includes('pdf') ||
        file.type.includes('word') ||
        file.type.includes('document') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel') ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls');

      return isValid && file.size <= 10 * 1024 * 1024;
    });

    if (validFiles.length === 0) {
      setError('Please select valid files (PDF, Word, Excel, max 10MB)');
      return;
    }

    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading',
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    await processFiles(validFiles);
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Upload files to N8N webhook
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        setUploadingFiles(prev =>
          prev.map(uf => uf.file.name === file.name ? { ...uf, progress: 30, status: 'uploading' } : uf)
        );

        try {
          // Create FormData for file upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('filename', file.name);
          formData.append('file_type', file.type);
          formData.append('file_id', `${Date.now()}-${file.name}`);

          setUploadingFiles(prev =>
            prev.map(uf => uf.file.name === file.name ? { ...uf, progress: 50, status: 'processing' } : uf)
          );

          // Send to N8N webhook
          const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const result = await response.json();
          console.log('N8N webhook response:', result);

          setUploadingFiles(prev =>
            prev.map(uf => uf.file.name === file.name ? {
              ...uf,
              progress: 100,
              status: 'completed'
            } : uf)
          );

          // Wait a bit then refresh tenders list
          setTimeout(() => {
            window.location.reload(); // Simple refresh to show new data
          }, 2000);

        } catch (err) {
          console.error('Error uploading file:', err);
          setUploadingFiles(prev =>
            prev.map(uf => uf.file.name === file.name ? {
              ...uf,
              status: 'error',
              progress: 100,
              error: err instanceof Error ? err.message : 'Upload failed'
            } : uf)
          );
        }
      }

      setIsProcessing(false);
      setError(null);
    } catch (err) {
      console.error('Error processing files:', err);
      setError('Failed to process files. Please check N8N webhook URL and try again.');
      setIsProcessing(false);
    }
  };

  // Removed - using N8N webhook directly instead
  const startPollingBatchStatus_DEPRECATED = async (batchId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const batchFiles = await fileUploadService.getBatchFiles(batchId);

        batchFiles.forEach(file => {
          setUploadingFiles(prev =>
            prev.map(uf => {
              if (uf.fileUpload?.id === file.id) {
                let progress = 50;
                if (file.processing_status === 'processing') progress = 75;
                if (file.processing_status === 'completed') progress = 100;
                if (file.processing_status === 'failed') progress = 100;

                return {
                  ...uf,
                  progress,
                  status: file.processing_status === 'completed' ? 'completed' :
                          file.processing_status === 'failed' ? 'error' : 'processing',
                  error: file.error_message || undefined
                };
              }
              return uf;
            })
          );
        });

        const allProcessed = batchFiles.every(
          f => f.processing_status === 'completed' || f.processing_status === 'failed'
        );

        if (allProcessed) {
          clearInterval(pollInterval);

          const completedFiles = batchFiles.filter(f => f.processing_status === 'completed');
          await fileUploadService.updateBatchStatus(batchId, 'completed', completedFiles.length);

          if (completedFiles.length > 0) {
            const mergedData = fileUploadService.mergeTenderExtractions(batchFiles);
            if (mergedData) {
              setExtractedData(mergedData);
            }

            setIsAggregating(true);
            try {
              const aggregationResult = await fileUploadService.aggregateBatch(batchId);
              console.log('Aggregation result:', aggregationResult);

              const profile = await fileUploadService.getTenderProfile(batchId);
              if (profile) {
                setTenderProfile(profile);
              }

              setShowPreview(true);
            } catch (err) {
              console.error('Aggregation error:', err);
              setShowPreview(true);
            } finally {
              setIsAggregating(false);
            }
          }

          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(pollInterval);
      setIsProcessing(false);
      setError('Processing timeout. Please check results.');
    }, 120000);
  };

  useEffect(() => {
    return () => {
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (fileName: string) => {
    setUploadingFiles(prev => prev.filter(uf => uf.file.name !== fileName));
  };

  const clearAll = () => {
    setUploadingFiles([]);
    setExtractedData(null);
    setShowPreview(false);
    setError(null);
  };

  const handleAcceptAndContinue = async () => {
    // N8N webhook handles tender creation automatically
    // Just refresh the page to see new data
    window.location.reload();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-6">
      {error && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!showPreview && (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging ? 'border-gray-900 bg-gray-50 scale-[1.02]' : 'border-gray-300 bg-white'
            }`}
          >
            <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
            <p className="text-base text-gray-600 mb-3 font-medium">
              Drag files here or click to browse
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              type="button"
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-3">
              PDF, Word, Excel • Max 10MB per file • No file limit
            </p>
          </div>


          {uploadingFiles.length > 0 && (
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Files ({uploadingFiles.length})
                </h3>
                <button
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
              <div className="p-4">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {uploadingFiles.map((uf, index) => (
                    <div
                      key={`${uf.file.name}-${index}`}
                      className="rounded-lg border bg-gray-50 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{uf.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(uf.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {uf.status === 'completed' && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {uf.status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          {(uf.status === 'uploading' || uf.status === 'processing') && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                          )}
                          {!isProcessing && (
                            <button
                              onClick={() => removeFile(uf.file.name)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {uf.status !== 'completed' && uf.status !== 'error' && (
                        <div className="mt-2">
                          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-900 transition-all duration-300"
                              style={{ width: `${uf.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {uf.status === 'uploading' && 'Uploading to N8N...'}
                            {uf.status === 'processing' && 'N8N is processing...'}
                          </p>
                        </div>
                      )}

                      {uf.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{uf.error || 'Upload failed'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {uploadingFiles.some(uf => uf.status === 'completed') && !showPreview && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 shadow-sm p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-green-900 mb-2">Dateien erfolgreich hochgeladen!</h3>
          <p className="text-sm text-green-700 mb-4">
            N8N verarbeitet Ihre Dateien. Die Daten werden in Kürze in der Tender-Liste erscheinen.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
          >
            Seite aktualisieren
          </button>
        </div>
      )}

      {/* Preview removed - N8N handles processing automatically */}
      {false && extractedData && showPreview && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 shadow-sm">
          <div className="p-4 border-b border-green-200 flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Ausschreibung extrahiert
            </h3>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              {extractedData.fileCount} Dateien
            </span>
          </div>
          <div className="p-6 space-y-6">
            {uploadingFiles.some(uf => uf.error && uf.error.includes('⚠️')) && (
              <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-900 mb-2">KI-Extraktion fehlgeschlagen</h4>
                    <div className="space-y-2">
                      {uploadingFiles
                        .filter(uf => uf.error && uf.error.includes('⚠️'))
                        .map((uf, idx) => (
                          <div key={idx} className="text-sm text-yellow-800 bg-yellow-100 rounded p-2">
                            <p className="font-medium mb-1">{uf.file.name}:</p>
                            <p className="whitespace-pre-wrap">{uf.error}</p>
                          </div>
                        ))
                      }
                    </div>
                    <p className="text-sm text-yellow-800 mt-3">
                      Die Daten wurden mit einfacher Regex-Extraktion erfasst. Bitte überprüfen Sie alle Felder manuell auf Vollständigkeit und Korrektheit.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {extractedData.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Zusammenfassung
                </h4>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">{extractedData.summary}</p>
              </div>
            )}

            <div className="grid gap-4 text-sm">
              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Grundinformationen</h4>
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <span className="text-gray-600">Titel:</span>
                  <span className="text-gray-900 font-medium">{extractedData.title}</span>
                  <span className="text-gray-600">Auftraggeber:</span>
                  <span className="text-gray-900">{extractedData.buyer}</span>
                  <span className="text-gray-600">Region:</span>
                  <span className="text-gray-900">{extractedData.region}</span>
                  <span className="text-gray-600">Frist:</span>
                  <span className="text-gray-900 font-semibold text-red-600">{formatDate(extractedData.deadline)}</span>
                  {extractedData.budgetInfo?.estimated && (
                    <>
                      <span className="text-gray-600">Budget:</span>
                      <span className="text-gray-900">{extractedData.budgetInfo.estimated}</span>
                    </>
                  )}
                </div>
              </div>

              {extractedData.certificationsRequired && extractedData.certificationsRequired.length > 0 && (
                <DetailSection title="Zertifizierungen" icon="🏅" items={extractedData.certificationsRequired} alertType="error" />
              )}

              {extractedData.insuranceRequirements && extractedData.insuranceRequirements.length > 0 && (
                <DetailSection title="Versicherungen" icon="🛡️" items={extractedData.insuranceRequirements} alertType="error" />
              )}

              {extractedData.standards && extractedData.standards.length > 0 && (
                <DetailSection title="Standards" icon="📋" items={extractedData.standards} alertType="warning" />
              )}

              {extractedData.safetyRequirements && extractedData.safetyRequirements.length > 0 && (
                <DetailSection title="Sicherheitsanforderungen" icon="⚠️" items={extractedData.safetyRequirements} alertType="warning" />
              )}

              {extractedData.equipmentRequirements && extractedData.equipmentRequirements.length > 0 && (
                <DetailSection title="Geräte & Ausrüstung" icon="🔧" items={extractedData.equipmentRequirements} />
              )}

              {extractedData.personnelRequirements && extractedData.personnelRequirements.length > 0 && (
                <DetailSection title="Personalanforderungen" icon="👥" items={extractedData.personnelRequirements} />
              )}

              {extractedData.technicalSpecifications && extractedData.technicalSpecifications.length > 0 && (
                <DetailSection title="Technische Spezifikationen" icon="⚙️" items={extractedData.technicalSpecifications} />
              )}

              {extractedData.complianceRequirements && extractedData.complianceRequirements.length > 0 && (
                <DetailSection title="Compliance" icon="✓" items={extractedData.complianceRequirements} alertType="warning" />
              )}

              {extractedData.paymentTerms && extractedData.paymentTerms.length > 0 && (
                <DetailSection title="Zahlungsbedingungen" icon="💰" items={extractedData.paymentTerms} />
              )}

              {extractedData.contractPenalties && extractedData.contractPenalties.length > 0 && (
                <DetailSection title="Vertragsstrafen" icon="⚖️" items={extractedData.contractPenalties} alertType="error" />
              )}

              {extractedData.submissionRequirements && extractedData.submissionRequirements.length > 0 && (
                <DetailSection title="Einreichungsanforderungen" icon="📤" items={extractedData.submissionRequirements} />
              )}

              {extractedData.evaluationCriteria && extractedData.evaluationCriteria.length > 0 && (
                <DetailSection title="Bewertungskriterien" icon="📊" items={extractedData.evaluationCriteria} />
              )}

              {extractedData.keyDates && extractedData.keyDates.length > 0 && (
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📅 Wichtige Termine
                  </h4>
                  <div className="space-y-2">
                    {extractedData.keyDates.map((kd: any, idx: number) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <span className="text-gray-600 font-mono">{formatDate(kd.date)}</span>
                        <span className="text-gray-900">{kd.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {extractedData.scopeOfWork && (
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Leistungsumfang</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{extractedData.scopeOfWork}</p>
                </div>
              )}

              {tenderProfile?.pflichtnachweise?.liste && tenderProfile.pflichtnachweise.liste.length > 0 && (
                <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    📋 Checkliste: Einzureichende Nachweise ({tenderProfile.pflichtnachweise.anzahl})
                  </h4>
                  <div className="space-y-2">
                    {tenderProfile.pflichtnachweise.liste.map((nachweis: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 bg-white rounded p-3">
                        <input type="checkbox" className="mt-1" />
                        <div className="flex-1">
                          <p className="font-medium text-blue-900">{nachweis.bezeichnung}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {nachweis.kategorie}
                            </span>
                            {nachweis.pflicht && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                                Pflicht
                              </span>
                            )}
                          </div>
                          {nachweis.hinweise && (
                            <p className="text-xs text-gray-600 mt-1">{nachweis.hinweise}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {tenderProfile.pflichtnachweise.kategorien && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs text-blue-700">Kategorien:</span>
                      {tenderProfile.pflichtnachweise.kategorien.map((kat: string, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {kat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tenderProfile?.validation_status && (
                <div className={`rounded-lg border-2 p-4 ${
                  tenderProfile.validation_status === 'valid' ? 'bg-green-50 border-green-300' :
                  tenderProfile.validation_status === 'partial' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
                }`}>
                  <h4 className={`font-semibold mb-2 flex items-center gap-2 ${
                    tenderProfile.validation_status === 'valid' ? 'text-green-900' :
                    tenderProfile.validation_status === 'partial' ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    {tenderProfile.validation_status === 'valid' ? '✓ Validierung erfolgreich' :
                     tenderProfile.validation_status === 'partial' ? '⚠ Teilweise validiert' :
                     '✗ Validierung fehlgeschlagen'}
                  </h4>
                  <p className="text-sm text-gray-700">
                    Konfidenz: {Math.round((tenderProfile.confidence_avg || 0) * 100)}%
                    {tenderProfile.conflict_count > 0 && ` • ${tenderProfile.conflict_count} Konflikte gefunden`}
                  </p>
                  {tenderProfile.validation_errors && tenderProfile.validation_errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {tenderProfile.validation_errors.slice(0, 3).map((err: any, idx: number) => (
                        <p key={idx} className="text-xs text-gray-600">• {err.error_message}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {extractedData.filenames && extractedData.filenames.length > 0 && (
                <div className="pt-2">
                  <h4 className="font-semibold text-gray-700 mb-2 text-xs">Analysierte Dateien</h4>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.filenames.map((fn: string, idx: number) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {fn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                className="flex-1 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                onClick={handleAcceptAndContinue}
              >
                <CheckCircle2 className="h-4 w-4" />
                Ausschreibung übernehmen
              </button>
              <button
                className="px-4 py-3 border border-green-300 hover:bg-green-100 rounded-lg transition"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {extractedData.fileCount > 1
                ? `Alle ${extractedData.fileCount} Dateien wurden analysiert und zu EINER Ausschreibung zusammengeführt.`
                : 'Die Datei wurde analysiert und extrahiert.'
              } Klicken Sie auf "Übernehmen" um fortzufahren.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
