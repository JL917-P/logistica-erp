import { useState } from 'react';
import FileUploader from './FileUploader';
import AnalysisResults from './AnalysisResults';
import { Briefcase } from 'lucide-react';

function Comercial({ onAnalysisComplete, onError, onLoading, loading, analysisData }) {
  const [localAnalysisData, setLocalAnalysisData] = useState(analysisData);

  const handleAnalysisComplete = (data) => {
    setLocalAnalysisData(data);
    if (onAnalysisComplete) onAnalysisComplete(data);
  };

  const handleReset = () => {
    setLocalAnalysisData(null);
  };

  return (
    <div className="space-y-6">
      {!localAnalysisData ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Gestión Comercial
              </h2>
              <p className="text-sm text-gray-500">
                Carga y analiza archivos Excel comerciales
              </p>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-800">
              <strong>Instrucciones:</strong> Arrastra un archivo Excel con información comercial. 
              El sistema analizará automáticamente la estructura y contenido del archivo.
            </p>
          </div>

          <FileUploader
            onAnalysisComplete={handleAnalysisComplete}
            onError={onError}
            onLoading={onLoading}
            loading={loading}
          />
        </div>
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Briefcase className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">
                  Análisis Comercial
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Resultados del archivo comercial procesado
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm"
            >
              Cargar Nuevo Archivo
            </button>
          </div>
          <AnalysisResults data={localAnalysisData} />
        </div>
      )}
    </div>
  );
}

export default Comercial;
