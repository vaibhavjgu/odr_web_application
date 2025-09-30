document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG & STATE ---
    const API_BASE_URL = '/api/inventory';
    let allInventory = [];
    let filteredInventory = [];
    let currentPage = 1;
    const ROWS_PER_PAGE = 6;
    const ALERT_DAYS_THRESHOLD = 15;
    let isEditMode = false;
    let editingAssetId = null;

    // --- INVENTORY SCHEMA (No changes needed) ---
    const inventorySchema = {
        po_date: { label: 'PO Date', type: 'date', group: 'purchase' },
        po_number: { label: 'PO Number', type: 'text', group: 'purchase' },
        cost: { label: 'Cost (INR)', type: 'number', group: 'purchase', required: true },
        asset_category: { label: 'Asset Category', type: 'select', options: ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Software', 'Networking', 'Accessory','others'], group: 'asset', required: true },
        item: { label: 'Item Description', type: 'text', group: 'asset', required: true, placeholder: 'e.g., Dell Latitude 5420' },
        make: { label: 'Make / Brand', type: 'text', group: 'asset', required: true, placeholder: 'e.g., Dell' },
        tag_no: { label: 'Asset Tag No.', type: 'text', group: 'asset', required: true, unique: true },
        quantity: { label: 'Quantity', type: 'number', group: 'asset', required: true, default: 1 },
        license_key: { label: 'License Key / Activation ID', type: 'textarea', group: 'asset' },
        status: { label: 'Status of Item', type: 'select', options: ['In Stock', 'Assigned', 'Under Maintenance', 'Scrapped', 'Returned'], group: 'assignment', required: true },
        assigned_to: { label: 'Assigned To (PI/RA Name)', type: 'text', group: 'assignment' },
        employee_id: { label: 'Employee ID', type: 'text', group: 'assignment' },
        assigned_date: { label: 'Assigned Date', type: 'date', group: 'assignment' },
        project_name: { label: 'Name of Project', type: 'text', group: 'assignment' },
        warranty_expiry_date: { label: 'Warranty Expiry Date', type: 'date', group: 'lifecycle' },
        maintenance_due_date: { label: 'Maintenance Due Date', type: 'date', group: 'lifecycle' },
        license_expiry_date: { label: 'License Expiry Date', type: 'date', group: 'lifecycle' },
        returned_to_odr: { label: 'Returned to ODR', type: 'select', options: ['No', 'Yes'], group: 'lifecycle' },
        date_of_return: { label: 'Date of Return', type: 'date', group: 'lifecycle' },
        scrap_date: { label: 'Scrap Date', type: 'date', group: 'lifecycle' },
        document_uploads: { label: 'Upload Invoice/Document', type: 'file', group: 'lifecycle' },
        remarks: { label: 'Remarks / Notes', type: 'textarea', group: 'lifecycle' },
    };
    const schemaGroups = {
        purchase: 'Purchase Information',
        asset: 'Asset Details',
        assignment: 'Assignment & Status',
        lifecycle: 'Lifecycle & Documents'
    };
    
    // --- NEW & UPDATED DOM ELEMENTS ---
    const inventoryTableBody = document.getElementById('grantTableBody'); // Aligned with new HTML
    const paginationList = document.getElementById('paginationList');
    const paginationInfo = document.getElementById('paginationInfo');
    const statusFilter = document.getElementById('statusFilter');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const addAssetBtn = document.getElementById('addAssetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modals
    const formModal = document.getElementById('formModal');
    const viewModal = document.getElementById('viewModal');
    const formModalTitle = document.getElementById('formModalTitle');
    const assetForm = document.getElementById('assetForm');
    const formContainer = document.getElementById('formContainer');
    const viewDetailsContainer = document.getElementById('viewDetailsContainer');

    // Stat Cards
    const statTotalAssets = document.getElementById('stat-total-assets');
    const statAssignedAssets = document.getElementById('stat-assigned-assets');
    const statInStockAssets = document.getElementById('stat-instock-assets');
    const statWarrantyAlerts = document.getElementById('stat-warranty-alerts');

    // --- API HELPER FUNCTIONS (Preserved) ---
    const getAuthHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` });

    async function fetchInventory() {
        inventoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading assets...</td></tr>`;
        try {
            const response = await fetch(API_BASE_URL, { headers: getAuthHeader() });
            if (!response.ok) throw new Error('Failed to fetch inventory. Please log in again.');
            allInventory = await response.json();
            updateStatCards();
            applyFiltersAndRender(); // Initial render
        } catch (error) {
            console.error(error);
            alert(error.message);
            inventoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const saveButton = document.getElementById('saveBtn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        const formData = new FormData(assetForm);
        const url = isEditMode ? `${API_BASE_URL}/${editingAssetId}` : API_BASE_URL;
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, { method: method, headers: getAuthHeader(), body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to save asset.');
            
            alert(result.message);
            closeModal(formModal);
            fetchInventory(); // Re-fetch all data to get the latest state
        } catch (error) {
            console.error('Save error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Asset';
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this asset? This is irreversible.')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE', headers: getAuthHeader() });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to delete asset.');

            alert(result.message);
            fetchInventory(); // Re-fetch to update the table
        } catch (error) {
            console.error('Delete error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- NEW UI RENDERING LOGIC (ADAPTED FROM GRANTS) ---

    // Filter, then render the current page
    function applyFiltersAndRender() {
        const searchTerm = globalSearchInput.value.toLowerCase().trim();
        const status = statusFilter.value;

        filteredInventory = allInventory.filter(asset => {
            const matchesSearch = searchTerm === '' || 
                ['item', 'tag_no', 'assigned_to', 'asset_category', 'po_number'].some(field => 
                    String(asset[field]).toLowerCase().includes(searchTerm)
                );
            const matchesStatus = status === '' || asset.status === status;
            return matchesSearch && matchesStatus;
        });

        displayPage(1); // Go to first page after filtering
    }

    // Display data for the current page
    function displayPage(page) {
        currentPage = page;
        inventoryTableBody.innerHTML = '';
        
        const start = (page - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const paginatedItems = filteredInventory.slice(start, end);

        if (paginatedItems.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No assets found.</td></tr>`;
        } else {
            paginatedItems.forEach((asset, index) => {
                const statusClass = `status-${asset.status.toLowerCase().replace(/ /g, '-')}`;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${start + index + 1}</td>
                    <td>${asset.asset_category || 'N/A'}</td>
                    <td>${asset.item || 'N/A'}</td>
                    <td>${asset.tag_no || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${asset.status}</span></td>
                    <td>${asset.assigned_to || 'N/A'}</td>
                    <td>${asset.warranty_expiry_date || 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="action-btn view-btn" data-id="${asset.id}" title="View Details"><i class="fa-solid fa-eye"></i></button>
                        <button class="action-btn edit-btn" data-id="${asset.id}" title="Edit Asset"><i class="fa-solid fa-pencil"></i></button>
                        <button class="action-btn delete-btn" data-id="${asset.id}" title="Delete Asset"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                `;
                inventoryTableBody.appendChild(row);
            });
        }
        setupPagination();
        updatePaginationInfo();
    }
    
    // Generate pagination links
    function setupPagination() {
        paginationList.innerHTML = '';
        const pageCount = Math.ceil(filteredInventory.length / ROWS_PER_PAGE);
        if (pageCount <= 1) return;

        // Previous button
        if (currentPage > 1) {
            paginationList.appendChild(createPageLink(currentPage - 1, '&laquo;', 'Previous page'));
        }

        // Page number links
        for (let i = 1; i <= pageCount; i++) {
            paginationList.appendChild(createPageLink(i, i));
        }
        
        // Next button
        if (currentPage < pageCount) {
            paginationList.appendChild(createPageLink(currentPage + 1, '&raquo;', 'Next page'));
        }
    }
    
    function createPageLink(page, text, ariaLabel = `Go to page ${page}`) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.innerHTML = text;
        link.classList.add('pagination-link');
        link.setAttribute('aria-label', ariaLabel);
        if (page === currentPage) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
        link.addEventListener('click', (e) => {
            e.preventDefault();
            displayPage(page);
        });
        li.appendChild(link);
        return li;
    }

    // Update "Showing X-Y of Z results" text
    function updatePaginationInfo() {
        const totalItems = filteredInventory.length;
        if (totalItems === 0) {
            paginationInfo.textContent = "No results";
            return;
        }
        const startItem = (currentPage - 1) * ROWS_PER_PAGE + 1;
        const endItem = Math.min(startItem + ROWS_PER_PAGE - 1, totalItems);
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} results`;
    }

    // --- HELPER & UI FUNCTIONS (Mostly preserved or adapted) ---

    // Calculate and display dashboard stats
    const getDateDifferenceInDays = (dateString) => {
        if (!dateString) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateString);
        targetDate.setHours(0, 0, 0, 0);
        return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    };

    function updateStatCards() {
        statTotalAssets.textContent = allInventory.length;
        statAssignedAssets.textContent = allInventory.filter(a => a.status === 'Assigned').length;
        statInStockAssets.textContent = allInventory.filter(a => a.status === 'In Stock').length;
        const warrantyAlerts = allInventory.filter(asset => {
            const daysLeft = getDateDifferenceInDays(asset.warranty_expiry_date);
            return daysLeft !== null && daysLeft >= 0 && daysLeft <= ALERT_DAYS_THRESHOLD;
        }).length;
        statWarrantyAlerts.textContent = warrantyAlerts;
    }

    // Modal controls
    const openModal = (modal) => modal.classList.remove('hidden');
    const closeModal = (modal) => modal.classList.add('hidden');

    // Dynamically generate form fields (Unchanged)
    const generateFormFields = () => {
        formContainer.innerHTML = '';
        for (const [groupId, groupTitle] of Object.entries(schemaGroups)) {
            const fieldset = document.createElement('fieldset');
            fieldset.innerHTML = `<legend>${groupTitle}</legend>`;
            const grid = document.createElement('div');
            grid.className = 'form-grid';
            for (const [key, config] of Object.entries(inventorySchema)) {
                if (config.group === groupId) {
                    const fieldWrapper = document.createElement('div');
                    let fieldHtml = `<label for="${key}" class="form-label ${config.required ? 'required' : ''}">${config.label}</label>`;
                    if (config.type === 'select') { 
                        let optionsHtml = config.options.map(opt => `<option value="${opt}">${opt}</option>`).join(''); 
                        fieldHtml += `<select id="${key}" name="${key}" ${config.required ? 'required' : ''} class="form-input">${optionsHtml}</select>`; 
                    } else if (config.type === 'textarea') { 
                        fieldHtml += `<textarea id="${key}" name="${key}" rows="3" placeholder="${config.placeholder || ''}" class="form-input"></textarea>`; 
                    } else if (config.type === 'file') { 
                        fieldHtml += `<div class="file-input-wrapper"><input type="file" id="${key}" name="${key}"><span class="file-name-display"></span></div>`; 
                    } else { 
                        fieldHtml += `<input type="${config.type}" id="${key}" name="${key}" ${config.required ? 'required' : ''} placeholder="${config.placeholder || ''}" class="form-input">`; 
                    }
                    fieldWrapper.innerHTML = fieldHtml;
                    grid.appendChild(fieldWrapper);
                }
            }
            fieldset.appendChild(grid);
            formContainer.appendChild(fieldset);
        }
    };
    
    // Show Add/Edit/View Modals (Adapted to new modal controls)
    const showAddModal = () => {
        isEditMode = false;
        editingAssetId = null;
        formModalTitle.textContent = 'Add New Asset';
        assetForm.reset();
        document.querySelectorAll('.file-name-display').forEach(d => d.textContent = '');
        openModal(formModal);
    };

    const showEditModal = (id) => {
        const asset = allInventory.find(a => a.id === id);
        if (!asset) return;
        isEditMode = true;
        editingAssetId = id;
        formModalTitle.textContent = 'Edit Asset';
        assetForm.reset();
        // Populate form (your existing logic is fine here)
        for (const key in inventorySchema) {
            const formField = assetForm.querySelector(`[name="${key}"]`);
            if (formField && asset[key] !== null && asset[key] !== undefined) {
                if (inventorySchema[key].type === 'file') {
                    const displaySpan = formField.parentElement.querySelector('.file-name-display');
                    if (displaySpan) displaySpan.textContent = asset[key] ? `Current: ${String(asset[key]).split('/').pop()}` : '';
                } else {
                    formField.value = asset[key];
                }
            }
        }
        openModal(formModal);
    };

    const showViewModal = async (id) => {
        viewDetailsContainer.innerHTML = '<p>Loading asset details...</p>';
        openModal(viewModal);
        try {
            const response = await fetch(`${API_BASE_URL}/${id}`, { headers: getAuthHeader() });
            if (!response.ok) throw new Error('Failed to fetch asset details.');
            const asset = await response.json();
            
            let detailsHtml = '';
            for (const [groupId, groupTitle] of Object.entries(schemaGroups)) {
                let groupHtml = `<h3>${groupTitle}</h3><dl>`;
                let hasContent = false;
                for (const [key, config] of Object.entries(inventorySchema)) {
                    if (config.group === groupId && (asset[key] || typeof asset[key] === 'number')) {
                        hasContent = true;
                        let value = asset[key];
                        if (key === 'cost') value = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
                        if (key === 'document_uploads' && value) value = `<a href="/api/download/${encodeURIComponent(value)}" target="_blank" class="file-link">${value.split('/').pop()}</a>`;
                        groupHtml += `<dt>${config.label}</dt><dd>${value || 'N/A'}</dd>`;
                    }
                }
                groupHtml += `</dl>`;
                if (hasContent) detailsHtml += groupHtml;
            }
            // Add assignment history if available
            if (asset.assignmentHistory && asset.assignmentHistory.length > 0) { /* ... your history logic ... */ }

            viewDetailsContainer.innerHTML = detailsHtml;
        } catch (error) {
            viewDetailsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    };

    // --- SHARED SIDEBAR LOGIC ---
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
    }
    const toggleMobileSidebar = () => document.body.classList.toggle('sidebar-open');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleMobileSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleMobileSidebar);


    // --- EVENT LISTENERS ---
    addAssetBtn.addEventListener('click', showAddModal);
    assetForm.addEventListener('submit', handleFormSubmit);
    exportBtn.addEventListener('click', () => alert('Export to Excel logic here.')); // Placeholder
    logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = '/'; });
    
    // Listeners for new filter controls
    globalSearchInput.addEventListener('input', applyFiltersAndRender);
    statusFilter.addEventListener('change', applyFiltersAndRender);

    // Event delegation for table action buttons
    inventoryTableBody.addEventListener('click', (e) => {
        const button = e.target.closest('.action-btn');
        if (!button) return;
        const id = parseInt(button.dataset.id, 10);
        if (button.classList.contains('view-btn')) showViewModal(id);
        else if (button.classList.contains('edit-btn')) showEditModal(id);
        else if (button.classList.contains('delete-btn')) handleDelete(id);
    });

    // Listeners for closing modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(formModal);
            closeModal(viewModal);
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(formModal);
            closeModal(viewModal);
            if (document.body.classList.contains('sidebar-open')) toggleMobileSidebar();
        }
    });
    
    // --- INITIALIZATION ---
    function init() {
        generateFormFields(); // Prepare the modal form ahead of time
        fetchInventory();
    }

    init();
});