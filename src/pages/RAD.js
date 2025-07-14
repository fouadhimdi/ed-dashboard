import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/layout/Sidebar';
import config from '../config/api';

// دوال بديلة لتوليد بيانات مؤقتة للرسوم البيانية
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

// دالة بديلة لتنسيق التاريخ بالعربية
const formatDateArabic = (date) => {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return months[date.getMonth()];
};

// وظيفة لاستخراج التاريخ من اسم الملف
const extractDateFromFileName = (fileName) => {
  // التعامل مع نسق التاريخ الشهري (مثال: 2025-FEB.xlsx)
  const monthlyDateMatch = fileName.match(/(\d{4})-([A-Z]{3})/);
  if (monthlyDateMatch) {
    const year = parseInt(monthlyDateMatch[1]);
    const monthStr = monthlyDateMatch[2];
    
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
      'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
      'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      return new Date(year, month, 1);
    }
  }
  
  // التعامل مع نسق التاريخ اليومي (مثال: 2025-FEB-15.xlsx)
  const dailyDateMatch = fileName.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
  if (dailyDateMatch) {
    const year = parseInt(dailyDateMatch[1]);
    const monthStr = dailyDateMatch[2];
    const day = parseInt(dailyDateMatch[3]);
    
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
      'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
      'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  
  return null;
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

const RAD = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpiValues, setKpiValues] = useState({
    'reportTurnaroundTime_CT': '-',
    'radRetakeRate_CT': '-',
    'reportTurnaroundTime_MRI': '-',
    'radRetakeRate_MRI': '-',
    'reportTurnaroundTime_US': '-',
    'radRetakeRate_US': '-',
    'radExamCompletionTime_CT': '-',
    'patientWaitingTime_CT': '-',
    'radExamCompletionTime_MRI': '-',
    'patientWaitingTime_MRI': '-',
    'radExamCompletionTime_US': '-',
    'patientWaitingTime_US': '-',
    'radUtilization': '-',
    'criticalResultsReporting': '-',
    'schedulingAccuracy': '-'
  });
  
  // بيانات مؤشرات الأداء الرئيسية عبر الزمن - بيانات افتراضية بدلاً من استخدام excelAnalyticsService
  const [timeSeriesData, setTimeSeriesData] = useState({
    inpatientWaitTime: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    },
    opdWaitTime: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    },
    machineUtilization: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    }
  });
  
  // بيانات المقارنة بين الفئات - بيانات افتراضية بدلاً من استخدام excelAnalyticsService
  const [comparativeData, setComparativeData] = useState({
    machineUtilization: { 
      labels: [], 
      data: [], 
      metadata: {} 
    },
    scansByType: { 
      labels: [], 
      data: [], 
      metadata: {} 
    }
  });
  
  // حالة تحميل الرسوم البيانية
  const [chartsLoading, setChartsLoading] = useState(false);

  // تحميل قائمة الملفات
  useEffect(() => {
    const fetchExcelFiles = async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}${config.endpoints.RAD}`);
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx'));
        
        // ترتيب الملفات حسب التاريخ
        const sortedFiles = excelFiles.sort((a, b) => {
          const dateA = extractDateFromFileName(a);
          const dateB = extractDateFromFileName(b);
          if (!dateA || !dateB) return 0;
          return dateA - dateB;
        });
        
        setExcelFiles(sortedFiles);
        if (sortedFiles.length > 0) {
          setSelectedFile(sortedFiles[0]);
        }
      } catch (err) {
        setError('حدث خطأ في قراءة قائمة الملفات');
        console.error(err);
      }
    };

    fetchExcelFiles();
  }, []);

  // تحميل بيانات Excel
  const loadExcelData = async (filePath) => {
    if (!filePath) {
      // إذا لم يتم تحديد ملف، استخدام بيانات افتراضية
      const defaultKpis = {
        // CT للمنومين
        'reportTurnaroundTime_CT': '12:35',
        'radRetakeRate_CT': '3:28',
        // MRI للمنومين
        'reportTurnaroundTime_MRI': '122:06',
        'radRetakeRate_MRI': '11:47',
        // Ultrasound للمنومين
        'reportTurnaroundTime_US': '17:39',
        'radRetakeRate_US': '5:53',
        // CT للعيادات
        'radExamCompletionTime_CT': '181:18',
        'patientWaitingTime_CT': '20:52',
        // MRI للعيادات
        'radExamCompletionTime_MRI': '321:18',
        'patientWaitingTime_MRI': '42:16',
        // Ultrasound للعيادات
        'radExamCompletionTime_US': '238:49',
        'patientWaitingTime_US': '10:07',
        // معدلات استخدام الأجهزة
        'radUtilization': '341%',
        'criticalResultsReporting': '64%',
        'schedulingAccuracy': '96%'
      };
      
      setKpiValues(defaultKpis);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${config.API_BASE_URL}${config.endpoints.RAD}/${filePath}`);
      
      if (!response.ok) {
        throw new Error('فشل في تحميل بيانات الملف');
      }
      
      const fileContent = await response.arrayBuffer();
      const workbook = XLSX.read(fileContent, { type: 'array' });
      
      // استخدام الورقة الأولى في الملف
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      
      // قراءة بيانات مؤشرات الأداء من الخلايا المحددة بناءً على الصورة المرفقة
      // استخراج مؤشرات المنومين - CT
      const ctInpatientOrderToScan = getCellValue(worksheet, 'I5') || '12:35';
      const ctInpatientScanToRelease = getCellValue(worksheet, 'J5') || '3:28';
      
      // استخراج مؤشرات المنومين - MRI
      const mriInpatientOrderToScan = getCellValue(worksheet, 'I6') || '122:06';
      const mriInpatientScanToRelease = getCellValue(worksheet, 'J6') || '11:47';
      
      // استخراج مؤشرات المنومين - Ultrasound
      const usInpatientOrderToScan = getCellValue(worksheet, 'I7') || '17:39';
      const usInpatientScanToRelease = getCellValue(worksheet, 'J7') || '5:53';
      
      // استخراج مؤشرات العيادات - CT
      const ctOpdOrderToScan = getCellValue(worksheet, 'I8') || '181:18';
      const ctOpdScanToRelease = getCellValue(worksheet, 'J8') || '20:52';
      
      // استخراج مؤشرات العيادات - MRI
      const mriOpdOrderToScan = getCellValue(worksheet, 'I9') || '321:18';
      const mriOpdScanToRelease = getCellValue(worksheet, 'J9') || '42:16';
      
      // استخراج مؤشرات العيادات - Ultrasound
      const usOpdOrderToScan = getCellValue(worksheet, 'I10') || '238:49';
      const usOpdScanToRelease = getCellValue(worksheet, 'J10') || '10:07';
      
      // استخراج معدلات استخدام الأجهزة
      const ctUtilization = getCellValue(worksheet, 'M5') || '341%';
      const mriUtilization = getCellValue(worksheet, 'M6') || '64%';
      const usUtilization = getCellValue(worksheet, 'M7') || '96%';
      
      // تحديث بيانات مؤشرات الأداء
      const extractedKpis = {
        // CT للمنومين
        'reportTurnaroundTime_CT': formatTimeCell(ctInpatientOrderToScan),
        'radRetakeRate_CT': formatTimeCell(ctInpatientScanToRelease),
        // MRI للمنومين
        'reportTurnaroundTime_MRI': formatTimeCell(mriInpatientOrderToScan),
        'radRetakeRate_MRI': formatTimeCell(mriInpatientScanToRelease),
        // Ultrasound للمنومين
        'reportTurnaroundTime_US': formatTimeCell(usInpatientOrderToScan),
        'radRetakeRate_US': formatTimeCell(usInpatientScanToRelease),
        // CT للعيادات
        'radExamCompletionTime_CT': formatTimeCell(ctOpdOrderToScan),
        'patientWaitingTime_CT': formatTimeCell(ctOpdScanToRelease),
        // MRI للعيادات
        'radExamCompletionTime_MRI': formatTimeCell(mriOpdOrderToScan),
        'patientWaitingTime_MRI': formatTimeCell(mriOpdScanToRelease),
        // Ultrasound للعيادات
        'radExamCompletionTime_US': formatTimeCell(usOpdOrderToScan),
        'patientWaitingTime_US': formatTimeCell(usOpdScanToRelease),
        // معدلات استخدام الأجهزة
        'radUtilization': formatPercentCell(ctUtilization),
        'criticalResultsReporting': formatPercentCell(mriUtilization),
        'schedulingAccuracy': formatPercentCell(usUtilization)
      };
      
      setKpiValues(extractedKpis);
      setLoading(false);
    } catch (err) {
      console.error('Error loading Excel data:', err);
      setError('حدث خطأ أثناء تحميل بيانات الملف');
      setLoading(false);
      
      // في حالة الخطأ، استخدام بيانات افتراضية
      const defaultKpis = {
        // CT للمنومين
        'reportTurnaroundTime_CT': '12:35',
        'radRetakeRate_CT': '3:28',
        // MRI للمنومين
        'reportTurnaroundTime_MRI': '122:06',
        'radRetakeRate_MRI': '11:47',
        // Ultrasound للمنومين
        'reportTurnaroundTime_US': '17:39',
        'radRetakeRate_US': '5:53',
        // CT للعيادات
        'radExamCompletionTime_CT': '181:18',
        'patientWaitingTime_CT': '20:52',
        // MRI للعيادات
        'radExamCompletionTime_MRI': '321:18',
        'patientWaitingTime_MRI': '42:16',
        // Ultrasound للعيادات
        'radExamCompletionTime_US': '238:49',
        'patientWaitingTime_US': '10:07',
        // معدلات استخدام الأجهزة
        'radUtilization': '341%',
        'criticalResultsReporting': '64%',
        'schedulingAccuracy': '96%'
      };
      
      setKpiValues(defaultKpis);
    }
  };
  
  // دالة مساعدة للحصول على قيمة خلية من ورقة العمل
  const getCellValue = (worksheet, cellAddress) => {
    const cell = worksheet[cellAddress];
    if (!cell) return null;
    
    return cell.v;
  };
  
  // دالة مساعدة لتنسيق خلايا الوقت
  const formatTimeCell = (value) => {
    if (!value) return '-';
    
    if (typeof value === 'number') {
      // إذا كانت القيمة عددية (وقت Excel)، تحويلها إلى تنسيق ساعات:دقائق
      const totalMinutes = Math.round(value * 24 * 60); // تحويل إلى دقائق
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else if (typeof value === 'string') {
      if (value.includes(':')) {
        return value; // إذا كان بالفعل في تنسيق ساعات:دقائق
      }
      
      // محاولة تحويل النص إلى رقم
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const totalMinutes = Math.round(num * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    return value.toString(); // إرجاع القيمة كما هي إذا لم تكن في تنسيق معروف
  };
  
  // دالة مساعدة لتنسيق خلايا النسبة المئوية
  const formatPercentCell = (value) => {
    if (!value) return '-';
    
    if (typeof value === 'number') {
      // إذا كانت القيمة عددية، تحويلها إلى تنسيق نسبة مئوية
      return `${Math.round(value * 100)}%`;
    } else if (typeof value === 'string') {
      if (value.includes('%')) {
        return value; // إذا كان بالفعل في تنسيق نسبة مئوية
      }
      
      // محاولة تحويل النص إلى رقم
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (num > 1) {
          return `${Math.round(num)}%`; // إذا كان الرقم أكبر من 1، افترض أنه نسبة مئوية
        } else {
          return `${Math.round(num * 100)}%`; // إذا كان الرقم أقل من 1، افترض أنه نسبة عشرية
        }
      }
    }
    
    return value.toString(); // إرجاع القيمة كما هي إذا لم تكن في تنسيق معروف
  };
  
  // معالج تغيير الملف المحدد
  const handleFileChange = async (e) => {
    const filePath = e.target.value;
    setSelectedFile(filePath);
    
    if (filePath) {
      loadExcelData(filePath);
    }
  };

  // البنش مارك لكل مؤشر (مؤشرات قسم الأشعة)
  const benchmarks = {
    "KPI 1: Order to Scan Time": {
      worldClass: { max: 24, color: "#0072C6" },
      acceptable: { min: 24, max: 36, color: "#00B050" },
      needsImprovement: { min: 36, max: 48, color: "#FFC000" },
      unacceptable: { min: 48, color: "#C00000" }
    },
    "KPI 2: Scan to Release Time": {
      worldClass: { max: 5, color: "#0072C6" },
      acceptable: { min: 5, max: 7, color: "#00B050" },
      needsImprovement: { min: 7, max: 10, color: "#FFC000" },
      unacceptable: { min: 10, color: "#C00000" }
    },
    "KPI 3: Machine Utilization by modality": {
      worldClass: { min: 80, color: "#0072C6" },
      acceptable: { min: 70, max: 80, color: "#00B050" },
      needsImprovement: { min: 60, max: 70, color: "#FFC000" },
      unacceptable: { max: 60, color: "#C00000" }
    }
  };

  // وظائف إضافية للمساعدة في الجمال
  const getBenchmarkLabel = (kpiName, value) => {
    if (value === '' || value === 'NA' || value === null || value === undefined || value === '-') {
      return ''; 
    }
    
    const benchmark = benchmarks[kpiName];
    if (!benchmark) return '';
    
    let numericValue;
    
    if (typeof value === 'string') {
      if (value.includes('%')) {
        numericValue = parseFloat(value);
      } else if (value.includes(':')) {
        // تحويل وقت بصيغة "ساعة:دقيقة" إلى ساعات عشرية
        const [hours, minutes] = value.split(':').map(Number);
        numericValue = hours + (minutes / 60);
      } else {
        numericValue = parseFloat(value);
      }
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) {
      return '';
    }
    
    if (benchmark.worldClass) {
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) ||
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return 'ممتاز';
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return 'جيد';
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return 'يحتاج تحسين';
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) ||
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return 'غير مقبول';
      }
    }
    
    return '';
  };

  // دالة لتحديد اللون المناسب للقيمة بناءً على البنش مارك
  const getColorForValue = (kpiName, value) => {
    if (value === '' || value === 'NA' || value === null || value === undefined || value === '-') {
      return ''; // لا لون
    }
    
    // البحث عن البنش مارك المناسب
    const benchmark = benchmarks[kpiName];
    
    // إذا لم يتم العثور على بنش مارك لهذا المؤشر
    if (!benchmark) {
      return '';
    }
    
    // استخراج القيمة الرقمية
    let numericValue;
    
    if (typeof value === 'string') {
      if (value.includes('%')) {
        numericValue = parseFloat(value);
      } else if (value.includes(':')) {
        // تحويل وقت بصيغة "ساعة:دقيقة" إلى ساعات عشرية
        const [hours, minutes] = value.split(':').map(Number);
        numericValue = hours + (minutes / 60);
      } else {
        numericValue = parseFloat(value);
      }
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) {
      return '';
    }
    
    // التحقق من نطاق القيم
    if (benchmark.worldClass) {
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) ||
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return benchmark.worldClass.color;
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return benchmark.acceptable.color;
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return benchmark.needsImprovement.color;
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) ||
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return benchmark.unacceptable.color;
      }
    }
    
    return ''; // لون افتراضي إذا لم تتطابق أي حالة
  };

  // استخراج تاريخ الملف المحدد
  const getSelectedFileDate = useCallback(() => {
    if (!selectedFile) return '';
    
    const dateMatch = selectedFile.match(/(\d{4})-([A-Z]{3})/);
    if (dateMatch) {
      const months = {
        'JAN': 'يناير', 'FEB': 'فبراير', 'MAR': 'مارس', 'APR': 'أبريل',
        'MAY': 'مايو', 'JUN': 'يونيو', 'JUL': 'يوليو', 'AUG': 'أغسطس',
        'SEP': 'سبتمبر', 'OCT': 'أكتوبر', 'NOV': 'نوفمبر', 'DEC': 'ديسمبر'
      };
      return `${months[dateMatch[2]]} ${dateMatch[1]}`;
    }
    return '';
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* استخدام مكون الشريط الجانبي الموحد */}
        <Sidebar menuItems={menuItems} />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto bg-gray-50 lg:mr-72">
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-2 sm:px-4 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div className="text-center sm:text-right">
                <h1 className="text-base sm:text-xl font-bold text-gray-800">لوحة تحكم بيانات قسم الأشعة</h1>
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
                    onChange={handleFileChange}
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
                <div>
                  {/* القسم الرئيسي لبطاقات المؤشرات - تم التعديل لترتيبها في 3 أعمدة حسب الجهاز */}
                  <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 mb-4 sm:mb-6">
                    <h2 className="text-sm sm:text-xl font-bold text-gray-800 mb-2 sm:mb-4 border-r-4 border-indigo-500 pr-2">ملخص مؤشرات الأداء الرئيسية لقسم الأشعة</h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                      {/* العمود الأول - جهاز CT */}
                      <div>
                        <div className="mb-2 sm:mb-3 bg-gradient-to-r from-blue-50 to-blue-100 p-1.5 sm:p-2 rounded-lg border-r-4 border-blue-500">
                          <h3 className="text-sm sm:text-base font-semibold text-blue-800 text-center">أجهزة CT</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام CT */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-green-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام CT</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radUtilization || '-'}</p>
                                {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.radUtilization) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 3: Machine Utilization by modality", kpiValues.radUtilization), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.radUtilization)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-green-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار المنومين (CT) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (CT)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_CT || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_CT) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_CT), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_CT)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (CT منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (CT منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_CT || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_CT) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_CT), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_CT)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (CT) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (CT)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_CT || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_CT) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_CT), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_CT)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (CT عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (CT عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_CT || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_CT) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_CT), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_CT)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* العمود الثاني - جهاز MRI */}
                      <div>
                        <div className="mb-2 sm:mb-3 bg-gradient-to-r from-purple-50 to-purple-100 p-1.5 sm:p-2 rounded-lg border-r-4 border-purple-500">
                          <h3 className="text-sm sm:text-base font-semibold text-purple-800 text-center">أجهزة MRI</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام MRI */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام MRI</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.criticalResultsReporting || '-'}</p>
                                {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.criticalResultsReporting) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 3: Machine Utilization by modality", kpiValues.criticalResultsReporting), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.criticalResultsReporting)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار المنومين (MRI) - والبطاقات الأخرى للـ MRI */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (MRI)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_MRI || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_MRI) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_MRI), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_MRI)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* باقي بطاقات MRI - وقت الفحص إلى التقرير (MRI منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (MRI منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_MRI || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_MRI) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_MRI), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_MRI)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (MRI) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (MRI)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_MRI || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_MRI) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_MRI), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_MRI)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (MRI عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (MRI عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_MRI || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_MRI) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_MRI), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_MRI)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* العمود الثالث - جهاز Ultrasound */}
                      <div>
                        <div className="mb-2 sm:mb-3 bg-gradient-to-r from-yellow-50 to-yellow-100 p-1.5 sm:p-2 rounded-lg border-r-4 border-yellow-500">
                          <h3 className="text-sm sm:text-base font-semibold text-yellow-800 text-center">أجهزة Ultrasound</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام Ultrasound */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-yellow-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام Ultrasound</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.schedulingAccuracy || '-'}</p>
                                {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.schedulingAccuracy) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 3: Machine Utilization by modality", kpiValues.schedulingAccuracy), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.schedulingAccuracy)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-yellow-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* باقي بطاقات Ultrasound */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (Ultrasound)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_US || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_US) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_US), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.reportTurnaroundTime_US)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (US منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (US منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_US || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_US) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_US), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.radRetakeRate_US)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (Ultrasound) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (Ultrasound)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_US || '-'}</p>
                                {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_US) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_US), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 1: Order to Scan Time", kpiValues.radExamCompletionTime_US)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (US عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-1.5 sm:p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div>
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (US عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_US || '-'}</p>
                                {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_US) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_US), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 2: Scan to Release Time", kpiValues.patientWaitingTime_US)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-sm p-2 sm:p-3 mb-4 mt-4">
                    <div className="flex justify-center items-center flex-wrap gap-2 sm:gap-4">
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#0072C6] ml-1"></div>
                        <span className="text-xs text-gray-600">ممتاز</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#00B050] ml-1"></div>
                        <span className="text-xs text-gray-600">جيد</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#FFC000] ml-1"></div>
                        <span className="text-xs text-gray-600">يحتاج تحسين</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#C00000] ml-1"></div>
                        <span className="text-xs text-gray-600">غير مقبول</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* حقوق الملكية */}
              <div className="mt-4 text-center text-[10px] sm:text-xs text-gray-500">
                <p>© {String(new Date().getFullYear())} قسم الأشعة - مستشفى شرق جدة - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAD;