const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "application/pdf",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, PDF, and DOC files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: fileFilter
});

// --- CONFIGURATION FOR EXTERNAL GRANTS ---
// This list should ONLY contain field names used by externalGrant.html and externalGrantRoutes.js
const grantUploadFields = [
    // Static Fields
    { name: 's1_project_agreement_file', maxCount: 10 },
    { name: 's2_application_document_file', maxCount: 10 },
    { name: 's6_financial_documents_file', maxCount: 10 },
    { name: 's7_fund_received_document_overall', maxCount: 10 },
    { name: 's12_project_image_file', maxCount: 10 },
    { name: 's12_final_report_file', maxCount: 10 },
    
    // Dynamic (repeater) Fields - Names must match what the frontend sends
    { name: 's4_pi_photographs', maxCount: 20 },
    { name: 's5_co_pi_photographs', maxCount: 20 },
    { name: 's7_fund_received_documents', maxCount: 20 },
    { name: 's9_deliverable_documents', maxCount: 20 },
    { name: 's10_staff_photographs', maxCount: 20 },
    { name: 's10_staff_agreements', maxCount: 20 },
    { name: 's11_equipment_bills_files', maxCount: 20 }
];

// --- CONFIGURATION FOR INTERNAL GRANTS ---
// This list should ONLY contain field names used by internalGrant.html and internalGrantRoutes.js
const internalGrantUploadFields = [
    // Static Field
    { name: 'finalReportDoc_uploader', maxCount: 10 }, // Increased maxCount for consistency

    // Dynamic Personnel Fields
    { name: 'pi_uploader', maxCount: 20 },     
    { name: 'copi_uploader', maxCount: 20 },   
    { name: 'hr_uploader', maxCount: 20 },     

    // Dynamic Budget Fields
    { name: 'travel_uploader', maxCount: 20 }, 
    { name: 'acc_uploader', maxCount: 20 },    
    { name: 'stat_uploader', maxCount: 20 },   
    { name: 'fw_uploader', maxCount: 20 },     
    { name: 'inst_uploader', maxCount: 20 },     
    { name: 'diss_uploader', maxCount: 20 },     
    { name: 'misc_uploader', maxCount: 20 },
    { name: 'finalReportDoc_uploader', maxCount: 20 }       
];

// --- CONFIGURATION FOR INVENTORY ---
const inventoryUploadFields = [
    { name: 'document_uploads', maxCount: 1 } 
];


const sopTemplateUploadFields = [
    { name: 'fileUpload', maxCount: 1 } // Matches the name="fileUpload" in your HTML form
];

// Add the new constant to your module.exports object
module.exports = { 
    upload, 
    grantUploadFields,
    internalGrantUploadFields,
    inventoryUploadFields,
    sopTemplateUploadFields 
};


