// public/js/sopsAndTemplates.js

document.addEventListener('DOMContentLoaded', () => {

    // ==============================================
    // === GLOBAL VARIABLES & STATE               ===
    // ==============================================
    let allDocuments = []; // Master list of documents from the server
    let currentPage = 1;
    const rowsPerPage = 10; // We can adjust this value

    // ==============================================
    // === UI ELEMENT SELECTORS                   ===
    // ==============================================
    // Main Views
    const mainDataView = document.getElementById('mainDataView');
    const sopFormContainer = document.getElementById('sopFormContainer');
    const generateDocView = document.getElementById('generateDocView');
    const mainHeaderTitle = document.getElementById('main-header-title');

    // Table & Pagination
    const tableBody = document.getElementById('sopTableBody');
    const paginationList = document.getElementById('paginationList');
    const paginationInfo = document.getElementById('paginationInfo');

    // SOP/Template Form
    const sopForm = document.getElementById('sopForm');
    const sopIdInput = document.getElementById('sopId');
    const fileUploadInput = document.getElementById('fileUpload');
    const fileUploadLabel = document.querySelector('label[for="fileUpload"]');
    
    // View Modal
    const viewModal = document.getElementById('viewModal');
    const modalDocId = document.getElementById('modalDocId');
    const modalDetailsContainer = document.querySelector('#viewDetailsContainer .modal-details-grid');
    

    // ==============================================
    // === UTILITY & API FUNCTIONS                ===
    // ==============================================

    /**
     * Logs the user out by clearing credentials and redirecting.
     */
    function logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        window.location.href = '/'; // Redirect to login page
    }

    /**
     * Fetches a file from the secure download endpoint.
     * @param {string} key - The S3 key of the file.
     * @param {string} filename - The original name of the file.
     */
    async function downloadFile(key, filename) {
        try {
            const response = await fetch(`/api/download/${encodeURIComponent(key)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            if (!response.ok) throw new Error('Download failed. You may not have permission.');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert(error.message);
        }
    }

    /**
     * Fetches all documents from the backend API.
     */
    async function fetchAndDisplayDocuments() {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Loading documents...</td></tr>';
        
        try {
            const response = await fetch('/api/sops-templates', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            if (!response.ok) throw new Error('Failed to fetch documents.');
            
            allDocuments = await response.json();
            displayPage(1); // Render the first page of results
            updateStats();

        } catch (error) {
            console.error('Fetch error:', error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-600">Error: ${error.message}</td></tr>`;
        }
    }

    /**
     * Handles both POST (Create) and PUT (Update) for the SOP/Template form.
     * @param {Event} event - The form submission event.
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        const submitButton = sopForm.querySelector('button[type="submit"]');
        const formData = new FormData(sopForm);
        const sopId = sopIdInput.value;

        const isUpdating = !!sopId;
        const url = isUpdating ? `/api/sops-templates/${sopId}` : '/api/sops-templates';
        const method = isUpdating ? 'PUT' : 'POST';

        submitButton.disabled = true;
        submitButton.textContent = isUpdating ? 'Updating...' : 'Uploading...';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
                body: formData
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');

            alert('Success: ' + result.message);
            showTableView(); // Go back to the table, which will refetch the data
        } catch (error) {
            console.error('Form Submit Error:', error);
            alert('Error: ' + error.message);
        } finally {
            submitButton.disabled = false;
            // The text will be reset when showTableView calls resetForm
        }
    }
    
    /**
     * Handles the deletion of a document after user confirmation.
     * @param {number} id - The ID of the document to delete.
     * @param {string} name - The display name of the document for the confirmation message.
     */
    async function deleteDocument(id, name) {
        if (!confirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/sops-templates/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            alert(result.message);
            fetchAndDisplayDocuments(); // Refetch all data to ensure UI is in sync

        } catch (error) {
            console.error('Delete Error:', error);
            alert('Error: ' + error.message);
        }
    }


    // ==============================================
    // === RENDERING & UI UPDATES                 ===
    // ==============================================
    
    /**
     * Filters the master list of documents based on current filter/search values.
     * @returns {Array} The filtered list of documents.
     */
    function getFilteredDocuments() {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const searchTerm = document.getElementById('globalSearchInput').value.toLowerCase();

        return allDocuments.filter(doc => {
            const matchesCategory = !categoryFilter || doc.file_category === categoryFilter;
            const matchesSearch = doc.display_name.toLowerCase().includes(searchTerm) || 
                                  doc.original_filename.toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });
    }

    /**
     * Generates a styled HTML badge based on the file extension.
     * @param {string} filename - The original name of the file.
     * @returns {string} HTML string for the badge.
     */
    function getTypeBadge(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        let badgeClass = 'status-completed'; // Fallback gray
        let typeLabel = extension.toUpperCase();

        switch (extension) {
            case 'pdf': badgeClass = 'file-type-pdf'; break;
            case 'docx': case 'doc': badgeClass = 'file-type-docx'; break;
            case 'xlsx': case 'xls': badgeClass = 'file-type-xlsx'; break;
        }
        return `<span class="file-type-badge ${badgeClass}">${typeLabel}</span>`;
    }

    /**
     * Renders a specific page of documents into the table.
     * @param {number} page - The page number to display.
     */
    function displayPage(page) {
        currentPage = page;
        const filteredDocs = getFilteredDocuments();
        
        tableBody.innerHTML = '';
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedItems = filteredDocs.slice(start, end);

        if (paginatedItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No documents match your criteria.</td></tr>';
        } else {
            paginatedItems.forEach(doc => {
                const uploadedDate = new Date(doc.uploaded_at).toLocaleDateString('en-CA');
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>SOP-${doc.id.toString().padStart(3, '0')}</td>
                <td>${doc.display_name}</td>
                <td><span class="status-badge ${doc.file_category === 'SOP' ? 'status-approved' : 'status-review'}">${doc.file_category}</span></td>
                <td>${getTypeBadge(doc.original_filename)}</td>
                <td>${doc.version || 'N/A'}</td>
                <td>${uploadedDate}</td>
                <td class="action-buttons">
                    <button class="action-btn view-btn" title="View Details" data-id="${doc.id}"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit-btn" title="Edit Document" data-id="${doc.id}"><i class="fa-solid fa-pencil"></i></button>
                    <button class="action-btn download-btn" title="Download Document" data-key="${doc.s3_key}" data-filename="${doc.original_filename}"><i class="fa-solid fa-download"></i></button>
                    <button class="action-btn delete-btn" title="Delete Document" data-id="${doc.id}" data-name="${doc.display_name}"><i class="fa-solid fa-trash-can"></i></button>
                </td>`;
                tableBody.appendChild(row);
            });
        }
        
        setupPagination(filteredDocs.length);
        updatePaginationInfo(filteredDocs.length);
    }

    /**
     * Creates and displays the pagination controls.
     * @param {number} totalItems - The total number of items after filtering.
     */
    function setupPagination(totalItems) {
        paginationList.innerHTML = '';
        const pageCount = Math.ceil(totalItems / rowsPerPage);
        if (pageCount <= 1) return;

        for (let i = 1; i <= pageCount; i++) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="pagination-link ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</a>`;
            paginationList.appendChild(li);
        }
    }
    
    /**
     * Updates the text indicating the current range of displayed items.
     * @param {number} totalItems - The total number of items after filtering.
     */
    function updatePaginationInfo(totalItems) {
        if (totalItems === 0) {
            paginationInfo.textContent = "No results";
            return;
        }
        const startItem = (currentPage - 1) * rowsPerPage + 1;
        const endItem = Math.min(startItem + rowsPerPage - 1, totalItems);
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} results`;
    }

    /**
     * Updates the statistic cards with counts from the master document list.
     */
    function updateStats() {
        document.querySelector('.stat-card:nth-child(1) .card-value').textContent = allDocuments.length;
        document.querySelector('.stat-card:nth-child(2) .card-value').textContent = allDocuments.filter(d => d.file_category === 'SOP').length;
        document.querySelector('.stat-card:nth-child(3) .card-value').textContent = allDocuments.filter(d => d.file_category === 'Template').length;
    }


    // ==============================================
    // === MODAL & FORM LOGIC                     ===
    // ==============================================

    /**
     * Opens and populates the view modal with document details.
     * @param {number} docId - The ID of the document to view.
     */
    function openViewModal(docId) {
        const doc = allDocuments.find(d => d.id === parseInt(docId));
        if (!doc) {
            alert('Error: Document not found.');
            return;
        }

        modalDocId.textContent = `SOP-${doc.id.toString().padStart(3, '0')}`;
        
        modalDetailsContainer.innerHTML = `
            <div class="col-span-2"><dt>Display Name</dt><dd>${doc.display_name}</dd></div>
            <div><dt>Category</dt><dd><span class="status-badge ${doc.file_category === 'SOP' ? 'status-approved' : 'status-review'}">${doc.file_category}</span></dd></div>
            <div><dt>Version</dt><dd>${doc.version || 'N/A'}</dd></div>
            <div><dt>Original Filename</dt><dd>${doc.original_filename}</dd></div>
            <div><dt>Uploaded On</dt><dd>${new Date(doc.uploaded_at).toLocaleString()}</dd></div>
            <div class="col-span-2"><dt>Description</dt><dd>${doc.description || 'No description provided.'}</dd></div>
        `;
        
        viewModal.classList.remove('hidden');
    }

    /**
     * Closes the view modal.
     */
    function closeModal() {
        viewModal.classList.add('hidden');
    }

    /**
     * Resets the SOP/Template form to its default state for a new upload.
     */
    function resetForm() {
        sopForm.reset();
        sopIdInput.value = ''; // Clear the hidden ID field
        mainHeaderTitle.textContent = 'Upload New Document';
        sopForm.querySelector('button[type="submit"]').textContent = 'Save Document';
        
        // Make the file input required again for new uploads
        fileUploadInput.required = true;
        fileUploadLabel.textContent = 'Select File';
        fileUploadLabel.classList.add('required');
    }

    /**
     * Populates the form with existing data for editing a document.
     * @param {number} docId - The ID of the document to edit.
     */
    function openEditForm(docId) {
        const doc = allDocuments.find(d => d.id === parseInt(docId));
        if (!doc) {
            alert('Error: Document not found.');
            return;
        }

        resetForm(); // Start with a clean form to ensure correct state
        
        // Populate the form fields with existing data
        sopIdInput.value = doc.id;
        document.getElementById('fileName').value = doc.display_name;
        document.getElementById('category').value = doc.file_category;
        document.getElementById('version').value = doc.version || '';
        document.getElementById('description').value = doc.description || '';
        
        // Update UI text for "Edit" mode
        mainHeaderTitle.textContent = `Edit Document: SOP-${doc.id.toString().padStart(3, '0')}`;
        sopForm.querySelector('button[type="submit"]').textContent = 'Update Document';
        
        // Make file upload optional for edits
        fileUploadInput.required = false;
        fileUploadLabel.textContent = 'Upload New File (Optional)';
        fileUploadLabel.classList.remove('required');
        
        showUploadFormView(true); // Show the form view, indicating it's for an edit
    }


    // ==============================================
    // === VIEW SWITCHING & SIDEBAR LOGIC         ===
    // ==============================================
    
    /** Shows the main document table view and refetches data. */
    const showTableView = () => {
        mainDataView.classList.remove('hidden');
        sopFormContainer.classList.add('hidden');
        generateDocView.classList.add('hidden');
        mainHeaderTitle.textContent = 'SOP & Templates Management';
        resetForm();
        fetchAndDisplayDocuments(); // Always refetch data when returning to the main view
    };

    /**
     * Shows the upload/edit form view.
     * @param {boolean} isEditing - If true, prevents the form from being reset.
     */
    const showUploadFormView = (isEditing = false) => {
        if (!isEditing) {
            resetForm(); // Only reset if we are creating a new document
        }
        mainDataView.classList.add('hidden');
        sopFormContainer.classList.remove('hidden');
        generateDocView.classList.add('hidden');
        // Title is set by resetForm or openEditForm
    };
    
    /** Shows the document generator view. */
    const showGeneratorView = () => {
        mainDataView.classList.add('hidden');
        sopFormContainer.classList.add('hidden');
        generateDocView.classList.remove('hidden');
        mainHeaderTitle.textContent = 'Generate Document';
    };


    // ==============================================
    // === EVENT LISTENERS                        ===
    // ==============================================

    // Form submission
    sopForm.addEventListener('submit', handleFormSubmit);

    // Main navigation/action buttons
    document.getElementById('addSopBtn').addEventListener('click', () => showUploadFormView(false));
    document.getElementById('generateDocBtn').addEventListener('click', showGeneratorView);
    document.getElementById('backToSopListBtn').addEventListener('click', showTableView);
    document.getElementById('cancelBtn').addEventListener('click', showTableView);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Table action buttons (using event delegation)
    tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('button.action-btn');
        if (!button) return;

        const { id, name, key, filename } = button.dataset;

        if (button.classList.contains('view-btn')) {
            openViewModal(id);
        } else if (button.classList.contains('edit-btn')) {
            openEditForm(id);
        } else if (button.classList.contains('download-btn')) {
            downloadFile(key, filename);
        } else if (button.classList.contains('delete-btn')) {
            deleteDocument(id, name);
        }
    });

    // Pagination (using event delegation)
    paginationList.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            displayPage(parseInt(e.target.dataset.page));
        }
    });

    // Filtering and Searching
    document.getElementById('categoryFilter').addEventListener('change', () => displayPage(1));
    document.getElementById('globalSearchInput').addEventListener('keyup', () => displayPage(1));

    // Modal close buttons
    viewModal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    viewModal.querySelector('#modalCloseFooterBtn').addEventListener('click', closeModal);

    // Sidebar functionality
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (sidebarCollapseBtn) { sidebarCollapseBtn.addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed')); }
    const toggleMobileSidebar = () => document.body.classList.toggle('sidebar-open');
    if (sidebarToggleBtn) { sidebarToggleBtn.addEventListener('click', toggleMobileSidebar); }
    if (sidebarOverlay) { sidebarOverlay.addEventListener('click', toggleMobileSidebar); }


    // =========================================================
    // === DOCUMENT GENERATOR LOGIC (Self-Contained Module)  ===
    // =========================================================
    function initializeGenerator() {
        const previewArea = document.getElementById('previewArea');
        const letterSelect = document.getElementById('letterSelect');
        const printBtn = document.getElementById('printBtn');
        const stipendFields = document.getElementById('stipendFields');
        const supportFields = document.getElementById('supportFields');

        document.getElementById('date').value = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const readImageFile = file => new Promise(resolve => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        
        const escapeHtml = str => (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

        const updateFormVisibility = () => {
            const sel = letterSelect.value;
            stipendFields.style.display = (sel === 'stipend') ? 'block' : 'none';
            supportFields.style.display = (sel === 'support') ? 'block' : 'none';
            buildPreview();
        };

        async function buildStipend() {
            const data = {
                name: escapeHtml(document.getElementById('name').value),
                designation: escapeHtml(document.getElementById('designation').value),
                project: escapeHtml(document.getElementById('project').value),
                school: escapeHtml(document.getElementById('school').value),
                duration: escapeHtml(document.getElementById('duration').value),
                position: escapeHtml(document.getElementById('position').value),
                stipend: escapeHtml(document.getElementById('stipend').value),
                reason: escapeHtml(document.getElementById('reason').value),
                date: escapeHtml(document.getElementById('date').value),
                financeName: escapeHtml(document.getElementById('finance_name').value),
                financeDetails: escapeHtml(document.getElementById('finance_details').value).replace(/\n/g, '<br>')
            };
            
            const [sig1Data, sig2Data] = await Promise.all([
                readImageFile(document.getElementById('sig1').files[0]),
                readImageFile(document.getElementById('sig2').files[0])
            ]);
            
            previewArea.innerHTML = `
                <div class="letter" id="letterDoc">
                    <div class="letter-header">
                        <!-- Space for letterhead -->
                    </div>

                    <div class="letter-body">
                        <div class="date">${data.date}</div>
                        <div class="recipient-info">
                            <strong>${data.name || '[Name]'}</strong><br>
                            ${data.designation || '[Designation]'}<br>
                            Project titled" ${data.project || '[Project Title]'}"<br>
                            O.P. Jindal Global University
                        </div>
                        <div class="subject">SUB: STIPEND CERTIFICATE LETTER</div>
                        <p>This is to certify that ${data.name || '[Name]'} is working as a ${data.designation || '[Designation]'} for the research project titled" ${data.project || '[Project Title]'}”, ${data.school || '[School Name]'}, O.P. Jindal Global University.</p>
                        <p>Her Research Assistantship particulars are as follows:</p>
                        <div class="particulars-list">
                            <div class="particular-item"><span class="particular-label">Duration of Appointment</span><span class="particular-value">: ${data.duration || '[Duration]'}</span></div>
                            <div class="particular-item"><span class="particular-label">Position Held</span><span class="particular-value">: ${data.position || '[Position]'}</span></div>
                            <div class="particular-item"><span class="particular-label">Monthly Stipend</span><span class="particular-value">: ${data.stipend || '[Stipend]'}</span></div>
                        </div>
                        <p>This letter is being issued at the specific request of ${data.name || '[Name]'} for ${data.reason || '[Reason]'}.</p>
                    </div>

                    <div class="letter-signature-footer">
                        <div class="sig-block">
                            <div class="sig-info">
                                ${sig1Data ? `<img src="${sig1Data}" alt="Finance Signature">` : '<div class="sig-placeholder"></div>'}
                                <strong>${data.financeName || '[Finance Person Name]'}</strong><br>
                                ${data.financeDetails || '[Finance Person Details]'}
                            </div>
                            <div class="sig-info" style="text-align: right;">
                                 ${sig2Data ? `<img src="${sig2Data}" alt="Dean Signature">` : '<div class="sig-placeholder"></div>'}
                                 <strong>Prof. (Dr.) Arpita Gupta</strong><br>
                                 Dean of Research | O.P. Jindal Global University<br>
                                 Professor | Jindal Global Law School
                            </div>
                        </div>
                        <div class="letter-footer">www.jgu.edu.in</div>
                    </div>
                </div>`;
        }

        async function buildSupport() {
            const data = {
                date: escapeHtml(document.getElementById('date').value),
                supportFor: escapeHtml(document.getElementById('support_for').value),
                profName: escapeHtml(document.getElementById('support_prof_name').value),
                para4: escapeHtml(document.getElementById('support_para4').value).replace(/\n/g, '<br>'),
                para5: escapeHtml(document.getElementById('support_para5').value).replace(/\n/g, '<br>'),
                contact: escapeHtml(document.getElementById('support_contact').value)
            };
            const sigData = await readImageFile(document.getElementById('support_sig').files[0]);

            previewArea.innerHTML = `
                <div class="letter" id="letterDoc">
                    <div class="letter-header">
                        <!-- Space for letterhead -->
                    </div>

                    <div class="letter-body">
                        <div class="date">${data.date}</div>
                        <div class="recipient-info"><strong>To whom it may concern,</strong></div>
                        <p class="subject-line"><strong>Subject: Letter of support for ${data.supportFor || '[Insert Details]'}</strong></p>
                        <div class="salutation">Dear Ma'am/Sir,</div>
                        <p>With this letter, we express our support for <strong>${data.profName || '[Prof. Insert Details]'}</strong> O.P. Jindal Global University.</p>
                        <p>JGU is a research-intensive, not-for-profit private university that has been awarded the prestigious ‘Institution of Eminence’ status by the Ministry of Education, Government of India. JGU is a research-intensive university that is deeply committed to its core institutional values of interdisciplinary and innovative pedagogy, pluralism and rigorous scholarship, and globalism and international engagement.</p>
                        <p>JGU has established twelve schools... [Content Truncated for Brevity] ...and four research & capacity-building institutes to further the University’s research goals.</p>
                        <p>${data.para4 || '(Insert your elaborate details {designation etc.})'}</p>
                        <p>${data.para5 || '(Insert collaboration related details)'}</p>
                        <p>Should you have any queries... (and so on)</p>
                        <p>With warm regards,</p>
                    </div>
                    
                    <div class="letter-signature-footer">
                        <div class="support-sig-block">
                            ${sigData ? `<img src="${sigData}" class="sig-img" alt="Signature">` : '<div style="height:80px;"></div>'}
                            <strong>Prof. Dabiru Sridhar Patnaik</strong><br>
                            Professor & Registrar<br>
                            O.P. Jindal Global (Institution of Eminence Deemed to be University)
                        </div>
                        <div class="letter-footer">www.jgu.edu.in</div>
                    </div>
                </div>`;
        }
        
        const buildPreview = async () => letterSelect.value === 'stipend' ? buildStipend() : buildSupport();

        const attachLiveEvents = () => {
            document.querySelectorAll('#dataForm input, #dataForm textarea').forEach(i => i.addEventListener('input', buildPreview));
            document.querySelectorAll('#dataForm input[type="file"]').forEach(fi => fi.addEventListener('change', buildPreview));
            letterSelect.addEventListener('change', updateFormVisibility);
        };
        
        const printStyles = `
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap');
            html, body { height: 100%; margin: 0; padding: 0; }
            body { font-family: 'Merriweather', serif; color: #000; font-size: 10.5pt; line-height: 1.4; }
            .letter { 
                max-width: 18cm; 
                margin: 0 auto; 
                height: 100%; 
                display: flex; 
                flex-direction: column; 
            }
            .letter-header { height: 120px; flex-shrink: 0; }
            .letter-body { flex-grow: 1; }
            .letter-signature-footer { flex-shrink: 0; }
            .logo-container img { width: 250px; }
            .contact-info { text-align: right; font-size: 10pt; line-height: 1.4; }
            .date { text-align: right; margin-bottom: 1.5rem; font-weight: bold; }
            p { margin: 0.8rem 0; }
            .subject { text-align: center; margin: 2rem 0; font-weight: bold; text-decoration: underline; }
            .particulars-list { margin: 1rem 0; padding-left: 2rem; }
            .particular-item { display: flex; margin-bottom: 0.5rem; }
            .particular-label { width: 180px; flex-shrink: 0; }
            .sig-block { margin-top: 2.5rem; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-info { width: 48%; }
            .sig-info img { max-width: 250px; max-height: 100px; display: block; margin-bottom: 8px; }
            .sig-placeholder { height: 70px; }
            .letter-footer { text-align: center; margin-top: 2rem; padding-top: 0.5rem; border-top: 1px solid #00008b; font-size: 10pt; page-break-inside: avoid; }
            .support-sig-block { margin-top: 3rem; page-break-inside: avoid; }
            .support-sig-block .sig-img { max-height: 80px; max-width: 250px; margin-bottom: 0.5rem; }
        `;

        printBtn.addEventListener('click', () => {
            const content = document.getElementById('letterDoc')?.outerHTML || '';
            const win = window.open('', '_blank');
            win.document.write(`<!doctype html><html><head><title>Print Document</title><style>${printStyles}</style></head><body>${content}</body></html>`);
            win.document.close();
            win.onload = () => { win.focus(); win.print(); win.close(); };
        });

        updateFormVisibility();
        attachLiveEvents();
    }


    // ==============================================
    // === INITIALIZE THE APP                     ===
    // ==============================================
    const username = localStorage.getItem('username');
    if (username) {
        document.querySelector('.sidebar .username').textContent = username;
    }

    fetchAndDisplayDocuments();
    initializeGenerator();
});