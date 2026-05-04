import { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileSpreadsheet, Loader2, X } from 'lucide-react';

function FileUploader({
  onAnalysisComplete,
  onError,
  onLoading,
  loading,
  compact = false,
  endpoint = '/api/upload'
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    // Validar tipo de archivo
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      onError('Por favor, selecciona un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    setSelectedFile(file);
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      onLoading(true);
      /* No fijar Content-Type: el navegador añade el boundary; sin él las subidas fallan en producción. */
      const response = await axios.post(endpoint, formData);

      if (response.data.success) {
        onAnalysisComplete(response.data);
      } else {
        onError(response.data.error || 'Error al procesar el archivo');
      }
    } catch (error) {
      onError(
        error.response?.data?.error || 
        error.message || 
        'Error al subir el archivo. Asegúrate de que el servidor esté ejecutándose.'
      );
    } finally {
      onLoading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const pickFile = () => {
    if (!loading) fileInputRef.current?.click();
  };

  if (compact) {
    return (
      <div className="inline-flex items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
          disabled={loading}
        />
        <button
          type="button"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            pickFile();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {loading ? 'Analizando…' : 'Cargar otro archivo'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zona de arrastre */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300
          ${isDragging 
            ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg' 
            : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/30'
          }
          ${loading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
            <p className="text-lg font-semibold text-gray-800">
              Analizando archivo...
            </p>
            <p className="text-sm text-gray-500">
              Por favor espera mientras procesamos tu archivo
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-primary-600 rounded-full shadow-lg">
              <Upload className="w-12 h-12 text-white" />
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-800 mb-2">
                Arrastra y suelta tu archivo Excel aquí
              </p>
              <p className="text-gray-600">
                o haz clic para seleccionar un archivo
              </p>
            </div>
            <div className="mt-2 px-4 py-2 bg-white rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">
                Formatos soportados: <span className="font-medium text-gray-700">.xlsx, .xls, .csv</span> (máx. 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Archivo seleccionado */}
      {selectedFile && !loading && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <button
            onClick={removeFile}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Remover archivo"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}

export default FileUploader;
