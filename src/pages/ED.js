import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import config from '../config/api';

// Helper functions to replace excelAnalyticsService
const generatePlaceholderData = (count, min, max, customLabels = null) => {
  const data = Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1) + min));
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const labels = customLabels || months.slice(0, count);
  
  return {
    labels,
    data,
    metadata: {
      min: Math.min(...data),
      max: Math.max(...data),
      avg: data.reduce((a, b) => a + b, 0) / data.length,
      isPlaceholder: true
    }
  };
};

// وظيفة لاستخراج التاريخ من اسم الملف
const extractDateFromFileName = (fileName) => {
  const dateMatch = fileName.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
  if (!dateMatch) return null;
  
  const year = parseInt(dateMatch[1]);
  const monthStr = dateMatch[2];
  const day = parseInt(dateMatch[3]);
  
  const months = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
    'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
    'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };
  
  const month = months[monthStr];
  if (month === undefined) return null;
  
  return new Date(year, month, day);
};

// وظيفة لمقارنة التواريخ للترتيب
const compareDates = (fileA, fileB) => {
  const dateA = extractDateFromFileName(fileA);
  const dateB = extractDateFromFileName(fileB);
  
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  return dateA - dateB; // ترتيب تصاعدي (من الأقدم للأحدث)
};

const ED = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState([]);
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [currentPage, setCurrentPage] = useState('emergency');
  
  // البنش مارك لكل مؤشر
  const benchmarks = {
    // KPI 1: Door to Doctor (بالدقائق)
    "KPI 1: Door to Doctor": {
      worldClass: { max: 10, color: "#0072C6" }, // أقل من 10 دقائق
      acceptable: { min: 10, max: 20, color: "#00B050" }, // 10-20 دقيقة
      needsImprovement: { min: 20, max: 40, color: "#FFC000" }, // 20-40 دقيقة
      unacceptable: { min: 40, color: "#C00000" } // أكثر من 40 دقيقة
    },
    
    // KPI 2: Doc to Decision (بالدقائق)
    "KPI 2: Doc to Decision": {
      worldClass: { max: 30, color: "#0072C6" }, // أقل من 30 دقيقة
      acceptable: { min: 30, max: 60, color: "#00B050" }, // 30-60 دقيقة
      needsImprovement: { min: 60, max: 90, color: "#FFC000" }, // 60-90 دقيقة
      unacceptable: { min: 90, color: "#C00000" } // أكثر من 90 دقيقة
    },
    
    // KPI 3: Decision to Ward/ICU/Home/etc. (بالدقائق)
    "KPI 3: Decision to": {
      worldClass: { max: 30, color: "#0072C6" }, // أقل من 30 دقيقة
      acceptable: { min: 30, max: 90, color: "#00B050" }, // 30-90 دقيقة
      needsImprovement: { min: 90, max: 130, color: "#FFC000" }, // 90-130 دقيقة
      unacceptable: { min: 130, color: "#C00000" } // أكثر من 130 دقيقة
    },
    
    // KPI 4: Non Urgent (نسبة مئوية)
    "KPI 4: Non Urgent": {
      worldClass: { max: 33, color: "#0072C6" }, // أقل من 33%
      acceptable: { min: 33, max: 50, color: "#00B050" }, // 33-50%
      needsImprovement: { min: 50, max: 75, color: "#FFC000" }, // 50-75%
      unacceptable: { min: 75, color: "#C00000" } // أكثر من 75%
    },
    
    // KPI 5: % Door to Disposition (نسبة مئوية)
    "KPI 5: % Door to Disposition": {
      worldClass: { min: 95, color: "#0072C6" }, // أكثر من 95%
      acceptable: { min: 75, max: 95, color: "#00B050" }, // 75-95%
      needsImprovement: { min: 60, max: 75, color: "#FFC000" }, // 60-75%
      unacceptable: { max: 60, color: "#C00000" } // أقل من 60%
    },
    
    // KPI 6: % LAMA & DAMA (نسبة مئوية)
    "KPI6: % LAMA & DAMA": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من 1%
      acceptable: { min: 1, max: 3, color: "#00B050" }, // 1-3%
      needsImprovement: { min: 3, max: 5, color: "#FFC000" }, // 3-5%
      unacceptable: { min: 5, color: "#C00000" } // أكثر من 5%
    },
    
    // KPI 7: Mortality Rate (نسبة مئوية)
    "KPI 7: Mortality Rate": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من 1%
      acceptable: { min: 1, max: 2, color: "#00B050" }, // 1-2%
      needsImprovement: { min: 2, max: 3, color: "#FFC000" }, // 2-3%
      unacceptable: { min: 3, color: "#C00000" } // أكثر من 3%
    },
    
    // KPI 8: Door to Pain Killer Time (بالساعات)
    "KPI 8: Door to Pain Killer Time": {
      worldClass: { max: 60, color: "#0072C6" }, // أقل من ساعة واحدة
      acceptable: { min: 60, max: 180, color: "#00B050" }, // 1-3 ساعات
      needsImprovement: { min: 180, max: 300, color: "#FFC000" }, // 3-5 ساعات
      unacceptable: { min: 300, color: "#C00000" } // أكثر من 5 ساعات
    }
  };

  // وظيفة لتحديد اللون المناسب لقيمة معينة بناءً على البنش مارك
  const getColorForValue = (kpiName, value) => {
    // التعامل مع القيم النصية أو الفارغة
    if (value === '' || value === 'NA' || value === null || value === undefined) {
      return ''; // لا لون
    }
    
    // البحث عن البنش مارك المناسب
    let benchmark;
    
    // للمؤشرات التي تبدأ بـ KPI 3
    if (kpiName.startsWith("KPI 3: Decision to")) {
      benchmark = benchmarks["KPI 3: Decision to"];
    } else {
      // للمؤشرات الأخرى
      benchmark = benchmarks[kpiName];
    }
    
    // إذا لم يتم العثور على بنش مارك لهذا المؤشر
    if (!benchmark) {
      return '';
    }
    
    // استخراج القيمة الرقمية
    let numericValue;
    
    // إذا كانت القيمة تحتوي على ساعات:دقائق
    if (typeof value === 'string' && value.includes(':')) {
      const [hours, minutes] = value.split(':').map(Number);
      numericValue = hours * 60 + minutes; // تحويل إلى دقائق
    } 
    // إذا كانت القيمة تحتوي على % (نسبة مئوية)
    else if (typeof value === 'string' && value.includes('%')) {
      numericValue = parseFloat(value);
    } 
    // القيم الرقمية
    else {
      numericValue = parseFloat(value);
    }
    
    // إذا لم يتم استخراج قيمة رقمية صالحة
    if (isNaN(numericValue)) {
      return '';
    }
    
    // تحديد اللون بناءً على النطاقات
    if (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max) {
      return benchmark.worldClass.color;
    } else if (benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) {
      return benchmark.worldClass.color;
    } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max !== undefined && 
               numericValue >= benchmark.acceptable.min && numericValue <= benchmark.acceptable.max) {
      return benchmark.acceptable.color;
    } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max !== undefined && 
               numericValue >= benchmark.needsImprovement.min && numericValue <= benchmark.needsImprovement.max) {
      return benchmark.needsImprovement.color;
    } else if (benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) {
      return benchmark.unacceptable.color;
    } else if (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max) {
      return benchmark.unacceptable.color;
    }
    
    return ''; // لون افتراضي إذا لم تتطابق أي حالة
  };

  // وظائف إضافية للمساعدة في الجمال
  const getBenchmarkLabel = (kpiName, value) => {
    if (value === '' || value === 'NA' || value === null || value === undefined) {
      return ''; 
    }
    
    let benchmark;
    if (kpiName.startsWith("KPI 3: Decision to")) {
      benchmark = benchmarks["KPI 3: Decision to"];
    } else {
      benchmark = benchmarks[kpiName];
    }
    
    if (!benchmark) return '';
    
    let numericValue;
    
    if (typeof value === 'string' && value.includes(':')) {
      const [hours, minutes] = value.split(':').map(Number);
      numericValue = hours * 60 + minutes;
    } else if (typeof value === 'string' && value.includes('%')) {
      numericValue = parseFloat(value);
    } else {
      numericValue = parseFloat(value);
    }
    
    if (isNaN(numericValue)) return '';
    
    if ((benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max) || 
        (benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min)) {
      return 'ممتاز';
    } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max !== undefined && 
               numericValue >= benchmark.acceptable.min && numericValue <= benchmark.acceptable.max) {
      return 'جيد';
    } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max !== undefined && 
               numericValue >= benchmark.needsImprovement.min && numericValue <= benchmark.needsImprovement.max) {
      return 'يحتاج تحسين';
    } else if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) ||
               (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
      return 'غير مقبول';
    }
    
    return '';
  };
  
  // وظيفة لقراءة قائمة الملفات من المجلد
  useEffect(() => {
    const fetchExcelFiles = async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}${config.endpoints.ED}`);
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx')).sort(compareDates);
        setExcelFiles(excelFiles);
        if (excelFiles.length > 0) {
          setSelectedFile(excelFiles[0]);
        }
      } catch (err) {
        setError('حدث خطأ في قراءة قائمة الملفات');
      }
    };

    fetchExcelFiles();
  }, []);

  // وظيفة لقراءة بيانات الملف المحدد
  useEffect(() => {
    const loadExcelData = async () => {
      if (!selectedFile) {
        setTableData({ headers: [], rows: [] });
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`${config.API_BASE_URL}${config.endpoints.ED}/${selectedFile}`);
        const fileContent = await response.arrayBuffer();
        const workbook = XLSX.read(fileContent, { type: 'array' });
        
        // الحصول على قائمة أوراق العمل
        const sheetNames = workbook.SheetNames;
        
        // البحث عن الورقة المطلوبة
        const sheetName = sheetNames.find(name => 
          name.toLowerCase().includes('ed kpis') || 
          name.toLowerCase().includes('kpis')
        );
        
        if (!sheetName) {
          throw new Error('لم يتم العثور على ورقة العمل المطلوبة في الملف');
        }
        
        const sheet = workbook.Sheets[sheetName];
        
        // تحديد الأعمدة التي سنعرضها
        const columnIds = [
          { id: 'AB', label: 'CTAS' },
          { id: 'AC', label: 'KPI 1: Door to Doctor' },
          { id: 'AD', label: 'KPI 2: Doc to Decision' },
          { id: 'AE', label: 'KPI 3: Decision to Ward' },
          { id: 'AF', label: 'KPI 3: Decision to ICU' },
          { id: 'AG', label: 'KPI 3: Decision to Home' },
          { id: 'AH', label: 'KPI 3: Decision to PICU' },
          { id: 'AI', label: 'KPI 3: Decision to NICU' },
          { id: 'AJ', label: 'KPI 3: Decision to another Health Facility' },
          { id: 'AK', label: 'KPI 4: Non Urgent' },
          { id: 'AL', label: 'Patients by urgency %' },
          { id: 'AM', label: 'Total patients within 4 hours' },
          { id: 'AN', label: 'Total patients' },
          { id: 'AO', label: 'KPI 5: % Door to Disposition' },
          { id: 'AP', label: 'KPI6: % LAMA & DAMA' },
          { id: 'AQ', label: 'KPI 6: % LAMA' },
          { id: 'AR', label: 'KPI6: % DAMA' },
          { id: 'AS', label: 'KPI 7: Mortality Rate' },
          { id: 'AT', label: 'KPI 8: Door to Pain Killer Time' },
          { id: 'AU', label: 'Volume of Patients discharged Ward' },
          { id: 'AV', label: 'Volume of Patients discharged ICU' },
          { id: 'AW', label: 'Volume of Patients discharged Home' },
          { id: 'AX', label: 'Volume of Patients discharged Another Facility' }
        ];
        
        // استخراج العناوين
        const headers = [];
        for (const column of columnIds) {
          const cellAddress = `${column.id}1`;
          const cell = sheet[cellAddress];
          
          if (cell && cell.v) {
            headers.push(cell.v);
          } else {
            headers.push(column.label);
          }
        }
        
        // استخراج البيانات
        const rows = [];
        for (let rowIndex = 2; rowIndex <= 7; rowIndex++) {
          const rowData = [];
          
          for (const column of columnIds) {
            const cellAddress = `${column.id}${rowIndex}`;
            const cell = sheet[cellAddress];
            
            let formattedValue = '';
            
            if (cell) {
              const columnLabel = column.label.toLowerCase();
              
              if (columnLabel.includes('non urgent') || columnLabel.includes('patients by urgency')) {
                formattedValue = cell.t === 'n' ? `${Math.round(cell.v * 100)}%` : cell.v === 0 ? '0%' : `${cell.v}`;
              } else if (columnLabel.includes('%') || columnLabel.includes('rate')) {
                if (cell.t === 'n') {
                  formattedValue = cell.v < 1 ? `${Math.round(cell.v * 100)}%` : `${Math.round(cell.v)}%`;
                } else {
                  formattedValue = cell.v === 0 ? '0%' : `${cell.v}`;
                }
              } else if (columnLabel.includes('time') || columnLabel.includes('door to') || 
                         columnLabel.includes('decision to') || columnLabel.includes('doc to')) {
                if (cell.t === 'n') {
                  const totalMinutes = Math.round(cell.v * 24 * 60);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  formattedValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else if (cell.v) {
                  formattedValue = cell.v;
                }
              } else if (columnLabel.includes('total') || columnLabel.includes('volume') || 
                         columnLabel.includes('patients') || columnLabel === 'ctas') {
                formattedValue = cell.t === 'n' ? Math.round(cell.v).toString() : cell.v ? cell.v.toString() : '';
              } else if (cell.v !== undefined && cell.v !== null) {
                formattedValue = cell.v.toString();
              }
            }
            
            rowData.push(formattedValue);
          }
          
          rows.push(rowData);
        }
        
        setTableData({ headers, rows });
      } catch (err) {
        setError("حدث خطأ أثناء قراءة البيانات: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadExcelData();
  }, [selectedFile]);
  
  // تعريف عناصر القائمة الجانبية
  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  // استخراج تاريخ الملف المحدد
  const getSelectedFileDate = () => {
    if (!selectedFile) return '';
    
    const dateMatch = selectedFile.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
    if (dateMatch) {
      const months = {
        'JAN': 'يناير', 'FEB': 'فبراير', 'MAR': 'مارس', 'APR': 'أبريل',
        'MAY': 'مايو', 'JUN': 'يونيو', 'JUL': 'يوليو', 'AUG': 'أغسطس',
        'SEP': 'سبتمبر', 'OCT': 'أكتوبر', 'NOV': 'نوفمبر', 'DEC': 'ديسمبر'
      };
      return `${dateMatch[3]} ${months[dateMatch[2]]} ${dateMatch[1]}`;
    }
    return '';
  };

  // دالة لتنسيق عناوين الأعمدة
  const formatColumnHeader = (header) => {
    if (!header) return '';
    
    // تنسيق عناوين الأعمدة للعرض الأفضل
    if (header.includes(':')) {
      const [kpiNum, kpiName] = header.split(':');
      return (
        <div className="flex flex-col items-center">
          <span className="font-bold text-indigo-600 text-xs">{kpiNum}:</span>
          <span className="text-[10px] mt-0.5">{kpiName.trim()}</span>
        </div>
      );
    }
    
    return <span className="text-xs">{header}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* استخدام مكون الشريط الجانبي الموحد */}
        <Sidebar menuItems={menuItems} />

        {/* المحتوى الرئيسي - تعديل الهوامش لتجنب التداخل مع الشريط الجانبي */}
        <div className="flex-1 overflow-auto bg-gray-50 lg:mr-72">
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-2 sm:px-4 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div className="text-center sm:text-right">
                <h1 className="text-base sm:text-xl font-bold text-gray-800">لوحة تحكم بيانات أقسام الطوارئ</h1>
                {selectedFile && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {getSelectedFileDate() ? `بيانات ${getSelectedFileDate()}` : selectedFile}
                  </div>
                )}
              </div>
              
              <div className="flex justify-center sm:justify-end">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="block w-full sm:w-56 bg-white border border-gray-300 rounded-lg py-1.5 pr-10 pl-3 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  >
                    <option value="">اختر ملف Excel</option>
                    {excelFiles.map((file, index) => (
                      <option key={index} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-2 sm:p-4">
            <div className="w-full mx-auto">
              {/* القسم الرئيسي - ملخص المؤشرات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
                <div className="bg-white rounded-lg shadow-sm p-2 sm:p-3 border-r-4 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">إجمالي المرضى</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">
                        {tableData.rows && tableData.rows[5] && tableData.rows[5][12] ? tableData.rows[5][12] : '-'}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg">
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500">
                    مقارنة بالشهر السابق
                    <span className="text-green-500 font-medium mr-1">↑ 12%</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-2 sm:p-3 border-r-4 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">وقت الانتظار للطبيب</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">
                        {tableData.rows && tableData.rows[0] && tableData.rows[0][1] ? tableData.rows[0][1] : '-'}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500">
                    الهدف الأمثل
                    <span className="text-indigo-600 font-medium mr-1">أقل من 10 دقائق</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-2 sm:p-3 border-r-4 border-green-500 transform transition-transform hover:scale-105 hover:shadow-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">نسبة الإستجابة خلال 4 ساعات</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">
                        {tableData.rows && tableData.rows[5] && tableData.rows[5][13] ? tableData.rows[5][13] : '-'}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500">
                    الهدف الأمثل
                    <span className="text-green-600 font-medium mr-1">أكثر من 95%</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-2 sm:p-3 border-r-4 border-red-500 transform transition-transform hover:scale-105 hover:shadow-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">معدل الوفيات</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">
                        {tableData.rows && tableData.rows[5] && tableData.rows[5][17] ? tableData.rows[5][17] : '-'}
                      </p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500">
                    الهدف الأمثل
                    <span className="text-indigo-600 font-medium mr-1">أقل من 1%</span>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="flex flex-col justify-center items-center h-40 bg-white rounded-lg shadow-sm">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2">جاري تحميل البيانات...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0 mr-3">
                      <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md mb-4">
                    <div className="px-2 sm:px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
                      <h2 className="text-sm sm:text-base font-bold text-white text-center">مؤشرات الأداء الرئيسية (KPIs)</h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                            {tableData.headers && tableData.headers.map((header, index) => (
                              <th 
                                key={index} 
                                className="sticky top-0 px-1 sm:px-2 py-1 sm:py-2 text-center text-[8px] sm:text-[10px] font-medium text-gray-600 uppercase tracking-wider border-b border-gray-200"
                                style={{
                                  minWidth: index === 0 ? '40px' : '65px',
                                  maxWidth: index === 0 ? '50px' : '90px',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  lineHeight: '1.1'
                                }}
                              >
                                {formatColumnHeader(header)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {tableData.rows && tableData.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {row.map((cell, cellIndex) => {
                                const columnHeader = tableData.headers[cellIndex];
                                const backgroundColor = getColorForValue(columnHeader, cell);
                                const benchmarkLabel = getBenchmarkLabel(columnHeader, cell);
                                
                                return (
                                  <td 
                                    key={cellIndex} 
                                    className="relative px-1 sm:px-2 py-1 sm:py-1.5 text-center text-[9px] sm:text-xs font-medium"
                                  >
                                    <div 
                                      className={`relative p-0.5 sm:p-1 rounded-md shadow-sm transition-all duration-200 ${backgroundColor ? 'transform hover:scale-105' : ''}`}
                                      style={{ 
                                        backgroundColor: backgroundColor || 'transparent',
                                        color: backgroundColor ? 'white' : 'rgb(17 24 39)',
                                        maxWidth: cellIndex === 0 ? '40px' : '80px',
                                        margin: '0 auto'
                                      }}
                                    >
                                      <div className="font-semibold text-[9px] sm:text-xs">{cell}</div>
                                      {benchmarkLabel && (
                                        <div className="text-[7px] sm:text-[9px] opacity-80 font-normal">{benchmarkLabel}</div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="px-2 sm:px-4 py-1 sm:py-1.5 bg-gray-50 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <div className="text-[8px] sm:text-[9px] text-gray-500">
                          تم التحديث: {new Date().toLocaleDateString('ar-SA')}
                        </div>
                        <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
                          <div className="flex items-center">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#0072C6] mr-1"></div>
                            <span className="text-[8px] sm:text-[9px] text-gray-600">ممتاز</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#00B050] mr-1"></div>
                            <span className="text-[8px] sm:text-[9px] text-gray-600">جيد</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFC000] mr-1"></div>
                            <span className="text-[8px] sm:text-[9px] text-gray-600">يحتاج تحسين</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#C00000] mr-1"></div>
                            <span className="text-[8px] sm:text-[9px] text-gray-600">غير مقبول</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* حقوق الملكية */}
              <div className="mt-2 text-center text-[10px] sm:text-xs text-gray-500">
                <p>© {String(new Date().getFullYear())} قسم الطوارئ - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ED;