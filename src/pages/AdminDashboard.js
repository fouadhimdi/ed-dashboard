import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import { authService } from '../services/authService';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    password: '',
    role: 'user'
  });
  const [error, setError] = useState('');

  // عناصر القائمة الجانبية
  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  useEffect(() => {
    // التحقق من صلاحيات المستخدم
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    // تحميل المستخدمين
    loadUsers();
    setLoading(false);
  }, [navigate, isAdmin]);

  const loadUsers = () => {
    try {
      // استخدام الوظيفة المحسنة للحصول على المستخدمين بدون كلمات المرور
      const usersList = authService.getUsers();
      setUsers(usersList);
    } catch (err) {
      setError('حدث خطأ في تحميل قائمة المستخدمين');
    }
  };

  const handleAddUser = () => {
    // التحقق من صحة البيانات
    if (!newUser.employeeId || !newUser.name || !newUser.password) {
      setError('جميع الحقول مطلوبة');
      return;
    }

    try {
      // إضافة المستخدم الجديد باستخدام الوظيفة المحسنة
      authService.addUser(newUser);
      
      // إعادة تحميل المستخدمين
      loadUsers();
      
      // إغلاق النافذة وإعادة تعيين النموذج
      setShowAddUserModal(false);
      setNewUser({
        employeeId: '',
        name: '',
        password: '',
        role: 'user'
      });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        // حذف المستخدم باستخدام الوظيفة المحسنة
        authService.deleteUser(userId);
        
        // إعادة تحميل المستخدمين
        loadUsers();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'users':
        return (
          <div className="bg-white shadow rounded-lg p-3 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">إدارة المستخدمين</h2>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 rounded mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="mr-3">
                    <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <button 
                onClick={() => setShowAddUserModal(true)}
                className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600"
              >
                إضافة مستخدم جديد
              </button>
              
              {/* جدول المستخدمين - responsive */}
              <div className="overflow-x-auto">
                <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الرقم الوظيفي
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الاسم
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الدور
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                            {user.employeeId}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                            {user.name}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                            {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                              disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-white shadow rounded-lg p-3 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">لوحة التحكم</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4">مرحباً بك في لوحة تحكم المشرف</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
              <div className="bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-100">
                <h3 className="text-base sm:text-lg font-semibold text-blue-700 mb-2">إدارة المستخدمين</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">إضافة وإدارة حسابات المستخدمين في النظام</p>
                <button 
                  onClick={() => setCurrentPage('users')}
                  className="w-full sm:w-auto bg-blue-500 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm hover:bg-blue-600"
                >
                  الانتقال إلى إدارة المستخدمين
                </button>
              </div>
              
              <div className="bg-green-50 p-4 sm:p-6 rounded-lg border border-green-100">
                <h3 className="text-base sm:text-lg font-semibold text-green-700 mb-2">بيانات قسم الطوارئ</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">عرض وتحليل بيانات مؤشرات الأداء في قسم الطوارئ</p>
                <button 
                  onClick={() => navigate('/emergency')}
                  className="w-full sm:w-auto bg-green-500 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm hover:bg-green-600"
                >
                  الانتقال إلى قسم الطوارئ
                </button>
              </div>
              
              <div className="bg-purple-50 p-4 sm:p-6 rounded-lg border border-purple-100 md:col-span-2 lg:col-span-1">
                <h3 className="text-base sm:text-lg font-semibold text-purple-700 mb-2">إحصائيات النظام</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">عرض إحصائيات عامة حول استخدام النظام</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">عدد المستخدمين:</span>
                    <span className="text-sm font-semibold text-purple-600">{users.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">المدراء:</span>
                    <span className="text-sm font-semibold text-purple-600">{users.filter(u => u.role === 'admin').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600 mr-4">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* الشريط الجانبي */}
        <Sidebar menuItems={menuItems} />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto lg:mr-72">
          <div className="p-4 sm:p-8">
            <div className="max-w-full mx-auto">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة إضافة مستخدم جديد */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">إضافة مستخدم جديد</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 rounded mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="mr-3">
                    <p className="text-xs sm:text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  الرقم الوظيفي
                </label>
                <input
                  type="text"
                  value={newUser.employeeId}
                  onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل الرقم الوظيفي"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  الاسم
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل الاسم"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  الدور
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setError('');
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors order-2 sm:order-1"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddUser}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors order-1 sm:order-2"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;