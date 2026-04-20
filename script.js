// ==========================================
// 0. AUTO-CLEANER (Fixes Excel Export Bugs)
// ==========================================
if (typeof rawData !== 'undefined') {
    rawData.forEach(shoe => {
        Object.keys(shoe).forEach(key => {
            const cleanKey = key.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (cleanKey !== key) {
                shoe[cleanKey] = shoe[key];
                delete shoe[key];
            }
        });
    });
}


// ==========================================
// 1. SMART FILTER STATE & UTILS
// ==========================================
function getSafeVal(d, key1, key2, fallback = 'N/A') {
    let val = d[key1] !== undefined ? d[key1] : d[key2];
    if (val === null || val === undefined || String(val).trim() === '') return fallback;
    return String(val).trim();
}

function cleanYear(val) {
    if (val === 'N/A') return val;
    let str = String(val);
    if (str.match(/^190[0-9]/)) {
        let cleanStr = str.split('T')[0].split(' ')[0]; 
        let d = new Date(cleanStr + "T00:00:00Z");
        let base = new Date("1899-12-30T00:00:00Z");
        let days = Math.round((d - base) / 86400000);
        return String(days);
    }
    if (str.length >= 4 && str.includes('-')) return str.substring(0,4);
    return str;
}

const filterState = { years: {}, months: {}, categories: {}, brands: {}, models: {} };

const years = [...new Set(rawData.map(d => cleanYear(getSafeVal(d, 'Year', 'year'))))].sort().reverse();
const months = [...new Set(rawData.map(d => getSafeVal(d, 'Month', 'month')))].sort();
const categories = [...new Set(rawData.map(d => getSafeVal(d, 'Category', 'category')))].sort();
const brands = [...new Set(rawData.map(d => getSafeVal(d, 'Brand', 'brand')))].sort();
const uniqueModels = [...new Set(rawData.map(d => getSafeVal(d, 'Model', 'model')))].sort();

years.forEach(y => filterState.years[y] = true);
months.forEach(m => filterState.months[m] = true);
categories.forEach(c => filterState.categories[c] = true);
brands.forEach(b => filterState.brands[b] = true);
uniqueModels.forEach(m => filterState.models[m] = true);

let selectedShoesForCompare = [];
const colors = ['#3b82f6','#10b981','#f43f5e','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16','#ef4444','#14b8a6','#6366f1','#f97316'];

function getDisplayName(brand, model) {
    if (!model || model === 'N/A') return '';
    if (model.toLowerCase().startsWith(brand.toLowerCase())) return model;
    return brand + ' ' + model;
}
function getBrandColor(brand) { return colors[brands.indexOf(brand) % colors.length]; }

function showToast(msg, colorClass) {
    const toast = document.createElement('div');
    toast.className = `${colorClass} text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm transition-all duration-500`;
    toast.style.animation = "slideUp 0.3s ease-out forwards";
    toast.textContent = msg;
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 100%)';
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}
function switchTab(tabId) {
    // 1. Hide all 3 view containers safely
    ['viewExplorer', 'viewCompare', 'viewPipeline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { 
            el.classList.remove('active'); 
            el.classList.add('hidden'); 
        }
    });
    
    // 2. Reset all 3 buttons safely
    ['btnTabExplorer', 'btnTabCompare', 'btnTabPipeline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            el.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-700');
        }
    });

    // 3. Figure out which one to activate
    const activeViewId = tabId === 'explorer' ? 'viewExplorer' : tabId === 'compare' ? 'viewCompare' : 'viewPipeline';
    const activeBtnId = tabId === 'explorer' ? 'btnTabExplorer' : tabId === 'compare' ? 'btnTabCompare' : 'btnTabPipeline';
    
    // 4. Turn on the selected view
    const activeView = document.getElementById(activeViewId);
    if (activeView) {
        activeView.classList.add('active');
        activeView.classList.remove('hidden');
    }
    
    // 5. Light up the selected button
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
        activeBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-700');
    }

    // 6. Trigger specific page logic
    if (tabId === 'compare') {
        renderCompareView();
    }
    if (tabId === 'pipeline' && !window.pipelineLoaded) {
        loadPipelineData();
        window.pipelineLoaded = true; // Prevents reloading the server every time you click the tab
    }
}
// ==========================================
// 2. SMART RENDERING ENGINE (EXPLORER)
// ==========================================
function renderFilter(containerId, items, stateDict, searchTerm, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const filteredItems = items.filter(item => {
        let disp = item;
        if (type === 'model') {
            const shoe = rawData.find(d => getSafeVal(d, 'Model', 'model') === item);
            disp = getDisplayName(shoe ? getSafeVal(shoe, 'Brand', 'brand') : '', item);
        }
        return disp.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => stateDict[item]);
    const selectAllChecked = isAllSelected ? 'checked' : '';

    let html = `
        <label class="flex items-center space-x-2 mb-1 cursor-pointer">
            <input type="checkbox" class="select-all-cb form-checkbox rounded bg-slate-800 border-slate-600" ${selectAllChecked}>
            <span class="text-sm font-bold text-white">Select All</span>
        </label>
        <hr class="border-slate-700 my-1">
    `;

    filteredItems.slice(0, 100).forEach(item => {
        let disp = item;
        if (type === 'model') {
            const shoe = rawData.find(d => getSafeVal(d, 'Model', 'model') === item);
            disp = getDisplayName(shoe ? getSafeVal(shoe, 'Brand', 'brand') : '', item);
        }
        const isChecked = stateDict[item] ? 'checked' : '';
        html += `<label class="flex items-center space-x-2 mb-1 cursor-pointer">
                    <input type="checkbox" value="${item}" class="smart-cb form-checkbox text-blue-500 rounded bg-slate-800 border-slate-600" ${isChecked}>
                    <span class="text-sm text-slate-300 truncate" title="${disp}">${disp}</span>
                 </label>`;
    });

    if (filteredItems.length > 100) html += `<div class="text-xs text-slate-500 italic mt-2 text-center">+ ${filteredItems.length - 100} more...</div>`;
    
    container.innerHTML = html;
    bindCheckboxes(containerId, stateDict, filteredItems);
}

function refreshFilters() {
    const selectedYears = Object.keys(filterState.years).filter(k => filterState.years[k]);
    const selectedMonths = Object.keys(filterState.months).filter(k => filterState.months[k]);
    const selectedCats = Object.keys(filterState.categories).filter(k => filterState.categories[k]);
    const selectedBrands = Object.keys(filterState.brands).filter(k => filterState.brands[k]);

    const availableBrands = [...new Set(rawData.filter(d => 
        selectedYears.includes(cleanYear(getSafeVal(d, 'Year', 'year'))) &&
        selectedMonths.includes(getSafeVal(d, 'Month', 'month')) &&
        selectedCats.includes(getSafeVal(d, 'Category', 'category'))
    ).map(d => getSafeVal(d, 'Brand', 'brand')))].sort();

    const availableModels = [...new Set(rawData.filter(d => 
        selectedYears.includes(cleanYear(getSafeVal(d, 'Year', 'year'))) &&
        selectedMonths.includes(getSafeVal(d, 'Month', 'month')) &&
        selectedCats.includes(getSafeVal(d, 'Category', 'category')) && 
        selectedBrands.includes(getSafeVal(d, 'Brand', 'brand'))
    ).map(d => getSafeVal(d, 'Model', 'model')))].sort();

    renderFilter('yearCheckboxContainer', years, filterState.years, document.getElementById('yearSearch').value, 'year');
    renderFilter('monthCheckboxContainer', months, filterState.months, document.getElementById('monthSearch').value, 'month');
    renderFilter('catCheckboxContainer', categories, filterState.categories, document.getElementById('catSearch').value, 'category');
    renderFilter('brandCheckboxContainer', availableBrands, filterState.brands, document.getElementById('brandSearch').value, 'brand');
    renderFilter('modelCheckboxContainer', availableModels, filterState.models, document.getElementById('modelSearch').value, 'model');
}

function bindCheckboxes(containerId, stateDict, filteredItems) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.smart-cb').forEach(cb => {
        cb.addEventListener('change', function() {
            stateDict[this.value] = this.checked;
            refreshFilters(); updateCharts(); 
        });
    });
    container.querySelector('.select-all-cb').addEventListener('change', function() {
        const isChecked = this.checked;
        filteredItems.forEach(item => { stateDict[item] = isChecked; });
        refreshFilters(); updateCharts();
    });
}

function setupSmartSearch(inputId) {
    document.getElementById(inputId).addEventListener('input', refreshFilters);
}

refreshFilters();
setupSmartSearch('yearSearch');
setupSmartSearch('monthSearch');
setupSmartSearch('catSearch');
setupSmartSearch('brandSearch');
setupSmartSearch('modelSearch');

// ==========================================
// 3. MATH HELPERS
// ==========================================
function calcStats(vals) {
    if(vals.length === 0) return {min: '-', avg: '-', max: '-'};
    const min = Math.min(...vals).toFixed(1);
    const max = Math.max(...vals).toFixed(1);
    const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
    return {min, avg, max};
}

function calcLinearRegression(data, xKey, yKey) {
    let n = data.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    data.forEach(d => {
        let x = parseFloat(d[xKey]); let y = parseFloat(d[yKey]);
        sumX += x; sumY += y; sumXY += x*y; sumX2 += x*x; sumY2 += y*y;
    });
    let denom = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    if (denom === 0) return null;
    let r = ((n * sumXY) - (sumX * sumY)) / denom;
    let slope = ((n * sumXY) - (sumX * sumY)) / ((n * sumX2) - (sumX * sumX));
    let intercept = (sumY - slope * sumX) / n;
    return { r, slope, intercept };
}

// ==========================================
// 4. CHART LOGIC
// ==========================================
const chartCtx = document.getElementById('mainChart').getContext('2d');
let mainChart = null;
let radarChart = null;
Chart.defaults.color = '#cbd5e1';
Chart.defaults.borderColor = '#334155';

function updateCharts() {
    const selectedYears = Object.keys(filterState.years).filter(k => filterState.years[k]);
    const selectedMonths = Object.keys(filterState.months).filter(k => filterState.months[k]);
    const selectedCats = Object.keys(filterState.categories).filter(k => filterState.categories[k]);
    const selectedBrands = Object.keys(filterState.brands).filter(k => filterState.brands[k]);
    const selectedModels = Object.keys(filterState.models).filter(k => filterState.models[k]);
    
    const xKey = document.getElementById('xMetric').value;
    const yKey = document.getElementById('yMetric').value;
    const is1D = (yKey === 'None');

    let filtered = rawData.filter(d => 
        selectedYears.includes(cleanYear(getSafeVal(d, 'Year', 'year'))) &&
        selectedMonths.includes(getSafeVal(d, 'Month', 'month')) &&
        selectedCats.includes(getSafeVal(d, 'Category', 'category')) && 
        selectedBrands.includes(getSafeVal(d, 'Brand', 'brand')) && 
        selectedModels.includes(getSafeVal(d, 'Model', 'model'))
    );
    document.getElementById('activeCountBadge').innerText = 'Active Selection: ' + filtered.length + ' Models';

    const isValidMetric = (val) => val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A';

    if (is1D) {
        filtered = filtered.filter(d => isValidMetric(d[xKey]));
        document.getElementById('yStatsRow').style.opacity = '0.3';
        document.getElementById('correlationBox').style.opacity = '0.3';
        document.getElementById('yQuad1').style.display = 'none';
        document.getElementById('yQuad2').style.display = 'none';
    } else {
        filtered = filtered.filter(d => isValidMetric(d[xKey]) && isValidMetric(d[yKey]));
        document.getElementById('yStatsRow').style.opacity = '1';
        document.getElementById('correlationBox').style.opacity = '1';
        document.getElementById('yQuad1').style.display = 'flex';
        document.getElementById('yQuad2').style.display = 'flex';
    }

    let xVals = filtered.map(d => parseFloat(d[xKey])).filter(v => !isNaN(v));
    let xStats = calcStats(xVals);
    document.getElementById('statXTitle').textContent = xKey; 
    document.getElementById('xMin').textContent = xStats.min;
    document.getElementById('xAvg').textContent = xStats.avg;
    document.getElementById('xMax').textContent = xStats.max;

    if (!is1D) {
        let yVals = filtered.map(d => parseFloat(d[yKey])).filter(v => !isNaN(v));
        let yStats = calcStats(yVals);
        document.getElementById('statYTitle').textContent = yKey; 
        document.getElementById('yMin').textContent = yStats.min;
        document.getElementById('yAvg').textContent = yStats.avg;
        document.getElementById('yMax').textContent = yStats.max;

        let reg = calcLinearRegression(filtered, xKey, yKey);
        if (reg) {
            document.getElementById('rValue').textContent = reg.r.toFixed(2);
            let text = "Weak";
            if(Math.abs(reg.r) > 0.7) text = "Strong";
            else if(Math.abs(reg.r) > 0.4) text = "Moderate";
            document.getElementById('rText').textContent = `${text} Correlation`;
        } else {
            document.getElementById('rValue').textContent = "-";
            document.getElementById('rText').textContent = "Not enough data";
        }
    }

    if (mainChart) mainChart.destroy();
    
    let xAvgVal = is1D ? 0 : (xVals.length > 0 ? xVals.reduce((a,b)=>a+b,0)/xVals.length : 0);
    let yAvgVal = is1D ? 0 : (filtered.length > 0 ? filtered.map(d => parseFloat(d[yKey])).filter(v => !isNaN(v)).reduce((a,b)=>a+b,0)/filtered.length : 0);
    
    if (is1D) {
        let sorted = [...filtered].sort((a,b) => b[xKey] - a[xKey]).slice(0, 100);
        mainChart = new Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: sorted.map(d => getDisplayName(getSafeVal(d, 'Brand', 'brand'), getSafeVal(d, 'Model', 'model'))),
                datasets: [{
                    label: xKey, data: sorted.map(d => d[xKey]),
                    backgroundColor: sorted.map(d => getBrandColor(getSafeVal(d, 'Brand', 'brand'))), shoes: sorted
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, activeElements) => { if (activeElements.length > 0) handleShoeAdd(mainChart.data.datasets[0].shoes[activeElements[0].index]); },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(ctx) { const shoe = ctx.dataset.shoes[ctx.dataIndex]; return [`${getDisplayName(getSafeVal(shoe, 'Brand', 'brand'), getSafeVal(shoe, 'Model', 'model'))}`, `${xKey}: ${ctx.raw}`]; } } }
                },
                scales: { x: { ticks: { display: sorted.length <= 40 } }, y: { title: { display: true, text: xKey, font: { weight: 'bold' } } } }
            }
        });
    } else {
        const datasets = [];
        const brandsInFiltered = [...new Set(filtered.map(d => getSafeVal(d, 'Brand', 'brand')))];
        brandsInFiltered.forEach(brand => {
            const brandData = filtered.filter(d => getSafeVal(d, 'Brand', 'brand') === brand);
            datasets.push({
                label: brand,
                data: brandData.map(d => ({ x: d[xKey], y: d[yKey], shoe: d })),
                backgroundColor: getBrandColor(brand),
                borderColor: '#1e293b', borderWidth: 1, pointRadius: 6, pointHoverRadius: 9
            });
        });

        if(xVals.length > 2) {
            let xMinB = Math.min(...xVals), xMaxB = Math.max(...xVals);
            let rawYVals = filtered.map(d=>parseFloat(d[yKey])).filter(v=>!isNaN(v));
            let yMinB = Math.min(...rawYVals), yMaxB = Math.max(...rawYVals);
            
            if(isFinite(xMinB) && isFinite(yMinB)) {
                datasets.push({ label: '📌 Category Avg (X)', data: [{x: xAvgVal, y: yMinB}, {x: xAvgVal, y: yMaxB}], type: 'line', borderColor: 'rgba(148, 163, 184, 0.8)', borderDash: [4, 4], pointRadius: 0, fill: false, borderWidth: 2 });
                datasets.push({ label: '📌 Category Avg (Y)', data: [{x: xMinB, y: yAvgVal}, {x: xMaxB, y: yAvgVal}], type: 'line', borderColor: 'rgba(148, 163, 184, 0.8)', borderDash: [4, 4], pointRadius: 0, fill: false, borderWidth: 2 });
            }
        }

        let reg = calcLinearRegression(filtered, xKey, yKey);
        if (reg && filtered.length > 2) {
            let xMin = Math.min(...xVals), xMax = Math.max(...xVals);
            if(isFinite(xMin) && isFinite(xMax)) {
                datasets.push({ label: 'Trendline', data: [{x: xMin, y: reg.slope * xMin + reg.intercept}, {x: xMax, y: reg.slope * xMax + reg.intercept}], type: 'line', borderColor: 'rgba(59, 130, 246, 0.5)', borderDash: [5, 5], pointRadius: 0, fill: false, borderWidth: 2 });
            }
        }

        mainChart = new Chart(chartCtx, {
            type: 'scatter',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, activeElements) => {
                    if (activeElements.length > 0) {
                        const el = activeElements[0];
                        const ds = mainChart.data.datasets[el.datasetIndex];
                        if(ds.label !== 'Trendline' && !ds.label.includes('Avg')) handleShoeAdd(ds.data[el.index].shoe);
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                if(ctx.dataset.label === 'Trendline' || ctx.dataset.label.includes('Avg')) return null;
                                const s = ctx.raw.shoe;
                                return [`${getDisplayName(getSafeVal(s, 'Brand', 'brand'), getSafeVal(s, 'Model', 'model'))}`, `${xKey}: ${ctx.parsed.x}`, `${yKey}: ${ctx.parsed.y}`];
                            }
                        }
                    },
                    legend: { position: 'right', labels: { filter: item => item.text !== 'Trendline' } }
                },
                scales: {
                    x: { title: { display: true, text: xKey, font: { weight: 'bold' } } },
                    y: { title: { display: true, text: yKey, font: { weight: 'bold' } } }
                }
            }
        });
    }
    updateQuadTables(filtered, xKey, yKey, is1D);
}

function updateQuadTables(data, xKey, yKey, is1D) {
    let sortedX = [...data].sort((a,b) => parseFloat(a[xKey]) - parseFloat(b[xKey]));
    const makeRows = (arr, key) => arr.map(s => `<tr><td class="mini-table-td truncate max-w-[150px]" title="${getDisplayName(getSafeVal(s, 'Brand', 'brand'), getSafeVal(s, 'Model', 'model'))}">${getDisplayName(getSafeVal(s, 'Brand', 'brand'), getSafeVal(s, 'Model', 'model'))}</td><td class="mini-table-td text-right font-bold">${s[key]}</td></tr>`).join('');
    
    document.getElementById('topXLowTitle').textContent = `Lowest 5: ${xKey}`;
    document.getElementById('topXHighTitle').textContent = `Highest 5: ${xKey}`;
    document.getElementById('topXLowTable').innerHTML = makeRows(sortedX.slice(0, 5), xKey);
    document.getElementById('topXHighTable').innerHTML = makeRows(sortedX.reverse().slice(0, 5), xKey);

    if(!is1D) {
        let sortedY = [...data].sort((a,b) => parseFloat(a[yKey]) - parseFloat(b[yKey]));
        document.getElementById('topYLowTitle').textContent = `Lowest 5: ${yKey}`;
        document.getElementById('topYHighTitle').textContent = `Highest 5: ${yKey}`;
        document.getElementById('topYLowTable').innerHTML = makeRows(sortedY.slice(0, 5), yKey);
        document.getElementById('topYHighTable').innerHTML = makeRows(sortedY.reverse().slice(0, 5), yKey);
    }
}

// ==========================================
// 5. COMPARE ARENA (DROPDOWNS)
// ==========================================
const compAddCat = document.getElementById('compAddCat');
const compAddBrand = document.getElementById('compAddBrand');
const compAddModel = document.getElementById('compAddModel');

function populateCompAddFilters() {
    categories.forEach(c => compAddCat.innerHTML += `<option value="${c}">${c}</option>`);
    updateCompAddBrandList(); 
}

function updateCompAddBrandList() {
    let cat = compAddCat.value;
    let filtered = rawData;
    if (cat !== 'All') filtered = filtered.filter(d => getSafeVal(d, 'Category', 'category') === cat);

    let brandsInFilter = [...new Set(filtered.map(d => getSafeVal(d, 'Brand', 'brand')))].sort();
    let currentBrand = compAddBrand.value; 

    compAddBrand.innerHTML = '<option value="All">All Brands</option>';
    brandsInFilter.forEach(b => { compAddBrand.innerHTML += `<option value="${b}">${b}</option>`; });

    if (brandsInFilter.includes(currentBrand)) compAddBrand.value = currentBrand;
    else compAddBrand.value = 'All';

    updateCompAddModelList(); 
}

function updateCompAddModelList() {
    let cat = compAddCat.value;
    let brand = compAddBrand.value;
    let filtered = rawData;
    
    if (cat !== 'All') filtered = filtered.filter(d => getSafeVal(d, 'Category', 'category') === cat);
    if (brand !== 'All') filtered = filtered.filter(d => getSafeVal(d, 'Brand', 'brand') === brand);
    
    let modelsInFilter = [...new Set(filtered.map(d => getSafeVal(d, 'Model', 'model')))].sort();
    
    compAddModel.innerHTML = '<option value="">Select a Model...</option>';
    modelsInFilter.forEach(m => {
        let shoe = rawData.find(x => getSafeVal(x, 'Model', 'model') === m);
        let disp = getDisplayName(getSafeVal(shoe, 'Brand', 'brand'), getSafeVal(shoe, 'Model', 'model'));
        compAddModel.innerHTML += `<option value="${m}">${disp}</option>`;
    });
}

compAddCat.addEventListener('change', updateCompAddBrandList);
compAddBrand.addEventListener('change', updateCompAddModelList);

function addSelectedCompareModel() {
    let m = compAddModel.value;
    if (!m) return;
    let shoe = rawData.find(x => getSafeVal(x, 'Model', 'model') === m);
    if (shoe) handleShoeAdd(shoe);
}

function handleShoeAdd(shoe) {
    if(selectedShoesForCompare.find(s => getSafeVal(s, 'Model', 'model') === getSafeVal(shoe, 'Model', 'model'))) {
        showToast(`⚠️ ${getDisplayName(getSafeVal(shoe, 'Brand', 'brand'), getSafeVal(shoe, 'Model', 'model'))} is already in Compare Arena!`, 'bg-amber-500');
        return;
    }
    if(selectedShoesForCompare.length >= 5) {
        showToast(`🛑 Max 5 shoes! Please clear some first.`, 'bg-rose-600');
        return;
    }
    
    selectedShoesForCompare.push(shoe);
    updateCompareBadge();
    
    if(document.getElementById('viewCompare').classList.contains('active')) {
        renderCompareView();
    } else {
        showToast(`✅ Added ${getDisplayName(getSafeVal(shoe, 'Brand', 'brand'), getSafeVal(shoe, 'Model', 'model'))} to Compare! (${selectedShoesForCompare.length}/5)`, 'bg-emerald-600');
        const tabBtn = document.getElementById('btnTabCompare');
        tabBtn.classList.add('ring-4', 'ring-emerald-500', 'bg-slate-700');
        setTimeout(() => { tabBtn.classList.remove('ring-4', 'ring-emerald-500', 'bg-slate-700'); }, 600);
    }
}

function removeShoe(model) {
    selectedShoesForCompare = selectedShoesForCompare.filter(s => getSafeVal(s, 'Model', 'model') !== model);
    updateCompareBadge();
    renderCompareView();
}

function clearCompare() {
    selectedShoesForCompare = [];
    updateCompareBadge();
    renderCompareView();
}

function updateCompareBadge() {
    const badge = document.getElementById('tabCompareBadge');
    if (selectedShoesForCompare.length > 0) {
        badge.classList.remove('hidden');
        badge.textContent = selectedShoesForCompare.length;
    } else {
        badge.classList.add('hidden');
    }
}

function renderCompareView() {
    const empty = document.getElementById('compareEmptyState');
    const content = document.getElementById('compareContentState');
    const chips = document.getElementById('selectedChipsContainer');

    if (selectedShoesForCompare.length === 0) {
        empty.classList.remove('hidden');
        content.classList.add('hidden');
        chips.innerHTML = '';
        
        // Turn off the neon lights when the arena is empty
        const radarBox = document.getElementById('radarChart')?.parentElement;
        if (radarBox) {
            radarBox.style.boxShadow = 'none';
            radarBox.style.borderColor = 'rgba(71, 85, 105, 0.4)'; // Reset to standard slate border
        }
        return;
    }

    empty.classList.add('hidden');
    content.classList.remove('hidden');
    content.classList.add('flex');

    // --- NEON UPGRADE 1: Glowing Brand Chips ---
    chips.innerHTML = selectedShoesForCompare.map((s, idx) => `
        <div class="flex items-center space-x-2 bg-slate-900 border rounded-full px-4 py-1.5 transition-all duration-500 cursor-default hover:scale-105" 
             style="border-color: ${colors[idx]}80; box-shadow: 0 0 15px ${colors[idx]}40;">
            <span class="w-3 h-3 rounded-full" style="background-color: ${colors[idx]}; box-shadow: 0 0 10px ${colors[idx]};"></span>
            <span class="text-sm font-bold text-slate-100 drop-shadow-md">${getDisplayName(getSafeVal(s, 'Brand', 'brand'), getSafeVal(s, 'Model', 'model'))}</span>
            <button onclick="removeShoe('${getSafeVal(s, 'Model', 'model').replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-rose-400 hover:scale-125 font-black ml-2 text-lg leading-none transition-all duration-200">&times;</button>
        </div>
    `).join('');

    // --- NEON UPGRADE 2: Ambient Spider Chart Glow ---
    const radarBox = document.getElementById('radarChart')?.parentElement;
    if (radarBox) {
        // Mix the colors of ALL selected shoes into one beautiful, layered ambient glow
        let ambientGlow = selectedShoesForCompare.map((s, idx) => `0 0 ${40 + (idx*10)}px ${colors[idx]}25`).join(', ');
        
        radarBox.style.boxShadow = ambientGlow;
        radarBox.style.borderColor = `${colors[0]}60`; // Tint the glass border to match Shoe #1
        radarBox.style.transition = 'all 0.6s ease-in-out';
    }

    buildSpiderChart();
    buildCompareTable();
}

// ==========================================
// 6. METRICS & CHARTS 
// ==========================================
const metricCategories = {"General info": ["Category", "Report Date", "Updated report date (with new methodology)", "Methodology", "Price (EUR)"], "Cushioning": ["Shock absorption heel (SA)", "Energy return heel (%)", "Heel stack (mm)", "Forefoot stack (mm)", "Drop (mm)", "Midsole softness (new method) (AC)", "Midsole softness (old method) (HA)", "Secondary foam softness (new method) (AC)", "Secondary foam softness (old method) (HA)", "Midsole softness in cold (HA)", "Midsole softness in cold (% change)"], "Size and fit": ["Size", "Width / Fit (new method) (mm)", "Width / Fit (old method) (mm)", "Toebox width (new method) (mm)", "Toebox width (old method) (mm)", "Toebox height (mm)"], "Traction / grip": ["Forefoot traction (CoF)", "Lug depth (mm)"], "Flexibility / Stifness": ["Flexibility / Stiffness (new method) (N)", "Flexibility / Stiffness (old method) (N)"], "Weight": ["Weight (g)", "Weight (oz)"], "Breathability": ["Breathability (rating 1-5)"], "Stability": ["Torsional rigidity (new method)", "Torsional rigidity (old method) (rating 1-5)", "Heel counter stiffness (rating 1-5)", "Midsole width - forefoot (mm)", "Midsole width - heel (mm)"], "Durability": ["Toe guard durability (rating 1-5)", "Toebox durability (rating 1-5)", "Heel padding durability (rating 1-5)", "Outsole hardness (HC)", "Outsole durability (mm loss)", "Outsole thickness (mm)"], "Misc": ["Insole thickness (mm)", "Removable insole", "Reflective elements", "Tongue padding (mm)", "Tongue: gusset type", "Heel tab"]};

const metricTooltips = {
    "Shock absorption heel (SA)": "Higher score = softer landings and better impact protection.",
    "Energy return heel (%)": "Higher % = a bouncier, more responsive ride.",
    "Midsole softness (new method) (AC)": "Lower score = softer, plush foam. Higher score = firm foam.",
    "Midsole softness in cold (% change)": "Lower % = the foam stays consistent and won't turn into a brick during winter.",
    "Forefoot traction (CoF)": "Coefficient of Friction. Higher score = better grip on wet or slick surfaces.",
    "Flexibility / Stiffness (new method) (N)": "Higher N = stiff and snappy. Lower N = highly flexible and natural feeling.",
    "Outsole hardness (HC)": "Higher HC = harder, more durable rubber. Lower HC = softer, grippier rubber."
};

function buildSpiderChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    const coreMetrics = ['Weight (g)', 'Heel stack (mm)', 'Drop (mm)', 'Midsole softness (new method) (AC)', 'Flexibility / Stiffness (new method) (N)', 'Shock absorption heel (SA)', 'Energy return heel (%)'];
    const labels = ['Lightweight', 'Heel Stack', 'Drop', 'Softness', 'Stiffness', 'Shock Absorption', 'Energy Return'];

    let compCats = [...new Set(selectedShoesForCompare.map(s => getSafeVal(s, 'Category', 'category')))];
    let catData = rawData.filter(d => compCats.includes(getSafeVal(d, 'Category', 'category')));

    function getPercentile(val, metric, data, invert) {
        if (isNaN(val) || val === null) return 0;
        let vals = data.map(d => parseFloat(d[metric])).filter(v => !isNaN(v));
        if (vals.length === 0) return 50;
        vals.sort((a,b) => a - b);
        let count = 0;
        for (let v of vals) {
            if (v < val) count++;
            else if (v === val) count += 0.5;
        }
        let pct = (count / vals.length) * 100;
        return invert ? 100 - pct : pct;
    }

    const radarDatasets = selectedShoesForCompare.map((shoe, idx) => {
        const dataPoints = coreMetrics.map((k, i) => {
            let val = parseFloat(shoe[k]);
            if (isNaN(val)) return 0;
            let invert = (k === 'Weight (g)' || k === 'Midsole softness (new method) (AC)');
            return getPercentile(val, k, catData, invert);
        });
        
        return {
            label: getDisplayName(getSafeVal(shoe, 'Brand', 'brand'), getSafeVal(shoe, 'Model', 'model')),
            data: dataPoints,
            actualData: coreMetrics.map(k => shoe[k]),
            backgroundColor: colors[idx % colors.length] + '40',
            borderColor: colors[idx % colors.length], pointBackgroundColor: colors[idx % colors.length],
            borderWidth: 2, pointRadius: 4
        };
    });

    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: labels, datasets: radarDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: '#334155' }, grid: { color: '#334155' },
                    pointLabels: { color: '#94a3b8', font: { size: 11, weight: 'bold' } },
                    ticks: { display: false, min: 0, max: 100 }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#e2e8f0', boxWidth: 10 } },
                tooltip: {
                    callbacks: { label: function(ctx) { return `${ctx.dataset.label}: ${ctx.dataset.actualData[ctx.dataIndex]}`; } }
                }
            }
        }
    });
}

function generateRunRepeatUrl(brand, model) {
    let fullName = getDisplayName(brand, model).toLowerCase();
    let urlSlug = fullName.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    return `https://runrepeat.com/${urlSlug}`;
}

function buildCompareTable() {
    const thead = document.getElementById('compareTableHead');
    const tbody = document.getElementById('compareTableBody');
    
    const tableEl = thead.parentElement;
    const wrapperEl = tableEl.parentElement; 
    
    wrapperEl.classList.add('max-h-[75vh]', 'overflow-y-auto', 'relative');
    thead.classList.add('sticky', 'top-0', 'z-50');
    tableEl.classList.remove('table-fixed');
    
    let compCats = [...new Set(selectedShoesForCompare.map(s => getSafeVal(s, 'Category', 'category')))];
    let catData = rawData.filter(d => compCats.includes(getSafeVal(d, 'Category', 'category')));
    let catLabel = compCats.join(" & ") + " Avg";

    let headHtml = `<tr><th class="px-4 py-4 bg-slate-900 sticky top-0 left-0 z-50 shadow-r border-b border-slate-700 whitespace-normal break-words align-bottom" style="min-width: 250px; width: 250px; max-width: 250px;">Metric</th>`;
    
    selectedShoesForCompare.forEach((s, idx) => {
        let brand = getSafeVal(s, 'Brand', 'brand');
        let model = getSafeVal(s, 'Model', 'model');
        let reviewUrl = s.URLs || s.URL || generateRunRepeatUrl(brand, model);
        
        headHtml += `<th class="px-4 py-4 bg-slate-900 sticky top-0 z-40 border-l border-b border-slate-700 text-center align-bottom" style="min-width: 140px; color: ${colors[idx]}">
            <a href="${reviewUrl}" target="_blank" class="hover:underline hover:text-blue-400 transition-colors cursor-pointer group" title="Read review on RunRepeat">
                ${brand}<br><span class="text-white font-bold group-hover:text-blue-400 transition-colors">${model.replace(brand, '').trim()}</span>
                <svg class="w-3 h-3 inline-block ml-1 opacity-50 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
        </th>`;
    });
    
    headHtml += `<th class="px-4 py-4 bg-slate-900 sticky top-0 z-40 border-l border-b border-slate-700 text-center text-slate-400 whitespace-normal align-bottom" style="min-width: 140px;">${catLabel}</th>`;
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    let bodyHtml = '';

    for (const [catName, exactKeys] of Object.entries(metricCategories)) {
        let catRowsHtml = '';
        
        exactKeys.forEach(exactKey => {
            let hasValue = selectedShoesForCompare.some(s => s[exactKey] !== null && s[exactKey] !== undefined && s[exactKey] !== '-' && s[exactKey] !== '');
            
            if (hasValue) {
                let numericVals = selectedShoesForCompare.map(s => parseFloat(s[exactKey])).filter(v => !isNaN(v));
                let rowMax = numericVals.length > 1 ? Math.max(...numericVals) : null;
                let rowMin = numericVals.length > 1 ? Math.min(...numericVals) : null;
                if (rowMax === rowMin) { rowMax = null; rowMin = null; }

                // --- TOOLTIP UPGRADE ---
                let tooltipHtml = '';
                if (metricTooltips && metricTooltips[exactKey]) {
                    tooltipHtml = `
                    <div class="group relative inline-block ml-2 cursor-help">
                        <svg class="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 w-56 p-3 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 font-normal normal-case break-words leading-relaxed">
                            ${metricTooltips[exactKey]}
                        </div>
                    </div>`;
                }

                let rowHtml = `<tr class="hover:bg-slate-800/50 transition-colors">
                    <td class="px-4 py-3 font-bold text-slate-300 bg-slate-900 sticky left-0 z-20 border-r border-slate-800 align-middle leading-snug" style="min-width: 250px; width: 250px; max-width: 250px;">
                        <div class="flex items-center justify-between">
                            <span class="break-words truncate whitespace-normal">${exactKey}</span>
                            ${tooltipHtml}
                        </div>
                    </td>`;
                // -----------------------

                selectedShoesForCompare.forEach(s => {
                    let val = (s[exactKey] !== null && s[exactKey] !== undefined && s[exactKey] !== '') ? s[exactKey] : '-';
                    let cssClass = '';
                    
                    if (val !== '-') {
                        let numVal = parseFloat(val);
                        if (!isNaN(numVal)) {
                            if (numVal === rowMax && rowMax !== null) cssClass = 'text-[#10b981] font-extrabold bg-[#10b981]/10';
                            else if (numVal === rowMin && rowMin !== null) cssClass = 'text-[#3b82f6] font-extrabold bg-[#3b82f6]/10';
                        }
                    }
                    
                    rowHtml += `<td class="px-4 py-3 text-center border-l border-slate-700/50 ${cssClass}">${val}</td>`;
                });
                
                let catAvgVal = '-';
                let cVals = catData.map(d => parseFloat(d[exactKey])).filter(v => !isNaN(v));
                if (cVals.length > 0) {
                    catAvgVal = (cVals.reduce((a,b)=>a+b,0)/cVals.length).toFixed(1);
                }
                rowHtml += `<td class="px-4 py-3 text-center border-l border-slate-700/50 text-slate-500 font-bold bg-slate-900/50">${catAvgVal}</td>`;
                
                rowHtml += `</tr>`;
                catRowsHtml += rowHtml;
            }
        });

        if (catRowsHtml !== '') {
            let totalCols = selectedShoesForCompare.length + 2;
            bodyHtml += `<tr class="bg-slate-800/80"><td colspan="${totalCols}" class="px-4 py-3 text-xs font-black uppercase tracking-widest text-blue-400 border-y border-slate-700">${catName}</td></tr>`;
            bodyHtml += catRowsHtml;
        }
    }
    
    tbody.innerHTML = bodyHtml;
}

// Exports
document.getElementById('exportBtn').addEventListener('click', function() {
    const canvas = document.getElementById('mainChart');
    const url = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = 'RunRepeat_Chart_Export.png';
    link.href = url;
    link.click();
});

document.getElementById('exportExcelBtn').addEventListener('click', function() {
    if (selectedShoesForCompare.length === 0) return;
    
    let aoa = [];
    let headers = ["Metric"];
    selectedShoesForCompare.forEach(s => headers.push(getSafeVal(s, 'Brand', 'brand') + " " + getSafeVal(s, 'Model', 'model')));
    let compCats = [...new Set(selectedShoesForCompare.map(s => getSafeVal(s, 'Category', 'category')))];
    headers.push(compCats.join(" & ") + " Avg");
    aoa.push(headers);
    
    Object.keys(metricCategories).forEach(catName => {
        let catKeys = metricCategories[catName];
        let subheader = [catName.toUpperCase()];
        for(let i=0; i<headers.length-1; i++) subheader.push("");
        aoa.push(subheader);
        
        catKeys.forEach(key => {
            let hasData = false;
            let rowData = [key];
            
            selectedShoesForCompare.forEach(shoe => {
                let val = shoe[key] !== null ? shoe[key] : '-';
                if (val !== '-') hasData = true;
                rowData.push(val);
            });
            
            if (hasData) {
                let catData = rawData.filter(d => compCats.includes(getSafeVal(d, 'Category', 'category')));
                let catAvgVal = '-';
                let cVals = catData.map(d => parseFloat(d[key])).filter(v => !isNaN(v));
                if (cVals.length > 0) {
                    catAvgVal = (cVals.reduce((a,b)=>a+b,0)/cVals.length).toFixed(1);
                }
                rowData.push(catAvgVal);
                aoa.push(rowData);
            }
        });
    });
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch: 35}];
    for (let i = 0; i < selectedShoesForCompare.length + 1; i++) {
        ws['!cols'].push({wch: 20});
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, "RunRepeat_Comparison.xlsx");
});

document.getElementById('xMetric').addEventListener('change', updateCharts);
document.getElementById('yMetric').addEventListener('change', updateCharts);

// ==========================================
// INIT, FOOTER & LIVE RADAR LOGIC
// ==========================================

let dashboardLatestDate = new Date(0);

function calculateLastUpdated() {
    rawData.forEach(d => {
        let dateStr = d['Date'] || d['Report Date'];
        if (dateStr && dateStr !== 'N/A') {
            let dateObj = new Date(dateStr);
            if (!isNaN(dateObj) && dateObj > dashboardLatestDate && dateObj.getFullYear() > 2000) {
                dashboardLatestDate = dateObj;
            }
        }
    });

    setTimeout(() => {
        const dateSpan = document.getElementById('lastUpdatedDate');
        if (dateSpan) {
            if (dashboardLatestDate.getFullYear() > 2000) {
                dateSpan.textContent = dashboardLatestDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                dateSpan.textContent = "Current"; 
            }
        }
    }, 200);
}

// Helper to update the timestamp UI
function updateSyncBadge(timestamp) {
    const badge = document.getElementById('radarSyncBadge');
    if (!badge) return;
    if (timestamp) {
        const d = new Date(parseInt(timestamp));
        badge.innerHTML = `⏳ Last Synced: <span class="text-white">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
    } else {
        badge.innerHTML = `⚠️ Never Synced`;
    }
}

// Runs automatically when you click the Live Radar tab
function loadPipelineData() { 
    const savedText = localStorage.getItem('savedRunRepeatRadar');
    const savedTime = localStorage.getItem('savedRadarTime');
    
    updateSyncBadge(savedTime); // Show the saved time immediately
    
    if (savedText) {
        document.getElementById('pipelinePasteBox').value = savedText;
        processPastedPipeline(true); // Load quietly
    }
}

function processPastedPipeline(isAutoLoad = false) {
    const text = document.getElementById('pipelinePasteBox').value;
    const contentDiv = document.getElementById('pipelineContent');

    if (!text.trim()) {
        contentDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-amber-500 mt-4 bg-amber-900/20 p-4 rounded border border-amber-800">⚠️ Please paste the text from RunRepeat first!</div>`;
        return;
    }

    // --- SAVE DATA AND TIMESTAMP TO BROWSER ---
    if (!isAutoLoad) {
        const now = new Date().getTime();
        localStorage.setItem('savedRunRepeatRadar', text);
        localStorage.setItem('savedRadarTime', now);
        updateSyncBadge(now); // Update badge instantly when scanned
    }

    // Break the pasted text into clean lines
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let testingLines = [];
    let publishedLines = [];
    let currentSection = null;

    for (let line of lines) {
        let lowerLine = line.toLowerCase();

        if (lowerLine.includes('testing in progress:')) {
            currentSection = 'testing';
            continue;
        } else if (lowerLine.includes('recently published:')) {
            currentSection = 'published';
            continue;
        } else if (lowerLine.includes('purchased:') || lowerLine.includes('receive a monthly email') || lowerLine.includes('suggest a shoe') || lowerLine.includes('how we decide')) {
            currentSection = 'ignore';
            continue;
        }

        if (currentSection === 'ignore' || currentSection === null) continue;

        if (lowerLine === 'see more' || lowerLine === 'submit' || lowerLine === 'subscribe') continue;
        if (lowerLine.includes('english') || lowerLine.includes('español') || lowerLine.includes('copyright') || lowerLine.includes('sitemap')) continue;
        if (lowerLine.includes('shoe name') && lowerLine.includes('category')) continue;

        line = line.replace(/\t+/g, ' | ');

        if (currentSection === 'testing') testingLines.push(line);
        if (currentSection === 'published') publishedLines.push(line);
    }

    function buildCard(title, items, borderColor, icon, bgGradient, isPublishedList) {
        let validItems = [];
        
        if (isPublishedList) {
            items.forEach(line => {
                const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},?\s\d{4}/i);
                if (dateMatch) {
                    let pubDate = new Date(dateMatch[0]);
                    if (!isNaN(pubDate) && dashboardLatestDate && pubDate > dashboardLatestDate) {
                        validItems.push(line);
                    }
                }
            });
        } else {
            validItems = items; 
        }

        if (validItems.length === 0) {
            if (isPublishedList) {
                return `
                <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col h-full opacity-80">
                    <div class="bg-gradient-to-r from-emerald-900/40 to-slate-900 p-4 border-b border-slate-700">
                        <h3 class="font-black text-white text-lg flex items-center shadow-sm">✅ Missing Report in the database</h3>
                    </div>
                    <div class="p-8 flex-1 flex flex-col items-center justify-center text-center">
                        <span class="text-5xl mb-4 drop-shadow-md">🎉</span>
                        <h4 class="text-white font-black text-xl mb-2 tracking-wide">Database Up to Date!</h4>
                        <p class="text-slate-400 text-sm font-medium">You have all the latest published shoes downloaded in your dashboard.</p>
                    </div>
                </div>`;
            }
            return ''; 
        }

        let html = `
        <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
            <div class="${bgGradient} p-4 border-b border-slate-700">
                <h3 class="font-black text-white text-lg flex items-center shadow-sm">${icon} ${title}</h3>
            </div>
            <div class="p-4 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <ul class="space-y-3">`;

        validItems.forEach(line => {
            let parts = line.split('|').map(p => p.trim());
            let shoeName = `<span class="font-bold text-slate-200">${parts[0]}</span>`;
            let extraInfo = parts.length > 1 ? parts.slice(1).join(' | ') : '';
            let extraHtml = extraInfo ? `<span class="text-xs text-slate-400 block mt-1">${extraInfo}</span>` : '';
            
            let badgeHtml = isPublishedList ? `<span class="mt-2 text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)] whitespace-nowrap self-start inline-block">Missing Data</span>` : '';
            
            let itemClass = isPublishedList
                ? `bg-rose-950/20 p-3 rounded-lg border border-rose-900/50 border-l-4 border-l-rose-500 hover:bg-rose-900/40 transition-colors flex flex-col`
                : `bg-slate-800 p-3 rounded-lg border border-slate-700 border-l-4 ${borderColor} hover:bg-slate-700 transition-colors flex flex-col`;

            html += `<li class="${itemClass}">
                <div>${shoeName}${extraHtml}</div>
                ${badgeHtml}
            </li>`;
        });

        html += `</ul></div></div>`;
        return html;
    }

    let testingHtml = buildCard('Testing in progress', testingLines, 'border-l-amber-500', '🧪', 'bg-gradient-to-r from-amber-900/40 to-slate-900', false);
    let publishedHtml = buildCard('Missing Reports in the database', publishedLines, 'border-l-rose-500', '🚨', 'bg-gradient-to-r from-rose-900/40 to-slate-900', true);

    if (!testingHtml && !publishedHtml) {
        contentDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-amber-500 mt-4 bg-amber-900/20 p-4 rounded border border-amber-800">⚠️ Could not find the shoe data. Make sure you pressed <b>Ctrl+A</b> on the RunRepeat website to copy everything!</div>`;
        return;
    }

    contentDiv.innerHTML = testingHtml + publishedHtml;
    
    document.getElementById('pipelinePasteBox').value = ''; 
    if (!isAutoLoad) {
        document.getElementById('pipelinePasteBox').placeholder = '✅ Radar synced and saved to your browser! You can safely refresh the page.';
    } else {
        document.getElementById('pipelinePasteBox').placeholder = '💾 Loaded from browser memory. Paste new text here to update.';
    }
}

// Ensure the dashboard boots up correctly!
populateCompAddFilters();
updateCharts();
calculateLastUpdated();