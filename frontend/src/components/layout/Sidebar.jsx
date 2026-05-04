import { Upload, Store, ChevronLeft, ChevronRight, Database } from 'lucide-react';

function Sidebar({ isOpen, activeView, onViewChange, onToggle }) {
  const menuItems = [
    {
      id: 'upload',
      label: 'Estado por pedido',
      icon: Upload,
      description: 'Analisis por estados'
    },
    {
      id: 'makro',
      label: 'Makro Tiendas',
      icon: Store,
      description: 'Carga exclusiva Makro'
    }
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isOpen ? 'w-64' : 'w-0 lg:w-20'}
        flex flex-col
        shadow-lg lg:shadow-none
      `}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {isOpen && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Logística ERP</h1>
                <p className="text-xs text-gray-500">Sistema Profesional</p>
              </div>
            </div>
          )}
          {!isOpen && (
            <div className="p-2 bg-primary-600 rounded-lg mx-auto">
              <Database className="w-6 h-6 text-white" />
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden lg:flex"
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-2 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-lg
                    transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }
                    ${!isOpen ? 'justify-center' : ''}
                  `}
                  title={!isOpen ? item.label : ''}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-500'}`}
                  />
                  {isOpen && (
                    <div className="flex-1 text-left">
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500">{item.description}</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {isOpen && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              <p className="font-medium text-gray-700">v1.0.0</p>
              <p className="mt-1">© 2026 Logística ERP</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
