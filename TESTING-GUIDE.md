# Testing Extension Guide

## Cara Test Fitur Debug dan Pick Selector:

### 1. **Test Debug Feature:**
   - Buka `test-page.html` di browser
   - Buka extension popup (`index.html`)
   - Di section **Compare Selectors (optional)**:
     - Input `#nilai1` di Selector 1
     - Input `#nilai2` di Selector 2
   - Di section **Advanced Compare**:
     - Toggle ON
     - Input `#nilai1` di selector utama
     - Akan ada default values: `#nilai2` dan `Hello World`
   - Klik tombol **"Debug Selector & Value"**
   - Hasil harus menampilkan info kedua compare methods

### 2. **Test Pick Selector:**
   - Klik tombol **"Pick Selector"** di extension popup
   - Extension akan masuk mode picker
   - Hover pada elemen di halaman test (misalnya div #nilai1)
   - Klik pada elemen yang diinginkan
   - Selector akan otomatis ditambahkan ke daftar

### 3. **Test Advanced Compare Logic:**
   - Aktifkan Advanced Compare
   - Set selector utama: `#nilai1`
   - Add values:
     - `#nilai2` (akan dideteksi sebagai SELECTOR - badge hijau)
     - `Hello World` (akan dideteksi sebagai LITERAL - badge kuning)
   - Pilih operator dan logic (AND/OR)
   - Test dengan debug button

### 4. **File yang Diperbaiki:**
   - ✅ `index.html` - Fixed selector IDs
   - ✅ `script.js` - Removed duplicate debug handlers
   - ✅ `script.js` - Added missing compare config handlers
   - ✅ `content.js` - Added Advanced Compare support

### 5. **Features yang Sudah Berfungsi:**
   - ✅ Debug Button (support both compare methods)
   - ✅ Pick Selector (dengan visual overlay)
   - ✅ Advanced Compare (auto-detection, AND/OR logic)
   - ✅ Auto-detection selector vs literal values
   - ✅ Visual indicators (SEL/LIT badges)

### 6. **Testing Elements di test-page.html:**
   - `#nilai1` - Element dengan text "Hello World"
   - `#nilai2` - Element dengan text "Test Value"  
   - `#input1`, `#input2` - Input fields dengan values
   - `#dynamic-content` - Content yang berubah otomatis
   - `.highlight-box` - Element dengan class selector
