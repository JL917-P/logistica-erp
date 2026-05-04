import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import FileUploader from './components/FileUploader';
import AnalysisResults from './components/AnalysisResults';
import MakroAnalysisResults from './components/MakroAnalysisResults';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('upload');
  const [analysisData, setAnalysisData] = useState({
    upload: null,
    makro: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const currentData = analysisData[activeView];
    if (currentData) {
      setSidebarOpen(false);
    }
  }, [analysisData, activeView]);

  const handleAnalysisComplete = (data, section) => {
    setAnalysisData((prev) => ({
      ...prev,
      [section]: data
    }));
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
  };

  const handleLoading = (isLoading) => {
    setLoading(isLoading);
  };

  const renderUploadForm = (section) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {section === 'upload' ? 'Estado por pedido' : 'Makro Tiendas'}
        </h2>
        <p className="text-gray-600">
          {section === 'upload'
            ? 'Analiza estados por pedido. Se extraen centro, fecha, vendedor, cliente, producto, cantidad, destino y estado. Solo muestra Autorizado y Atendido parcialmente.'
            : 'Exclusivo Makro: agrupa datos por tienda, NRO_OC y producto, sumando UNDS, PESO, SC50 y PH.'}
        </p>
      </div>
      <FileUploader
        onAnalysisComplete={(data) => handleAnalysisComplete(data, section)}
        onError={handleError}
        onLoading={handleLoading}
        loading={loading}
        endpoint={section === 'upload' ? '/api/upload' : '/api/upload-makro'}
      />
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        activeView={activeView}
        onViewChange={setActiveView}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex flex-col transition-all duration-300">
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {(activeView === 'upload' || activeView === 'makro') && (
              <div className="w-full max-w-full flex flex-col gap-4">
                {!analysisData[activeView] && renderUploadForm(activeView)}

                {analysisData[activeView] && activeView === 'upload' && (
                  <div className="sticky top-0 z-30 -mx-6 px-6 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
                    <div className="w-full flex items-center justify-end py-2">
                      <FileUploader
                        compact
                        onAnalysisComplete={(data) => handleAnalysisComplete(data, activeView)}
                        onError={handleError}
                        onLoading={handleLoading}
                        loading={loading}
                        endpoint="/api/upload"
                      />
                    </div>
                  </div>
                )}

                {analysisData[activeView] && (
                  <div className="w-full max-w-full">
                    {activeView === 'upload' ? (
                      <AnalysisResults data={analysisData.upload} />
                    ) : (
                      <MakroAnalysisResults
                        data={analysisData.makro}
                        uploadProps={{
                          onAnalysisComplete: (data) => handleAnalysisComplete(data, 'makro'),
                          onError: handleError,
                          onLoading: handleLoading,
                          loading,
                          endpoint: '/api/upload-makro'
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
