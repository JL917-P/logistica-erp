import { useState } from 'react';
import FileUploader from './FileUploader';
import AnalysisResults from './AnalysisResults';
import { Package, Upload, BarChart3 } from 'lucide-react';

function Productos({ onAnalysisComplete, onError, onLoading, loading, analysisData }) {
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
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Gestión de Productos
              </h2>
              <p className="text-sm text-gray-500">
                Carga y analiza archivos Excel de productos
              </p>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Instrucciones:</strong> Arrastra un archivo Excel con información de productos. 
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">
                  Análisis de Productos
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Resultados del archivo de productos procesado
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

export default Productos;
