import { 
  FileSpreadsheet, 
  Upload, 
  TrendingUp, 
  Database,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react';

function Dashboard({ onUploadClick, analysisData }) {
  const allData = [
    analysisData?.productos, 
    analysisData?.clientes, 
    analysisData?.vendedores,
    analysisData?.tiendas,
    analysisData?.comercial,
    analysisData?.internacional
  ];
  
  const totalFiles = allData.filter(Boolean).length;
  const totalRows = allData
    .filter(Boolean)
    .reduce((sum, data) => sum + (data.analysis?.summary?.totalRows || 0), 0);
  const totalSheets = allData
    .filter(Boolean)
    .reduce((sum, data) => sum + (data.analysis?.summary?.totalSheets || 0), 0);

  const stats = [
    {
      label: 'Archivos Procesados',
      value: totalFiles.toString(),
      icon: FileSpreadsheet,
      color: 'blue',
      change: '+12%'
    },
    {
      label: 'Total de Registros',
      value: totalRows.toLocaleString(),
      icon: Database,
      color: 'green',
      change: '+8%'
    },
    {
      label: 'Hojas Analizadas',
      value: totalSheets.toString(),
      icon: BarChart3,
      color: 'purple',
      change: '+5%'
    },
    {
      label: 'Tasa de Éxito',
      value: '100%',
      icon: TrendingUp,
      color: 'indigo',
      change: '+2%'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200',
      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200'
    };
    return colors[color] || colors.blue;
  };

  const getRecentActivity = () => {
    const activities = [];
    if (analysisData?.productos) {
      activities.push({
        type: 'productos',
        title: 'Productos cargados',
        description: analysisData.productos.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (analysisData?.clientes) {
      activities.push({
        type: 'clientes',
        title: 'Clientes cargados',
        description: analysisData.clientes.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (analysisData?.vendedores) {
      activities.push({
        type: 'vendedores',
        title: 'Vendedores cargados',
        description: analysisData.vendedores.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (analysisData?.tiendas) {
      activities.push({
        type: 'tiendas',
        title: 'Tiendas cargadas',
        description: analysisData.tiendas.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (analysisData?.comercial) {
      activities.push({
        type: 'comercial',
        title: 'Datos comerciales cargados',
        description: analysisData.comercial.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (analysisData?.internacional) {
      activities.push({
        type: 'internacional',
        title: 'Datos internacionales cargados',
        description: analysisData.internacional.filename,
        time: 'Reciente',
        icon: FileSpreadsheet,
        status: 'success'
      });
    }
    if (activities.length === 0) {
      activities.push({
        type: 'upload',
        title: 'Ningún archivo cargado',
        description: 'Comienza cargando un archivo Excel',
        time: '',
        icon: Upload,
        status: 'pending'
      });
    }
    return activities;
  };

  const recentActivities = getRecentActivity();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Bienvenido a Logística ERP
            </h1>
            <p className="text-primary-100 text-lg">
              Sistema profesional de análisis de datos Excel
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm">
              <FileSpreadsheet className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg border ${getColorClasses(stat.color)}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Acciones Rápidas
          </h3>
          <div className="space-y-3">
            <button
              onClick={onUploadClick}
              className="w-full flex items-center justify-between p-4 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-600 rounded-lg">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Cargar Archivo Excel</p>
                  <p className="text-sm text-gray-500">Analizar nuevo archivo</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-600 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Ver Reportes</p>
                  <p className="text-sm text-gray-500">Análisis históricos</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Actividad Reciente
          </h3>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div
                  key={index}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    activity.status === 'success' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {activity.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Getting Started */}
      {totalFiles === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Comenzar
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-gray-600 mb-2">
                Carga tu primer archivo Excel para comenzar a analizar datos
              </p>
              <button
                onClick={onUploadClick}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Cargar Archivo Ahora
              </button>
            </div>
            <div className="hidden md:block">
              <div className="p-6 bg-primary-50 rounded-lg">
                <FileSpreadsheet className="w-16 h-16 text-primary-600" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
