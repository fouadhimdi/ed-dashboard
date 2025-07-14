import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ menuItems }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // إذا لم يتم تمرير عناصر القائمة، استخدم القائمة الافتراضية
  const defaultMenuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  const items = menuItems || defaultMenuItems;
  
  // تصفية العناصر بناءً على صلاحيات المستخدم
  const filteredItems = isAdmin 
    ? items 
    : items.filter(item => item.showForRegularUser);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* زر القائمة للشاشات الصغيرة */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={toggleMobileMenu}
          className="bg-indigo-900 text-white p-2 rounded-lg shadow-lg hover:bg-indigo-800 transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* خلفية مظلمة للشاشات الصغيرة */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileMenu}
        />
      )}

      {/* الشريط الجانبي */}
      <div className={`
        fixed top-0 right-0 bottom-0 bg-indigo-900 text-white shadow-lg overflow-y-auto z-50 transition-transform duration-300 ease-in-out
        lg:w-72 lg:translate-x-0
        ${isMobileMenuOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full lg:translate-x-0'}
      `} dir="rtl">
        <div className="px-4 lg:px-6 py-4 lg:py-6 mb-4 lg:mb-8">
          <h1 className="text-lg lg:text-2xl font-bold text-center">لوحة التحكم</h1>
          <div className="text-xs text-blue-300 text-center mt-2">مرحباً بك، 123</div>
          <div className="mt-2 bg-blue-600 text-center py-1 px-3 text-xs rounded-full">
            مشرف
          </div>
        </div>
        
        <div className="space-y-1">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center px-4 lg:px-6 py-3 lg:py-4 text-base lg:text-lg transition-colors duration-200 ${
                location.pathname === item.path
                  ? 'bg-blue-800 text-white'
                  : 'text-blue-100 hover:bg-blue-800/50'
              }`}
            >
              <span className="mr-3 lg:mr-4 text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
        
        <div className="absolute bottom-0 right-0 left-0 px-4 lg:px-6 py-4 bg-indigo-950">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              window.location.href = '/';
            }}
            className="flex items-center text-blue-300 hover:text-white transition-colors duration-200 w-full"
          >
            <svg className="w-5 h-5 lg:w-6 lg:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل خروج
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;