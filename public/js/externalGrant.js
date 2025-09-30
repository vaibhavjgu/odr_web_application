
/**
 * Populates a given <select> element with a comprehensive list of countries.
 * @param {string} selectElementId - The ID of the <select> element to populate.
 */
function populateCountryDropdown(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.warn(`Country dropdown with ID '${selectElementId}' not found.`);
        return;
    }

    // A comprehensive list of countries.
    const countries = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];

    // Clear existing options except the first one (e.g., "Select Country")
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add a default placeholder option
    selectElement.innerHTML = '<option value="">Select Country</option>';

    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        selectElement.appendChild(option);
    });
}
// ========= END: NEW COUNTRY DROPDOWN HELPER =========


document.addEventListener('DOMContentLoaded', () => {
        // --- Configuration ---
        const API_BASE_URL = '/api';


         let allGrants = []; // Will hold the full list of grants from the API
    let currentPage = 1;
    const rowsPerPage = 6;

        // --- Define columns visible in the main table ---
        const VISIBLE_COLUMNS_IN_TABLE = [
            { key: 'application_id', header: 'Application ID' },
            { key: 'project_title', header: 'Project Title' },
            { key: 'pi_names_concatenated', header: 'PI Name(s)' }, // Assuming backend provides this
            { key: 'project_status', header: 'Project Status' },
        ];

        // --- DOM Elements ---
        const tableBody = document.getElementById('data-table-body');
        const addGrantBtn = document.getElementById('addGrantBtn');
        const grantFormContainer = document.getElementById('grantFormContainer');
        const mainDataView = document.getElementById('mainDataView'); // <-- ADD THIS LINE
        const grantForm = document.getElementById('grantForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const formTitle = document.getElementById('formTitle'); // In accordion form
        const mainProjectIdInput = document.getElementById('projectId'); // Hidden input in accordion form for DB ID

        const modal = document.getElementById('grantDetailsModal');
        const modalTitleEl = document.getElementById('modalTitle'); // For view details modal
        const modalBodyContent = document.getElementById('modalBodyContent');

        const FADE_DURATION = 300;

        const filterContainer = document.getElementById("filterContainer");
        const globalSearchInput = document.getElementById("globalSearch");
        const table = document.getElementById("dataTable");
        
        

        const assignInventoryModal = document.getElementById('assignInventoryModal');
        const assignInventoryBtn_S11 = document.getElementById('assignInventoryButton_S11');
        const closeAssignModalBtn = document.getElementById('closeAssignModalBtn');
        const cancelAssignBtn = document.getElementById('cancelAssignBtn');
        const confirmAssignBtn = document.getElementById('confirmAssignBtn');
        const inventoryDropdown = document.getElementById('inventoryDropdown');
        const piDropdownContainer = document.getElementById('piDropdownContainer');
        const piDropdown = document.getElementById('piDropdown');
                    
        const statActiveGrants = document.getElementById('stat-active-grants');
        const statTotalFunding = document.getElementById('stat-total-funding');
        const statTotalPIs = document.getElementById('stat-total-pis');
        const statGrantsCompleted = document.getElementById('stat-grants-completed');
        const openFilterModalBtn = document.getElementById('openFilterModalBtn');
        const advancedFilterModal = document.getElementById('advancedFilterModal');
        const advancedFilterForm = document.getElementById('advancedFilterForm');
        const closeFilterModalBtn = document.getElementById('closeFilterModalBtn');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');





    // --- FILE VALIDATION HELPER ---
    function validateFile(fileInput) {
        const MAX_SIZE_MB = 2;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        const ALLOWED_TYPES = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // for .docx
        ];

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];

            // 1. Check file size
            if (file.size > MAX_SIZE_BYTES) {
                alert(`Error: File "${file.name}" is too large.\nPlease upload a file smaller than ${MAX_SIZE_MB} MB.`);
                fileInput.value = ""; // Clear the invalid file from the input
                return false;
            }

            // 2. Check file type
            if (!ALLOWED_TYPES.includes(file.type)) {
                alert(`Error: File type for "${file.name}" is not supported.\nPlease upload a valid image, PDF, or Word document.`);
                fileInput.value = ""; // Clear the invalid file from the input
                return false;
            }
        }
        return true; // File is valid
    }



    // Helper function to close any open modals
function closeAllModals() {
    document.querySelectorAll('.modal, .modal-overlay').forEach(modal => {
        modal.style.display = "none";
    });
    document.body.classList.remove('modal-open');
}

// Now, modify your existing openModal function to use this helper
function openModal(modalId) {
    closeAllModals(); // <-- ADD THIS LINE AT THE TOP
    
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.style.display = "block"; // or "flex" if you use flexbox for centering
        document.body.classList.add('modal-open');
    }
}
        
    function resetAllFileDisplays() {
    // This selector finds ALL elements whose ID ends with '_display_container'
    const allDisplayContainers = document.querySelectorAll('[id$="_display_container"]');
    
    allDisplayContainers.forEach(container => {
        // We reset its content to the default "None" state.
        container.innerHTML = '<span class="text-sm text-gray-500">None</span>';
    });
}

        function attachFileValidators() {
    // This selector finds all file inputs, whether static or dynamically added later.
    const allFileInputs = document.querySelectorAll('input[type="file"]');
    allFileInputs.forEach(input => {
        // Check if a listener has already been attached to avoid duplicates
        if (!input.dataset.validatorAttached) {
            input.addEventListener('change', () => validateFile(input));
            input.dataset.validatorAttached = 'true'; // Mark as attached
        }
    });
}


        attachFileValidators();

        

        function updateStatCards(grants) {
    if (!Array.isArray(grants)) return;

    // Calculate stats
    const activeGrants = grants.filter(g => g.project_status === 'In Progress' || g.project_status === 'Active').length;
    
    // THE FIX IS HERE: Corrected g.grant_amount_in_r to g.grant_amount_in_inr
const totalFunding = grants.reduce((sum, g) => sum + (parseFloat(g.grant_amount_in_inr) || 0), 0);    
    const completedGrants = grants.filter(g => g.project_status === 'Completed').length;
    
    // This is a simple count of unique PI names.
    const piNames = new Set();
    grants.forEach(g => {
        if (g.pi_names_concatenated) {
            g.pi_names_concatenated.split(',').forEach(name => piNames.add(name.trim()));
        }
    });
    const totalPIs = piNames.size;

    // Update the DOM
    if (statActiveGrants) statActiveGrants.textContent = activeGrants;
    if (statTotalFunding) statTotalFunding.textContent = formatCurrency(totalFunding); // Use existing currency formatter
    if (statTotalPIs) statTotalPIs.textContent = totalPIs;
    if (statGrantsCompleted) statGrantsCompleted.textContent = completedGrants;
}


        

        async function fetchAndDisplayGrants(filters = {}) {
            const columnsCount = VISIBLE_COLUMNS_IN_TABLE.length + 2; // +2 for S.No and Actions
            tableBody.innerHTML = `<tr><td colspan="${columnsCount}" style="text-align: center; padding: 20px;">Loading data...</td></tr>`;
            
            // Build the query string from the filters object
            const queryParams = new URLSearchParams();
            for (const key in filters) {
                const value = filters[key];
                if (value) { // Ensure value is not null, undefined, or empty string
                     if (Array.isArray(value)) {
                        value.forEach(item => queryParams.append(key, item));
                    } else {
                        queryParams.append(key, value);
                    }
                }
            }
            const queryString = queryParams.toString();
            const url = `${API_BASE_URL}/external-grants${queryString ? `?${queryString}` : ''}`;
            
            try {
                console.log(`Fetching from URL: ${url}`);
                const response = await fetch(url, { headers: {'Authorization': `Bearer ${localStorage.getItem('accessToken')}`} });
                
                if (!response.ok) {
                    let errorDetails = `Server error (Status: ${response.status})`;
                    try { const errorData = await response.json(); errorDetails = errorData.error || errorData.message || errorDetails; } catch (e) {}
                    throw new Error(errorDetails);
                }

                const grants = await response.json();
                
                allGrants = grants; // Store the new filtered/unfiltered list
                currentPage = 1; // Reset to page 1 after every new fetch
                displayCurrentPage(); // This function will paginate and display the `allGrants` data
                
                updateStatCards(grants);

            } catch (error) {
                console.error("Error fetching grants:", error);
                tableBody.innerHTML = `<tr><td colspan="${columnsCount}" style="text-align: center; padding: 20px; color: red;">Error loading data: ${error.message}.</td></tr>`;
                allGrants = []; // Clear data on error
                displayCurrentPage(); // Display "No grants found" message
                updateStatCards([]); // Reset stat cards
            }
        }
        



        function populateTable(grants, startIndex = 0) { // <-- Add startIndex parameter
    tableBody.innerHTML = '';
    const columnsCount = VISIBLE_COLUMNS_IN_TABLE.length + 2;

    if (!Array.isArray(grants) || grants.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${columnsCount}" style="text-align: center; padding: 20px;">No grants found matching your criteria.</td></tr>`;
        return;
    }

    grants.forEach((grant, index) => {
        const grantId = grant.application_id;
        if (!grantId) {
            console.warn("Skipping row - missing application_id:", grant);
            return;
        }
        const row = tableBody.insertRow();
        row.setAttribute('data-id', grantId);
        
        row.insertCell().textContent = startIndex + index + 1; // <-- USE startIndex here

        VISIBLE_COLUMNS_IN_TABLE.forEach(col => {
            const cell = row.insertCell();
            let value = grant[col.key];
            if (col.key.toLowerCase().includes('date')) value = formatDate(value);
            cell.textContent = (value !== null && value !== undefined && value !== '') ? value : 'N/A';
        });

        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');
        actionCell.style.whiteSpace = 'nowrap';
        actionCell.innerHTML = `
            <button class="view-details-btn" data-id="${grantId}" title="View Details"><i class="fas fa-eye"></i></button>
            <button class="edit-btn" data-id="${grantId}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" data-id="${grantId}" title="Delete"><i class="fas fa-trash"></i></button>
        `;
    });
}


           function displayCurrentPage() {
        
            const globalSearch = globalSearchInput.value.toLowerCase();
            
            // Note: We are simplifying the filter logic here to just use the global search,
            // as the complex multi-filter UI from the original file was not fully implemented.
            // This can be expanded later if needed.
            let filteredGrants = allGrants.filter(grant => {
                const piNames = grant.pi_names_concatenated || '';
                const title = grant.project_title || '';
                const appId = grant.application_id || '';

                return (
                    piNames.toLowerCase().includes(globalSearch) ||
                    title.toLowerCase().includes(globalSearch) ||
                    appId.toLowerCase().includes(globalSearch)
                );
            });

            const start = (currentPage - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            const paginatedItems = filteredGrants.slice(start, end);

            populateTable(paginatedItems, start); // Pass the `start` index for correct S.No
            setupPagination(filteredGrants.length);
            updatePaginationInfo(filteredGrants.length, start);
        }
        // ADD THIS ENTIRE NEW FUNCTION

            /**
             * Generates a smart list of page numbers and ellipses for pagination.
             * @param {number} pageCount - The total number of pages.
             * @param {number} currentPage - The currently active page.
             * @returns {Array<number|string>} - An array like [1, 2, '...', 5, 6, 7, '...', 10]
             */
            function generatePaginationLinks(pageCount, currentPage) {
                const links = [];
                const siblingCount = 1; // How many pages to show on each side of the current page

                // Case 1: Not enough pages to need ellipses
                if (pageCount <= 5 + (2 * siblingCount)) {
                    for (let i = 1; i <= pageCount; i++) {
                        links.push(i);
                    }
                    return links;
                }

                // Always show the first page
                links.push(1);

                // Case 2: Show ellipsis after the first page
                if (currentPage > 2 + siblingCount) {
                    links.push('...');
                }

                // Determine the range of pages to show around the current page
                const startPage = Math.max(2, currentPage - siblingCount);
                const endPage = Math.min(pageCount - 1, currentPage + siblingCount);

                for (let i = startPage; i <= endPage; i++) {
                    links.push(i);
                }

                // Case 3: Show ellipsis before the last page
                if (currentPage < pageCount - 1 - siblingCount) {
                    links.push('...');
                }

                // Always show the last page
                links.push(pageCount);

                return links;
            }

       // REPLACE your old setupPagination function with this one

function setupPagination(totalItems) {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList) return;
    paginationList.innerHTML = ''; // Clear old links
    const pageCount = Math.ceil(totalItems / rowsPerPage);

    // Don't display pagination if there's only one page or less
    if (pageCount <= 1) {
        return;
    }

    // Use our new helper function to get the list of items to render
    const linksToRender = generatePaginationLinks(pageCount, currentPage);

    linksToRender.forEach(item => {
        const li = document.createElement('li');

        if (item === '...') {
            // It's an ellipsis, so create a non-clickable span
            const span = document.createElement('span');
            span.textContent = '...';
            span.classList.add('pagination-ellipsis');
            li.appendChild(span);
        } else {
            // It's a page number, so create a clickable link
            const link = document.createElement('a');
            link.href = '#';
            link.innerText = item;
            link.classList.add('pagination-link');
            if (item === currentPage) {
                link.classList.add('active');
            }
            link.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = item; // Set the new current page
                displayCurrentPage(); // Re-render the table for that page
            });
            li.appendChild(link);
        }
        paginationList.appendChild(li);
    });
}

        function updatePaginationInfo(totalItems, start) {
            const paginationInfo = document.getElementById('paginationInfo');
            if (!paginationInfo) return;
            const startItem = totalItems > 0 ? start + 1 : 0;
            const endItem = Math.min(start + rowsPerPage, totalItems);
            paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} results`;
        }

        // --- ACCORDION FORM HANDLING ---
        function setDisplayFileName(fileInputId, s3Key) {
            const displaySpanId = `${fileInputId}_display`;
            const displaySpan = document.getElementById(displaySpanId);
            if (displaySpan) {
                displaySpan.textContent = s3Key ? s3Key.split('/').pop() : 'None';
            }
        }

    // ... (API_BASE_URL, VISIBLE_COLUMNS_IN_TABLE, other DOM elements) ...

    function calculateAndDisplayProjectDuration() {
        const startDateInput = document.getElementById('project_start_date');
        const endDateInput = document.getElementById('project_end_date');
        const durationInput = document.getElementById('project_duration');

        if (!startDateInput || !endDateInput || !durationInput) {
            // console.warn("Date or duration input fields not found for duration calculation.");
            return;
        }

        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);

        if (startDateInput.value && endDateInput.value && !isNaN(startDate) && !isNaN(endDate) && endDate >= startDate) {
            let years = endDate.getFullYear() - startDate.getFullYear();
            let months = endDate.getMonth() - startDate.getMonth();
            let days = endDate.getDate() - startDate.getDate();

            if (days < 0) {
                months--;
                // Get days in the previous month of endDate
                const prevMonthEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
                days += prevMonthEndDate.getDate();
            }

            if (months < 0) {
                years--;
                months += 12;
            }

            let durationString = "";
            if (years > 0) {
                durationString += `${years} year${years > 1 ? 's' : ''}`;
            }
            if (months > 0) {
                if (durationString) durationString += ", ";
                durationString += `${months} month${months > 1 ? 's' : ''}`;
            }
            if (days > 0) {
                if (durationString) durationString += ", ";
                durationString += `${days} day${days > 1 ? 's' : ''}`;
            }

            if (!durationString && startDate.getTime() === endDate.getTime()) {
                durationString = "0 days (Same day)";
            } else if (!durationString) {
                durationString = "N/A (Invalid date range)"; // Should not happen with endDate >= startDate
            }

            durationInput.value = durationString;

        } else if (startDateInput.value && endDateInput.value && endDate < startDate) {
            durationInput.value = "End date before start date";
        } else {
            durationInput.value = ""; // Clear if dates are not valid or incomplete
        }
    }

    
    window.calculateAndDisplayProjectDuration = calculateAndDisplayProjectDuration;

    

    const projectStartDateInput = document.getElementById('project_start_date');
    const projectEndDateInput = document.getElementById('project_end_date');

    if (projectStartDateInput) {
        projectStartDateInput.addEventListener('change', calculateAndDisplayProjectDuration);
    }
    if (projectEndDateInput) {
        projectEndDateInput.addEventListener('change', calculateAndDisplayProjectDuration);
    }



    function populateAccordionForm(grantData) {
        if (!grantForm) {
            console.error("Grant form element not found!");
            return;
        }
        grantForm.reset(); // Basic reset for simple input types
        console.log("POPULATE FORM: Starting with data:", JSON.stringify(grantData, null, 2));

        // --- Helper to set value and handle potential null from backend ---
        function setFieldValue(elementId, value, isDate = false) {
            const element = document.getElementById(elementId);
            if (element) {
                if (isDate) {
                    element.value = formatDate(value, 'YYYY-MM-DD'); // Ensure date is in YYYY-MM-DD
                } else if (element.type === 'checkbox') {
                    element.checked = !!value; // Handle boolean for checkbox
                } else if (element.tagName === 'SELECT') {
                    element.value = value === null || value === undefined ? '' : value;
                }
                else {
                    element.value = value === null || value === undefined ? '' : value;
                }
            } else {
                // console.warn(`Element with ID '${elementId}' not found during form population.`);
            }
        }

        function setFileDisplay(fileInputBaseId, s3Key) {
            const displaySpan = document.getElementById(`${fileInputBaseId}_display`);
            const hiddenKeyInput = document.getElementById(`existing_${fileInputBaseId}_s3_key`); // Or by name if IDs are not on hidden
            
            if (displaySpan) {
                displaySpan.textContent = s3Key ? s3Key.split('/').pop() : 'None';
            }
            if (hiddenKeyInput) {
                hiddenKeyInput.value = s3Key || '';
            }
        }

        // --- Section 1: Core Project Info ---
        const core = grantData.coreInfo || {};
        setFieldValue('application_id', core.application_id);
        setFieldValue('project_id_odr', core.project_id_odr);
        setFieldValue('project_title', core.project_title);
        setFieldValue('project_id_funder', core.project_id_funder);
        setFieldValue('department_name', core.department_name);
        setFieldValue('type_of_grant', core.type_of_grant);
        setFieldValue('funder_type', core.funder_type);
        setFieldValue('fcra_type', core.fcra_type);
        setFieldValue('project_website_link', core.project_website_link);
        populateMultiFileDisplay('s1_project_agreement_file', core.project_agreement_files || []);
        // --- Section 2: Dates & Status ---
        const ds = grantData.datesStatus || {};
        setFieldValue('application_date', ds.application_date, true);
        setFieldValue('application_status', ds.application_status);
        setFieldValue('project_status', ds.project_status);
        setFieldValue('project_secured_date', ds.project_secured_date, true);
        setFieldValue('project_start_date', ds.project_start_date, true);
        setFieldValue('project_end_date', ds.project_end_date, true);
        setFieldValue('calendar_year', ds.calendar_year); 
        setFieldValue('financial_year', ds.financial_year); 
        setFieldValue('academic_year', ds.academic_year); 
        // project_duration is auto-calculated by embedded script; trigger it
        if (typeof calculateAndDisplayProjectDuration === 'function') {
                calculateAndDisplayProjectDuration();
        }
        setFieldValue('financial_closing_status', ds.financial_closing_status); // Assuming ID matches
        populateMultiFileDisplay('s2_application_document_file', ds.application_document_s3_key || []);
        // --- Section 3: Funding & Collaboration (Dynamic) ---
        if (typeof window.populateFundingCollaborationsGui_S3 === 'function') { // Ensure unique function name
            window.populateFundingCollaborationsGui_S3(grantData.fundingCollaborations || []);
        } else {
            console.warn("populateFundingCollaborationsGui_S3 function not found. Ensure HTML script for Section 3 is correct and loaded.");
        }

        // --- Section 4: Principal Investigators (PI) (Dynamic) ---
        if (typeof window.populatePIGui_S4 === 'function') {
            window.populatePIGui_S4(grantData.principalInvestigators || []);
        } else {
            console.warn("populatePIGui_S4 function not found. Ensure HTML script for Section 4 is correct and loaded.");
        }

        // --- Section 5: Co-Investigators (Co-PI) (Dynamic) ---
        if (typeof window.populateCoPiGui_S5 === 'function') {
            window.populateCoPiGui_S5(grantData.coInvestigators || []);
        } else {
            console.warn("populateCoPiGui_S5 function not found. Ensure HTML script for Section 5 is correct and loaded.");
        }
        
        
// --- Section 6: Grant Amounts & Overheads ---
const ao = grantData.amountsOverheads || {};
// The field IDs on the left now match the DB columns on the right (ao.grant_sanctioned_amount)
setFieldValue('grant_sanctioned_amount_original_currency', ao.grant_sanctioned_amount);
setFieldValue('currency_code', ao.currency);
setFieldValue('exchange_rate_to_inr', ao.exchange_rate);
setFieldValue('grant_amount_in_inr', ao.grant_amount_in_inr);
setFieldValue('amount_in_usd_equivalent', ao.amount_in_usd);
setFieldValue('overheads_percentage', ao.overheads_percentage);
setFieldValue('overheads_secured_inr', ao.overheads_secured);
setFieldValue('overheads_received_inr', ao.overheads_received);

if (window.triggerSection6Calculations) {
    window.triggerSection6Calculations();
}


// Correctly handle boolean for GST dropdown
let gstFormValue = '';
if (ao.gst_applicable === 'Yes') {
    gstFormValue = 'true';
} else if (ao.gst_applicable === 'No') {
    gstFormValue = 'false';
} else if (ao.gst_applicable === 'Exempted') {
    gstFormValue = 'exempt';
}
setFieldValue('gst_applicable', gstFormValue);

// The file population logic was already correct
populateMultiFileDisplay('s6_financial_documents_file', ao.financial_documents_s3_key || []);

// Trigger client-side calculations after populating
if (typeof calculateOverheads === 'function') {
    calculateOverheads();
}

        // --- Section 7: Funds Received & Installments (Dynamic) ---
        if (typeof window.populateInstallmentsGui_S7 === 'function') {
            window.populateInstallmentsGui_S7(grantData.fundInstallments || []);
        } else {
            console.warn("populateInstallmentsGui_S7 function not found. Ensure HTML script for Section 7 is correct and loaded.");
        }
        // Note: The totals in section 7 (total_amount_received_inr_s7, remaining_amount_in_inr_s7)
        // are calculated by its embedded script, which `populateInstallmentsGui_S7` should trigger.
        // Also populate the overall file for Section 7:
populateMultiFileDisplay('s7_fund_received_document_overall', grantData.filesOther?.overall_s7_doc_s3_key || []);

        // --- Section 8: Project Budget Head (Dynamic) ---
        if (typeof window.populateBudgetHeadsGui_S8 === 'function') {
            window.populateBudgetHeadsGui_S8(grantData.budgetHeads || []);
        } else {
            console.warn("populateBudgetHeadsGui_S8 function not found. Ensure HTML script for Section 8 is correct and loaded.");
        }

        // --- Section 9: Project Deliverables (Dynamic) ---
        if (typeof window.populateDeliverablesGui_S9 === 'function') {
            window.populateDeliverablesGui_S9(grantData.projectDeliverables || []);
        } else {
            console.warn("populateDeliverablesGui_S9 function not found. Ensure HTML script for Section 9 is correct and loaded.");
        }

        // --- Section 10: Project Staff (Dynamic) ---
        if (typeof window.populateStaffGui_S10 === 'function') {
            window.populateStaffGui_S10(grantData.projectStaff || []);
        } else {
            console.warn("populateStaffGui_S10 function not found. Ensure HTML script for Section 10 is correct and loaded.");
        }

        // --- Section 11: Project Equipments (Dynamic) ---
        if (typeof window.populateEquipmentsGui_S11 === 'function') {
    // Get manually added equipment from the project_equipments table
    const manuallyAddedEquipments = grantData.projectEquipments || [];
    
    // Get assigned items from the inventory table and add a flag
    const assignedInventoryItems = (grantData.assignedInventory || []).map(item => ({
        ...item,
        isFromInventory: true // This flag is crucial for the renderer
    }));

    // Combine both lists into one to be displayed in the section
    const allEquipments = [...assignedInventoryItems, ...manuallyAddedEquipments];
    
    window.populateEquipmentsGui_S11(allEquipments);
        } else {
            console.warn("populateEquipmentsGui_S11 function not found. Ensure HTML script for Section 11 is correct and loaded.");
        }

        // --- Section 12: Files & Other ---
        const fo = grantData.filesOther || {};
let s12ImageFiles = [];
if (fo.project_image_s3_key && typeof fo.project_image_s3_key === 'string') {
    try { s12ImageFiles = JSON.parse(fo.project_image_s3_key); } catch (e) {}
} else if (Array.isArray(fo.project_image_s3_key)) {
    s12ImageFiles = fo.project_image_s3_key;
}
populateMultiFileDisplay('s12_project_image_file', s12ImageFiles);populateMultiFileDisplay('s12_final_report_file', fo.final_report_document_s3_key || []);
        console.log("POPULATE FORM: Finished populating.");
    }


    function resetAccordionStates(openFirst = true) {
    const accordionButtons = document.querySelectorAll('.accordion-button');
    accordionButtons.forEach((button, index) => {
        const contentId = button.getAttribute('aria-controls');
        const content = document.getElementById(contentId);
        if (!content) return;

        // Determine if this accordion should be open
        const shouldBeOpen = (openFirst && index === 0);

        if (shouldBeOpen) {
            content.style.display = 'block';
            button.setAttribute('aria-expanded', 'true');
        } else {
            content.style.display = 'none';
            button.setAttribute('aria-expanded', 'false');
        }
    });
}

    // In externalGrant.js
    async function showForm(grantDbId = null) {
        // --- 1. Fade out the main data table view ---
        mainDataView.classList.add('view-hidden');

        // --- 2. Prepare the form data in the background ---
        formTitle.textContent = grantDbId ? "Edit Grant Details" : "Add New Grant Details";
        mainProjectIdInput.value = grantDbId || '';
        
        // Get the Application ID field to make it read-only on edit
        const applicationIdField = document.getElementById('application_id');

        if (grantDbId) {
            // --- EDITING (Fetch data and lock the ID field) ---
            if (applicationIdField) {
                applicationIdField.readOnly = true;
                applicationIdField.classList.add('locked-field');
            }

            console.log(`[JS showForm EDIT] Fetching details for grant ID: ${grantDbId}`);
            try {
                    const safeGrantId = encodeURIComponent(grantDbId);
const response = await fetch(`${API_BASE_URL}/external-grants/${safeGrantId}`, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
});                            if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Fetch failed (Status: ${response.status}) - ${errData.message || 'Server error'}`);
                }
                const grantFullData = await response.json();
                populateAccordionForm(grantFullData);
            } catch (error) {
                console.error("Error fetching grant for edit:", error);
                alert(`Error loading grant data: ${error.message}`);
                mainDataView.classList.remove('view-hidden'); // Show the table again if there was an error
                return;
            }
        } else {
            // --- CREATING NEW (Reset form and ensure ID field is editable) ---
            if (applicationIdField) {
                applicationIdField.readOnly = false;
                applicationIdField.classList.remove('locked-field');
            }

            console.log("[JS showForm NEW] Resetting form for a new grant.");
            grantForm.reset();
            if (mainProjectIdInput) mainProjectIdInput.value = '';

            // (The rest of your 'else' block for resetting dynamic sections stays the same)
           const dynamicSections = [
    { populateFunc: window.populateFundingCollaborationsGui_S3 },
    { populateFunc: window.populatePIGui_S4 },
    { populateFunc: window.populateCoPiGui_S5 },
    { populateFunc: window.populateInstallmentsGui_S7 },
    { populateFunc: window.populateBudgetHeadsGui_S8 },
    { populateFunc: window.populateDeliverablesGui_S9 },
    { populateFunc: window.populateStaffGui_S10 },
    { populateFunc: window.populateEquipmentsGui_S11 }
];
dynamicSections.forEach(section => {
    if (typeof section.populateFunc === 'function') {
        section.populateFunc([]); // Calling with an empty array resets the section
    }
});

resetAllFileDisplays();
}

        // --- 3. After the fade-out is complete, switch the views and fade in the form ---
        setTimeout(() => {
            mainDataView.style.display = 'none';
            grantFormContainer.classList.remove('view-hidden');
            grantFormContainer.style.display = 'block';
            grantFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, FADE_DURATION);
    }
        
    function hideForm() {
        // --- 1. Immediately reset form fields ---
        console.log("[JS hideForm] Hiding form and resetting fields & accordions.");
        if (grantForm) grantForm.reset();
        if (mainProjectIdInput) mainProjectIdInput.value = '';
        if (typeof resetAccordionStates === 'function') resetAccordionStates(true);
        
        // --- 2. Fade out the form ---
        grantFormContainer.classList.add('view-hidden');

        // --- 3. After fade-out is complete, switch views and fade in the data table ---
        setTimeout(() => {
            grantFormContainer.style.display = 'none'; // Hide form from layout
            mainDataView.classList.remove('view-hidden'); // Make sure table view is not hidden
            mainDataView.style.display = 'block'; // Show table view in layout
        }, FADE_DURATION);
    }   

    function collectGrantFormData() {
        const data = {
            coreInfo: {}, datesStatus: {}, amountsOverheads: {}, filesOther: {},
            fundingCollaborations: [], principalInvestigators: [], coInvestigators: [],
            fundInstallments: [], budgetHeads: [], projectDeliverables: [],
            projectStaff: [], projectEquipments: []
        };

        // Helper to get value, trim if string, parse if number, or return null
        function getVal(elementId, type = 'string') {
            const element = document.getElementById(elementId);
            if (!element) return null;
            let value = element.value;
            if (type === 'string') return value.trim() || null;
            if (type === 'float') return parseFloat(value) || null;
            if (type === 'int') return parseInt(value, 10) || null; // Ensure base 10 for parseInt
            if (type === 'boolean_string') return value === 'true' ? true : (value === 'false' ? false : null); // For select with "true"/"false"
            return value || null; // Default for dates, selects with string values
        }

        // --- Section 1: Core Project Info ---
        data.coreInfo.application_id = getVal('application_id');
        data.coreInfo.project_id_odr = getVal('project_id_odr');
        data.coreInfo.project_title = getVal('project_title');
        data.coreInfo.project_id_funder = getVal('project_id_funder');
        data.coreInfo.department_name = getVal('department_name');
        data.coreInfo.type_of_grant = getVal('type_of_grant');
        data.coreInfo.funder_type = getVal('funder_type');
        data.coreInfo.fcra_type = getVal('fcra_type');
        data.coreInfo.project_website_link = getVal('project_website_link');
        // For file, we primarily care about NEW uploads (handled by FormData separately)
        // But we need the existing S3 key if the file wasn't changed.
data.coreInfo.project_agreement_files = Array.from(document.querySelectorAll('input[name="existing_files_s1_project_agreement_file[]"]')).map(input => input.value);

        // --- Section 2: Dates & Status ---
        data.datesStatus.application_date = getVal('application_date');
        data.datesStatus.application_status = getVal('application_status');
        data.datesStatus.project_status = getVal('project_status');
        data.datesStatus.project_secured_date = getVal('project_secured_date');
        data.datesStatus.project_start_date = getVal('project_start_date');
        data.datesStatus.project_end_date = getVal('project_end_date');
        data.datesStatus.calendar_year = getVal('calendar_year');
        data.datesStatus.financial_year = getVal('financial_year'); 
        data.datesStatus.academic_year = getVal('academic_year');
        data.datesStatus.project_duration = getVal('project_duration');
        data.datesStatus.financial_closing_status = getVal('financial_closing_status'); // Your HTML uses 'financial_closing_status' as id
data.datesStatus.application_document_s3_key = Array.from(document.querySelectorAll('input[name="existing_files_s2_application_document_file[]"]')).map(input => input.value);
        // --- Section 3: Funding & Collaboration ---
        
        document.querySelectorAll('#fundingCollabContainer_S3 .funding-collab-entry').forEach(entry => {
            const item = {
                funding_agencies_name: entry.querySelector('input[name="funding_agencies_name[]"]')?.value.trim() || null,
                collaboration_name: entry.querySelector('textarea[name="collaboration_name[]"]')?.value.trim() || null, // Or textarea
                collaboration_country_of_origin: entry.querySelector('input[name="collaboration_country_of_origin[]"]')?.value.trim() || null,
                collaboration_contact_details: entry.querySelector('input[name="collaboration_contact_details[]"]')?.value.trim() || null
            };
            // Only add if at least one field has a value to avoid empty objects
            if (Object.values(item).some(v => v !== null && v !== '')) {
                data.fundingCollaborations.push(item);
            }
        });


// --- Section 4: Principal Investigators ---
document.querySelectorAll('#piContainer_S4 .pi-entry').forEach(entry => {
    // Get existing files the user wants to keep
    const existingFilesToKeep = Array.from(
        entry.querySelectorAll('input[data-role="existing-pi-file"]')
    ).map(input => input.value);

    // *** THE KEY FIX: Count newly selected files for THIS PI entry ***
    const fileInput = entry.querySelector('input[name="s4_pi_photographs[]"]');
    const newFileCount = fileInput ? fileInput.files.length : 0;

    const pi = {
        name_of_pi: entry.querySelector('input[name="name_of_pi[]"]')?.value.trim(),
        pi_contact_details: entry.querySelector('input[name="pi_contact_details[]"]')?.value.trim() || null,
        pi_affiliating_institution: entry.querySelector('input[name="pi_affiliating_institution[]"]')?.value.trim() || null,
        pi_affiliating_country: entry.querySelector('select[name="pi_affiliating_country[]"]')?.value.trim() || null,
        
        // This correctly assigns the array of files to keep.
        pi_photograph_s3_key: existingFilesToKeep,

        // *** Add the new file count to the payload for the backend ***
        newFileCount: newFileCount 
    };

    if (pi.name_of_pi) {
        data.principalInvestigators.push(pi);
    }
});

// --- Section 5: Co-Investigators ---
document.querySelectorAll('#coPiContainer_S5 .co-pi-entry').forEach(entry => {
    const existingFilesToKeep = Array.from(
        entry.querySelectorAll('input[data-role="existing-co-pi-file"]')
    ).map(input => input.value);
    
    // *** THE KEY FIX: Count newly selected files for THIS Co-PI entry ***
    const fileInput = entry.querySelector('input[name="s5_co_pi_photographs[]"]');
    const newFileCount = fileInput ? fileInput.files.length : 0;

    const coPi = {
        name_of_co_pi: entry.querySelector('input[name="name_of_co_pi[]"]')?.value.trim(),
        co_pi_contact_details: entry.querySelector('input[name="co_pi_contact_details[]"]')?.value.trim() || null,
        co_pi_affiliating_institution: entry.querySelector('input[name="co_pi_affiliating_institution[]"]')?.value.trim() || null,
        co_pi_affiliating_country: entry.querySelector('select[name="co_pi_affiliating_country[]"]')?.value.trim() || null,
        co_pi_photograph_s3_key: existingFilesToKeep,

        // *** Add the new file count to the payload for the backend ***
        newFileCount: newFileCount
    };

    if (coPi.name_of_co_pi) {
        data.coInvestigators.push(coPi);
    }
});


        // --- Section 6: Grant Amounts & Overheads ---
        data.amountsOverheads.grant_sanctioned_amount_original_currency = getVal('grant_sanctioned_amount_original_currency', 'float');
        data.amountsOverheads.currency_code = getVal('currency_code')?.toUpperCase();
        data.amountsOverheads.exchange_rate_to_inr = getVal('exchange_rate_to_inr', 'float');
        data.amountsOverheads.grant_amount_in_inr = getVal('grant_amount_in_inr', 'float'); // If editable
        data.amountsOverheads.amount_in_usd_equivalent = getVal('amount_in_usd_equivalent', 'float'); // If editable
        data.amountsOverheads.overheads_percentage = getVal('overheads_percentage', 'float');
        data.amountsOverheads.overheads_secured_inr = getVal('overheads_secured_inr', 'float'); // If editable
        data.amountsOverheads.overheads_received_inr = getVal('overheads_received_inr', 'float');
const gstFormValue = getVal('gst_applicable'); // This gets the raw value: "true", "false", or "exempt"
let gstDbValue = null;
if (gstFormValue === 'true') {
    gstDbValue = 'Yes';
} else if (gstFormValue === 'false') {
    gstDbValue = 'No';
} else if (gstFormValue === 'exempt') {
    gstDbValue = 'Exempted';
}
data.amountsOverheads.gst_applicable = gstDbValue;data.amountsOverheads.financial_documents_s3_key = Array.from(document.querySelectorAll('input[name="existing_files_s6_financial_documents_file[]"]')).map(input => input.value);
   



// --- Section 7: Funds Received & Installments ---
document.querySelectorAll('#installmentsContainer_S7 .installment-entry-s7').forEach(entry => {
    // Get existing files the user wants to keep
    const existingFilesToKeep = Array.from(
        entry.querySelectorAll('input[data-role="existing-installment-file"]')
    ).map(input => input.value);

    // *** THE KEY FIX: Count newly selected files for THIS installment entry ***
    const fileInput = entry.querySelector('input[name="s7_fund_received_documents[]"]');
    const newFileCount = fileInput ? fileInput.files.length : 0;

    const inst = {
        fy_year_installment: entry.querySelector('input[name="fy_year_installment[]"]')?.value.trim() || null,
        installment_amount_inr: parseFloat(entry.querySelector('input[name="installment_amount_inr[]"]')?.value) || null,
        bank_fee_inr: parseFloat(entry.querySelector('input[name="bank_fee_inr[]"]')?.value) || null,
        installment_date: entry.querySelector('input[name="installment_date[]"]')?.value || null,
        
        // This correctly assigns the array of files to keep.
        fund_received_document_s3_key: existingFilesToKeep,

        // *** Add the new file count to the payload for the backend ***
        newFileCount: newFileCount
    };

    if (inst.fy_year_installment || inst.installment_amount_inr !== null) {
        data.fundInstallments.push(inst);
    }
});

        // --- Section 8: Project Budget Head ---
        // Assumes container ID `budgetHeadContainer_S8` and entry class `budget-head-entry`
        document.querySelectorAll('#budgetHeadContainer_S8 .budget-head-entry').forEach(entry => {
            const bh = {
                budget_head_name: entry.querySelector('input[name="budget_head_name[]"]')?.value.trim(),
                budget_percentage: parseFloat(entry.querySelector('input[name="budget_percentage[]"]')?.value) || null,
                budget_head_value_inr: parseFloat(entry.querySelector('input[name="budget_head_value_inr[]"]')?.value) || null,
                actual_expense_inr: parseFloat(entry.querySelector('input[name="actual_expense_inr[]"]')?.value) || null,
                balance_fund_inr: parseFloat(entry.querySelector('input[name="balance_fund_inr[]"]')?.value) || null, // If editable
            };
            if (bh.budget_head_name) {
                data.budgetHeads.push(bh);
            }
        });

    

// --- Section 9: Project Deliverables ---
document.querySelectorAll('#deliverableContainer_S9 .deliverable-entry-s9').forEach(entry => {
    // Get existing files the user wants to keep
    const existingFilesToKeep = Array.from(
        entry.querySelectorAll('input[data-role="existing-deliverable-file"]')
    ).map(input => input.value);

    // *** THE KEY FIX: Count newly selected files for THIS deliverable entry ***
    const fileInput = entry.querySelector('input[name="s9_deliverable_documents[]"]');
    const newFileCount = fileInput ? fileInput.files.length : 0;

    const del = {
        deliverable_description: entry.querySelector('textarea[name="deliverable_description[]"]')?.value.trim(),
        deliverable_status: entry.querySelector('select[name="deliverable_status[]"]')?.value || null,
        deliverable_due_date: entry.querySelector('input[name="deliverable_due_date[]"]')?.value || null,
        
        // This correctly assigns the array of files to keep.
        deliverable_document_s3_key: existingFilesToKeep,

        // *** Add the new file count to the payload for the backend ***
        newFileCount: newFileCount
    };
    if (del.deliverable_description) {
        data.projectDeliverables.push(del);
    }
});


// --- Section 10: Project Staff ---
let staffCount = 0;
document.querySelectorAll('#staffDetailsContainer_S10 .staff-entry-s10').forEach(entry => {
    staffCount++;
    const photosToKeep = Array.from(entry.querySelectorAll('input[data-role="existing-staff-photo"]')).map(input => input.value);
    const agreementsToKeep = Array.from(entry.querySelectorAll('input[data-role="existing-staff-agreement"]')).map(input => input.value);

    // *** THE KEY FIX: Count new files for EACH input separately ***
    const photoInput = entry.querySelector('input[name="s10_staff_photographs[]"]');
    const newPhotoCount = photoInput ? photoInput.files.length : 0;

    const agreementInput = entry.querySelector('input[name="s10_staff_agreements[]"]');
    const newAgreementCount = agreementInput ? agreementInput.files.length : 0;

    const staff = {
        staff_name: entry.querySelector('input[name="staff_name[]"]')?.value.trim(),
        staff_role: entry.querySelector('input[name="staff_role[]"]')?.value.trim() || null,
        staff_stipend_rate_inr: parseFloat(entry.querySelector('input[name="staff_stipend_rate_inr[]"]')?.value) || null,
        staff_months_stipend_paid: parseInt(entry.querySelector('input[name="staff_months_stipend_paid[]"]')?.value, 10) || null,
        staff_total_stipend_paid_inr: parseFloat(entry.querySelector('input[name="staff_total_stipend_paid_inr[]"]')?.value) || null,
        staff_per_diem_paid_inr: parseFloat(entry.querySelector('input[name="staff_per_diem_paid_inr[]"]')?.value) || null,
        staff_joining_date: entry.querySelector('input[name="staff_joining_date[]"]')?.value || null,
        staff_end_date: entry.querySelector('input[name="staff_end_date[]"]')?.value || null,
        staff_status: entry.querySelector('select[name="staff_status[]"]')?.value || 'active',
        staff_photograph_s3_key: photosToKeep,
        staff_agreement_s3_key: agreementsToKeep,

        // *** Add the new file counts to the payload for the backend ***
        newPhotoCount: newPhotoCount,
        newAgreementCount: newAgreementCount
    };
    if (staff.staff_name) {
        data.projectStaff.push(staff);
    }
});
data.coreInfo.total_project_staff_count = staffCount;



        // --- Section 11: Project Equipments ---
document.querySelectorAll('#equipmentContainer_S11 .equipment-entry-s11').forEach(entry => {
    const existingFilesToKeep = Array.from(
        entry.querySelectorAll('input[data-role="existing-equipment-file"]')
    ).map(input => input.value);

    const equip = {
        equipment_name_description: entry.querySelector('textarea[name="equipment_name_description[]"]')?.value.trim(),
        quantity_of_equipment: parseInt(entry.querySelector('input[name="quantity_of_equipment[]"]')?.value, 10) || null,
        cost_per_unit_inr: parseFloat(entry.querySelector('input[name="cost_per_unit_inr[]"]')?.value) || null,
        total_cost_equipments_inr: parseFloat(entry.querySelector('input[name="total_cost_equipments_inr[]"]')?.value) || null,
        equipment_bills_s3_key: existingFilesToKeep
    };
    if (equip.equipment_name_description) {
        data.projectEquipments.push(equip);
    }
});

        // --- Section 12: Files & Other ---
       data.filesOther.project_image_s3_key = Array.from(document.querySelectorAll('input[name="existing_files_s12_project_image_file[]"]')).map(input => input.value);
data.filesOther.final_report_document_s3_key = Array.from(document.querySelectorAll('input[name="existing_files_s12_final_report_file[]"]')).map(input => input.value);
data.filesOther.overall_s7_doc_s3_key = Array.from(document.querySelectorAll('input[name="existing_files_s7_fund_received_document_overall[]"]')).map(input => input.value);

        console.log("Collected Grant Data:", JSON.stringify(data, null, 2));
        console.log("CLIENT collectGrantFormData - FINAL grantDataObject:") 

        return data;

    }

        window.collectGrantFormData = collectGrantFormData; // ADD THIS LINE


        async function handleFormSubmit(event) {
        event.preventDefault();
        const saveButton = grantForm.querySelector('.btn-save'); // Ensure your save button has this class or a unique ID
        if (!saveButton) {
            console.error("Save button not found in the form!");
            alert("Error: Save button is missing. Cannot submit.");
            return;
        }

        // --- 1. Basic Client-Side Validation (Example) ---
        // You should expand this based on your requirements
        const projectIdOdr = document.getElementById('project_id_odr')?.value.trim();
        const projectTitle = document.getElementById('project_title')?.value.trim();
        const errors = [];

        // if (!projectIdOdr) {
        //     errors.push("Project ID (ODR) is required.");
        //     document.getElementById('project_id_odr')?.classList.add('border-red-500');
        // } else {
        //     document.getElementById('project_id_odr')?.classList.remove('border-red-500');
        // }

        if (!projectTitle) {
            errors.push("Project Title is required.");
            document.getElementById('project_title')?.classList.add('border-red-500');
        } else {
            document.getElementById('project_title')?.classList.remove('border-red-500');
        }
        
        // Add more client-side validation for other critical fields if needed
        // ...

        if (errors.length > 0) {
            alert("Please correct the following errors:\n" + errors.join("\n"));
            // Optionally, scroll to the first error field
            const firstErrorField = document.querySelector('.border-red-500');
            firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return; // Stop submission
        }
            const grantDataObject = collectGrantFormData();
            


            const formData = new FormData();
            console.log("Grant Data Object being stringified for FormData:", JSON.stringify(grantDataObject, null, 2)); // Check this object

            formData.append('grantDetails', JSON.stringify(grantDataObject));

            // Append files
            const fileInputIdsAndNames = [ // { id: 'html_id', nameForBackend: 'multer_field_name' }
                { id: 's1_project_agreement_file', nameForBackend: 's1_project_agreement_file' },
                { id: 's2_application_document_file', nameForBackend: 's2_application_document_file' },
                // PI Photos (Array) - nameForBackend is `s4_pi_photographs[]` but multer needs `s4_pi_photographs`
                // Multer will receive these as `req.files['s4_pi_photographs']` which is an array of files
                ...Array.from(document.querySelectorAll('input[name="s4_pi_photographs[]"]')).map(input => ({ id: input.id, nameForBackend: 's4_pi_photographs' })),
                ...Array.from(document.querySelectorAll('input[name="s5_co_pi_photographs[]"]')).map(input => ({ id: input.id, nameForBackend: 's5_co_pi_photographs' })),
                { id: 's6_financial_documents_file', nameForBackend: 's6_financial_documents_file' },
                ...Array.from(document.querySelectorAll('input[name="s7_fund_received_documents[]"]')).map(input => ({ id: input.id, nameForBackend: 's7_fund_received_documents' })),
                { id: 's7_fund_received_document_overall', nameForBackend: 's7_fund_received_document_overall' },
                   ...Array.from(document.querySelectorAll('input[name="s9_deliverable_documents[]"]')).map(input => ({ id: input.id, nameForBackend: 's9_deliverable_documents' })),
                ...Array.from(document.querySelectorAll('input[name="s10_staff_photographs[]"]')).map(input => ({ id: input.id, nameForBackend: 's10_staff_photographs' })),
                ...Array.from(document.querySelectorAll('input[name="s10_staff_agreements[]"]')).map(input => ({ id: input.id, nameForBackend: 's10_staff_agreements' })),
                ...Array.from(document.querySelectorAll('input[name="s11_equipment_bills_files[]"]')).map(input => ({ id: input.id, nameForBackend: 's11_equipment_bills_files' })),
                { id: 's12_project_image_file', nameForBackend: 's12_project_image_file' },
                { id: 's12_final_report_file', nameForBackend: 's12_final_report_file' },
            ];

            fileInputIdsAndNames.forEach(fileInfo => {
                const fileInput = document.getElementById(fileInfo.id);
                 if (fileInput && fileInput.files.length > 0) {
        // Loop through the FileList object, which contains all selected files.
        for (const file of fileInput.files) {
            // Append each file individually. The browser and backend will
            // automatically group them into an array because the name is the same.
            formData.append(fileInfo.nameForBackend, file);
        }
    }
            });


            const editGrantDbId = mainProjectIdInput.value;
            const method = editGrantDbId ? 'PUT' : 'POST';
            const safeEditId = editGrantDbId ? encodeURIComponent(editGrantDbId) : null;
            const url = safeEditId ? `${API_BASE_URL}/external-grants/${safeEditId}` : `${API_BASE_URL}/external-grants`;
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

            try {
                const response = await fetch(url, { method: method, headers: {'Authorization': `Bearer ${localStorage.getItem('accessToken')}`},body: formData });// FormData sets Content-Type automatically
                const result = await response.json();
                if (!response.ok) { throw new Error(result.message || `Save failed (Status: ${response.status})`); }
                alert(result.message || 'Grant saved successfully!');
                hideForm();
                fetchAndDisplayGrants();
            } catch (error) {
                console.error(`Error ${editGrantDbId ? 'updating' : 'creating'} grant:`, error);
                alert(`Failed to save grant: ${error.message}`);
            } finally {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Save Grant Details';
            }
        }


        // --- Delete Function ---
        async function deleteGrant(grantDbId) {
            if (!confirm(`Are you sure you want to delete grant ID ${grantDbId}? This action cannot be undone.`)) return;
            try {
                    const safeGrantId = encodeURIComponent(grantDbId);
        const response = await fetch(`${API_BASE_URL}/external-grants/${safeGrantId}`, {method: 'DELETE', headers: {  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`}});                   
         if (!response.ok) {
                    let errorDetails = `Delete failed (Status: ${response.status})`;
                    try { const result = await response.json(); errorDetails = result.message || errorDetails; } catch (e) {}
                    throw new Error(errorDetails);
                }
                let successMessage = `Grant ${grantDbId} deleted.`;
                try { const result = await response.json(); successMessage = result.message || successMessage; } catch(e) {}
                alert(successMessage);
                fetchAndDisplayGrants();
            } catch (error) {
                console.error(`Error deleting grant ${grantDbId}:`, error);
                alert(`Failed to delete grant: ${error.message}`);
            }
        }

        // --- Modal Handling ---
        // --- (REPLACE) MODAL HANDLING LOGIC ---

// Helper function to close any currently visible modals
function closeAllModals() {
    // This finds both the grantDetailsModal and the assignInventoryModal
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden'); // Use class to hide
    });
    document.body.classList.remove('modal-open'); // Allow scrolling again
}

// New function to open a modal by its ID
function openModal(modalId) {
    closeAllModals(); // First, ensure no other modals are open
    
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.classList.remove('hidden'); // Use class to show
        document.body.classList.add('modal-open'); // Prevent background scrolling
    }
}

// Make closeModal globally accessible for HTML onclick attributes
window.closeModal = function(modalId) {
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}
        window.addEventListener('click', (event) => { if (event.target == modal) closeModal('grantDetailsModal'); });
        window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && modal.style.display === 'block') closeModal('grantDetailsModal'); });

        function getFriendlyLabel(key) {
            const labelMap = {
                'application_id': 'Application ID', 'project_id_odr': 'Project ID (ODR)', 'project_title': 'Project Title',
                'department_name': 'Department', 'fcra_type': 'FCRA Status', 'funder_type': 'Funder Type',
                'project_website_link': 'Project Website', 'type_of_grant': 'Type of Grant',
                'project_id_funder': 'Project ID (Funder)', 'project_agreement_s3_key': 'Project Agreement File',
                'application_date': 'Application Date', 'application_status': 'Application Status',
                'project_status': 'Project Status', 'project_secured_date': 'Project Secured Date',
                'project_start_date': 'Project Start Date', 'project_end_date': 'Project End Date',
                'calendar_year': 'Calendar Year Secured', 'financial_year': 'Financial Year Secured',
                'academic_year': 'Academic Year Secured', 'project_duration': 'Project Duration',
                'financial_closing_status': 'Financial Closing Status (UC)', 'application_document_s3_key': 'Application Document File',
                'funding_agency_name': 'Funding Agency', 'collaboration_name': 'Collaborating Institution',
                'collaboration_country_of_origin': 'Collaborator Country', 'collaboration_contact_details': 'Collaborator Contact',
                'name_of_pi': "PI Name", 'pi_contact_details': "PI Email",
                'pi_affiliating_institution': "PI Institution", 'pi_affiliating_country': "PI Country",
                'pi_photograph_s3_key': 'PI Photograph',
                'name_of_co_pi': "Co-PI Name", 'co_pi_contact_details': "Co-PI Email",
                'co_pi_affiliating_institution': "Co-PI Institution", 'co_pi_affiliating_country': "Co-PI Country",
                'co_pi_photograph_s3_key': 'Co-PI Photograph',
                'grant_sanctioned_amount_original_currency': 'Sanctioned Amount (Original)', 'currency_code': 'Currency',
                'exchange_rate_to_inr': 'Exchange Rate to INR', 'grant_amount_in_inr': 'Grant Amount (INR)',
                'amount_in_usd_equivalent': 'Amount (USD Equiv.)', 'overheads_percentage': 'Overheads (%)',
                'overheads_secured_inr': 'Overheads Secured (INR)', 'overheads_received_inr': 'Overheads Received (INR)',
                'gst_applicable': 'GST Applicable', 'financial_documents_s3_key': 'Financial Documents File',
                'fy_year_installment': 'Installment FY', 'installment_amount_inr': 'Installment Amount (INR)',
                'bank_fee_inr': 'Bank Fee (INR)', 'total_amount_received_inr': 'Total Received (INR)',
                'fund_received_document_s3_key': 'Fund Received Document (Installment)',
                'fund_received_document_overall_s3_key': 'Overall Fund Document',
                'budget_head_name': 'Budget Head', 'budget_percentage': 'Budget (%)',
                'budget_head_value_inr': 'Budget Value (INR)', 'actual_expense_inr': 'Actual Expense (INR)',
                'balance_fund_inr': 'Balance Fund (INR)',
                'deliverable_description': 'Deliverable', 'deliverable_status': 'Deliverable Status',
                'total_project_staff_count': 'Total Staff', 'staff_name': 'Staff Name', 'staff_role': 'Staff Role',
                'staff_stipend_rate_inr': 'Stipend Rate (INR)', 'staff_months_stipend_paid': 'Months Paid',
                'staff_total_stipend_paid_inr': 'Total Stipend (INR)', 'staff_per_diem_paid_inr': 'Per Diem (INR)',
                'staff_photograph_s3_key': 'Staff Photograph','staff_joining_date': 'Staff Joining Date','staff_end_date': 'Staff End Date','staff_status': 'Staff Status',
                'equipment_name_description': 'Equipment', 'quantity_of_equipment': 'Quantity',
                'cost_per_unit_inr': 'Cost/Unit (INR)', 'total_cost_equipments_inr': 'Total Equipment Cost (INR)',
                'equipment_bills_s3_key': 'Equipment Bills File',
                'project_image_s3_key': 'Project Image File', 'final_report_document_s3_key': 'Final Report File'
            };
            const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // **** ADD THIS LOG ****
            if (key === 'project_id_funder') {
                console.log(`[getFriendlyLabel] For key '${key}', returning label: '${label}'`);
            }
            // **** END OF ADDED LOG ****
            return label;    }



function formatDisplayValue(key, value) {
    // --- UNIFIED FILE HANDLING LOGIC ---
    const isFileKey = key && (key.toLowerCase().endsWith('_s3_key') || key.toLowerCase().endsWith('_file') || key.toLowerCase().endsWith('_files'));

    if (isFileKey) {
        let fileKeys = [];
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            try { fileKeys = JSON.parse(value); } catch (e) { fileKeys = []; }
        } else if (Array.isArray(value)) {
            fileKeys = value;
        } else if (typeof value === 'string' && value) {
            fileKeys = [value];
        }

        if (fileKeys.length === 0 || !fileKeys[0]) {
            return '<em style="color: #999;">N/A</em>';
        }

        return fileKeys.map(fileKey => {
            if (!fileKey) return '';
            const fileName = String(fileKey).split('/').pop();
            const safeKey = encodeURIComponent(fileKey);
            return `<a href="#" onclick="event.preventDefault(); window.previewFile('${safeKey}')" class="file-download-link" title="Click to preview ${fileName}">${fileName}</a>`;
        }).join('<br>');
    }

    let displayValue = value;

    // --- LIST OF FIELDS THAT ARE STRINGS AND SHOULD NOT BE FORMATTED AS CURRENCY ---
    const nonCurrencyKeywords = [
        'project_id_funder', 'funder_type', 'type_of_grant', 'project_title',
        'department_name', 'fcra_type', 'application_id', 'project_id_odr',
        'funding_agencies_name', 'collaboration_name', 'collaboration_country_of_origin', 'collaboration_contact_details',
        'name_of_pi', 'pi_contact_details', 'pi_affiliating_institution', 'pi_affiliating_country',
        'name_of_co_pi', 'co_pi_contact_details', 'co_pi_affiliating_institution', 'co_pi_affiliating_country',
        'project_status', 'application_status', 'currency', 'project_duration', // 'currency_code' changed to 'currency'
        'financial_closing_status', 'fy_year_installment', 'budget_head_name',
        'deliverable_description', 'deliverable_status', 'staff_name', 'staff_role', 'staff_status',
        'equipment_name_description',
        'gst_applicable' // <-- **GST IS NOW EXCLUDED FROM CURRENCY FORMATTING**
    ];

    // --- FORMATTING LOGIC CHAIN ---
    if (key && key.toLowerCase().includes('date') && value) {
        displayValue = formatDate(value, 'DD-MM-YYYY');
    } else if (key === 'project_website_link' && value && typeof value === 'string' && value.startsWith('http')) {
        const cleanValue = String(value).replace(/"/g, '"');
        displayValue = `<a href="${cleanValue}" target="_blank" rel="noopener noreferrer" style="color: blue; text-decoration: underline;">${cleanValue}</a>`;
    } else if (key === 'gst_applicable' && value) {
        // **GST now has its own specific formatting rule**
        displayValue = value; // Displays 'Yes', 'No', or 'Exempted' directly
    } else if (typeof value === 'boolean') {
        // General boolean handler (for any other potential boolean fields)
        displayValue = value ? 'Yes' : 'No';
    } else if (key && key.includes('percentage')) {
        displayValue = formatPercentage(value);
    } else if (typeof value === 'number' && !nonCurrencyKeywords.includes(key)) {
        // A more robust check: if it's a number and not in the exclusion list, format as currency.
        displayValue = formatCurrency(value);
    }

    // --- FINAL NULL/EMPTY AND SANITIZATION CHECKS ---
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        // Use the originally set displayValue unless it's still the raw value
        if (displayValue === value) {
            displayValue = '<em style="color: #999;">N/A</em>';
        }
    } else if (typeof displayValue === 'string' && !displayValue.startsWith('<a') && !displayValue.startsWith('<em')) {
        // Basic sanitization for display
        displayValue = displayValue.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/'/g, "'");
    }

    return displayValue;
}




/**
 * Main function to generate the entire dashboard HTML string.
 * @param {object} grant - The full grant data object from the API.
 * @returns {string} - The complete HTML for the modal body.
 */

// REPLACE your existing generateDashboardHtml function with this one
function generateDashboardHtml(grant) {
    const core = grant.coreInfo || {};
    const dates = grant.datesStatus || {};
    const amounts = grant.amountsOverheads || {};
    const staff = grant.projectStaff || [];
    const piNames = grant.principalInvestigators?.map(p => p.name_of_pi).join(', ') || 'N/A';
    
    const endDate = dates.project_end_date ? new Date(dates.project_end_date) : null;
    let daysRemaining = 'N/A';
    if(endDate && dates.project_status === "In Progress") {
        const today = new Date(); today.setHours(0,0,0,0);
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays >= 0 ? `${diffDays} days` : 'Past Due';
    }

    const sanctioned = amounts.grant_amount_in_inr || 0;
    
    const overheads = amounts.overheads_secured || 0;
    const totalStaff = staff.length;
    const statusClass = (dates.project_status || '').toLowerCase().replace(/ /g, '-');

    return `
    <div class="dashboard-container">
        <!-- Header & KPIs (Unchanged) -->
        <div class="dashboard-header">
            <h3><i class="fas fa-rocket"></i> ${core.project_title || 'N/A'}</h3>
            <div class="header-meta">
                <span><strong>PI(s):</strong> ${piNames}</span>
                <span class="status-badge ${statusClass}"><i class="fas fa-info-circle mr-2"></i>${dates.project_status || 'N/A'}</span>
            </div>
        </div>
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-icon bg-blue-100"><i class="fas fa-coins"></i></div><div class="kpi-content"><div class="kpi-title">Total Sanctioned (INR)</div><div class="kpi-value">${formatCurrency(sanctioned)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon bg-green-100"><i class="fas fa-university"></i></div><div class="kpi-content"><div class="kpi-title">Overheads Secured (INR)</div><div class="kpi-value">${formatCurrency(overheads)}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon bg-amber-100"><i class="fas fa-users"></i></div><div class="kpi-content"><div class="kpi-title">Project Staff Count</div><div class="kpi-value">${totalStaff}</div></div></div>
            <div class="kpi-card"><div class="kpi-icon bg-red-100"><i class="fas fa-hourglass-half"></i></div><div class="kpi-content"><div class="kpi-title">Time Remaining</div><div class="kpi-value">${daysRemaining}</div></div></div>
        </div>

        <!-- NEW, CORRECTED LAYOUT FOR ALL CHARTS AND COMPONENTS -->
        <div class="dashboard-grid">
            
            <!-- Financial Charts -->
            <div class="chart-wrapper">
                <h4>Funds Received Over Time (Cumulative)</h4>
                <canvas id="fundsLineChart"></canvas>
            </div>
            <div class="chart-wrapper">
                <h4>Budget Allocation vs. Expenditure</h4>
                <canvas id="budgetBarChart"></canvas>
            </div>
            
            <!-- Operational Components -->
            <div class="chart-wrapper">
                <h4>Upcoming Deadlines</h4>
                <div id="taskListContainer"></div>
            </div>
            <div class="chart-wrapper">
                <h4>Staff Contracts</h4>
                <div id="staffContractsContainer"></div>
            </div>
            
            <!-- Equipment Summary (takes the full width) -->
            <div class="chart-wrapper full-width">
                <h4>Assigned Equipment Summary</h4>
                <div id="equipmentSummaryContainer"></div>
            </div>

        </div>
    </div>`;
}
/**
 * Initializes all the Chart.js charts on the dashboard.
 * Must be called *after* the dashboard HTML is added to the DOM.
 * @param {object} grant - The full grant data object.
 */

// REPLACE THE ENTIRE OLD FUNCTION WITH THIS NEW VERSION
// REPLACE THE ENTIRE OLD FUNCTION WITH THIS NEW VERSION
function initializeDashboardComponents(grant) {
    // --- Data Extraction ---
    const dates = grant.datesStatus || {};
    const budgetHeads = grant.budgetHeads || [];
    const deliverables = grant.projectDeliverables || [];
    const installments = grant.fundInstallments || [];
    const staff = grant.projectStaff || [];
    const manualEquipment = grant.projectEquipments || [];
    const inventoryEquipment = grant.assignedInventory || [];

    // --- Budget Bar Chart (No changes here) ---
    const budgetBarChartCtx = document.getElementById("budgetBarChart");
    if (budgetBarChartCtx) { 
        new Chart(budgetBarChartCtx, { type: 'bar', data: { labels: budgetHeads.map(b => b.budget_head || 'Unnamed'), datasets: [{ label: 'Allocated (INR)', data: budgetHeads.map(b => b.budget_value || 0), backgroundColor: 'rgba(59, 130, 246, 0.6)' }, { label: 'Spent (INR)', data: budgetHeads.map(b => b.actual_expense || 0), backgroundColor: 'rgba(239, 68, 68, 0.6)' }] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } } }, plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } } } });
    }

    // =========================================================================
    // ========= THE LOGIC FOR THIS CHART IS COMPLETELY REWRITTEN ============
    // =========================================================================
    const fundsLineChartCtx = document.getElementById("fundsLineChart");
    if (fundsLineChartCtx) {
        if (installments.length === 0) { 
            fundsLineChartCtx.parentElement.innerHTML += '<div style="display: flex; align-items: center; justify-content: center; height: 250px;"><p style="color: #6b7280;">No fund installments recorded.</p></div>'; 
        } else {
            // 1. Prepare three arrays: labels for the X-axis, individual amounts for the line, and cumulative for the tooltip.
            let dataPoints = [];
            // Add a starting point at the project's start date with a value of 0 for a clean timeline
            if (dates.project_start_date) {
                dataPoints.push({ installment_date: dates.project_start_date, installment_amount_inr: 0 });
            }
            dataPoints = dataPoints.concat(installments);

            const sortedPoints = dataPoints.sort((a, b) => new Date(a.installment_date) - new Date(b.installment_date));
            
            let cumulativeAmount = 0;
            const lineChartLabels = [];
            const individualAmounts = [];
            const cumulativeAmounts = [];

            sortedPoints.forEach(point => {
                const installmentValue = point.installment_amount_inr || 0;
                cumulativeAmount += installmentValue;

                lineChartLabels.push(formatDate(point.installment_date, 'DD-MMM-YYYY'));
                individualAmounts.push(installmentValue);
                cumulativeAmounts.push(cumulativeAmount);
            });
            
            // 2. Configure the new Chart with detailed options
            new Chart(fundsLineChartCtx, {
                type: 'line',
                data: {
                    labels: lineChartLabels,
                    datasets: [{
                        label: "Installment Amount",
                        data: individualAmounts, // The line now plots the INDIVIDUAL installment amounts
                        borderColor: "#F59E0B", // Amber-500 for the line
                        backgroundColor: "rgba(245, 158, 11, 0.1)", // Light amber for the area fill
                        fill: true,
                        tension: 0, // Makes it a step-like chart
                        pointRadius: 6,
                        pointBackgroundColor: '#F59E0B'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Installment Amount (INR)' },
                            ticks: { callback: value => formatCurrency(value) }
                        },
                        x: {
                            title: { display: true, text: 'Installment Date' }
                        }
                    },
                    plugins: {
                        // This is the custom tooltip logic
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const individual = formatCurrency(context.parsed.y);
                                    // Use the dataIndex to get the cumulative value from our separate array
                                    const cumulative = formatCurrency(cumulativeAmounts[context.dataIndex]);
                                    return [
                                        `Installment: ${individual}`,
                                        `Cumulative Received: ${cumulative}`
                                    ];
                                }
                            }
                        },
                        // This configures the datalabels plugin we added
                        datalabels: {
                            align: 'end',
                            anchor: 'end',
                            backgroundColor: 'rgba(245, 158, 11, 0.8)',
                            borderRadius: 4,
                            color: 'white',
                            font: { weight: 'bold' },
                            padding: { top: 4, bottom: 2, left: 6, right: 6 },
                            formatter: (value) => {
                                // Don't show a label for 0
                                return value > 0 ? formatCurrency(value) : null;
                            }
                        },
                        title: {
                            display: true,
                            text: 'Installment Amounts Received'
                        },
                        legend: {
                            display: false // Hiding the legend as the title is clear enough
                        }
                    }
                }
            });
        }
    }
    // =========================================================================
    // ========= END OF REWRITTEN CHART LOGIC ================================
    // =========================================================================

    // --- Task List (Upcoming Deadlines) (remains the same) ---
    const taskListContainer = document.getElementById('taskListContainer');
    if (taskListContainer) {
        const pendingTasks = deliverables.filter(d => d.deliverable_status !== 'Completed').sort((a, b) => new Date(a.deliverable_due_date) - new Date(b.deliverable_due_date));
        if (pendingTasks.length > 0) { let html = '<ul class="task-list">'; pendingTasks.forEach(task => { const dueDate = new Date(task.deliverable_due_date); const day = dueDate.getDate(); const month = dueDate.toLocaleString('default', { month: 'short' }).toUpperCase(); const statusClass = (task.deliverable_status || 'not-started').toLowerCase().replace(/ /g, '-'); html += `<li class="task-list-item"><div class="task-date"><span>${day}</span><small>${month}</small></div><div class="task-desc">${task.deliverable_description}</div><div class="task-status ${statusClass}">${task.deliverable_status}</div></li>`; }); html += '</ul>'; taskListContainer.innerHTML = html; } else { taskListContainer.innerHTML = '<p style="text-align: center; color: #6b7280; padding-top: 2rem;">All deliverables are marked as complete!</p>'; }
    }

    // --- Staff Contract Analysis (remains the same) ---
    const staffContainer = document.getElementById('staffContractsContainer');
    if (staffContainer) {
        if (staff.length > 0) { let html = '<ul class="staff-contracts-list">'; staff.forEach(member => { const startDate = new Date(member.staff_joining_date); const endDate = new Date(member.staff_end_date); let progress = 0, timeLeft = "N/A", barColorClass = 'bg-red-500'; if (!isNaN(startDate) && !isNaN(endDate) && endDate > startDate) { const totalDuration = endDate.getTime() - startDate.getTime(); const elapsedDuration = new Date().getTime() - startDate.getTime(); progress = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100)); const daysRemaining = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)); timeLeft = daysRemaining > 0 ? `${daysRemaining} days left` : 'Contract Ended'; if (daysRemaining > 60) barColorClass = 'bg-green-500'; else if (daysRemaining > 0) barColorClass = 'bg-amber-500'; } html += `<li class="staff-contract-item"><div class="staff-info"><span class="staff-name">${member.staff_name}</span><span class="staff-time-left">${timeLeft}</span></div><div class="progress-bar-container"><div class="progress-bar-fill ${barColorClass}" style="width: ${progress.toFixed(0)}%;"></div></div></li>`; }); html += '</ul>'; staffContainer.innerHTML = html; } else { staffContainer.innerHTML = '<p style="text-align: center; color: #6b7280; padding-top: 2rem;">No staff members have been added.</p>'; }
    }

    // --- Equipment Summary (remains the same) ---
    const equipmentContainer = document.getElementById('equipmentSummaryContainer');
    if (equipmentContainer) {
        const allEquipment = [...manualEquipment.map(e => ({ ...e, source: 'Manual' })), ...inventoryEquipment.map(e => ({ ...e, source: 'Inventory' }))];
        const totalValue = manualEquipment.reduce((sum, item) => sum + (item.total_cost || 0), 0);
        let html = `<div class="equipment-summary"><div class="summary-box"><div class="value">${allEquipment.length}</div><div class="label">Total Items Assigned</div></div><div class="summary-box"><div class="value">${formatCurrency(totalValue)}</div><div class="label">Value of Purchased Items</div></div></div><div class="equipment-list">`;
        if (allEquipment.length > 0) { allEquipment.forEach(item => { const iconClass = item.source === 'Inventory' ? 'fa-warehouse' : 'fa-shopping-cart'; html += `<div class="equipment-list-item"><span class="icon"><i class="fas ${iconClass}"></i></span><div class="details"><div class="name">${item.equipment_name_description || item.item}</div><div class="meta">Source: ${item.source}${item.tag_no ? ` | Tag: ${item.tag_no}` : ''}${item.quantity_of_equipment ? ` | Qty: ${item.quantity_of_equipment}` : ''}</div></div></div>`; }); } else { html += '<p style="text-align: center; color: #6b7280; padding: 1rem 0;">No equipment has been assigned to this project.</p>'; }
        html += '</div>';
        equipmentContainer.innerHTML = html;
    }
}
// REPLACE your existing showGrantDetailsPopup function with this one.
async function showGrantDetailsPopup(grantDbId) {
    const modal = document.getElementById('grantDetailsModal');
    const modalContent = document.getElementById('grantDetailsModalContent');
    const modalTitleEl = document.getElementById('modalTitle');
    const modalBodyContent = document.getElementById('modalBodyContent');

    if (!modal || !modalContent || !modalTitleEl || !modalBodyContent) {
        console.error("Modal elements not found!");
        return;
    }

    // Make the modal wider to accommodate the dashboard and details
    modalContent.classList.add('modal-content-dashboard');

    modalTitleEl.textContent = `Project Details : ${grantDbId}`;
    modalBodyContent.innerHTML = '<p style="text-align: center;">Loading details...</p>';
    openModal('grantDetailsModal');

    try {
        const safeGrantId = encodeURIComponent(grantDbId);
        const response = await fetch(`${API_BASE_URL}/external-grants/${safeGrantId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Fetch failed (Status: ${response.status}) - ${errorData.message || 'Server error'}`);
        }
        
        const grantFullData = await response.json();
        
        // 1. Generate the new tabbed HTML structure
        modalBodyContent.innerHTML = generateTabbedModalHtml(grantFullData);
        
        // 2. Initialize the tab switching functionality
        initializeModalTabs();
        
        // 3. Initialize charts for the (now hidden) dashboard tab
        setTimeout(() => {
            initializeDashboardComponents(grantFullData); // <-- Use the new function name
        }, 100);
    } catch (error) {
        console.error("Error fetching/displaying grant details:", error);
        modalBodyContent.innerHTML = `<p style="text-align: center; color: red;">Error loading details: ${error.message}</p>`;
    }
}

/**
 * Generates the HTML for the "Full Details" tab using a read-only accordion format.
 * @param {object} grant - The full grant data object from the API.
 * @returns {string} - The complete HTML for the details view.
 */
// REPLACE your existing generateFullDetailsHtml function with this one
function generateFullDetailsHtml(grant) {
    // Helper to render a single section of simple key-value pairs
    function renderSection(title, dataObject, sectionNumber, iconClass, gridClass = 'lg:grid-cols-2') {
        if (!dataObject || Object.keys(dataObject).length === 0) return '';

        const contentHtml = Object.entries(dataObject)
            .map(([key, value]) => {
                const label = getFriendlyLabel(key);
                if (!label || key === 'id' || key.includes('_id')) return '';
                return `<div class="detail-item"><strong>${label}</strong><span>${formatDisplayValue(key, value)}</span></div>`;
            }).join('');
        if (!contentHtml.trim()) return '';

        return `
            <div class="details-accordion-section">
                <div class="details-accordion-header"><i class="fas ${iconClass} mr-3 text-gray-500"></i> ${sectionNumber}. ${title}</div>
                <div class="details-accordion-content grid ${gridClass} gap-x-8">
                    ${contentHtml}
                </div>
            </div>`;
    }

    // Helper to render a section that contains an array of objects
    function renderArraySection(title, dataArray, sectionNumber, iconClass) {
        let contentHtml;
        if (!dataArray || dataArray.length === 0) {
            contentHtml = `<div class="detail-item col-span-full"><span><em class="text-gray-500">No data provided for this section.</em></span></div>`;
        } else {
            contentHtml = dataArray.map((item, index) => {
                const itemDetails = Object.entries(item)
                    .map(([key, value]) => {
                        const label = getFriendlyLabel(key);
                        if (!label || key === 'id' || key.includes('_id')) return '';
                        return `<div class="detail-item"><strong>${label}</strong><span>${formatDisplayValue(key, value)}</span></div>`;
                    }).join('');
                return `<div class="detail-subsection col-span-full bg-gray-50 p-4 rounded-lg">
                            <h4 class="font-semibold text-gray-700 mb-2 border-b pb-2">Entry #${index + 1}</h4>
                            <div class="grid lg:grid-cols-2 gap-x-8">${itemDetails}</div>
                        </div>`;
            }).join('');
        }
        
        return `
            <div class="details-accordion-section">
                <div class="details-accordion-header"><i class="fas ${iconClass} mr-3 text-gray-500"></i> ${sectionNumber}. ${title}</div>
                <div class="details-accordion-content grid lg:grid-cols-1 gap-y-4">
                    ${contentHtml}
                </div>
            </div>`;
    }

    // Build the entire HTML string by calling the helpers with icons and grid classes
    return `
        ${renderSection("Core Project Info", grant.coreInfo, 1, 'fa-info-circle', 'lg:grid-cols-3')}
        ${renderSection("Dates & Status", grant.datesStatus, 2, 'fa-calendar-alt', 'lg:grid-cols-3')}
        ${renderArraySection("Funding & Collaboration", grant.fundingCollaborations, 3, 'fa-handshake')}
        ${renderArraySection("Principal Investigator (PI)", grant.principalInvestigators, 4, 'fa-user-tie')}
        ${renderArraySection("Co-Investigator(s) (Co-PI)", grant.coInvestigators, 5, 'fa-user-friends')}
        ${renderSection("Grant Amounts & Overheads", grant.amountsOverheads, 6, 'fa-piggy-bank', 'lg:grid-cols-3')}
        ${renderArraySection("Funds Received & Installments", grant.fundInstallments, 7, 'fa-cash-register')}
        ${renderArraySection("Project Budget Head", grant.budgetHeads, 8, 'fa-chart-pie')}
        ${renderArraySection("Project Deliverables", grant.projectDeliverables, 9, 'fa-tasks')}
        ${renderArraySection("Project Staff", grant.projectStaff, 10, 'fa-users-cog')}
        ${renderArraySection("Project Equipments (Manual)", grant.projectEquipments, 11, 'fa-tools')}
        ${renderArraySection("Project Equipments (Inventory)", grant.assignedInventory, 11, 'fa-warehouse')}
        ${renderSection("Files & Other", grant.filesOther, 12, 'fa-paperclip')}
    `;
}

/**
 * Generates the main tabbed structure for the modal.
 * @param {object} grant - The full grant data object.
 * @returns {string} The HTML for the entire modal body, including tabs and content panes.
 */
function generateTabbedModalHtml(grant) {
    return `
        <div class="modal-tabs">
            <button class="modal-tab-button active" data-tab="dashboard">Summary</button>
            <button class="modal-tab-button" data-tab="details">All Details</button>
        </div>
        
        <div id="tab-dashboard" class="tab-content active">
            ${generateDashboardHtml(grant)}
        </div>
        
        <div id="tab-details" class="tab-content">
            ${generateFullDetailsHtml(grant)}
        </div>
    `;
}




/**
 * Adds event listeners to the modal tabs to handle switching between views.
 */
function initializeModalTabs() {
    const tabButtons = document.querySelectorAll('.modal-tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate clicked
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}


    // --- SECTION 6: FINANCIAL CALCULATION LOGIC ---

      

        // This function gathers PI data directly from the form's DOM
        function getPIsFromForm() {
            const pis = [];
            document.querySelectorAll('#piContainer_S4 .pi-entry').forEach((entry, index) => {
                const nameInput = entry.querySelector('input[name="name_of_pi[]"]');
                // The backend now returns a PI `id` when fetching grant data. We need to store it.
                // We will add a hidden input in the PI template to hold this ID.
                const idInput = entry.querySelector('input[name="pi_id[]"]'); 
                if (nameInput && nameInput.value && idInput && idInput.value) {
                    pis.push({
                        id: idInput.value,
                        name: nameInput.value
                    });
                }
            });
            return pis;
        }

        async function openAssignInventoryModal() {
            if (!document.getElementById('application_id').value) {
                alert("Please save the grant with a valid Application ID before assigning inventory.");
                return;
            }

            piDropdownContainer.style.display = 'none'; // Hide PI dropdown initially
            inventoryDropdown.innerHTML = '<option value="">Loading available assets...</option>';
            inventoryDropdown.disabled = true;
            openModal('assignInventoryModal');

            try {
                // Fetch available assets (this part is unchanged)
                const response = await fetch('/api/inventory/available', { headers: {'Authorization': `Bearer ${localStorage.getItem('accessToken')}`} });
                if (!response.ok) throw new Error('Could not fetch available inventory.');
                const availableAssets = await response.json();

                inventoryDropdown.innerHTML = '<option value="">-- Select an asset --</option>';
                if (availableAssets.length > 0) {
                    availableAssets.forEach(asset => {
                        const option = document.createElement('option');
                        option.value = asset.id;
                        option.textContent = `${asset.asset_category}: ${asset.item} (${asset.tag_no})`;
                        inventoryDropdown.appendChild(option);
                    });
                    inventoryDropdown.disabled = false;
                } else {
                    inventoryDropdown.innerHTML = '<option value="">No assets are currently in stock.</option>';
                }
            } catch (error) {
                console.error("Inventory fetch error:", error);
                inventoryDropdown.innerHTML = `<option value="">Error: ${error.message}</option>`;
            }
        }

        function populatePiDropdown() {
            const pis = getPIsFromForm();
            piDropdown.innerHTML = '';
            
            if (pis.length > 0) {
                pis.forEach(pi => {
                    const option = document.createElement('option');
                    option.value = pi.id;
                    option.textContent = pi.name;
                    piDropdown.appendChild(option);
                });
                piDropdownContainer.style.display = 'block'; // Show the PI dropdown
            } else {
                piDropdownContainer.style.display = 'none'; // Hide if no PIs are on the grant
            }
        }
        
        inventoryDropdown.addEventListener('change', () => {
             if (inventoryDropdown.value) {
                populatePiDropdown();
             } else {
                piDropdownContainer.style.display = 'none';
             }
        });

        async function handleConfirmAssignment() {
            const assetId = inventoryDropdown.value;
            const piId = piDropdown.value;
            const piName = piDropdown.options[piDropdown.selectedIndex]?.text; // Get the selected PI's name
            const grantApplicationId = document.getElementById('application_id').value;
            const projectName = document.getElementById('project_title').value;

            if (!assetId || !piId) {
                alert('Please select an asset and a PI to assign it to.');
                return;
            }
            
            confirmAssignBtn.disabled = true;
            confirmAssignBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Assigning...';

            try {
                const response = await fetch(`/api/inventory/assign/${assetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
                    body: JSON.stringify({
                        grant_application_id: grantApplicationId,
                        grant_type: 'EXTERNAL',
                        pi_id: piId, // <-- SEND THE PI ID
                        assigned_to: piName, // Send the name for display purposes
                        project_name: projectName,
                        assigned_date: new Date().toISOString().split('T')[0]
                    })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                alert(result.message);
                closeModal('assignInventoryModal');
                await showForm(grantApplicationId); // Refresh the form

            } catch (error) {
                console.error('Assignment error:', error);
                alert(`Error assigning asset: ${error.message}`);
            } finally {
                confirmAssignBtn.disabled = false;
                confirmAssignBtn.innerHTML = '<i class="fas fa-link mr-2"></i>Assign Asset';
            }
        }
        
        // --- (End of new inventory logic) ---
    // 1. Get references to the input fields involved in the calculation.
    const sanctionedAmountInrInput = document.getElementById('grant_amount_in_inr');
    const overheadsPercentageInput = document.getElementById('overheads_percentage');
    const overheadsSecuredInrInput = document.getElementById('overheads_secured_inr');

    // 2. Create the function that performs the calculation.
    function calculateOverheads() {
        // Read the values from the input fields and convert them to numbers.
        // Use `|| 0` to handle empty fields gracefully.
        const sanctionedAmount = parseFloat(sanctionedAmountInrInput.value) || 0;
        const percentage = parseFloat(overheadsPercentageInput.value) || 0;

        // Check if we have valid numbers to work with.
        if (sanctionedAmount > 0 && percentage > 0) {
            // Calculate the overheads.
            const overheadsValue = sanctionedAmount * (percentage / 100);
            
            // Update the "Overheads Secured (INR)" field with the result, formatted to 2 decimal places.
            overheadsSecuredInrInput.value = overheadsValue.toFixed(2);
        } else {
            // If the inputs are not valid, clear the result field.
            overheadsSecuredInrInput.value = '';
        }
    }

    // 3. Attach event listeners to the two input fields.
    // This will make the `calculateOverheads` function run every time the user types.
    if (sanctionedAmountInrInput) {
        sanctionedAmountInrInput.addEventListener('input', calculateOverheads);
    }
    if (overheadsPercentageInput) {
        overheadsPercentageInput.addEventListener('input', calculateOverheads);
    }

    // --- END OF SECTION 6 CALCULATION LOGIC ---

        // --- Event Listeners Setup ---
        // --- Event Listeners Setup ---

        // Global Search (now triggers a server-side filter)
        if (globalSearchInput) {
            // Use the 'input' event to capture every change, including typing, backspace, and pasting.
            globalSearchInput.addEventListener('input', () => {
                // IMPORTANT: Reset to the first page every time the search term changes.
                currentPage = 1; 
                // Re-run the display function, which will apply the new filter from the search box.
                displayCurrentPage();
            });
        }
        
        // Main Form Buttons
        if (addGrantBtn) addGrantBtn.addEventListener('click', () => showForm());
        if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
        if (grantForm) grantForm.addEventListener('submit', handleFormSubmit);

        // --- NEW FILTER MODAL LISTENERS ---
        if (openFilterModalBtn) {
            openFilterModalBtn.addEventListener('click', () => openModal('advancedFilterModal'));
        }
        if (closeFilterModalBtn) {
            closeFilterModalBtn.addEventListener('click', () => closeModal('advancedFilterModal'));
        }

        if (advancedFilterForm) {
            advancedFilterForm.addEventListener('submit', (event) => {
                event.preventDefault(); // Prevent default form submission

                // Collect all filter values
                const filters = {
                    projectTitle: document.getElementById('filterProjectTitle').value,
                    fundingAgency: document.getElementById('filterFundingAgency').value,
                    collaborator: document.getElementById('filterCollaborator').value,
                    collaboratorCountry: document.getElementById('filterCollaboratorCountry').value,
                    schools: Array.from(document.querySelectorAll('input[name="filterSchools"]:checked')).map(cb => cb.value),
                    grantTypes: Array.from(document.querySelectorAll('input[name="filterGrantType"]:checked')).map(cb => cb.value),
                    funderTypes: Array.from(document.querySelectorAll('input[name="filterFunderType"]:checked')).map(cb => cb.value),
                    startDate: document.getElementById('filterStartDate').value,
                    endDate: document.getElementById('filterEndDate').value,
                    minAmount: document.getElementById('filterMinAmount').value,
                    maxAmount: document.getElementById('filterMaxAmount').value,
                };

                fetchAndDisplayGrants(filters);
                closeModal('advancedFilterModal');
            });
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (advancedFilterForm) advancedFilterForm.reset();
                fetchAndDisplayGrants(); // Fetch all grants again
                // No need to close modal, user might want to set new filters
            });
        }
        
        // Inventory Modal Listeners
        if (assignInventoryBtn_S11) assignInventoryBtn_S11.addEventListener('click', openAssignInventoryModal);
        if (closeAssignModalBtn) closeAssignModalBtn.addEventListener('click', () => closeModal('assignInventoryModal'));
        if (cancelAssignBtn) cancelAssignBtn.addEventListener('click', () => closeModal('assignInventoryModal'));
        if (confirmAssignBtn) confirmAssignBtn.addEventListener('click', handleConfirmAssignment);

        // Table Action Buttons (Event Delegation)
        if (tableBody) {
            tableBody.addEventListener('click', (event) => {
                const target = event.target;
                const actionButton = target.closest('.view-details-btn, .edit-btn, .delete-btn');
                if (!actionButton) return;
                const grantDbId = actionButton.dataset.id;
                if (!grantDbId) return;

                if (actionButton.classList.contains('view-details-btn')) showGrantDetailsPopup(grantDbId);
                else if (actionButton.classList.contains('edit-btn')) showForm(grantDbId);
                else if (actionButton.classList.contains('delete-btn')) deleteGrant(grantDbId);
            });
        } else { console.error("CRITICAL: Table body element not found."); }




window.previewFile = async function previewFile(encodedKey) {
    // The key is encoded to be URL-safe. We will make the link in the next step.
    const statusElement = document.getElementById('modalBodyContent');
    const originalContent = statusElement ? statusElement.innerHTML : '';
    
    try {
        // Call our new backend endpoint
        const response = await fetch(`${API_BASE_URL}/external-grants/preview/${encodedKey}`, {
             headers: {'Authorization': `Bearer ${localStorage.getItem('accessToken')}`}
        });
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Server error generating preview link.');
        }

        // Open the secure, temporary URL returned from the backend in a new tab
        window.open(data.url, '_blank');
        
    } catch (error) {
        console.error('File preview error:', error);
        alert(`Could not open file: ${error.message}`);
    }
}
    
    
        function formatDate(dateString, format = 'DD-MM-YYYY') {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString; // Return original if invalid date

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
            return `${day}-${month}-${year}`; // Default DD-MM-YYYY
        }
        // Add this new helper function
        function getStatusBadgeClass(status) {
            const s = status ? status.toLowerCase() : '';
            if (s.includes('progress') || s.includes('active')) return 'status-inprogress';
            if (s.includes('completed')) return 'status-completed';
            if (s.includes('submitted') || s.includes('review')) return 'status-review';
            if (s.includes('unsuccessful') || s.includes('terminated') || s.includes('rejected')) return 'status-rejected';
            if (s.includes('successful') || s.includes('approved')) return 'status-approved';
            return 'status-completed'; // A default fallback color
        }
        function formatCurrency(value) {
            if (value === null || value === undefined || isNaN(parseFloat(value))) return 'N/A';
            // This new formatter uses the Indian Rupee style
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 0, // No decimals for cleaner look
                maximumFractionDigits: 0
            }).format(value);
        }
        function formatPercentage(value) {
            if (value === null || value === undefined || isNaN(parseFloat(value))) return 'N/A';
            return `${parseFloat(value).toFixed(1)}%`;
        }

        
        

        


async function handleUnassignItem(inventoryId) {
    if (!confirm("Are you sure you want to unassign this item and return it to the inventory stock?")) {
        return;
    }

    try {
        const response = await fetch(`/api/inventory/unassign/${inventoryId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert(result.message);
        
        // Refresh the form to show the item has been removed
        const grantId = document.getElementById('application_id')?.value || document.getElementById('applicationNumber')?.value;
        if (grantId) {
            showForm(grantId);
        }

    } catch (error) {
        console.error("Unassign error:", error);
        alert(`Error: ${error.message}`);
    }
}

// In the main event listener for the form container...
grantForm.addEventListener('click', (event) => {
    if (event.target.classList.contains('unassign-inventory-btn')) {
        const inventoryId = event.target.dataset.inventoryId;
        handleUnassignItem(inventoryId);
    }
});




async function exportVisibleFullData() {
    if (!table || !tableBody) { alert("Data table not found."); return; }
    const visibleRows = Array.from(tableBody.querySelectorAll("tr:not([style*='display: none'])"));

    const projectIdsToExport = visibleRows
        .map(row => row.dataset.id)
        .filter(id => id); // Filter out any undefined/null IDs

    if (projectIdsToExport.length === 0) {
        alert("No visible grants to export. Please adjust filters or add data."); 
        return;
    }

    const exportButton = document.querySelector('.export-all-btn');
    const originalButtonText = exportButton ? exportButton.innerHTML : 'Export Visible Records';
    if (exportButton) { 
        exportButton.disabled = true; 
        exportButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Exporting...'; 
    }

    try {
        const response = await fetch(`${API_BASE_URL}/external-grants/export`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            },
            body: JSON.stringify({ ids: projectIdsToExport })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch data for export (Status: ${response.status}) - ${errData.message || 'Server error'}`);
        }
        
        const fullGrantDataArray = await response.json();
        
        if (!Array.isArray(fullGrantDataArray) || fullGrantDataArray.length === 0) {
            alert("No detailed data received from server for export."); 
            return;
        }

        // Call the new Excel generation function
        exportDataToExcel(fullGrantDataArray);

    } catch (error) {
        console.error("Error during export:", error); 
        alert(`Failed to export data: ${error.message}`);
    } finally {
        if (exportButton) { 
            exportButton.disabled = false; 
            exportButton.innerHTML = originalButtonText; 
        }
    }
}

/**
 * Processes comprehensive grant data and generates a multi-sheet XLSX file.
 * @param {Array<object>} grantsData - The array of full grant data objects from the backend.
 */
function exportDataToExcel(grantsData) {
    const workbook = XLSX.utils.book_new();

    // --- SHEET 1: Main Grant Details (Static Sections) ---
    const mainSheetData = grantsData.map(grant => {
        const core = grant.coreInfo || {};
        const dates = grant.datesStatus || {};
        const amounts = grant.amountsOverheads || {};
        const files = grant.filesOther || {};

        // Helper to format JSON file arrays into a clean, comma-separated string
        const formatFiles = (fileData) => {
            if (!fileData) return '';
            try {
                const keys = Array.isArray(fileData) ? fileData : JSON.parse(fileData);
                return keys.map(key => key.split('/').pop()).join(', ');
            } catch {
                return fileData; // Return as is if not a valid JSON array string
            }
        };

        return {
            'Application ID': core.application_id,
            'Project ID (ODR)': core.project_id_odr,
            'Project Title': core.project_title,
            'Department': core.department_name,
            'Funder Type': core.funder_type,
            'FCRA Status': core.fcra_type,
            'Type of Grant': core.type_of_grant,
            'Project Website Link': core.project_website_link,
            'Project Agreement Files': formatFiles(core.project_agreement_files),
            'Application Date': formatDate(dates.application_date, 'DD-MM-YYYY'),
            'Application Status': dates.application_status,
            'Project Status': dates.project_status,
            'Project Start Date': formatDate(dates.project_start_date, 'DD-MM-YYYY'),
            'Project End Date': formatDate(dates.project_end_date, 'DD-MM-YYYY'),
            'Project Duration': dates.project_duration,
            'Application Document Files': formatFiles(dates.application_document_s3_key),
            'Sanctioned Amount (Original)': amounts.grant_sanctioned_amount,
            'Currency': amounts.currency,
            'Exchange Rate (to INR)': amounts.exchange_rate,
            'Sanctioned Amount (INR)': amounts.grant_amount_in_inr,
            'Amount (USD Equiv.)': amounts.amount_in_usd,
            'Overheads (%)': amounts.overheads_percentage,
            'Overheads Secured (INR)': amounts.overheads_secured,
            'Overheads Received (INR)': amounts.overheads_received,
            'GST Applicable': amounts.gst_applicable,
            'Financial Document Files': formatFiles(amounts.financial_documents_s3_key),
            'Project Image Files': formatFiles(files.project_image_s3_key),
            'Final Report Files': formatFiles(files.final_report_document_s3_key),
            'Overall Fund Utilization Files': formatFiles(files.overall_s7_doc_s3_key),
        };
    });
    const mainWorksheet = XLSX.utils.json_to_sheet(mainSheetData);
    XLSX.utils.book_append_sheet(workbook, mainWorksheet, "Main Grant Details");

    // --- DYNAMIC SHEETS ---
    // A helper function to create a sheet for any 1-to-many relationship
    const createDynamicSheet = (sheetName, dataKey, columnMap) => {
        const allItems = [];
        grantsData.forEach(grant => {
            if (grant[dataKey] && grant[dataKey].length > 0) {
                grant[dataKey].forEach(item => {
                    const row = { 'Application ID': grant.coreInfo.application_id };
                    for (const [backendKey, excelHeader] of Object.entries(columnMap)) {
                        row[excelHeader] = item[backendKey];
                    }
                    allItems.push(row);
                });
            }
        });
        if (allItems.length > 0) {
            const worksheet = XLSX.utils.json_to_sheet(allItems);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
    };

    // Define the structure for each dynamic sheet
    createDynamicSheet("Funding & Collaboration", "fundingCollaborations", {
        funding_agencies_name: 'Funding Agency',
        collaboration_name: 'Collaborating Institution',
        collaboration_country_of_origin: 'Collaborator Country'
    });
    createDynamicSheet("Principal Investigators", "principalInvestigators", {
        name_of_pi: 'PI Name',
        pi_contact_details: 'PI Email/Contact',
        pi_affiliating_institution: 'PI Institution',
        pi_affiliating_country: 'PI Country'
    });
    createDynamicSheet("Co-Investigators", "coInvestigators", {
        name_of_co_pi: 'Co-PI Name',
        co_pi_contact_details: 'Co-PI Email/Contact',
        co_pi_affiliating_institution: 'Co-PI Institution',
        co_pi_affiliating_country: 'Co-PI Country'
    });
    createDynamicSheet("Fund Installments", "fundInstallments", {
        fy_year: 'Financial Year',
        installment_date: 'Installment Date',
        installment_amount_inr: 'Installment Amount (INR)',
        bank_fee_inr: 'Bank Fee (INR)'
    });
    createDynamicSheet("Budget Heads", "budgetHeads", {
        budget_head: 'Budget Head',
        budget_percentage: 'Budget (%)',
        budget_value: 'Budget Value (INR)',
        actual_expense: 'Actual Expense (INR)',
        balance_fund: 'Balance Fund (INR)'
    });
    createDynamicSheet("Deliverables", "projectDeliverables", {
        deliverable_type: 'Deliverable Description',
        deliverable_status: 'Status',
        deliverable_due_date: 'Due Date'
    });
    createDynamicSheet("Project Staff", "projectStaff", {
        staff_name: 'Staff Name',
        staff_role: 'Role',
        staff_joining_date: 'Joining Date',
        staff_end_date: 'End Date',
        staff_status: 'Status',
        staff_stipend_rate: 'Stipend Rate (INR)'
    });
    createDynamicSheet("Project Equipments", "projectEquipments", {
        name_of_equipment: 'Equipment Name',
        quantity_of_equipment: 'Quantity',
        cost_per_unit: 'Cost per Unit (INR)',
        total_cost: 'Total Cost (INR)'
    });
    
    // --- Finalize and Download ---
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(workbook, `External_Grants_Report_${timestamp}.xlsx`);
    console.log(`Multi-sheet Excel report generated for ${grantsData.length} grants.`);
}


// =========================================================================
// ========= END: NEW EXPORT LOGIC (REPLACES exportVisibleFullData) =========
// =========================================================================




        const exportBtnGlobal = document.querySelector('.export-all-btn'); // Assuming it's outside any specific scope
        if (exportBtnGlobal) exportBtnGlobal.addEventListener('click', exportVisibleFullData);


  // --- Sidebar Collapse/Toggle Logic ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn'); // Hamburger for mobile
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    // Desktop collapse/expand
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }

    // Mobile hamburger menu toggle
    const toggleMobileSidebar = () => {
        document.body.classList.toggle('sidebar-open');
    };
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleMobileSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleMobileSidebar);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            toggleMobileSidebar();
        }
    });

   // --- (CORRECTED) Logout Functionality ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        console.log("Logging out...");
        // Clear the token and username from localStorage for a full logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        // Redirect the user to the login page (root)
        window.location.href = '/';
    });
}

        // --- Initial Setup ---
        fetchAndDisplayGrants();
        updateFilterButtonVisibility();

    }); 