const express = require('express');
const router = express.Router(); // Use an Express Router
const pool = require('../db'); // We assume a db.js file exports the pool
const { upload, grantUploadFields } = require('../multerConfig.js'); 
const { uploadToS3, deleteFromS3, getSignedUrlForView } = require('../services/s3Service');

function getUploadedFileKey(reqFiles, fieldName, fileIndex = 0) {
    if (reqFiles && reqFiles[fieldName] && reqFiles[fieldName][fileIndex] && reqFiles[fieldName][fileIndex].s3Key) {
        return reqFiles[fieldName][fileIndex].s3Key;
    }
    return null;
}

// Helper function to get an array of S3 keys for a multi-file field (after s3Key is attached)
function getUploadedFileKeysArray(reqFiles, fieldName, expectedCount) {
    const keys = [];
    if (reqFiles && reqFiles[fieldName] && reqFiles[fieldName].length > 0) {
        for (let i = 0; i < reqFiles[fieldName].length; i++) {
            // Check if s3Key property exists on the file object
            if (reqFiles[fieldName][i].s3Key) {
                keys.push(reqFiles[fieldName][i].s3Key);
            } else {
                // This case should ideally not happen if Step 1 (uploading all files to S3) is successful
                // and attaches s3Key to every file object in reqFiles.
                // console.warn(`getUploadedFileKeysArray: s3Key missing for file in field ${fieldName} at index ${i}`);
                keys.push(null); 
            }
        }
    }
    // Pad with nulls if the number of uploaded files for this field is less than expected
    // This is important if dataArray has more items than files were uploaded for that array type
    while (keys.length < expectedCount) {
        keys.push(null);
    }
    return keys;
}

// === CREATE GRANT ===
 
router.post('/', upload.fields(grantUploadFields), async (req, res) => {
    console.log("\n--- SERVER POST: START Create New Grant ---");
    if (!req.body.grantDetails) {
        console.error("SERVER POST: 'grantDetails' is missing.");
        return res.status(400).json({ message: "grantDetails is missing in the request body." });
    }

    let grantDetails;
    try {
        grantDetails = JSON.parse(req.body.grantDetails);
        console.log("SERVER POST: Parsed req.body.grantDetails successfully.");
    } catch (e) {
        console.error("SERVER POST: Invalid JSON in 'grantDetails'.", e);
        return res.status(400).json({ message: "Invalid JSON in grantDetails." });
    }

    const filesUploadedByMulter = req.files || {};
    const mainApplicationId = grantDetails.coreInfo?.application_id;
    if (!mainApplicationId) {
        console.error("SERVER POST: Application ID is missing from coreInfo.");
        return res.status(400).json({ message: "Application ID is required." });
    }
    console.log(`SERVER POST: Main Application ID: ${mainApplicationId}`);

    const connection = await pool.getConnection();
    console.log("SERVER POST: Database connection acquired.");

    try {
        await connection.beginTransaction();
        console.log("SERVER POST: Transaction started.");

        // --- Step 1: Upload ALL files to S3 and store their keys on the file objects ---
        // CORRECTED LOOP: Use Object.keys() for safe iteration.
        const fieldNames = Object.keys(filesUploadedByMulter);
        for (const fieldName of fieldNames) {
            const fileArrayFromMulter = filesUploadedByMulter[fieldName];
            for (let i = 0; i < fileArrayFromMulter.length; i++) {
                const fileObj = fileArrayFromMulter[i];
                fileObj.s3Key = await uploadToS3(fileObj, mainApplicationId, `${fieldName}_item${i}`);
            }
        }
        
        // --- Step 2: Insert data into database tables ---
        // Your existing database insertion logic is correct and preserved below.

        // Section 1: `projects` table
        console.log("SERVER POST: Inserting into 'projects' table.");
        const core = grantDetails.coreInfo || {};

        const agreementFileObjects = filesUploadedByMulter['s1_project_agreement_file'] || [];
        const agreementS3Keys = agreementFileObjects.map(file => file.s3Key);

        const agreementS3KeysJson = JSON.stringify(agreementS3Keys);


        await connection.query(
            `INSERT INTO projects (application_id , grant_category ,project_id_odr, project_title, project_id_funder, department_name, type_of_grant, funder_type, fcra_type, project_website_link, project_agreement_files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [mainApplicationId, 'EXTERNAL',core.project_id_odr, core.project_title, core.project_id_funder, core.department_name, core.type_of_grant, core.funder_type, core.fcra_type, core.project_website_link, agreementS3KeysJson]
        );

  // Section 2: `project_dates_status` table
console.log("SERVER POST: Inserting into 'project_dates_status' table.");
const ds = grantDetails.datesStatus || {};

const appDocFiles = filesUploadedByMulter['s2_application_document_file'] || [];
const appDocS3KeysJson = JSON.stringify(appDocFiles.map(file => file.s3Key));

await connection.query(
    `INSERT INTO project_dates_status (application_id, academic_year, application_date, application_status, calendar_year, financial_closing_status, financial_year, project_duration, project_end_date, project_secured_date, project_start_date, project_status, application_document_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mainApplicationId, ds.academic_year, ds.application_date, ds.application_status, ds.calendar_year, ds.financial_closing_status, ds.financial_year, ds.project_duration, ds.project_end_date, ds.project_secured_date, ds.project_start_date, ds.project_status, appDocS3KeysJson] // Passing the JSON here
);

        // Section 3: `funding_collaboration` table (1:N)
        if (grantDetails.fundingCollaborations && grantDetails.fundingCollaborations.length > 0) {
            for (const item of grantDetails.fundingCollaborations) {
                await connection.query(`INSERT INTO funding_collaboration (application_id, funding_agencies_name, collaboration_name, collaboration_country_of_origin, collaboration_contact_details) VALUES (?, ?, ?, ?, ?)`, [mainApplicationId, item.funding_agencies_name, item.collaboration_name, item.collaboration_country_of_origin, item.collaboration_contact_details]);
            }
        }
        
//         // Section 4: `principal_investigators` table (1:N with file)
//         if (grantDetails.principalInvestigators && grantDetails.principalInvestigators.length > 0) {
//     const piPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's4_pi_photographs'); // No need for expected count here
//     let newFileIndex = 0; // Use a separate index for files

//     for (const pi of grantDetails.principalInvestigators) {
//         // This is the correct logic that was missing
//         const piPhotoKey = piPhotoS3Keys[newFileIndex] || null;
//         const piPhotoKeyJson = JSON.stringify(piPhotoKey ? [piPhotoKey] : []); // Create the JSON array string
        
//         await connection.query(
//             `INSERT INTO principal_investigators (application_id, name_of_pi, pi_contact_details, pi_affiliating_institution, pi_affiliating_country, pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//             [mainApplicationId, pi.name_of_pi, pi.pi_contact_details, pi.pi_affiliating_institution, pi.pi_affiliating_country, piPhotoKeyJson] // Use the new JSON variable
//         );
//         newFileIndex++; // Move to the next uploaded file for the next PI
//     }
// }

//     // Section 5: `co_investigators` table (1:N with file)



//         if (grantDetails.coInvestigators && grantDetails.coInvestigators.length > 0) {
//     const coPiPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's5_co_pi_photographs');
//     let newFileIndex = 0;

//     for (const coPi of grantDetails.coInvestigators) {
//         const coPiPhotoKey = coPiPhotoS3Keys[newFileIndex] || null;
//         const coPiPhotoKeyJson = JSON.stringify(coPiPhotoKey ? [coPiPhotoKey] : []); // Create JSON array string
        
//         await connection.query(
//             `INSERT INTO co_investigators (application_id, name_of_co_pi, co_pi_contact_details, co_pi_affiliating_institution, co_pi_affiliating_country, co_pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//             [mainApplicationId, coPi.name_of_co_pi, coPi.co_pi_contact_details, coPi.co_pi_affiliating_institution, coPi.co_pi_affiliating_country, coPiPhotoKeyJson]
//         );
//         newFileIndex++;
//     }
// }


// Section 4: `principal_investigators` table (1:N with file)
if (grantDetails.principalInvestigators && grantDetails.principalInvestigators.length > 0) {
    const allPiPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's4_pi_photographs');
    let fileCursor = 0; // Use a cursor to track our position in the flat file array

    for (const pi of grantDetails.principalInvestigators) {
        const newFileCount = pi.newFileCount || 0;
        const filesForThisPi = allPiPhotoS3Keys.slice(fileCursor, fileCursor + newFileCount);
        fileCursor += newFileCount; // Move the cursor forward

        const piPhotoKeyJson = JSON.stringify(filesForThisPi); // Store as a JSON array
        
        await connection.query(
            `INSERT INTO principal_investigators (application_id, name_of_pi, pi_contact_details, pi_affiliating_institution, pi_affiliating_country, pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
            [mainApplicationId, pi.name_of_pi, pi.pi_contact_details, pi.pi_affiliating_institution, pi.pi_affiliating_country, piPhotoKeyJson]
        );
    }
}

// Section 5: `co_investigators` table (1:N with file)
if (grantDetails.coInvestigators && grantDetails.coInvestigators.length > 0) {
    const allCoPiPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's5_co_pi_photographs');
    let fileCursor = 0;

    for (const coPi of grantDetails.coInvestigators) {
        const newFileCount = coPi.newFileCount || 0;
        const filesForThisCoPi = allCoPiPhotoS3Keys.slice(fileCursor, fileCursor + newFileCount);
        fileCursor += newFileCount;

        const coPiPhotoKeyJson = JSON.stringify(filesForThisCoPi); // Store as a JSON array
        
        await connection.query(
            `INSERT INTO co_investigators (application_id, name_of_co_pi, co_pi_contact_details, co_pi_affiliating_institution, co_pi_affiliating_country, co_pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
            [mainApplicationId, coPi.name_of_co_pi, coPi.co_pi_contact_details, coPi.co_pi_affiliating_institution, coPi.co_pi_affiliating_country, coPiPhotoKeyJson]
        );
    }
}


        // Section 6: `grant_info` table
        const gi = grantDetails.amountsOverheads || {};

        const financialDocFiles = filesUploadedByMulter['s6_financial_documents_file'] || [];
        const financialDocS3KeysJson = JSON.stringify(financialDocFiles.map(file => file.s3Key));

        let remainingAmount = gi.grant_amount_in_inr;
        if (typeof gi.remaining_amount_inr === 'number') { remainingAmount = gi.remaining_amount_inr; }
        await connection.query(`INSERT INTO grant_info (application_id, grant_sanctioned_amount, currency, exchange_rate, grant_amount_in_inr, amount_in_usd, overheads_percentage, overheads_secured, overheads_received, gst_applicable, financial_documents_s3_key, remaining_amount_inr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [mainApplicationId, gi.grant_sanctioned_amount_original_currency, gi.currency_code, gi.exchange_rate_to_inr, gi.grant_amount_in_inr, gi.amount_in_usd_equivalent, gi.overheads_percentage, gi.overheads_secured_inr, gi.overheads_received_inr, gi.gst_applicable, financialDocS3KeysJson, remainingAmount]);

        


        // Section 7: `funds_received` table
// if (grantDetails.fundInstallments && grantDetails.fundInstallments.length > 0) {
//     const installmentDocS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's7_fund_received_documents');
//     let newFileIndex = 0;

//     for (const inst of grantDetails.fundInstallments) {
//         const installmentDocKey = installmentDocS3Keys[newFileIndex] || null;
//         // The `amount_received_in_inr` column seems redundant if it's the same as installment_amount_inr, but we'll preserve the logic.
//         const amountReceived = inst.installment_amount_inr; 
//         const installmentDocKeyJson = JSON.stringify(installmentDocKey ? [installmentDocKey] : []);
        
//         await connection.query(
//             `INSERT INTO funds_received (application_id, fy_year, installment_amount_inr, bank_fee_inr, amount_received_in_inr, installment_date, fund_received_document_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
//             [mainApplicationId, inst.fy_year_installment, inst.installment_amount_inr, inst.bank_fee_inr, amountReceived, inst.installment_date, installmentDocKeyJson]
//         );
//         newFileIndex++;
//     }
// }
        
// Section 7: `funds_received` table
if (grantDetails.fundInstallments && grantDetails.fundInstallments.length > 0) {
    const allInstallmentDocS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's7_fund_received_documents');
    let fileCursor = 0;

    for (const inst of grantDetails.fundInstallments) {
        const newFileCount = inst.newFileCount || 0;
        const filesForThisInstallment = allInstallmentDocS3Keys.slice(fileCursor, fileCursor + newFileCount);
        fileCursor += newFileCount;

        const installmentDocKeyJson = JSON.stringify(filesForThisInstallment);
        
        // --- CORRECTED QUERY: Removed the 'amount_received_inr' column and its value ---
        await connection.query(
            `INSERT INTO funds_received (application_id, fy_year, installment_amount_inr, bank_fee_inr, installment_date, fund_received_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
            [mainApplicationId, inst.fy_year_installment, inst.installment_amount_inr, inst.bank_fee_inr, inst.installment_date, installmentDocKeyJson]
        );
    }
}


        // Section 8: `budget_head` table
        if (grantDetails.budgetHeads && grantDetails.budgetHeads.length > 0) {
            for (const bh of grantDetails.budgetHeads) {
                await connection.query(`INSERT INTO budget_head (application_id, budget_head, budget_percentage, budget_value, actual_expense, balance_fund) VALUES (?, ?, ?, ?, ?, ?)`, [mainApplicationId, bh.budget_head_name, bh.budget_percentage, bh.budget_head_value_inr, bh.actual_expense_inr, bh.balance_fund_inr]);
            }
        }


        // Section 9: `project_deliverables` table
// if (grantDetails.projectDeliverables && grantDetails.projectDeliverables.length > 0) {
//     const deliverableDocS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's9_deliverable_documents');
//     let newFileIndex = 0;

//     for (const del of grantDetails.projectDeliverables) {
//         const deliverableDocKey = deliverableDocS3Keys[newFileIndex] || null;
//         const deliverableDocKeyJson = JSON.stringify(deliverableDocKey ? [deliverableDocKey] : []);
        
//         await connection.query(
//             `INSERT INTO project_deliverables (application_id, deliverable_type, deliverable_status, deliverable_start_date, deliverable_due_date, deliverable_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//             [mainApplicationId, del.deliverable_description, del.deliverable_status, del.deliverable_start_date, del.deliverable_due_date, deliverableDocKeyJson]
//         );
//         newFileIndex++;
//     }
// }


// Section 9: `project_deliverables` table
if (grantDetails.projectDeliverables && grantDetails.projectDeliverables.length > 0) {
    const allDeliverableDocS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's9_deliverable_documents');
    let fileCursor = 0; // Use a cursor to track our position in the flat file array

    for (const del of grantDetails.projectDeliverables) {
        // Use the count from the payload to slice the correct number of new files
        const newFileCount = del.newFileCount || 0;
        const filesForThisDeliverable = allDeliverableDocS3Keys.slice(fileCursor, fileCursor + newFileCount);
        fileCursor += newFileCount; // Move the cursor forward

        const deliverableDocKeyJson = JSON.stringify(filesForThisDeliverable);
        
        await connection.query(
            `INSERT INTO project_deliverables (application_id, deliverable_type, deliverable_status, deliverable_start_date, deliverable_due_date, deliverable_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
            // Note: deliverable_start_date is not in your form, so we'll pass null.
            [mainApplicationId, del.deliverable_description, del.deliverable_status, null, del.deliverable_due_date, deliverableDocKeyJson]
        );
    }
}
        
        

//         // Section 10: `project_staff` table
// if (grantDetails.projectStaff && grantDetails.projectStaff.length > 0) {
//     const staffPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's10_staff_photographs');
//     const staffAgreementS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's10_staff_agreements');
//     let newFileIndex = 0;

//     for (const staff of grantDetails.projectStaff) {
//         const photoKey = staffPhotoS3Keys[newFileIndex] || null;
//         const agreementKey = staffAgreementS3Keys[newFileIndex] || null;

//         const photoKeyJson = JSON.stringify(photoKey ? [photoKey] : []);
//         const agreementKeyJson = JSON.stringify(agreementKey ? [agreementKey] : []);
        
//         await connection.query(
//             `INSERT INTO project_staff (application_id, staff_name, staff_role, staff_stipend_rate, staff_months_paid, staff_total_stipend, staff_per_diem, staff_joining_date, staff_end_date, staff_status, staff_photograph_s3_key, staff_agreement_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
//             [mainApplicationId, staff.staff_name, staff.staff_role, staff.staff_stipend_rate_inr, staff.staff_months_stipend_paid, staff.staff_total_stipend_paid_inr, staff.staff_per_diem_paid_inr, staff.staff_joining_date, staff.staff_end_date, staff.staff_status || 'active', photoKeyJson, agreementKeyJson]
//         );
//         newFileIndex++;
//     }
// }


// Section 10: `project_staff` table
if (grantDetails.projectStaff && grantDetails.projectStaff.length > 0) {
    const allStaffPhotoS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's10_staff_photographs');
    const allStaffAgreementS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's10_staff_agreements');
    let photoCursor = 0;
    let agreementCursor = 0;

    for (const staff of grantDetails.projectStaff) {
        // Slice photos based on the count for this staff member
        const newPhotoCount = staff.newPhotoCount || 0;
        const photosForThisStaff = allStaffPhotoS3Keys.slice(photoCursor, photoCursor + newPhotoCount);
        photoCursor += newPhotoCount;

        // Slice agreements based on the count for this staff member
        const newAgreementCount = staff.newAgreementCount || 0;
        const agreementsForThisStaff = allStaffAgreementS3Keys.slice(agreementCursor, agreementCursor + newAgreementCount);
        agreementCursor += newAgreementCount;

        const photoKeyJson = JSON.stringify(photosForThisStaff);
        const agreementKeyJson = JSON.stringify(agreementsForThisStaff);
        
        await connection.query(
            `INSERT INTO project_staff (application_id, staff_name, staff_role, staff_stipend_rate, staff_months_paid, staff_total_stipend, staff_per_diem, staff_joining_date, staff_end_date, staff_status, staff_photograph_s3_key, staff_agreement_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [mainApplicationId, staff.staff_name, staff.staff_role, staff.staff_stipend_rate_inr, staff.staff_months_stipend_paid, staff.staff_total_stipend_paid_inr, staff.staff_per_diem_paid_inr, staff.staff_joining_date, staff.staff_end_date, staff.staff_status || 'active', photoKeyJson, agreementKeyJson]
        );
    }
}


        // Section 11: `project_equipments` table
// Corrected logic for Section 11 in the POST / route
// Section 11: `project_equipments` table
if (grantDetails.projectEquipments && grantDetails.projectEquipments.length > 0) {
    const allEquipmentBillS3Keys = getUploadedFileKeysArray(filesUploadedByMulter, 's11_equipment_bills_files');
    let fileCursor = 0; // Use the correct cursor pattern

    for (const equip of grantDetails.projectEquipments) {
        // Assume frontend sends 'newFileCount' for each equipment item
        const newFileCount = equip.newFileCount || 0; 
        const filesForThisEquipment = allEquipmentBillS3Keys.slice(fileCursor, fileCursor + newFileCount);
        fileCursor += newFileCount; // Move cursor forward

        const equipmentBillKeyJson = JSON.stringify(filesForThisEquipment);
        
        await connection.query(
            `INSERT INTO project_equipments (application_id, name_of_equipment, quantity_of_equipment, cost_per_unit, total_cost, equipment_bills_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
            [mainApplicationId, equip.equipment_name_description, equip.quantity_of_equipment, equip.cost_per_unit_inr, equip.total_cost_equipments_inr, equipmentBillKeyJson]
        );
    }
}
        
        // Section 12: `project_files` table
        const finalReportFiles = filesUploadedByMulter['s12_final_report_file'] || [];
        const finalReportS3KeysJson = JSON.stringify(finalReportFiles.map(file => file.s3Key));

        const projectImageFiles = filesUploadedByMulter['s12_project_image_file'] || [];
        const projectImageS3KeysJson = JSON.stringify(projectImageFiles.map(file => file.s3Key));

        const overallDocFiles = filesUploadedByMulter['s7_fund_received_document_overall'] || [];
        const overallDocS3KeysJson = JSON.stringify(overallDocFiles.map(file => file.s3Key));

        await connection.query(`INSERT INTO project_files (application_id, final_report_document_s3_key, project_image_s3_key, overall_s7_doc_s3_key) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE final_report_document_s3_key = VALUES(final_report_document_s3_key), project_image_s3_key = VALUES(project_image_s3_key), overall_s7_doc_s3_key = VALUES(overall_s7_doc_s3_key)`, [mainApplicationId, finalReportS3KeysJson, projectImageS3KeysJson, overallDocS3KeysJson]);

        await connection.commit();
        console.log("SERVER POST: Transaction committed successfully.");
        res.status(201).json({ message: 'External grant created successfully', projectId: mainApplicationId });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log("SERVER POST: Transaction rolled back due to error.");
        }
        console.error('SERVER POST: Error creating external grant:', error);
        
        // S3 file cleanup on failure
        // CORRECTED LOOP for the catch block
        const fieldNames = Object.keys(filesUploadedByMulter);
        for (const fieldName of fieldNames) {
            const fileArray = filesUploadedByMulter[fieldName];
            for (const fileObj of fileArray) {
                if (fileObj.s3Key) {
                    console.log(`SERVER POST (Rollback Cleanup): Deleting S3 object: ${fileObj.s3Key}`);
                    await deleteFromS3(fileObj.s3Key);
                }
            }
        }
        
        res.status(500).json({ message: 'Failed to create external grant', error: error.message });
    } finally {
        if (connection) {
            connection.release();
            console.log("SERVER POST: Database connection released.");
        }
        console.log(`--- SERVER POST: END Create New Grant for ${mainApplicationId} ---`);
    }
});

router.get('/preview/:key(*)', async (req, res) => {
    // The (*) in the route parameter allows the key to contain slashes ('/')
    const key = req.params.key;
    console.log(`--- SERVER GET PREVIEW: Request for key: ${key} ---`);
    
    try {
        // Call the new service function to generate the temporary URL
        const url = await getSignedUrlForView(key);
        // Send the URL back to the frontend in a JSON object
        res.json({ url });
    } catch (error) {
        console.error(`SERVER GET PREVIEW: Error generating URL for key ${key}:`, error);
        res.status(500).json({ message: "Could not generate file preview link." });
    }
});


// =========================================================================
// ========= START: COMPLETE REPLACEMENT FOR THE UPDATE LOGIC  =========
// =========================================================================

/**
 * A generic, reusable function to handle the entire update logic for a 1-to-many relationship.
 * It handles DB record deletion/re-insertion and S3 file cleanup.
 * @param {object} connection - The database connection.
 * @param {string} applicationId - The parent grant ID.
 * @param {object[]} dataArray - The array of data for the child table from the frontend.
 * @param {object} allUploadedFiles - The complete req.files object from Multer.
 * @param {object} config - The configuration object for this specific table.
 */


//     const { tableName, insertQuery, fields, fileConfigs = [] } = config;
//     console.log(`\nSERVER PUT [${tableName}]: Processing for Application ID ${applicationId}`);

//     // 1. Get all old S3 keys from the DB for this table to identify orphans later.
//     const oldS3KeysInDb = new Set();
//     if (fileConfigs.length > 0) {
//         const dbColumns = fileConfigs.map(fc => fc.dbColumn).join(', ');
//         const [oldFileRows] = await connection.query(`SELECT ${dbColumns} FROM ${tableName} WHERE application_id = ?`, [applicationId]);
//         oldFileRows.forEach(row => {
//             fileConfigs.forEach(fc => {
//                 if (row[fc.dbColumn]) {
//                     try {
//                         const parsedKeys = JSON.parse(row[fc.dbColumn]);
//                         if (Array.isArray(parsedKeys)) {
//                             parsedKeys.forEach(key => key && oldS3KeysInDb.add(key));
//                         } else if (typeof row[fc.dbColumn] === 'string') { // Handle legacy single-string keys
//                            row[fc.dbColumn] && oldS3KeysInDb.add(row[fc.dbColumn]);
//                         }
//                     } catch (e) {
//                         // If parsing fails, it might be a legacy single string.
//                         if (typeof row[fc.dbColumn] === 'string') {
//                            row[fc.dbColumn] && oldS3KeysInDb.add(row[fc.dbColumn]);
//                         }
//                     }
//                 }
//             });
//         });
//     }

//     // 2. Clear all previous records from the database for this grant.
//     const [deleteResult] = await connection.query(`DELETE FROM ${tableName} WHERE application_id = ?`, [applicationId]);
//     console.log(`SERVER PUT [${tableName}]: Deleted ${deleteResult.affectedRows} DB rows.`);

//     // 3. Re-insert the new/updated records from the form.
//     const currentItemS3KeysInPayload = new Set();
//     if (dataArray.length > 0) {
//         const newFilesForField = {};
//         fileConfigs.forEach(fc => {
//             newFilesForField[fc.multerFieldName] = getUploadedFileKeysArray(allUploadedFiles, fc.multerFieldName);
//         });

//         console.log(`SERVER PUT [${tableName}]: Re-inserting ${dataArray.length} items.`);
//         for (let i = 0; i < dataArray.length; i++) {
//             const itemFromFrontend = dataArray[i];
//             const valuesToInsert = fields.map(f => itemFromFrontend[f] === undefined ? null : itemFromFrontend[f]);

//             fileConfigs.forEach(fc => {
//                 const existingFilesToKeep = itemFromFrontend[fc.dbColumn] || [];
//                 const newFileForThisItem = newFilesForField[fc.multerFieldName].shift();
                
//                 const finalFileArray = [...existingFilesToKeep];
//                 if (newFileForThisItem) {
//                     finalFileArray.push(newFileForThisItem);
//                 }
                
//                 const finalFileArrayJson = JSON.stringify(finalFileArray);
//                 valuesToInsert.push(finalFileArrayJson);
//                 finalFileArray.forEach(key => key && currentItemS3KeysInPayload.add(key));
//             });
            
//             await connection.query(insertQuery, [applicationId, ...valuesToInsert]);
//         }
//     }

//     // 4. Clean up any orphaned S3 files for this section.
//     oldS3KeysInDb.forEach(async (oldKey) => {
//         if (!currentItemS3KeysInPayload.has(oldKey)) {
//             console.log(`SERVER PUT [${tableName}]: S3 CLEANUP - Deleting orphaned S3 file: ${oldKey}`);
//             await deleteFromS3(oldKey);
//         }
//     });
//     console.log(`SERVER PUT [${tableName}]: Finished processing.`);
// }

// --- CONFIGURATION FOR 1-to-MANY TABLES ---



// const oneToManyTablesConfig = [
//     { 
//         tableName: 'funding_collaboration', 
//         dataArrayName: 'fundingCollaborations', 
//         insertQuery: `INSERT INTO funding_collaboration (application_id, funding_agencies_name, collaboration_name, collaboration_country_of_origin, collaboration_contact_details) VALUES (?, ?, ?, ?, ?)`, 
//         fields: ['funding_agencies_name', 'collaboration_name', 'collaboration_country_of_origin', 'collaboration_contact_details']
//     },
//     { 
//         tableName: 'principal_investigators', 
//         dataArrayName: 'principalInvestigators', 
//         insertQuery: `INSERT INTO principal_investigators (application_id, name_of_pi, pi_contact_details, pi_affiliating_institution, pi_affiliating_country, pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//         fields: ['name_of_pi', 'pi_contact_details', 'pi_affiliating_institution', 'pi_affiliating_country'],
//         fileConfigs: [{ dbColumn: 'pi_photograph_s3_key', multerFieldName: 's4_pi_photographs' }]
//     },
//     { 
//         tableName: 'co_investigators', 
//         dataArrayName: 'coInvestigators', 
//         insertQuery: `INSERT INTO co_investigators (application_id, name_of_co_pi, co_pi_contact_details, co_pi_affiliating_institution, co_pi_affiliating_country, co_pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//         fields: ['name_of_co_pi', 'co_pi_contact_details', 'co_pi_affiliating_institution', 'co_pi_affiliating_country'],
//         fileConfigs: [{ dbColumn: 'co_pi_photograph_s3_key', multerFieldName: 's5_co_pi_photographs' }]
//     },

//     { 
//     tableName: 'funds_received', 
//     dataArrayName: 'fundInstallments', 
//     // --- CORRECTED QUERY: Removed 'amount_received_inr' ---
//     insertQuery: `INSERT INTO funds_received (application_id, fy_year, installment_amount_inr, bank_fee_inr, installment_date, fund_received_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//     // --- CORRECTED FIELDS: Removed the redundant 'installment_amount_inr' that mapped to the wrong column ---
//     fields: ['fy_year_installment', 'installment_amount_inr', 'bank_fee_inr', 'installment_date'],
//     fileConfigs: [{ dbColumn: 'fund_received_document_s3_key', multerFieldName: 's7_fund_received_documents' }]
// },
//     { 
//         tableName: 'budget_head', 
//         dataArrayName: 'budgetHeads', 
//         insertQuery: `INSERT INTO budget_head (application_id, budget_head, budget_percentage, budget_value, actual_expense, balance_fund) VALUES (?, ?, ?, ?, ?, ?)`, 
//         fields: ['budget_head_name', 'budget_percentage', 'budget_head_value_inr', 'actual_expense_inr', 'balance_fund_inr']
//     },
//     { 
//         tableName: 'project_deliverables', 
//         dataArrayName: 'projectDeliverables', 
//         insertQuery: `INSERT INTO project_deliverables (application_id, deliverable_type, deliverable_status, deliverable_start_date, deliverable_due_date, deliverable_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//         fields: ['deliverable_description', 'deliverable_status', 'deliverable_start_date', 'deliverable_due_date'],
//         fileConfigs: [{ dbColumn: 'deliverable_document_s3_key', multerFieldName: 's9_deliverable_documents' }]
//     },
//     { 
//         tableName: 'project_equipments', 
//         dataArrayName: 'projectEquipments', 
//         insertQuery: `INSERT INTO project_equipments (application_id, name_of_equipment, quantity_of_equipment, cost_per_unit, total_cost, equipment_bills_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
//         fields: ['equipment_name_description', 'quantity_of_equipment', 'cost_per_unit_inr', 'total_cost_equipments_inr'],
//         fileConfigs: [{ dbColumn: 'equipment_bills_s3_key', multerFieldName: 's11_equipment_bills_files' }]
//     },
//     {
//         tableName: 'project_staff',
//         dataArrayName: 'projectStaff',
//         insertQuery: `INSERT INTO project_staff (application_id, staff_name, staff_role, staff_stipend_rate, staff_months_paid, staff_total_stipend, staff_per_diem, staff_joining_date, staff_end_date, staff_status, staff_photograph_s3_key, staff_agreement_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         fields: ['staff_name', 'staff_role', 'staff_stipend_rate_inr', 'staff_months_stipend_paid', 'staff_total_stipend_paid_inr', 'staff_per_diem_paid_inr', 'staff_joining_date', 'staff_end_date', 'staff_status'],
//         fileConfigs: [
//             { dbColumn: 'staff_photograph_s3_key', multerFieldName: 's10_staff_photographs' },
//             { dbColumn: 'staff_agreement_s3_key',  multerFieldName: 's10_staff_agreements' }
//         ]
//     }
// ];


// REPLACE the entire oneToManyTablesConfig constant with this

const oneToManyTablesConfig = [
    { 
        tableName: 'funding_collaboration', 
        dataArrayName: 'fundingCollaborations', 
        insertQuery: `INSERT INTO funding_collaboration (application_id, funding_agencies_name, collaboration_name, collaboration_country_of_origin, collaboration_contact_details) VALUES (?, ?, ?, ?, ?)`, 
        fields: ['funding_agencies_name', 'collaboration_name', 'collaboration_country_of_origin', 'collaboration_contact_details']
    },
    { 
        tableName: 'principal_investigators', 
        dataArrayName: 'principalInvestigators', 
        insertQuery: `INSERT INTO principal_investigators (application_id, name_of_pi, pi_contact_details, pi_affiliating_institution, pi_affiliating_country, pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['name_of_pi', 'pi_contact_details', 'pi_affiliating_institution', 'pi_affiliating_country'],
        fileConfigs: [{ dbColumn: 'pi_photograph_s3_key', multerFieldName: 's4_pi_photographs', countPropertyName: 'newFileCount' }]
    },
    { 
        tableName: 'co_investigators', 
        dataArrayName: 'coInvestigators', 
        insertQuery: `INSERT INTO co_investigators (application_id, name_of_co_pi, co_pi_contact_details, co_pi_affiliating_institution, co_pi_affiliating_country, co_pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['name_of_co_pi', 'co_pi_contact_details', 'co_pi_affiliating_institution', 'co_pi_affiliating_country'],
        fileConfigs: [{ dbColumn: 'co_pi_photograph_s3_key', multerFieldName: 's5_co_pi_photographs', countPropertyName: 'newFileCount' }]
    },
    { 
        tableName: 'funds_received', 
        dataArrayName: 'fundInstallments', 
        insertQuery: `INSERT INTO funds_received (application_id, fy_year, installment_amount_inr, bank_fee_inr, installment_date, fund_received_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['fy_year_installment', 'installment_amount_inr', 'bank_fee_inr', 'installment_date'],
        fileConfigs: [{ dbColumn: 'fund_received_document_s3_key', multerFieldName: 's7_fund_received_documents', countPropertyName: 'newFileCount' }]
    },
    { 
        tableName: 'budget_head', 
        dataArrayName: 'budgetHeads', 
        insertQuery: `INSERT INTO budget_head (application_id, budget_head, budget_percentage, budget_value, actual_expense, balance_fund) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['budget_head_name', 'budget_percentage', 'budget_head_value_inr', 'actual_expense_inr', 'balance_fund_inr']
    },
    { 
        tableName: 'project_deliverables', 
        dataArrayName: 'projectDeliverables', 
        insertQuery: `INSERT INTO project_deliverables (application_id, deliverable_type, deliverable_status, deliverable_start_date, deliverable_due_date, deliverable_document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['deliverable_description', 'deliverable_status', 'deliverable_start_date', 'deliverable_due_date'],
        fileConfigs: [{ dbColumn: 'deliverable_document_s3_key', multerFieldName: 's9_deliverable_documents', countPropertyName: 'newFileCount' }]
    },
    { 
        tableName: 'project_equipments', 
        dataArrayName: 'projectEquipments', 
        insertQuery: `INSERT INTO project_equipments (application_id, name_of_equipment, quantity_of_equipment, cost_per_unit, total_cost, equipment_bills_s3_key) VALUES (?, ?, ?, ?, ?, ?)`, 
        fields: ['equipment_name_description', 'quantity_of_equipment', 'cost_per_unit_inr', 'total_cost_equipments_inr'],
        fileConfigs: [{ dbColumn: 'equipment_bills_s3_key', multerFieldName: 's11_equipment_bills_files', countPropertyName: 'newFileCount' }]
    },
    {
        tableName: 'project_staff',
        dataArrayName: 'projectStaff',
        insertQuery: `INSERT INTO project_staff (application_id, staff_name, staff_role, staff_stipend_rate, staff_months_paid, staff_total_stipend, staff_per_diem, staff_joining_date, staff_end_date, staff_status, staff_photograph_s3_key, staff_agreement_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        fields: ['staff_name', 'staff_role', 'staff_stipend_rate_inr', 'staff_months_stipend_paid', 'staff_total_stipend_paid_inr', 'staff_per_diem_paid_inr', 'staff_joining_date', 'staff_end_date', 'staff_status'],
        fileConfigs: [
            { dbColumn: 'staff_photograph_s3_key', multerFieldName: 's10_staff_photographs', countPropertyName: 'newPhotoCount' },
            { dbColumn: 'staff_agreement_s3_key',  multerFieldName: 's10_staff_agreements', countPropertyName: 'newAgreementCount' }
        ]
    }
];


// === UPDATE GRANT ===
router.put('/:applicationId', upload.fields(grantUploadFields), async (req, res) => {
    const applicationIdToUpdate = req.params.applicationId;
    console.log(`\n--- SERVER PUT: START Update for Application ID: ${applicationIdToUpdate} ---`);

    if (!req.body.grantDetails) {
        return res.status(400).json({ message: "grantDetails is missing." });
    }
    let grantDetails;
    try {
        grantDetails = JSON.parse(req.body.grantDetails);
    } catch (e) {
        return res.status(400).json({ message: "Invalid JSON in grantDetails." });
    }

    const newlyUploadedFiles = req.files || {};
    const newlyUploadedS3KeysForRollback = [];

    const connection = await pool.getConnection();
    console.log("SERVER PUT: Database connection acquired.");
    await connection.beginTransaction();
    console.log("SERVER PUT: Transaction started.");

    try {
        // Step 1: Upload all new files to S3 and add the `s3Key` property to the file objects.
        for (const fieldName in newlyUploadedFiles) {
            const fileArray = newlyUploadedFiles[fieldName];
            for (const fileObj of fileArray) {
                const s3Key = await uploadToS3(fileObj, applicationIdToUpdate, `${fieldName}_updated`);
                fileObj.s3Key = s3Key;
                if (s3Key) newlyUploadedS3KeysForRollback.push(s3Key);
            }
        }
        
        // --- Step 2: Update 1-to-1 tables ---
        console.log("SERVER PUT: Updating 1-to-1 tables.");
        
        const processSingleEntityFileUpdate = async (tableName, dbColumnName, formFieldName, existingKeepList) => {
            const [rows] = await connection.query(`SELECT ${dbColumnName} FROM ${tableName} WHERE application_id = ?`, [applicationIdToUpdate]);
            let originalFiles = [];
            if (rows[0] && rows[0][dbColumnName]) {
                try { originalFiles = JSON.parse(rows[0][dbColumnName]); } catch (e) {}
            }
            if(!Array.isArray(originalFiles)) originalFiles = []; // Ensure it is an array

            const filesToDelete = originalFiles.filter(key => !(existingKeepList || []).includes(key));
            if (filesToDelete.length > 0) {
                console.log(`SERVER PUT [S3 Cleanup for ${tableName}]: Deleting ${filesToDelete.length} orphaned file(s).`);
                await Promise.all(filesToDelete.map(key => deleteFromS3(key)));
            }
            const newFiles = (newlyUploadedFiles[formFieldName] || []).map(f => f.s3Key);
            return JSON.stringify([...(existingKeepList || []), ...newFiles]);
        };

        const core = grantDetails.coreInfo || {};
        const finalAgreementFilesJson = await processSingleEntityFileUpdate('projects', 'project_agreement_files', 's1_project_agreement_file', core.project_agreement_files);
        await connection.query(
            `UPDATE projects SET project_id_odr=?, project_title=?, project_id_funder=?, department_name=?, type_of_grant=?, funder_type=?, fcra_type=?, project_website_link=?, project_agreement_files=? WHERE application_id = ?`,
            [core.project_id_odr, core.project_title, core.project_id_funder, core.department_name, core.type_of_grant, core.funder_type, core.fcra_type, core.project_website_link, finalAgreementFilesJson, applicationIdToUpdate]
        );

        const ds = grantDetails.datesStatus || {};
        const finalAppDocJson = await processSingleEntityFileUpdate('project_dates_status', 'application_document_s3_key', 's2_application_document_file', ds.application_document_s3_key);
        await connection.query(
            `INSERT INTO project_dates_status (application_id, academic_year, application_date, application_status, calendar_year, financial_closing_status, financial_year, project_duration, project_end_date, project_secured_date, project_start_date, project_status, application_document_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE academic_year=VALUES(academic_year), application_date=VALUES(application_date), application_status=VALUES(application_status), calendar_year=VALUES(calendar_year), financial_closing_status=VALUES(financial_closing_status), financial_year=VALUES(financial_year), project_duration=VALUES(project_duration), project_end_date=VALUES(project_end_date), project_secured_date=VALUES(project_secured_date), project_start_date=VALUES(project_start_date), project_status=VALUES(project_status), application_document_s3_key = ?`,
            [applicationIdToUpdate, ds.academic_year, ds.application_date, ds.application_status, ds.calendar_year, ds.financial_closing_status, ds.financial_year, ds.project_duration, ds.project_end_date, ds.project_secured_date, ds.project_start_date, ds.project_status, finalAppDocJson, finalAppDocJson]
        );
        
        const gi = grantDetails.amountsOverheads || {};
        const finalFinancialDocsJson = await processSingleEntityFileUpdate('grant_info', 'financial_documents_s3_key', 's6_financial_documents_file', gi.financial_documents_s3_key);
        await connection.query(
            `INSERT INTO grant_info (application_id, grant_sanctioned_amount, currency, exchange_rate, grant_amount_in_inr, amount_in_usd, overheads_percentage, overheads_secured, overheads_received, gst_applicable, financial_documents_s3_key, remaining_amount_inr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE grant_sanctioned_amount=VALUES(grant_sanctioned_amount), currency=VALUES(currency), exchange_rate=VALUES(exchange_rate), grant_amount_in_inr=VALUES(grant_amount_in_inr), amount_in_usd=VALUES(amount_in_usd), overheads_percentage=VALUES(overheads_percentage), overheads_secured=VALUES(overheads_secured), overheads_received=VALUES(overheads_received), gst_applicable=VALUES(gst_applicable), financial_documents_s3_key = ?, remaining_amount_inr=VALUES(remaining_amount_inr)`,
            [applicationIdToUpdate, gi.grant_sanctioned_amount_original_currency, gi.currency_code, gi.exchange_rate_to_inr, gi.grant_amount_in_inr, gi.amount_in_usd_equivalent, gi.overheads_percentage, gi.overheads_secured_inr, gi.overheads_received_inr, gi.gst_applicable, finalFinancialDocsJson, gi.remaining_amount_inr, finalFinancialDocsJson]
        );

        const fo = grantDetails.filesOther || {};
        const finalReportJson = await processSingleEntityFileUpdate('project_files', 'final_report_document_s3_key', 's12_final_report_file', fo.final_report_document_s3_key);
        const projectImageJson = await processSingleEntityFileUpdate('project_files', 'project_image_s3_key', 's12_project_image_file', fo.project_image_s3_key);
        const overallS7Json = await processSingleEntityFileUpdate('project_files', 'overall_s7_doc_s3_key', 's7_fund_received_document_overall', fo.overall_s7_doc_s3_key);
        await connection.query(
            `INSERT INTO project_files (application_id, final_report_document_s3_key, project_image_s3_key, overall_s7_doc_s3_key) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE final_report_document_s3_key = ?, project_image_s3_key = ?, overall_s7_doc_s3_key = ?`,
            [applicationIdToUpdate, finalReportJson, projectImageJson, overallS7Json, finalReportJson, projectImageJson, overallS7Json]
        );

        // --- Step 3: Process all 1-to-many relationships using our new reusable helper ---
        for (const config of oneToManyTablesConfig) {
            await processOneToManyRelationship(
                connection,
                applicationIdToUpdate,
                grantDetails[config.dataArrayName],
                newlyUploadedFiles,
                config
            );
        }


// async function processOneToManyRelationship(connection, applicationId, dataArray = [], allUploadedFiles, config) {
//     const { tableName, insertQuery, fields, fileConfigs = [] } = config;
//     console.log(`\nSERVER PUT [${tableName}]: Processing for Application ID ${applicationId}`);

//     // --- (Step 1: Get old S3 keys remains the same) ---
//     const oldS3KeysInDb = new Set();
//     if (fileConfigs.length > 0) {
//         const dbColumns = fileConfigs.map(fc => fc.dbColumn).join(', ');
//         const [oldFileRows] = await connection.query(`SELECT ${dbColumns} FROM ${tableName} WHERE application_id = ?`, [applicationId]);
//         oldFileRows.forEach(row => {
//             fileConfigs.forEach(fc => {
//                 if (row[fc.dbColumn]) {
//                     try {
//                         const parsedKeys = JSON.parse(row[fc.dbColumn]);
//                         if (Array.isArray(parsedKeys)) {
//                             parsedKeys.forEach(key => key && oldS3KeysInDb.add(key));
//                         }
//                     } catch (e) { /* ignore */ }
//                 }
//             });
//         });
//     }

//     // --- (Step 2: Delete old DB records remains the same) ---
//     const [deleteResult] = await connection.query(`DELETE FROM ${tableName} WHERE application_id = ?`, [applicationId]);
//     console.log(`SERVER PUT [${tableName}]: Deleted ${deleteResult.affectedRows} DB rows.`);

//     // --- (Step 3: Re-insert records with CORRECTED file logic) ---
//     const currentItemS3KeysInPayload = new Set();
//     if (dataArray.length > 0) {
//         // ** THE KEY FIX IS HERE **
//         // We now create a mutable copy of the new file keys for each file type.
//         const newFilesQueue = {};
//         fileConfigs.forEach(fc => {
//             newFilesQueue[fc.multerFieldName] = getUploadedFileKeysArray(allUploadedFiles, fc.multerFieldName);
//         });

//         console.log(`SERVER PUT [${tableName}]: Re-inserting ${dataArray.length} items.`);
//         for (const itemFromFrontend of dataArray) {
//             const valuesToInsert = fields.map(f => itemFromFrontend[f] === undefined ? null : itemFromFrontend[f]);

//             // For each file type (e.g., photo, agreement), build its final file array
//             fileConfigs.forEach(fc => {
//                 const existingFilesToKeep = itemFromFrontend[fc.dbColumn] || [];
                
//                 // ** THE CRITICAL CHANGE **
//                 // Instead of associating all new files with the first item, we check if the frontend
//                 // sent any NEW files for this specific item. Since the frontend sends one file input per item,
//                 // the number of new files should correspond to the number of items that had a new file attached.
//                 // We use `shift()` to consume the next available file from the queue for this item.
//                 const newFileForThisItem = newFilesQueue[fc.multerFieldName].shift();
                
//                 const finalFileArray = [...existingFilesToKeep];
//                 if (newFileForThisItem) {
//                     finalFileArray.push(newFileForThisItem);
//                 }
                
//                 const finalFileArrayJson = JSON.stringify(finalFileArray);
//                 valuesToInsert.push(finalFileArrayJson);
//                 finalFileArray.forEach(key => key && currentItemS3KeysInPayload.add(key));
//             });
            
//             await connection.query(insertQuery, [applicationId, ...valuesToInsert]);
//         }
//     }

//     // --- (Step 4: S3 Cleanup remains the same) ---
//     oldS3KeysInDb.forEach(async (oldKey) => {
//         if (!currentItemS3KeysInPayload.has(oldKey)) {
//             console.log(`SERVER PUT [${tableName}]: S3 CLEANUP - Deleting orphaned S3 file: ${oldKey}`);
//             await deleteFromS3(oldKey);
//         }
//     });
//     console.log(`SERVER PUT [${tableName}]: Finished processing.`);
// }    

async function processOneToManyRelationship(connection, applicationId, dataArray = [], allUploadedFiles, config) {
    const { tableName, insertQuery, fields, fileConfigs = [] } = config;
    console.log(`\nSERVER PUT [${tableName}]: Processing for Application ID ${applicationId}`);

    // --- (Step 1: Get old S3 keys remains the same) ---
    const oldS3KeysInDb = new Set();
    if (fileConfigs.length > 0) {
        const dbColumns = fileConfigs.map(fc => fc.dbColumn).join(', ');
        const [oldFileRows] = await connection.query(`SELECT ${dbColumns} FROM ${tableName} WHERE application_id = ?`, [applicationId]);
        oldFileRows.forEach(row => {
            fileConfigs.forEach(fc => {
                if (row[fc.dbColumn]) {
                    try {
                        const parsedKeys = JSON.parse(row[fc.dbColumn]);
                        if (Array.isArray(parsedKeys)) {
                            parsedKeys.forEach(key => key && oldS3KeysInDb.add(key));
                        }
                    } catch (e) { /* ignore non-json legacy data */ }
                }
            });
        });
    }

    // --- (Step 2: Delete old DB records remains the same) ---
    const [deleteResult] = await connection.query(`DELETE FROM ${tableName} WHERE application_id = ?`, [applicationId]);
    console.log(`SERVER PUT [${tableName}]: Deleted ${deleteResult.affectedRows} DB rows.`);

    // --- (Step 3: Re-insert records with CORRECTED file logic) ---
    const currentItemS3KeysInPayload = new Set();
    if (dataArray && dataArray.length > 0) {
        // Create a mutable queue of new file keys for each file type.
        const newFilesQueue = {};
        fileConfigs.forEach(fc => {
            newFilesQueue[fc.multerFieldName] = getUploadedFileKeysArray(allUploadedFiles, fc.multerFieldName);
        });

        console.log(`SERVER PUT [${tableName}]: Re-inserting ${dataArray.length} items.`);
        for (const itemFromFrontend of dataArray) {
            const valuesToInsert = fields.map(f => itemFromFrontend[f] === undefined ? null : itemFromFrontend[f]);

            // For each file type (e.g., photo, agreement), build its final file array
            fileConfigs.forEach(fc => {
                const existingFilesToKeep = itemFromFrontend[fc.dbColumn] || [];
                
                // *** THE KEY FIX for UPDATE ***
                // Use the count from the frontend to slice the correct number of new files from the queue.
                // const newFileCount = itemFromFrontend.newFileCount || 0; // Assumes frontend sends this count
                const newFileCount = itemFromFrontend[fc.countPropertyName] || 0;

                const newFilesForThisItem = newFilesQueue[fc.multerFieldName].splice(0, newFileCount);
                
                const finalFileArray = [...existingFilesToKeep, ...newFilesForThisItem];
                
                const finalFileArrayJson = JSON.stringify(finalFileArray);
                valuesToInsert.push(finalFileArrayJson);
                finalFileArray.forEach(key => key && currentItemS3KeysInPayload.add(key));
            });
            
            await connection.query(insertQuery, [applicationId, ...valuesToInsert]);
        }
    }

    // --- (Step 4: S3 Cleanup remains the same) ---
    oldS3KeysInDb.forEach(async (oldKey) => {
        if (!currentItemS3KeysInPayload.has(oldKey)) {
            console.log(`SERVER PUT [${tableName}]: S3 CLEANUP - Deleting orphaned S3 file: ${oldKey}`);
            await deleteFromS3(oldKey);
        }
    });
    console.log(`SERVER PUT [${tableName}]: Finished processing.`);
}



await connection.commit();
        console.log("SERVER PUT: Transaction committed successfully.");
        res.json({ message: 'External grant updated successfully', applicationId: applicationIdToUpdate });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log("SERVER PUT: Transaction rolled back due to error.");
        }
        console.error('SERVER PUT: Error updating external grant:', error);
        for (const s3key of newlyUploadedS3KeysForRollback) {
            console.log(`SERVER PUT (Rollback Cleanup): Deleting newly uploaded S3 object: ${s3key}`);
            await deleteFromS3(s3key);
        }
        res.status(500).json({ message: 'Failed to update external grant', error: error.message });
    } finally {
        if (connection) {
            connection.release();
            console.log("SERVER PUT: Database connection released.");
        }
        console.log(`--- SERVER PUT: END Update for Application ID: ${applicationIdToUpdate} ---\n`);
    }
});
// =========================================================================
// =========================================================================
// =========  END: COMPLETE REPLACEMENT FOR THE UPDATE LOGIC  ==========
// =========================================================================

// === GET ALL GRANTS ===
// This is the single, correct route handler for fetching a list of grants.
// === GET ALL GRANTS (WITH ADVANCED FILTERING) ===
router.get('/', async (req, res) => {
    console.log("SERVER GET ALL: Received request with query params:", req.query);
    try {
        // --- 1. Base Query with all necessary JOINs ---
        let baseQuery = `
            SELECT 
                p.application_id,
                p.project_id_odr,
                p.project_title, 
                pds.project_status,
                gi.grant_amount_in_inr,
                (SELECT GROUP_CONCAT(DISTINCT pi.name_of_pi SEPARATOR ', ') 
                 FROM principal_investigators pi 
                 WHERE pi.application_id = p.application_id) AS pi_names_concatenated
            FROM projects p
            LEFT JOIN project_dates_status pds ON p.application_id = pds.application_id
            LEFT JOIN grant_info gi ON p.application_id = gi.application_id
            LEFT JOIN funding_collaboration fc ON p.application_id = fc.application_id
            WHERE p.grant_category = 'EXTERNAL'
        `;
        
        const whereClauses = [];
        const queryParams = [];

        // --- 2. Dynamically build WHERE clauses based on request query ---
        
        // a) Project Title (Text Search)
        if (req.query.projectTitle) {
            whereClauses.push("p.project_title LIKE ?");
            queryParams.push(`%${req.query.projectTitle}%`);
        }

        // f) Funding Agency (Text Search)
        if (req.query.fundingAgency) {
            whereClauses.push("fc.funding_agencies_name LIKE ?");
            queryParams.push(`%${req.query.fundingAgency}%`);
        }

        // g) Collaborator (Text Search)
        if (req.query.collaborator) {
            whereClauses.push("fc.collaboration_name LIKE ?");
            queryParams.push(`%${req.query.collaborator}%`);
        }
        
        // h) Collaborator Country (Text Search)
        if (req.query.collaboratorCountry) {
            whereClauses.push("fc.collaboration_country_of_origin LIKE ?");
            queryParams.push(`%${req.query.collaboratorCountry}%`);
        }
        
        // b) School/Institute (Multi-select)
        if (req.query.schools) {
            const schools = Array.isArray(req.query.schools) ? req.query.schools : [req.query.schools];
            if (schools.length > 0) {
                whereClauses.push(`p.department_name IN (?)`);
                queryParams.push(schools);
            }
        }

        // c) Type of Grant (Multi-select)
        if (req.query.grantTypes) {
            const grantTypes = Array.isArray(req.query.grantTypes) ? req.query.grantTypes : [req.query.grantTypes];
            if (grantTypes.length > 0) {
                whereClauses.push(`p.type_of_grant IN (?)`);
                queryParams.push(grantTypes);
            }
        }
        
        // d) Funder Type (Multi-select)
        if (req.query.funderTypes) {
            const funderTypes = Array.isArray(req.query.funderTypes) ? req.query.funderTypes : [req.query.funderTypes];
            if (funderTypes.length > 0) {
                whereClauses.push(`p.funder_type IN (?)`);
                queryParams.push(funderTypes);
            }
        }
        
        // e) Project Secured Date Range
        if (req.query.startDate && req.query.endDate) {
            whereClauses.push("pds.project_secured_date BETWEEN ? AND ?");
            queryParams.push(req.query.startDate, req.query.endDate);
        }

        // i) Sanctioned Amount Range
        if (req.query.minAmount && req.query.maxAmount) {
            whereClauses.push("gi.grant_amount_in_inr BETWEEN ? AND ?");
            queryParams.push(parseFloat(req.query.minAmount), parseFloat(req.query.maxAmount));
        } else if (req.query.minAmount) {
            whereClauses.push("gi.grant_amount_in_inr >= ?");
            queryParams.push(parseFloat(req.query.minAmount));
        } else if (req.query.maxAmount) {
            whereClauses.push("gi.grant_amount_in_inr <= ?");
            queryParams.push(parseFloat(req.query.maxAmount));
        }
        
        // --- 3. Combine clauses into the final query ---
        if (whereClauses.length > 0) {
            baseQuery += " AND " + whereClauses.join(" AND ");
        }

        // Because of JOINs, we might get duplicates. GROUP BY the primary ID.
        baseQuery += " GROUP BY p.application_id ORDER BY p.application_id DESC";

        console.log("SERVER GET ALL: Executing query:", baseQuery);
        console.log("SERVER GET ALL: With parameters:", queryParams);

        const [grants] = await pool.query(baseQuery, queryParams);
        
        res.json(grants);

    } catch (error) {
        console.error("Error fetching grants list (server-side):", error);
        res.status(500).json({ message: "Failed to fetch grants", error: error.message });
    }
});
// The duplicate, fragmented code that was here has been removed.
// === GET ONE GRANT ===

    router.get('/:applicationId', async (req, res) => {
    const { applicationId } = req.params; // Get the ID from the URL path
    
    console.log(`\n--- SERVER GET ONE: Request for Application ID: ${applicationId} ---`);

    const connection = await pool.getConnection();
    console.log("SERVER GET ONE: Database connection acquired.");
    try {
        const grantData = {
            coreInfo: {}, datesStatus: {}, fundingCollaborations: [],
            principalInvestigators: [], coInvestigators: [],
            amountsOverheads: {}, fundInstallments: [], budgetHeads: [],
            projectDeliverables: [], projectStaff: [], projectEquipments: [],
            filesOther: {} // fundInstallmentsOverallFileKey will be added dynamically
        };

        // 1. Fetch from 'projects' (Core Info)
        const [projectRows] = await connection.query('SELECT * FROM projects WHERE application_id = ?', [applicationId]);
        if (projectRows.length === 0) {
            return res.status(404).json({ message: 'Grant not found' });
        }
        // =========================================================================
        grantData.coreInfo = projectRows[0];
        // =========================================================================

        // 2. Fetch from 'project_dates_status' (Dates & Status)
        const [datesStatusRows] = await connection.query('SELECT * FROM project_dates_status WHERE application_id = ?', [applicationId]);
        if (datesStatusRows.length > 0) {
            // =========================================================================
            grantData.datesStatus = datesStatusRows[0];
            // =========================================================================
        }

        // 3. Fetch from 'grant_info' (Amounts & Overheads)
        // REPLACE WITH THIS NEW CODE BLOCK

        const [grantInfoRows] = await connection.query('SELECT * FROM grant_info WHERE application_id = ?', [applicationId]);
        if (grantInfoRows.length > 0) {
            const dbData = grantInfoRows[0];
            // Map DB columns to the property names the frontend expects
            grantData.amountsOverheads = {
                grant_sanctioned_amount: dbData.grant_sanctioned_amount,
                currency: dbData.currency,
                exchange_rate: dbData.exchange_rate,
                grant_amount_in_inr: dbData.grant_amount_in_inr,
                amount_in_usd: dbData.amount_in_usd,
                overheads_percentage: dbData.overheads_percentage,
                overheads_secured: dbData.overheads_secured, // <-- THE KEY FIX IS HERE
                overheads_received: dbData.overheads_received,
                gst_applicable: dbData.gst_applicable,
                financial_documents_s3_key: dbData.financial_documents_s3_key,
                remaining_amount_inr: dbData.remaining_amount_inr
            };
        }
        
        // 4. Fetch from 'project_files' (Files & Other)
        const [projectFilesRows] = await connection.query('SELECT * FROM project_files WHERE application_id = ?', [applicationId]);
        if (projectFilesRows.length > 0) {
            // =========================================================================
            grantData.filesOther = projectFilesRows[0];
            // =========================================================================
        }

        // 5. Fetch from 'funding_collaboration' (1:N)
        const [fundingCollabRows] = await connection.query('SELECT * FROM funding_collaboration WHERE application_id = ?', [applicationId]);
        grantData.fundingCollaborations = fundingCollabRows; // This was already correct.

        // 6. Fetch from 'principal_investigators' (1:N)
        const [piRows] = await connection.query('SELECT * FROM principal_investigators WHERE application_id = ?', [applicationId]);
        // =========================================================================
        grantData.principalInvestigators = piRows;
        // =========================================================================
        
        // 7. Fetch from 'co_investigators' (1:N)
        const [coPiRows] = await connection.query('SELECT * FROM co_investigators WHERE application_id = ?', [applicationId]);
        // =========================================================================
        grantData.coInvestigators = coPiRows;
        // =========================================================================

        // 8. Fetch from 'funds_received' (1:N - Installments)
        const [fundsReceivedRows] = await connection.query('SELECT * FROM funds_received WHERE application_id = ?', [applicationId]);
        grantData.fundInstallments = fundsReceivedRows.map(r => ({ 
            ...r, 
            fy_year_installment: r.fy_year,
        }));
        if (grantData.amountsOverheads) {
             grantData.amountsOverheads.total_amount_received_inr = fundsReceivedRows.reduce((sum, row) => sum + parseFloat(row.installment_amount_inr || 0), 0);
        } else {
             grantData.amountsOverheads = { total_amount_received_inr: fundsReceivedRows.reduce((sum, row) => sum + parseFloat(row.installment_amount_inr || 0), 0) };
        }


        // 9. Fetch from 'budget_head' (1:N)
const [budgetHeadRows] = await connection.query('SELECT * FROM budget_head WHERE application_id = ?', [applicationId]);
grantData.budgetHeads = budgetHeadRows; // Just send the raw data

        // 10. Fetch from 'project_deliverables' (1:N)
        const [deliverableRows] = await connection.query('SELECT * FROM project_deliverables WHERE application_id = ?', [applicationId]);
        grantData.projectDeliverables = deliverableRows.map(r => ({ 
            ...r, 
            deliverable_description: r.deliverable_type,
        }));

        // 11. Fetch from 'project_staff' (1:N)
        const [staffRows] = await connection.query('SELECT * FROM project_staff WHERE application_id = ?', [applicationId]);
        grantData.projectStaff = staffRows.map(r => ({
            staff_name: r.staff_name,
            staff_role: r.staff_role,
            staff_months_stipend_paid: r.staff_months_paid,
            staff_stipend_rate_inr: r.staff_stipend_rate,
            staff_total_stipend_paid_inr: r.staff_total_stipend,
            staff_per_diem_paid_inr: r.staff_per_diem,
            staff_joining_date: r.staff_joining_date,
            staff_end_date: r.staff_end_date,
            staff_status: r.staff_status,
            staff_photograph_s3_key: r.staff_photograph_s3_key,
            staff_agreement_s3_key: r.staff_agreement_s3_key,
            id: r.id
        }));

        // 12. Fetch from 'project_equipments' (1:N)
        const [equipRows] = await connection.query('SELECT * FROM project_equipments WHERE application_id = ?', [applicationId]);
        // =========================================================================
        grantData.projectEquipments = equipRows;
        // =========================================================================
        
        // 13. Fetch from 'inventory' for items assigned to this grant (NEW)
    const [assignedInventoryRows] = await connection.query(
        'SELECT id, asset_category, item, make, tag_no, status FROM inventory WHERE grant_application_id = ? AND grant_type = ?', 
        [applicationId, 'EXTERNAL']
    );
    grantData.assignedInventory = assignedInventoryRows; // Add it to the response object

        console.log(`SERVER GET ONE: Successfully fetched all data for Application ID: ${applicationId}.`);
        res.json(grantData);

    } catch (error) {
        console.error(`SERVER GET ONE: Error fetching grant details for Application ID ${applicationId}:`, error);
        res.status(500).json({ message: 'Failed to fetch grant details', error: error.message });
    } finally {
        if (connection) {
            connection.release();
            console.log("SERVER GET ONE: Database connection released.");
        }
    }
});



/**
 * ============================================
 * === EXPORT GRANT DATA (POST /export) ===
 * ============================================
 */
router.post('/export', async (req, res) => {
    console.log("\n--- [EXTERNAL] SERVER POST: Request to export grant data ---");

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No grant IDs provided for export." });
    }

    const connection = await pool.getConnection();
    console.log("SERVER EXPORT: Database connection acquired.");
    
    try {
        const allGrantsData = [];

        // Loop through each grant ID provided by the frontend
        for (const applicationId of ids) {
            console.log(`SERVER EXPORT: Fetching full data for Application ID: ${applicationId}`);
            
            // This is the "Comprehensive Object" that will hold all data for one grant
            const grantData = {
                coreInfo: {}, datesStatus: {}, fundingCollaborations: [],
                principalInvestigators: [], coInvestigators: [],
                amountsOverheads: {}, fundInstallments: [], budgetHeads: [],
                projectDeliverables: [], projectStaff: [], projectEquipments: [],
                filesOther: {}
            };

            // --- REUSE THE EXACT SAME LOGIC AS GET /:applicationId ---

            // 1. Fetch from 'projects' (Core Info)
            const [projectRows] = await connection.query('SELECT * FROM projects WHERE application_id = ?', [applicationId]);
            if (projectRows.length > 0) {
                grantData.coreInfo = projectRows[0];
            }

            // 2. Fetch from 'project_dates_status'
            const [datesStatusRows] = await connection.query('SELECT * FROM project_dates_status WHERE application_id = ?', [applicationId]);
            if (datesStatusRows.length > 0) {
                grantData.datesStatus = datesStatusRows[0];
            }

            // 3. Fetch from 'grant_info'
            const [grantInfoRows] = await connection.query('SELECT * FROM grant_info WHERE application_id = ?', [applicationId]);
            if (grantInfoRows.length > 0) {
                grantData.amountsOverheads = grantInfoRows[0];
            }
            
            // 4. Fetch from 'project_files'
            const [projectFilesRows] = await connection.query('SELECT * FROM project_files WHERE application_id = ?', [applicationId]);
            if (projectFilesRows.length > 0) {
                grantData.filesOther = projectFilesRows[0];
            }

            // 5. Fetch all 1-to-many relationships
            const [fundingCollabRows] = await connection.query('SELECT * FROM funding_collaboration WHERE application_id = ?', [applicationId]);
            grantData.fundingCollaborations = fundingCollabRows;

            const [piRows] = await connection.query('SELECT * FROM principal_investigators WHERE application_id = ?', [applicationId]);
            grantData.principalInvestigators = piRows;
            
            const [coPiRows] = await connection.query('SELECT * FROM co_investigators WHERE application_id = ?', [applicationId]);
            grantData.coInvestigators = coPiRows;

            const [fundsReceivedRows] = await connection.query('SELECT * FROM funds_received WHERE application_id = ?', [applicationId]);
            grantData.fundInstallments = fundsReceivedRows;

            const [budgetHeadRows] = await connection.query('SELECT * FROM budget_head WHERE application_id = ?', [applicationId]);
            grantData.budgetHeads = budgetHeadRows;

            const [deliverableRows] = await connection.query('SELECT * FROM project_deliverables WHERE application_id = ?', [applicationId]);
            grantData.projectDeliverables = deliverableRows;

            const [staffRows] = await connection.query('SELECT * FROM project_staff WHERE application_id = ?', [applicationId]);
            grantData.projectStaff = staffRows;

            const [equipRows] = await connection.query('SELECT * FROM project_equipments WHERE application_id = ?', [applicationId]);
            grantData.projectEquipments = equipRows;
            
            // Add the fully assembled object for this grant to our main array
            allGrantsData.push(grantData);
        }

        console.log(`SERVER EXPORT: Successfully fetched data for ${allGrantsData.length} grants.`);
        // Send the array of comprehensive grant objects back to the frontend
        res.status(200).json(allGrantsData);

    } catch (error) {
        console.error("[EXTERNAL] SERVER EXPORT: Error fetching data for export:", error);
        res.status(500).json({ message: "A server error occurred while fetching data for export.", error: error.message });
    } finally {
        if (connection) {
            connection.release();
            console.log("SERVER EXPORT: Database connection released.");
        }
    }
});


// === DELETE GRANT ===

router.delete('/:applicationId', async (req, res) => {
    const { applicationId } = req.params;
    console.log(`\n--- SERVER DELETE: START Deletion for Project ID (DB Key): ${applicationId} ---`);

    const connection = await pool.getConnection();
    console.log("SERVER DELETE: Database connection acquired.");
    try {
        await connection.beginTransaction();
        console.log("SERVER DELETE: Transaction started.");

        // --- Step 1: Identify all S3 keys to be deleted ---
        const s3KeysToDelete = new Set(); // Use a Set to avoid duplicate delete attempts

        // Define tables and their S3 key columns (can be an array if multiple file columns per table)
        const tablesAndTheirFileColumns = [
            { table: 'projects', fileColumns: ['project_agreement_files'] }, // Assuming this one wasn't renamed
            { table: 'project_dates_status', fileColumns: ['application_document_s3_key'] },
            { table: 'principal_investigators', fileColumns: ['pi_photograph_s3_key'] },
            { table: 'co_investigators', fileColumns: ['co_pi_photograph_s3_key'] },
            { table: 'grant_info', fileColumns: ['financial_documents_s3_key'] },
            { table: 'funds_received', fileColumns: ['fund_received_document_s3_key'] }, // Per installment
            { table: 'project_deliverables', fileColumns: ['deliverable_document_s3_key'] }, // Per deliverable
            { table: 'project_staff', fileColumns: ['staff_photograph_s3_key', 'staff_agreement_s3_key'] }, // Multiple files per staff
            { table: 'project_equipments', fileColumns: ['equipment_bills_s3_key'] },
            { table: 'project_files', fileColumns: ['project_image_s3_key', 'final_report_document_s3_key', 'overall_s7_doc_s3_key'] }
        ];

        // Corrected logic for the DELETE /:applicationId route
for (const { table, fileColumns } of tablesAndTheirFileColumns) {
    if (fileColumns && fileColumns.length > 0) {
        const selectColumns = fileColumns.join(', ');
        const [rows] = await connection.query(`SELECT ${selectColumns} FROM ${table} WHERE application_id = ?`, [applicationId]);
        
        for (const row of rows) {
            for (const col of fileColumns) {
                if (row[col]) {
                    try {
                        // FIX: Parse the JSON string into an array
                        const parsedKeys = JSON.parse(row[col]);
                        if (Array.isArray(parsedKeys)) {
                            // Add each key from the array to the set
                            parsedKeys.forEach(key => {
                                if (key) s3KeysToDelete.add(key);
                            });
                        }
                    } catch (e) {
                        // This might catch legacy data that wasn't a JSON array.
                        // You could log this error if needed.
                        console.warn(`Could not parse S3 key JSON from ${table}.${col} for ID ${applicationId}`);
                    }
                }
            }
        }
    }
}
        
        console.log(`SERVER DELETE: Identified ${s3KeysToDelete.size} S3 keys for potential deletion:`, Array.from(s3KeysToDelete));

        // --- Step 2: Delete records from database (child tables first, then parent) ---
        // Order is important due to foreign key constraints if ON DELETE CASCADE is not set for all.
        // If ON DELETE CASCADE IS set on all FKs pointing to projects.project_id, 
        // then deleting from 'projects' table would automatically delete related child records.
        // However, explicit deletion is safer and clearer.

        console.log("SERVER DELETE: Deleting from related tables...");
        await connection.query('DELETE FROM funding_collaboration WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM principal_investigators WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM co_investigators WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM funds_received WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM budget_head WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM project_deliverables WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM project_staff WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM project_equipments WHERE application_id = ?', [applicationId]);
        
        // Delete from 1:1 tables
        await connection.query('DELETE FROM project_dates_status WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM grant_info WHERE application_id = ?', [applicationId]);
        await connection.query('DELETE FROM project_files WHERE application_id = ?', [applicationId]);
        
        // Finally, delete from the main 'projects' table
        console.log("SERVER DELETE: Deleting from 'projects' table.");
        const [deleteResult] = await connection.query('DELETE FROM projects WHERE application_id = ?', [applicationId]);

        if (deleteResult.affectedRows === 0) {
            // This means the project didn't exist in the first place, or was already deleted.
            // S3 keys might have been collected based on related tables if they somehow existed without a parent.
            await connection.rollback();
            console.warn(`SERVER DELETE: Project ID ${applicationId} not found in 'projects' table for deletion. Rolling back.`);
            return res.status(404).json({ message: 'Grant not found for deletion.' });
        }
        console.log(`SERVER DELETE: Deleted ${deleteResult.affectedRows} row(s) from 'projects' table.`);

        // --- Step 3: If DB deletions were successful, delete files from S3 ---
        if (s3KeysToDelete.size > 0) {
            console.log(`SERVER DELETE: Proceeding to delete ${s3KeysToDelete.size} S3 objects.`);
            const s3DeletePromises = [];
            for (const s3Key of s3KeysToDelete) {
                console.log(`SERVER DELETE: Queuing S3 delete for key: ${s3Key}`);
                s3DeletePromises.push(deleteFromS3(s3Key));
            }
            await Promise.all(s3DeletePromises); // Wait for all S3 deletions
            console.log("SERVER DELETE: S3 object deletion process completed.");
        } else {
            console.log("SERVER DELETE: No S3 objects identified for deletion.");
        }

        await connection.commit();
        console.log("SERVER DELETE: Transaction committed successfully.");
        res.json({ message: `Grant ${applicationId} and associated data deleted successfully.` });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log("SERVER DELETE: Transaction rolled back due to error.");
        }
        console.error(`SERVER DELETE: Error deleting grant ${applicationId}:`, error);
        res.status(500).json({ message: 'Failed to delete grant', error: error.message });
    } finally {
        if (connection) {
            connection.release();
            console.log("SERVER DELETE: Database connection released.");
        }
        console.log(`--- SERVER DELETE: END Deletion for Project ID: ${applicationId} ---\n`);
    }
});




module.exports = router;