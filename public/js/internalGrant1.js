// ==========================================================
// === INTERNAL GRANTS - CLIENT-SIDE SCRIPT (CORRECTED & INTEGRATED)
// ==========================================================

// ==========================================================
// --- 1. GLOBAL STATE & DYNAMIC ROW TEMPLATES
// ==========================================================

let allGrants = []; // Will hold the full list of grants from the API
let currentPage = 1;
const rowsPerPage = 6;
let activeFilters = {}; // You can change this number

const piRowTemplate = `
<div class="pi-entry group grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <input type="hidden" name="piId[]" value="">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">PI Name</label><input type="text" name="piName[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">PI Contact</label><input type="text" name="piContact[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-3"><label class="block text-sm font-medium text-gray-700 mb-1">Upload Document(s)</label><input type="file" name="pi_uploader[]" multiple class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"><div class="mt-2"><p class="text-sm font-medium text-gray-700">Existing File(s):</p><div class="existing-files-container mt-1 space-y-1"><span class="text-sm text-gray-500">None</span></div></div></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const copiRowTemplate = `
<div class="copi-entry group grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Co-PI Name</label><input type="text" name="copiName[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Contact</label><input type="text" name="copiContact[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Institution</label><input type="text" name="copiInstitution[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Document</label><input type="file" name="copi_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const hrRowTemplate = `
<div class="hr-entry group grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" name="hr_name[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Designation</label><input type="text" name="hr_designation[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Stipend</label><input type="number" step="0.01" name="hr_stipend[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-3"><label class="block text-sm font-medium text-gray-700 mb-1">Agreement</label><input type="file" name="hr_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const travelRowTemplate = `
<div class="travel-entry group grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Where (From-To)</label><input type="text" name="travel_where[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" name="travel_start[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" name="travel_end[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Sanctioned</label><input type="number" step="0.01" name="travel_sanctioned[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Utilised</label><input type="number" step="0.01" name="travel_utilised[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-3"><label class="block text-sm font-medium text-gray-700 mb-1">Upload Bill</label><input type="file" name="travel_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const accommodationRowTemplate = `
<div class="acc-entry group grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Where (City)</label><input type="text" name="acc_where[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">No. of Days</label><input type="number" name="acc_days[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Sanctioned</label><input type="number" step="0.01" name="acc_sanctioned[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Utilised</label><input type="number" step="0.01" name="acc_utilised[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Upload Bill</label><input type="file" name="acc_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const stationeryRowTemplate = `
<div class="stat-entry group grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Item/Type</label><input type="text" name="stat_type[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input type="number" name="stat_quantity[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Sanctioned</label><input type="number" step="0.01" name="stat_sanctioned[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Utilised</label><input type="number" step="0.01" name="stat_utilised[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Upload Bill</label><input type="file" name="stat_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

const genericBudgetRowTemplate = (prefix) => `
<div class="${prefix}-entry group grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 border p-4 rounded-md bg-gray-50 relative">
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Item/Type</label><input type="text" name="${prefix}_type[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Sanctioned</label><input type="number" step="0.01" name="${prefix}_sanctioned[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Amount Utilised</label><input type="number" step="0.01" name="${prefix}_utilised[]" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Upload Bill</label><input type="file" name="${prefix}_uploader[]" class="block w-full text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"></div>
    <button type="button" class="remove-item-btn absolute top-2 right-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-times-circle"></i></button>
</div>`;

// ==========================================================
// --- 2. HELPER FUNCTIONS
// ==========================================================

function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(parseFloat(value))) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateString, format = 'YYYY-MM-DD') {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A'; // Return 'N/A' for invalid dates
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// === UPDATED FUNCTION: CALCULATE DURATION IN DAYS ===
function calculateDuration() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const durationInput = document.getElementById('duration');

    const startDateValue = startDateInput.value;
    const endDateValue = endDateInput.value;

    // Only calculate if both dates are valid
    if (startDateValue && endDateValue) {
        const start = new Date(startDateValue);
        const end = new Date(endDateValue);

        // Check if the end date is before the start date
        if (end < start) {
            durationInput.value = ''; // Clear if the date range is invalid
            return;
        }
        
        // Calculate the difference in milliseconds
        const timeDifference = end.getTime() - start.getTime();

        // Convert milliseconds to days (1000ms * 60s * 60min * 24hr)
        const dayDifference = timeDifference / (1000 * 3600 * 24);
        
        // Add 1 to make the day count inclusive (e.g., March 1 to March 2 is 2 days)
        const totalDays = Math.round(dayDifference) + 1;

        durationInput.value = totalDays;
    } else {
        // If one of the dates is cleared, clear the duration as well
        durationInput.value = '';
    }
}

// ... other helper functions like getFriendlyLabel, populateExistingFiles ...
function getFriendlyLabel(key) {
    const labelMap = { 'application_id': 'Application ID', 'internal_grant_number': 'Internal Grant No.', 'project_title': 'Project Title', 'department_name': 'School/Dept', 'project_term': 'Term', 'grant_sanctioned_amount': 'Total Sanctioned', 'proposal_call_month_year': 'Proposal Call', 'project_secured_date': 'Sanctioned Date', 'project_start_date': 'Start Date', 'project_end_date': 'End Date', 'project_duration': 'Duration (Months)', 'application_status': 'Application Status', 'project_status': 'Overall Status', 'name_of_pi': 'PI Name', 'pi_contact_details': 'PI Contact', 'pi_photograph_s3_key': 'PI Documents', 'item_type': 'Item/Type', 'amount_sanctioned': 'Amount Sanctioned', 'amount_utilised': 'Amount Utilised', 'bill_s3_key': 'Bill/Document', 'final_report_document_s3_key': 'Final Report' };
    if (labelMap[key]) return labelMap[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function populateExistingFiles(container, fileData, hiddenInputDataRole) {
    if (!container) return;
    container.innerHTML = '<span class="text-sm text-gray-500">None</span>';
    let fileKeys = [];
    if (Array.isArray(fileData)) { fileKeys = fileData; }
    else if (typeof fileData === 'string' && fileData.trim().startsWith('[')) { try { fileKeys = JSON.parse(fileData); } catch (e) {} }
    else if (typeof fileData === 'string' && fileData.trim() !== '') { fileKeys = [fileData]; }
    if (fileKeys.length > 0 && fileKeys[0]) {
        container.innerHTML = '';
        fileKeys.forEach(key => {
            if (!key) return;
            const fileName = key.split('/').pop();
            const fileElement = document.createElement('div');
            fileElement.className = 'existing-file-item flex justify-between items-center p-1 bg-gray-100 border rounded';
            fileElement.innerHTML = `<span class="text-sm truncate" title="${fileName}">${fileName}</span><button type="button" class="btn-remove-file text-red-500 font-bold text-lg leading-none">&times;</button><input type="hidden" data-role="${hiddenInputDataRole}" value="${key}">`;
            fileElement.querySelector('.btn-remove-file').addEventListener('click', () => fileElement.remove());
            container.appendChild(fileElement);
        });
    }
}

// ==========================================================
// --- 2.1 ADVANCED FILTERING FUNCTIONS
// ==========================================================

function populateFilterModalOptions() {
    // This function must exist because it is called when data is fetched.
    // It is currently empty because the filter options are hardcoded in the HTML.
    // It can be used in the future if you add more dynamic filters.
}

const getCheckedValues = (name) => 
    Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

function applyFilters() {
    // The helper `getCheckedValues` is now defined globally above, so we don't need it inside here.
    activeFilters = {
        projectName: document.getElementById('filterProjectName').value.trim(),
        piName: document.getElementById('filterPiName').value.trim(),
        schools: getCheckedValues('filterSchool'),
        overallStatuses: getCheckedValues('filterOverallStatus'),
        terms: getCheckedValues('filterTerm'),
        applicationStatuses: getCheckedValues('filterApplicationStatus'),
        amountMin: document.getElementById('filterAmountMin').value,
        amountMax: document.getElementById('filterAmountMax').value,
    };
    
    // Clean up empty filters
    Object.keys(activeFilters).forEach(key => {
        if (!activeFilters[key] || (Array.isArray(activeFilters[key]) && !activeFilters[key].length)) {
            delete activeFilters[key];
        }
    });

    document.getElementById('filterModal').style.display = 'none';
    currentPage = 1;
    updateActiveFilterPills();
    displayCurrentPage();
}

function clearFilters() {
    activeFilters = {};
    document.getElementById('filterForm').reset();
    updateActiveFilterPills();
    currentPage = 1;
    displayCurrentPage();
}

function removeFilter(key, value = null) {
    // --- THIS IS THE CORRECTED LOGIC FOR REMOVING FILTERS ---
    const nameMap = {
        schools: 'filterSchool',
        overallStatuses: 'filterOverallStatus',
        terms: 'filterTerm',
        applicationStatuses: 'filterApplicationStatus'
    };

    if (nameMap[key]) {
        // This correctly finds and unchecks the specific checkbox
        const checkbox = document.querySelector(`input[name="${nameMap[key]}"][value="${value}"]`);
        if (checkbox) checkbox.checked = false;
    } else {
        // This handles simple text inputs
        const inputId = `filter${key.charAt(0).toUpperCase() + key.slice(1)}`;
        const inputElement = document.getElementById(inputId);
        if(inputElement) inputElement.value = '';
    }
    // --- END OF CORRECTED LOGIC ---

    if (Array.isArray(activeFilters[key])) {
        activeFilters[key] = activeFilters[key].filter(item => item !== value);
        if (activeFilters[key].length === 0) {
            delete activeFilters[key];
        }
    } else {
        delete activeFilters[key];
    }
    
    updateActiveFilterPills();
    currentPage = 1;
    displayCurrentPage();
}


function updateActiveFilterPills() {
    const container = document.getElementById('activeFiltersContainer');
    container.innerHTML = '';
    
    Object.entries(activeFilters).forEach(([key, values]) => {
        const createPill = (label, value) => {
            const pill = document.createElement('div');
            pill.className = 'filter-pill';
            pill.innerHTML = `<span>${label}: <strong>${value}</strong></span>`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'filter-pill-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => removeFilter(key, value);
            pill.appendChild(removeBtn);
            container.appendChild(pill);
        };

        if (Array.isArray(values)) {
            values.forEach(value => createPill(key.replace(/s$/, ''), value));
        } else if (key === 'amountMin' || key === 'amountMax') {
            // Handle range separately
            if(activeFilters.amountMin && activeFilters.amountMax) {
                 if(key === 'amountMin') createPill('Amount', `₹${activeFilters.amountMin} - ₹${activeFilters.amountMax}`);
            } else if (activeFilters.amountMin) {
                 if(key === 'amountMin') createPill('Amount', `> ₹${activeFilters.amountMin}`);
            } else if (activeFilters.amountMax) {
                 if(key === 'amountMax') createPill('Amount', `< ₹${activeFilters.amountMax}`);
            }
        } else {
            createPill(key, values);
        }
    });
}
// ==========================================================
// --- 3. DASHBOARD & VIEW DETAILS FUNCTIONS
// ==========================================================

// ... All your dashboard functions (generateDashboardHtml, initializeDashboardComponents, etc.) are correct and can remain here ...
function generateDashboardHtml(grant) {
    const dates = grant.datesStatus || {}; 
    const grantInfo = grant.grantInfo || {};
    const staff = grant.projectStaff || [];

    // --- NEW & CORRECTED UTILIZATION CALCULATION ---
    
    // 1. Calculate sum of all budget items that have an 'amount_utilised' field
    const budgetKeys = ['fieldworkBudget', 'travelBudget', 'accommodationBudget', 'stationeryBudget', 'disseminationBudget', 'miscBudget'];
    const budgetUtilized = budgetKeys.reduce((total, key) => {
        const sectionTotal = (grant[key] || []).reduce((sum, item) => sum + (parseFloat(item.amount_utilised) || 0), 0);
        return total + sectionTotal;
    }, 0);

    // 2. Calculate sum of all staff stipends
    const staffStipendsUtilized = staff.reduce((sum, staffMember) => sum + (parseFloat(staffMember.staff_stipend_rate) || 0), 0);
    
    // 3. Add them together for the final total
    const totalUtilized = budgetUtilized + staffStipendsUtilized;
    // --- END OF NEW CALCULATION ---

    const endDate = dates.project_end_date ? new Date(dates.project_end_date) : null;
    let daysRemaining = 'N/A';
    if(endDate && dates.project_status === "Ongoing") { 
        const today = new Date(); 
        today.setHours(0,0,0,0); 
        const diffTime = endDate.getTime() - today.getTime(); 
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        daysRemaining = diffDays >= 0 ? `${diffDays} days` : 'Past Due'; 
    }
    
    return `<div class="dashboard-container"><div class="dashboard-header"><h3><i class="fas fa-building-columns"></i> ${grant.projectInfo?.project_title || 'N/A'}</h3><div class="header-meta"><span><strong>PI(s):</strong> ${grant.principalInvestigators?.map(p => p.name_of_pi).join(', ') || 'N/A'}</span></div></div><div class="kpi-grid"><div class="kpi-card"><div class="kpi-icon bg-blue-100"><i class="fas fa-coins"></i></div><div class="kpi-content"><div class="kpi-title">Total Sanctioned</div><div class="kpi-value">${formatCurrency(grantInfo.grant_sanctioned_amount)}</div></div></div><div class="kpi-card"><div class="kpi-icon bg-green-100"><i class="fas fa-wallet"></i></div><div class="kpi-content"><div class="kpi-title">Total Utilized</div><div class="kpi-value">${formatCurrency(totalUtilized)}</div></div></div><div class="kpi-card"><div class="kpi-icon bg-amber-100"><i class="fas fa-users"></i></div><div class="kpi-content"><div class="kpi-title">Project Staff</div><div class="kpi-value">${staff.length}</div></div></div><div class="kpi-card"><div class="kpi-icon bg-red-100"><i class="fas fa-hourglass-half"></i></div><div class="kpi-content"><div class="kpi-title">Time Remaining</div><div class="kpi-value">${daysRemaining}</div></div></div></div><div class="dashboard-grid"><div class="chart-wrapper full-width"><h4>Budget Allocation vs. Expenditure</h4><canvas id="internalBudgetBarChart"></canvas></div><div class="chart-wrapper"><h4>Upcoming Deadlines</h4><div id="internalTaskListContainer"></div></div><div class="chart-wrapper"><h4>Assigned Equipment</h4><div id="internalEquipmentContainer"></div></div></div></div>`;
}
function initializeDashboardComponents(grant) {
    const budgetCtx = document.getElementById("internalBudgetBarChart"); if (budgetCtx) { const budgetData = [ { label: 'Field Work', sanctioned: grant.fieldworkBudget, utilised: grant.fieldworkBudget }, { label: 'Travel', sanctioned: grant.travelBudget, utilised: grant.travelBudget }, { label: 'Accommodation', sanctioned: grant.accommodationBudget, utilised: grant.accommodationBudget }, { label: 'Instruments', sanctioned: grant.instruments, utilised: grant.instruments }, { label: 'Stationery', sanctioned: grant.stationeryBudget, utilised: grant.stationeryBudget }, { label: 'Dissemination', sanctioned: grant.disseminationBudget, utilised: grant.disseminationBudget }, { label: 'Misc.', sanctioned: grant.miscBudget, utilised: grant.miscBudget } ]; const labels = budgetData.map(d => d.label); const sanctionedData = budgetData.map(d => (d.sanctioned || []).reduce((sum, item) => sum + (parseFloat(item.amount_sanctioned) || 0), 0)); const utilisedData = budgetData.map(d => (d.utilised || []).reduce((sum, item) => sum + (parseFloat(item.amount_utilised) || 0), 0)); new Chart(budgetCtx, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Allocated (INR)', data: sanctionedData, backgroundColor: 'rgba(59, 130, 246, 0.6)' }, { label: 'Spent (INR)', data: utilisedData, backgroundColor: 'rgba(239, 68, 68, 0.6)' } ] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } } }, plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } } } }); }
    const taskListContainer = document.getElementById('internalTaskListContainer'); if (taskListContainer && grant.projectDeliverables && grant.projectDeliverables.length > 0) { let html = '<ul class="task-list">'; const deadline = grant.projectDeliverables[0].deliverable_due_date; const description = grant.projectDeliverables[0].deliverable_type || "Final Report/Publication"; if(deadline) { const dueDate = new Date(deadline); html += `<li class="task-list-item"><div class="task-date"><span>${dueDate.getDate()}</span><small>${dueDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</small></div><div class="task-desc">${description}</div></li>`; } html += '</ul>'; taskListContainer.innerHTML = html; } else if (taskListContainer) { taskListContainer.innerHTML = '<p class="text-center text-gray-500 pt-8">No specific deadlines recorded.</p>'; }
    const equipmentContainer = document.getElementById('internalEquipmentContainer'); if (equipmentContainer) { const allEquipment = [ ...(grant.instruments || []).map(e => ({ ...e, source: 'Manual' })), ...(grant.assignedInventory || []).map(e => ({ ...e, source: 'Inventory' })) ]; if (allEquipment.length > 0) { let html = '<div class="equipment-list">'; allEquipment.forEach(item => { html += `<div class="equipment-list-item"><span class="icon"><i class="fas ${item.source === 'Inventory' ? 'fa-warehouse' : 'fa-shopping-cart'}"></i></span><div class="details"><div class="name">${item.item_type || item.item}</div><div class="meta">Source: ${item.source} ${item.tag_no ? `| Tag: ${item.tag_no}` : ''}</div></div></div>`; }); html += '</div>'; equipmentContainer.innerHTML = html; } else { equipmentContainer.innerHTML = '<p class="text-center text-gray-500 pt-8">No equipment assigned.</p>'; } }
}
function generateFullDetailsHtml(grant) { function renderSection(title, dataObject, sectionNumber, iconClass) { if (!dataObject || Object.keys(dataObject).length === 0) return ''; const contentHtml = Object.entries(dataObject).map(([key, value]) => `<div class="detail-item"><strong>${getFriendlyLabel(key)}</strong><span>${value || 'N/A'}</span></div>`).join(''); return `<div class="details-accordion-section"><div class="details-accordion-header"><i class="fas ${iconClass} mr-3 text-gray-500"></i> ${sectionNumber}. ${title}</div><div class="details-accordion-content grid lg:grid-cols-2 gap-x-8">${contentHtml}</div></div>`; } function renderArraySection(title, dataArray, sectionNumber, iconClass) { let contentHtml; if (!dataArray || dataArray.length === 0) { contentHtml = `<div class="detail-item col-span-full"><span><em class="text-gray-500">No data provided.</em></span></div>`; } else { contentHtml = dataArray.map((item, index) => { const itemDetails = Object.entries(item).filter(([key]) => key !== 'id' && key !== 'application_id').map(([key, value]) => `<div class="detail-item"><strong>${getFriendlyLabel(key)}</strong><span>${value || 'N/A'}</span></div>`).join(''); return `<div class="detail-subsection col-span-full bg-gray-50 p-4 rounded-lg"><h4 class="font-semibold text-gray-700 mb-2 border-b pb-2">Entry #${index + 1}</h4><div class="grid lg:grid-cols-2 gap-x-8">${itemDetails}</div></div>`; }).join(''); } return `<div class="details-accordion-section"><div class="details-accordion-header"><i class="fas ${iconClass} mr-3 text-gray-500"></i> ${sectionNumber}. ${title}</div><div class="details-accordion-content grid lg:grid-cols-1 gap-y-4">${contentHtml}</div></div>`; } const combinedProjectInfo = { ...grant.projectInfo, ...grant.datesStatus, ...grant.grantInfo }; return `${renderSection("Project & Grant Information", combinedProjectInfo, 1, 'fa-info-circle')} ${renderArraySection("Principal Investigators", grant.principalInvestigators, 3, 'fa-user-tie')} ${renderArraySection("Co-Investigators", grant.coInvestigators, 4, 'fa-user-friends')} ${renderArraySection("Human Resources", grant.projectStaff, 5, 'fa-users-cog')} ${renderArraySection("Field Work Budget", grant.fieldworkBudget, 6, 'fa-map-marked-alt')} ${renderArraySection("Travel Budget", grant.travelBudget, 7, 'fa-plane')} ${renderArraySection("Accommodation Budget", grant.accommodationBudget, 8, 'fa-hotel')} ${renderArraySection("Instruments/Resources", [...(grant.instruments || []), ...(grant.assignedInventory || [])], 9, 'fa-tools')} ${renderArraySection("Stationery & Printing Budget", grant.stationeryBudget, 10, 'fa-print')} ${renderArraySection("Dissemination Budget", grant.disseminationBudget, 11, 'fa-bullhorn')} ${renderArraySection("Miscellaneous Budget", grant.miscBudget, 12, 'fa-receipt')} ${renderArraySection("Project Outcomes", grant.projectDeliverables, 13, 'fa-tasks')}`; }
function generateTabbedModalHtml(grant) { return `<div class="modal-tabs"><button class="modal-tab-button active" data-tab="dashboard">Summary</button><button class="modal-tab-button" data-tab="details">All Details</button></div><div id="tab-dashboard" class="tab-content active" style="padding: 0 !important;">${generateDashboardHtml(grant)}</div><div id="tab-details" class="tab-content">${generateFullDetailsHtml(grant)}</div>`; }
function initializeModalTabs() { const tabButtons = document.querySelectorAll('.modal-tab-button'); const tabContents = document.querySelectorAll('.tab-content'); tabButtons.forEach(button => { button.addEventListener('click', () => { tabButtons.forEach(btn => btn.classList.remove('active')); tabContents.forEach(content => content.classList.remove('active')); button.classList.add('active'); document.getElementById(`tab-${button.dataset.tab}`).classList.add('active'); }); }); }

// ==========================================================
// --- 4. CORE APPLICATION LOGIC (CRUD, Form Handling)
// ==========================================================

async function fetchAndDisplayGrants() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Loading grants...</td></tr>';
    try {
        // === FIX: RESTORED HEADERS FOR AUTHENTICATION ===
        const response = await fetch('/api/internal-grants', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        
        const grants = await response.json();
        allGrants = grants;
        
        populateStatCards(allGrants);
        populateFilterModalOptions();
        
        currentPage = 1;
        displayCurrentPage();
        
    } catch (error) {
        console.error("Failed to fetch grants:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-600">Error loading grants.</td></tr>`;
    }
}

function populateStatCards(grants) {
    const activeGrants = grants.filter(g => g.overallStatus === 'Ongoing').length;
    const totalFunding = grants.reduce((sum, g) => sum + (parseFloat(g.grant_sanctioned_amount) || 0), 0);
    const uniqueSchools = new Set(grants.map(g => g.department_name)).size;
    const uniqueFaculties = new Set(grants.map(g => g.pi_names)).size;

    document.getElementById('statActiveGrants').textContent = activeGrants;
    document.getElementById('statTotalFunding').textContent = formatCurrency(totalFunding); 
    document.getElementById('statTotalSchools').textContent = uniqueSchools;
    document.getElementById('statTotalFaculties').textContent = uniqueFaculties;
}


// === FIX: ADDED MISSING PAGINATION & DISPLAY FUNCTIONS ===

function populateTable(grants, startIndex = 0) { // CHANGE 1: Accept the starting index
    const tableBody = document.getElementById('dataTableBody');
    tableBody.innerHTML = '';

    const getStatusBadgeClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'ongoing': return 'status-active';
            case 'accepted': return 'status-approved';
            case 'completed': return 'status-completed';
            case 'delayed': return 'status-review';
            case 'rejected': case 'terminated': return 'status-rejected';
            default: return 'status-completed';
        }
    };

    grants.forEach((grant, index) => { // CHANGE 2: Get the loop index
        const row = tableBody.insertRow();
       row.innerHTML = `
    <td>${startIndex + index + 1}</td> 
    <td>${grant.application_id || 'N/A'}</td>
    <td>${grant.project_title || 'N/A'}</td>
    <td>${grant.pi_names || 'N/A'}</td>
    <!-- The Submission Date td has been removed from here -->
    <td><span class="status-badge ${getStatusBadgeClass(grant.overallStatus)}">${grant.overallStatus || 'N/A'}</span></td>
    <td class="action-buttons">
        <button class="action-btn view-btn" data-id="${grant.application_id}" title="View Details"><i class="fa-solid fa-eye"></i></button>
        <button class="action-btn edit-btn" data-id="${grant.application_id}" title="Edit Grant"><i class="fa-solid fa-pencil"></i></button>
        <button class="action-btn delete-btn" data-id="${grant.application_id}" title="Delete Grant"><i class="fa-solid fa-trash-can"></i></button>
    </td>
`;
    });
}

function displayCurrentPage() {
    // The global search input still works on top of the filters
    const searchFilter = document.getElementById('globalSearchInput').value.toLowerCase();

    let filteredGrants = allGrants;

    // --- NEW: Apply advanced filters from the activeFilters object ---
    if (Object.keys(activeFilters).length > 0) {
        filteredGrants = allGrants.filter(grant => {
            return Object.entries(activeFilters).every(([key, value]) => {
                if (key === 'projectName') {
                    return grant.project_title?.toLowerCase().includes(value.toLowerCase());
                }
                if (key === 'piName') {
                    return grant.pi_names?.toLowerCase().includes(value.toLowerCase());
                }
                if (key === 'schools') {
                    return value.includes(grant.department_name);
                }
                if (key === 'overallStatuses') {
                    return value.includes(grant.overallStatus);
                }
                // Add similar checks for 'terms' and 'applicationStatuses' if you enable them
                if (key === 'amountMin') {
                    return !value || (parseFloat(grant.grant_sanctioned_amount) >= parseFloat(value));
                }
                if (key === 'amountMax') {
                    return !value || (parseFloat(grant.grant_sanctioned_amount) <= parseFloat(value));
                }
                return true; // Default to true for unhandled keys
            });
        });
    }

    // Apply the global search on top of the already filtered list
    if (searchFilter) {
        filteredGrants = filteredGrants.filter(g => 
            (g.application_id && g.application_id.toLowerCase().includes(searchFilter)) ||
            (g.project_title && g.project_title.toLowerCase().includes(searchFilter)) ||
            (g.pi_names && g.pi_names.toLowerCase().includes(searchFilter))
        );
    }

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = filteredGrants.slice(start, end);

    populateTable(paginatedItems, start);
    setupPagination(filteredGrants.length);
    updatePaginationInfo(filteredGrants.length, start);
}
    
function setupPagination(totalItems) {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList) return;
    paginationList.innerHTML = '';

    const pageCount = Math.ceil(totalItems / rowsPerPage);
    // If there's only one page or no pages, don't show pagination
    if (pageCount <= 1) {
        return;
    }

    const siblingCount = 1; // How many pages to show on each side of the current page

    // --- Helper function to create a page link ---
    const createPageLink = (pageNumber) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.innerText = pageNumber;
        link.classList.add('pagination-link');
        if (pageNumber === currentPage) {
            link.classList.add('active');
        }
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = pageNumber;
            displayCurrentPage();
        });
        li.appendChild(link);
        return li;
    };

    // --- Helper function to create an ellipsis ---
    const createEllipsis = () => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.innerText = '...';
        span.classList.add('pagination-ellipsis');
        li.appendChild(span);
        return li;
    };

    // --- Main Pagination Logic ---
    let lastPageAdded = 0;
    for (let i = 1; i <= pageCount; i++) {
        const isFirstPage = i === 1;
        const isLastPage = i === pageCount;
        // Determine if the current loop iteration 'i' is within the sibling range of the current page
        const isInSiblingRange = Math.abs(i - currentPage) <= siblingCount;

        // We show a page number if it's the first, the last, or within the sibling range
        if (isFirstPage || isLastPage || isInSiblingRange) {
            // If there's a gap between the last number we added and the current one, insert an ellipsis
            if (i > lastPageAdded + 1) {
                paginationList.appendChild(createEllipsis());
            }

            // Add the page number link itself
            paginationList.appendChild(createPageLink(i));
            lastPageAdded = i;
        }
    }
}

function updatePaginationInfo(totalItems, start) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (!paginationInfo) return;
    const startItem = totalItems > 0 ? start + 1 : 0;
    const endItem = Math.min(start + rowsPerPage, totalItems);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} results`;
}


// ... other core functions like deleteGrant, showGrantDetailsPopup, showForm etc. are correct and remain here ...
async function deleteGrant(applicationId) { if (!confirm(`Are you sure you want to permanently delete grant #${applicationId}? This action cannot be undone.`)) { return; } try { const response = await fetch(`/api/internal-grants/${applicationId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'The server could not delete the grant.'); alert(result.message); fetchAndDisplayGrants(); } catch (error) { console.error('Failed to delete grant:', error); alert(`Error: ${error.message}`); } }
async function showGrantDetailsPopup(applicationId) { const modal = document.getElementById('viewModal'); const modalContent = modal.querySelector('.modal-content-lg'); const modalBody = document.getElementById('viewDetailsContainer'); if (!modal || !modalBody || !modalContent) return; modalContent.classList.add('modal-content-dashboard'); modalBody.innerHTML = '<p class="text-center p-8">Loading dashboard...</p>'; modal.style.display = 'block'; try { const response = await fetch(`/api/internal-grants/${applicationId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); const grantFullData = await response.json(); if (!response.ok) throw new Error(grantFullData.message || 'Failed to fetch details.'); modalBody.innerHTML = generateTabbedModalHtml(grantFullData); initializeModalTabs(); setTimeout(() => initializeDashboardComponents(grantFullData), 100); } catch (error) { console.error("Error showing grant details:", error); modalBody.innerHTML = `<p class="text-center p-8 text-red-600">Error: ${error.message}</p>`; } }
async function showForm(applicationId = null) { const mainDataView = document.getElementById('mainDataView'); const grantFormContainer = document.getElementById('grantFormContainer'); const formTitle = document.getElementById('formTitle'); const form = document.getElementById('grantForm'); const applicationIdInput = document.getElementById('applicationId'); form.reset(); document.getElementById('pi-container').innerHTML = ''; document.getElementById('copi-container').innerHTML = ''; document.getElementById('hr-container').innerHTML = ''; document.getElementById('fieldwork-container').innerHTML = ''; document.getElementById('travel-container').innerHTML = ''; document.getElementById('accommodation-container').innerHTML = ''; document.getElementById('instruments-container').innerHTML = ''; document.getElementById('stationery-container').innerHTML = ''; document.getElementById('dissemination-container').innerHTML = ''; document.getElementById('misc-container').innerHTML = ''; if (applicationId) { formTitle.textContent = 'Edit Internal Grant'; applicationIdInput.value = applicationId; try { const response = await fetch(`/api/internal-grants/${applicationId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); if (!response.ok) throw new Error('Grant data could not be fetched.'); const grantData = await response.json(); populateAccordionForm(grantData); } catch (error) { console.error('Error fetching grant for edit:', error); alert('Could not load grant data. Please try again.'); return; } } else { formTitle.textContent = 'Add New Internal Grant'; form.elements['applicationNumber'].readOnly = false; applicationIdInput.value = ''; addItemToContainer('pi-container', piRowTemplate); } mainDataView.style.display = 'none'; grantFormContainer.style.display = 'block'; grantFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function populateAccordionForm(data) {
    const form = document.getElementById('grantForm');
    const setVal = (name, value) => {
        const el = form.elements[name];
        if (el) {
            if (el.type === 'date' && value) {
                el.value = new Date(value).toISOString().split('T')[0];
            } else {
                el.value = value || '';
            }
        }
    };
    const p = data.projectInfo || {};
    const ds = data.datesStatus || {};
    const gi = data.grantInfo || {};
    setVal('applicationNumber', p.application_id);
    form.elements['applicationNumber'].readOnly = true;
    setVal('projectName', p.project_title);
    setVal('grantNumber', p.internal_grant_number);
    setVal('school', p.department_name);
    setVal('term', p.project_term);
    setVal('totalSanctioned', gi.grant_sanctioned_amount);
    setVal('proposalCall', ds.proposal_call_month_year);
    setVal('sanctionedDate', ds.project_secured_date);
    setVal('startDate', ds.project_start_date);
    setVal('endDate', ds.project_end_date);
    setVal('duration', ds.project_duration);
    setVal('applicationStatus', ds.application_status);
    setVal('overallStatus', ds.project_status);
    (data.principalInvestigators || []).forEach(pi => {
        const piTemplateWithId = piRowTemplate.replace('<input type="hidden" name="piId[]" value="">', `<input type="hidden" name="piId[]" value="${pi.id || ''}">`);
        addItemToContainer('pi-container', piTemplateWithId, pi);
    });
    (data.coInvestigators || []).forEach(copi => addItemToContainer('copi-container', copiRowTemplate, copi));
    (data.projectStaff || []).forEach(hr => addItemToContainer('hr-container', hrRowTemplate, hr));
    (data.fieldworkBudget || []).forEach(item => addItemToContainer('fieldwork-container', genericBudgetRowTemplate('fw'), item));
    (data.travelBudget || []).forEach(item => addItemToContainer('travel-container', travelRowTemplate, item));
    (data.accommodationBudget || []).forEach(item => addItemToContainer('accommodation-container', accommodationRowTemplate, item));
    (data.stationeryBudget || []).forEach(item => addItemToContainer('stationery-container', stationeryRowTemplate, item));
    const manuallyAddedInstruments = data.instruments || [];
    const assignedInventoryItems = (data.assignedInventory || []).map(item => ({ ...item, isFromInventory: true
    }));
    const allInstruments = [...assignedInventoryItems, ...manuallyAddedInstruments];
    allInstruments.forEach(item => {
        if (item.isFromInventory) {
            const assignedItemHtml = `<div class="group grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 border p-4 rounded-md bg-blue-50 relative"><div class="md:col-span-4"><p class="text-sm font-medium text-gray-700"><i class="fas fa-tag mr-2 text-blue-600"></i><span class="font-bold">Assigned from Inventory</span></p></div><div><strong class="block text-xs text-gray-500">Item</strong><p>${item.item || 'N/A'}</p></div><div><strong class="block text-xs text-gray-500">Make</strong><p>${item.make || 'N/A'}</p></div><div><strong class="block text-xs text-gray-500">Tag No.</strong><p>${item.tag_no || 'N/A'}</p></div><div class="text-right"><button type="button" class="unassign-inventory-btn text-red-600 hover:text-red-800 text-sm font-medium" data-inventory-id="${item.id}"><i class="fas fa-undo-alt mr-1"></i> Unassign</button></div></div>`;
            const container = document.getElementById('instruments-container');
            if (container) container.insertAdjacentHTML('beforeend', assignedItemHtml);
        } else {
            addItemToContainer('instruments-container', genericBudgetRowTemplate('inst'), item);
        }
    });
    (data.disseminationBudget || []).forEach(item => addItemToContainer('dissemination-container', genericBudgetRowTemplate('diss'), item));
    (data.miscBudget || []).forEach(item => addItemToContainer('misc-container', genericBudgetRowTemplate('misc'), item));

    // --- THIS IS THE FIX ---
    // The calculateDuration() call is now on its own line.
    calculateDuration();
}
function addItemToContainer(containerId, template, data = {}) { const container = document.getElementById(containerId); if (!container) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = template; const newItem = tempDiv.firstElementChild; if (containerId === 'pi-container' && data) { newItem.querySelector('input[name="piName[]"]').value = data.name_of_pi || ''; newItem.querySelector('input[name="piContact[]"]').value = data.pi_contact_details || ''; newItem.querySelector('input[name="piId[]"]').value = data.id || ''; const filesContainer = newItem.querySelector('.existing-files-container'); populateExistingFiles(filesContainer, data.pi_photograph_s3_key, 'existing-pi-file'); } const removeButton = newItem.querySelector('.remove-item-btn'); if (removeButton) { removeButton.addEventListener('click', (event) => { const entryToRemove = event.target.closest('.group'); if (entryToRemove) entryToRemove.remove(); }); } container.appendChild(newItem); }
async function handleInternalGrantSubmit(event) { event.preventDefault(); const form = event.target; const submitButton = form.querySelector('button[type="submit"]'); const grantData = { coreInfo: {}, datesStatus: {}, grantInfo: {}, principalInvestigators: [], }; const getVal = (name) => form.elements[name]?.value.trim() || null; grantData.coreInfo.application_id = getVal('applicationNumber'); grantData.coreInfo.project_title = getVal('projectName'); grantData.coreInfo.department_name = getVal('school'); grantData.coreInfo.internal_grant_number = getVal('grantNumber'); grantData.coreInfo.project_term = getVal('term'); grantData.datesStatus.proposal_call_month_year = getVal('proposalCall'); grantData.datesStatus.project_secured_date = getVal('sanctionedDate'); grantData.datesStatus.project_start_date = getVal('startDate'); grantData.datesStatus.project_end_date = getVal('endDate'); grantData.datesStatus.project_duration = getVal('duration'); grantData.datesStatus.application_status = getVal('applicationStatus'); grantData.datesStatus.project_status = getVal('overallStatus'); grantData.grantInfo.grant_sanctioned_amount = getVal('totalSanctioned'); grantData.principalInvestigators = []; document.querySelectorAll('#pi-container .pi-entry').forEach(entry => { const name = entry.querySelector('[name="piName[]"]')?.value.trim(); if (!name) return; const existingFilesToKeep = Array.from(entry.querySelectorAll('input[data-role="existing-pi-file"]')).map(input => input.value); const fileInput = entry.querySelector('input[name="pi_uploader[]"]'); const newFileCount = fileInput ? fileInput.files.length : 0; grantData.principalInvestigators.push({ id: entry.querySelector('[name="piId[]"]')?.value || null, name_of_pi: name, pi_contact_details: entry.querySelector('[name="piContact[]"]')?.value.trim(), pi_photograph_s3_key: existingFilesToKeep, newFileCount: newFileCount, }); }); const formData = new FormData(); formData.append('grantDetails', JSON.stringify(grantData)); document.querySelectorAll('input[name="pi_uploader[]"]').forEach(input => { for (const file of input.files) { formData.append('pi_uploader', file); } }); submitButton.disabled = true; submitButton.textContent = 'Saving...'; const isEditMode = !!document.getElementById('applicationId')?.value; const method = isEditMode ? 'PUT' : 'POST'; const url = isEditMode ? `/api/internal-grants/${getVal('applicationNumber')}` : '/api/internal-grants'; try { const response = await fetch(url, { method: method, headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }, body: formData }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'An unknown server error occurred.'); alert(result.message); hideForm(); fetchAndDisplayGrants(); } catch (error) { console.error("Submission Error:", error); alert("Error: " + error.message); } finally { submitButton.disabled = false; submitButton.textContent = 'Save Grant'; } }
function hideForm() { document.getElementById('grantFormContainer').style.display = 'none'; document.getElementById('mainDataView').style.display = 'block';document.querySelector('.main-content').classList.remove('form-active'); }
function logout() { localStorage.removeItem('accessToken'); localStorage.removeItem('username'); window.location.href = '/'; }

// ==========================================================
// --- 5. INVENTORY INTEGRATION LOGIC
// ==========================================================

// ... All your inventory functions (openAssignInventoryModal, etc.) are correct and can remain here ...
const assignInventoryModal = document.getElementById('assignInventoryModal'); const assignInventoryBtn = document.getElementById('assignInventoryBtn'); const closeAssignModalBtn = document.getElementById('closeAssignModalBtn'); const cancelAssignBtn = document.getElementById('cancelAssignBtn'); const confirmAssignBtn = document.getElementById('confirmAssignBtn'); const inventoryDropdown = document.getElementById('inventoryDropdown'); const piDropdownContainer = document.getElementById('piDropdownContainer'); const piDropdown = document.getElementById('piDropdown');
function getPIsFromInternalForm() { const pis = []; document.querySelectorAll('#pi-container .pi-entry').forEach(entry => { const name = entry.querySelector('input[name="piName[]"]')?.value; const id = entry.querySelector('input[name="piId[]"]')?.value; if (name && id) pis.push({ id, name }); }); return pis; }
async function openAssignInventoryModal() { if (!document.getElementById('applicationNumber').value) { alert("Please save the grant with a valid Application Number before assigning inventory."); return; } piDropdownContainer.style.display = 'none'; inventoryDropdown.innerHTML = '<option value="">Loading...</option>'; if(assignInventoryModal) assignInventoryModal.style.display = 'block'; try { const response = await fetch('/api/inventory/available', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); if (!response.ok) throw new Error('Could not fetch available inventory.'); const assets = await response.json(); if (assets.length === 0) { inventoryDropdown.innerHTML = '<option value="">No assets are currently in stock.</option>'; return; } inventoryDropdown.innerHTML = '<option value="">-- Select an asset --</option>'; assets.forEach(asset => inventoryDropdown.innerHTML += `<option value="${asset.id}">${asset.item} (${asset.tag_no})</option>`); } catch (error) { inventoryDropdown.innerHTML = `<option value="">Error loading assets</option>`; console.error(error); } }
inventoryDropdown?.addEventListener('change', () => { const pis = getPIsFromInternalForm(); piDropdown.innerHTML = ''; if (inventoryDropdown.value && pis.length > 0) { pis.forEach(pi => piDropdown.innerHTML += `<option value="${pi.id}">${pi.name}</option>`); piDropdownContainer.style.display = 'block'; } else { piDropdownContainer.style.display = 'none'; } });
async function handleConfirmAssignment() { const assetId = inventoryDropdown.value; const piId = piDropdown.value; const applicationNumber = document.getElementById('applicationNumber').value; const projectName = document.getElementById('projectName').value; const piName = piDropdown.options[piDropdown.selectedIndex]?.text; if (!assetId || !piId) { return alert('Please select both an asset and a PI.'); } confirmAssignBtn.disabled = true; confirmAssignBtn.textContent = 'Assigning...'; try { const response = await fetch(`/api/inventory/assign/${assetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }, body: JSON.stringify({ grant_application_id: applicationNumber, grant_type: 'INTERNAL', pi_id: piId, assigned_to: piName, project_name: projectName, assigned_date: new Date().toISOString().split('T')[0] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); alert(result.message); if(assignInventoryModal) assignInventoryModal.style.display = 'none'; showForm(applicationNumber); } catch (error) { alert(`Error: ${error.message}`); console.error(error); } finally { confirmAssignBtn.disabled = false; confirmAssignBtn.textContent = 'Assign Asset'; } }

// ==========================================================
// --- 6. INITIALIZATION & EVENT LISTENERS
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const addGrantBtn = document.getElementById('addGrantBtn');
    const grantForm = document.getElementById('grantForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const accordionWrapper = document.getElementById('accordion-wrapper');
    const tableBody = document.getElementById('dataTableBody');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const searchInput = document.getElementById('globalSearchInput');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const openFilterBtn = document.getElementById('openFilterModalBtn');
    const filterModal = document.getElementById('filterModal');
    const closeFilterBtn = document.getElementById('closeFilterModalBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    // --- Inventory Modal Element Selectors ---
    const assignInventoryBtn = document.getElementById('assignInventoryBtn');
    const assignInventoryModal = document.getElementById('assignInventoryModal');
    const closeAssignModalBtn = document.getElementById('closeAssignModalBtn');
    const cancelAssignBtn = document.getElementById('cancelAssignBtn');
    const confirmAssignBtn = document.getElementById('confirmAssignBtn');

    // --- Filter Modal Logic (Corrected) ---
    if (openFilterBtn) {
        openFilterBtn.addEventListener('click', () => {
            if (filterModal) filterModal.style.display = 'flex'; // Use 'flex' to enable centering
        });
    }
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener('click', () => {
            if (filterModal) filterModal.style.display = 'none';
        });
    }
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

    if (filterModal) {
        // This allows closing the modal by clicking on the dark background overlay
        filterModal.addEventListener('click', (event) => {
            if (event.target === filterModal) {
                filterModal.style.display = 'none';
            }
        });
    }

    // --- Sidebar Logic ---
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }
    const toggleMobileSidebar = () => document.body.classList.toggle('sidebar-open');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleMobileSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleMobileSidebar);

    // --- Filter and Search Logic ---
    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            currentPage = 1; // Reset to first page on search
            displayCurrentPage();
        });
    }
    // --- Event listeners for automatic duration calculation ---
    if (startDateInput) {
        startDateInput.addEventListener('change', calculateDuration);
    }
    if (endDateInput) {
        endDateInput.addEventListener('change', calculateDuration);
    }
    
    // --- Accordion Logic ---
    if (accordionWrapper) {
        accordionWrapper.addEventListener('click', (event) => {
            const button = event.target.closest('.accordion-button');
            if (!button) return;
            const content = button.nextElementSibling;
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                content.style.display = 'none';
                button.setAttribute('aria-expanded', 'false');
                // Tailwind class manipulation for rotation
                button.querySelector('svg')?.classList.remove('rotate-180');
            } else {
                content.style.display = 'block';
                button.setAttribute('aria-expanded', 'true');
                // Tailwind class manipulation for rotation
                button.querySelector('svg')?.classList.add('rotate-180');
            }
        });
    }

    // --- Form and View Switching ---
    if (addGrantBtn) addGrantBtn.addEventListener('click', () => showForm());
    if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
    if (grantForm) grantForm.addEventListener('submit', handleInternalGrantSubmit);

    // --- Dynamic Row Buttons ---
    document.getElementById('addPiBtn')?.addEventListener('click', () => addItemToContainer('pi-container', piRowTemplate));
    document.getElementById('addCoPiBtn')?.addEventListener('click', () => addItemToContainer('copi-container', copiRowTemplate));
    document.getElementById('addHrBtn')?.addEventListener('click', () => addItemToContainer('hr-container', hrRowTemplate));
    document.getElementById('addFieldworkBtn')?.addEventListener('click', () => addItemToContainer('fieldwork-container', genericBudgetRowTemplate('fw')));
    document.getElementById('addTravelBtn')?.addEventListener('click', () => addItemToContainer('travel-container', travelRowTemplate));
    document.getElementById('addAccommodationBtn')?.addEventListener('click', () => addItemToContainer('accommodation-container', accommodationRowTemplate));
    document.getElementById('addInstrumentBtn')?.addEventListener('click', () => addItemToContainer('instruments-container', genericBudgetRowTemplate('inst')));
    document.getElementById('addStationeryBtn')?.addEventListener('click', () => addItemToContainer('stationery-container', stationeryRowTemplate));
    document.getElementById('addDisseminationBtn')?.addEventListener('click', () => addItemToContainer('dissemination-container', genericBudgetRowTemplate('diss')));
    document.getElementById('addMiscBtn')?.addEventListener('click', () => addItemToContainer('misc-container', genericBudgetRowTemplate('misc')));

    // --- Inventory Modal Buttons ---
    assignInventoryBtn?.addEventListener('click', openAssignInventoryModal);
    closeAssignModalBtn?.addEventListener('click', () => assignInventoryModal.style.display = 'none');
    cancelAssignBtn?.addEventListener('click', () => assignInventoryModal.style.display = 'none');
    confirmAssignBtn?.addEventListener('click', handleConfirmAssignment);

    // --- Table Action Buttons (Event Delegation) ---
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button.action-btn');
            if (!button) return;
            const applicationId = button.dataset.id;
            if (!applicationId) return;

            if (button.classList.contains('delete-btn')) deleteGrant(applicationId);
            else if (button.classList.contains('edit-btn')) showForm(applicationId);
            else if (button.classList.contains('view-btn')) showGrantDetailsPopup(applicationId);
        });
    }
    
    // --- View Modal Close Logic ---
    const viewModal = document.getElementById('viewModal');
    if (viewModal) {
        viewModal.addEventListener('click', (event) => {
            if (event.target === event.currentTarget || event.target.closest('.modal-close-btn, .btn-secondary')) {
                viewModal.style.display = 'none';
                viewModal.querySelector('.modal-content-lg')?.classList.remove('modal-content-dashboard');
            }
        });
    }

    // --- Initial Data Load ---
    fetchAndDisplayGrants();
});