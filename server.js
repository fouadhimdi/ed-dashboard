const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// دالة موحدة للوصول إلى المجلدات وقراءة محتوياتها
function readDirectoryHandler(dirName) {
  return (req, res) => {
    // في بيئة الإنتاج، البيانات ستكون في مجلد build
    const directoryPath = process.env.NODE_ENV === 'production' 
      ? path.join(__dirname, `build/data/${dirName}`)
      : path.join(__dirname, `public/data/${dirName}`);
    
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        return res.status(500).send({
          message: `Unable to scan directory ${dirName}: ${err}`,
        });
      }
      
      res.json(files);
    });
  };
}

// مسارات للوصول إلى المجلدات المختلفة
app.get('/data/ED', readDirectoryHandler('ED'));
app.get('/data/LAB', readDirectoryHandler('LAB'));
app.get('/data/BB', readDirectoryHandler('BB'));
app.get('/data/OR', readDirectoryHandler('OR'));
app.get('/data/RAD', readDirectoryHandler('RAD'));

// مسار للوصول إلى المجلدات الديناميكية (قائمة الملفات)
app.get('/data/:folderName', (req, res) => {
  const { folderName } = req.params;
  
  // التحقق من صحة اسم المجلد لأسباب أمنية
  const validFolders = ['ED', 'LAB', 'BB', 'OR', 'RAD'];
  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ 
      message: 'Access denied: Invalid folder' 
    });
  }
  
  // إرجاع قائمة الملفات في المجلد
  readDirectoryHandler(folderName)(req, res);
});

// مسار للوصول إلى الملفات الديناميكية
app.get('/data/:folderName/:fileName', (req, res) => {
  const { folderName, fileName } = req.params;
  
  // التحقق من صحة اسم المجلد لأسباب أمنية
  const validFolders = ['ED', 'LAB', 'BB', 'OR', 'RAD'];
  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ 
      message: 'Access denied: Invalid folder' 
    });
  }

  // إرجاع الملف المطلوب
  const filePath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, `build/data/${folderName}/${fileName}`)
    : path.join(__dirname, `public/data/${folderName}/${fileName}`);
    
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send({
        message: `File not found: ${fileName}`
      });
    }
  });
});

// تقديم الملفات الثابتة من مجلد build في الإنتاج أو public في التطوير
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  // إرجاع index.html للمسارات غير المطابقة (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build/index.html'));
  });
} else {
  app.use(express.static('public'));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});