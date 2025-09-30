const express = require('express');
const router = express.Router();
const pool = require('../db');
const { upload, internalGrantUploadFields } = require('../multerConfig.js'); 
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');

// =============================================================================
// === HELPER FUNCTIONS (REUSABLE LOGIC)
// =============================================================================


// Reusable helper to process 1-to-many relationships during an update
async function processOneToManyRelationship(connection, applicationId, dataArray = [], allUploadedFiles, config) {
    const { tableName, insertQuery, fields, fileConfigs = [] } = config;
    console.log(`\nSERVER PUT [${tableName}]: Processing for Application ID ${applicationId}`);

    // Step 1: Get all old S3 keys from the DB for this table to identify orphans later.
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
                    } catch (e) { /* ignore non-json values */ }
                }
            });
        });
    }

    // Step 2: Clear all previous records from the database for this grant.
    await connection.query(`DELETE FROM ${tableName} WHERE application_id = ?`, [applicationId]);
    
    // Step 3: Re-insert the new/updated records from the form.
    const currentItemS3KeysInPayload = new Set();
    if (dataArray && dataArray.length > 0) {
        const newFilesQueue = {};
        fileConfigs.forEach(fc => {
            newFilesQueue[fc.multerFieldName] = (allUploadedFiles[fc.multerFieldName] || []).map(f => f.s3Key);
        });

        for (const itemFromFrontend of dataArray) {
            const valuesToInsert = fields.map(f => itemFromFrontend[f] === undefined ? null : itemFromFrontend[f]);
            
            fileConfigs.forEach(fc => {
                const existingFilesToKeep = itemFromFrontend[fc.dbColumn] || [];
                const newFileCount = itemFromFrontend[fc.countPropertyName] || 0;
                const newFilesForThisItem = newFilesQueue[fc.multerFieldName].splice(0, newFileCount);
                const finalFileArray = [...existingFilesToKeep, ...newFilesForThisItem];
const finalFileArrayJson = JSON.stringify(finalFileArray || []);
                valuesToInsert.push(finalFileArrayJson);
                finalFileArray.forEach(key => key && currentItemS3KeysInPayload.add(key));
            });
            
            await connection.query(insertQuery, [applicationId, ...valuesToInsert]);
        }
    }

    // Step 4: Clean up any orphaned S3 files for this section.
    oldS3KeysInDb.forEach(async (oldKey) => {
        if (!currentItemS3KeysInPayload.has(oldKey)) {
            console.log(`SERVER PUT [S3 Cleanup for ${tableName}]: Deleting orphaned file: ${oldKey}`);
            await deleteFromS3(oldKey);
        }
    });
}


const oneToManyTablesConfig = [
    { 
        tableName: 'principal_investigators', 
        dataArrayName: 'principalInvestigators', 
        insertQuery: `INSERT INTO principal_investigators (application_id, name_of_pi, pi_contact_details, pi_photograph_s3_key) VALUES (?, ?, ?, ?)`, 
        fields: ['name_of_pi', 'pi_contact_details'],
        fileConfigs: [{ dbColumn: 'pi_photograph_s3_key', multerFieldName: 'pi_uploader', countPropertyName: 'newFileCount' }]
    },
     // Section 4: Co-Investigators (Now configured to follow the same correct pattern)
    { 
        tableName: 'co_investigators', 
        dataArrayName: 'coInvestigators', 
        insertQuery: `INSERT INTO co_investigators (application_id, name_of_co_pi, co_pi_contact_details, co_pi_affiliating_institution, co_pi_photograph_s3_key) VALUES (?, ?, ?, ?, ?)`, 
        fields: ['name_of_co_pi', 'co_pi_contact_details', 'co_pi_affiliating_institution'],
        fileConfigs: [{ dbColumn: 'co_pi_photograph_s3_key', multerFieldName: 'copi_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 5: Human Resources
    {
        tableName: 'project_staff',
        dataArrayName: 'projectStaff',
        insertQuery: `INSERT INTO project_staff (application_id, staff_name, staff_role, staff_stipend_rate, staff_agreement_s3_key) VALUES (?, ?, ?, ?, ?)`,
        fields: ['staff_name', 'staff_role', 'staff_stipend_rate'],
        fileConfigs: [{ dbColumn: 'staff_agreement_s3_key', multerFieldName: 'hr_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 6: Field Work
    {
        tableName: 'internal_budget_fieldwork',
        dataArrayName: 'fieldworkBudget',
        insertQuery: `INSERT INTO internal_budget_fieldwork (application_id, type, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?)`,
        fields: ['type', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'fw_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 7: Travel
    {
        tableName: 'internal_budget_travel',
        dataArrayName: 'travelBudget',
        insertQuery: `INSERT INTO internal_budget_travel (application_id, travel_where, start_of_travel, end_of_travel, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        fields: ['travel_where', 'start_of_travel', 'end_of_travel', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'travel_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 8: Accommodation
    {
        tableName: 'internal_budget_accommodation',
        dataArrayName: 'accommodationBudget',
        insertQuery: `INSERT INTO internal_budget_accommodation (application_id, location, number_of_days, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`,
        fields: ['location', 'number_of_days', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'acc_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 9: Instruments/Resources
    {
        tableName: 'project_equipments',
        dataArrayName: 'instruments',
        insertQuery: `INSERT INTO project_equipments (application_id, name_of_equipment, equipment_bills_s3_key) VALUES (?, ?, ?)`,
        fields: ['name_of_equipment'],
        fileConfigs: [{ dbColumn: 'equipment_bills_s3_key', multerFieldName: 'inst_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 10: Stationery
    {
        tableName: 'internal_budget_stationery',
        dataArrayName: 'stationeryBudget',
        insertQuery: `INSERT INTO internal_budget_stationery (application_id, type, quantity, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?, ?)`,
        fields: ['type', 'quantity', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'stat_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 11: Dissemination
    {
        tableName: 'internal_budget_dissemination',
        dataArrayName: 'disseminationBudget',
        insertQuery: `INSERT INTO internal_budget_dissemination (application_id, type, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?)`,
        fields: ['type', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'diss_uploader', countPropertyName: 'newFileCount' }]
    },
    // Section 12: Miscellaneous
    {
        tableName: 'internal_budget_misc',
        dataArrayName: 'miscBudget',
        insertQuery: `INSERT INTO internal_budget_misc (application_id, type, amount_sanctioned, amount_utilised, document_s3_key) VALUES (?, ?, ?, ?, ?)`,
        fields: ['type', 'amount_sanctioned', 'amount_utilised'],
        fileConfigs: [{ dbColumn: 'document_s3_key', multerFieldName: 'misc_uploader', countPropertyName: 'newFileCount' }]
    }
];







console.log('--- MULTER CONFIGURATION CHECK ---');
console.log('The server is about to use this list for internal grants:');
console.dir(internalGrantUploadFields, { depth: null });



router.post('/', upload.fields(internalGrantUploadFields), async (req, res) => {
    console.log("\n--- [INTERNAL] SERVER POST: (NEW LOGIC) Create new grant ---");

    if (!req.body.grantDetails) {
        return res.status(400).json({ message: "grantDetails is missing." });
    }

    let grantDetails;
    try {
        grantDetails = JSON.parse(req.body.grantDetails);
    } catch (e) {
        return res.status(400).json({ message: "Invalid JSON in grantDetails." });
    }

    const filesUploadedByMulter = req.files || {};
    const mainApplicationId = grantDetails.coreInfo?.application_id;

    if (!mainApplicationId) {
        return res.status(400).json({ message: "Application Number is required." });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // Step 1: Upload all files to S3
        for (const fieldName in filesUploadedByMulter) {
            for (const fileObj of filesUploadedByMulter[fieldName]) {
                fileObj.s3Key = await uploadToS3(fileObj, mainApplicationId, fieldName);
            }
        }

        // Step 2: Insert into parent 'projects' table
        const core = grantDetails.coreInfo;
        await connection.query(
            `INSERT INTO projects (application_id, grant_category, project_title, department_name, internal_grant_number, project_term) VALUES (?, ?, ?, ?, ?, ?)`,
            [mainApplicationId, 'INTERNAL', core.project_title, core.department_name, core.internal_grant_number, core.project_term]
        );
        
        // Step 3: Insert into other 1-to-1 tables
        const ds = grantDetails.datesStatus || {};
        await connection.query(`INSERT INTO project_dates_status (application_id, proposal_call_month_year, project_secured_date, project_start_date, project_end_date, project_duration, application_status, project_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [mainApplicationId, ds.proposal_call_month_year, ds.project_secured_date, ds.project_start_date, ds.project_end_date, ds.project_duration, ds.application_status, ds.project_status]);
        
        const gi = grantDetails.grantInfo || {};
        await connection.query(`INSERT INTO grant_info (application_id, grant_sanctioned_amount) VALUES (?, ?)`,
            [mainApplicationId, gi.grant_sanctioned_amount]);



        for (const config of oneToManyTablesConfig) {
            const dataArrayForSection = grantDetails[config.dataArrayName];

            if (dataArrayForSection && dataArrayForSection.length > 0) {
                const allSectionFiles = (filesUploadedByMulter[config.fileConfigs[0].multerFieldName] || []).map(f => f.s3Key);
                let fileCursor = 0;

                for (const item of dataArrayForSection) {
                    const newFileCount = item.newFileCount || 0;
                    const filesForThisItem = allSectionFiles.slice(fileCursor, fileCursor + newFileCount);
                    fileCursor += newFileCount;
                    const itemFilesJson = JSON.stringify(filesForThisItem || []);

                    const valuesToInsert = config.fields.map(field => item[field] === undefined ? null : item[field]);
                    
                    await connection.query(config.insertQuery, [
                        mainApplicationId,
                        ...valuesToInsert,
                        itemFilesJson
                    ]);
                }
            }
        }
        await connection.commit();
        res.status(201).json({ message: 'Internal grant created successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("[INTERNAL] SERVER POST: Error saving grant:", error);
        
        for (const fieldName in filesUploadedByMulter) {
            for (const fileObj of filesUploadedByMulter[fieldName]) {
                if(fileObj.s3Key) await deleteFromS3(fileObj.s3Key);
            }
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Error: Application ID '${mainApplicationId}' already exists.` });
        }
        res.status(500).json({ message: 'A server error occurred.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * === GET ALL INTERNAL GRANTS (GET /) ===
 */
router.get('/', async (req, res) => {
    console.log("\n--- [INTERNAL] SERVER GET ALL: Request for all internal grants ---");
    try {
        const query = `
            SELECT 
                p.application_id,
                p.internal_grant_number,
                p.project_title,
                p.department_name,
                p.project_term, -- ADDED FOR TERM FILTER
                pds.project_status AS overallStatus,
                pds.application_status, -- ADDED FOR APPLICATION STATUS FILTER
                (SELECT GROUP_CONCAT(pi.name_of_pi SEPARATOR ', ') 
                 FROM principal_investigators pi 
                 WHERE pi.application_id = p.application_id) AS pi_names,
                (SELECT GROUP_CONCAT(copi.name_of_co_pi SEPARATOR ', ') 
                 FROM co_investigators copi 
                 WHERE copi.application_id = p.application_id) AS copi_names, -- ADDED FOR CO-PI FILTER
                gi.grant_sanctioned_amount,
                COALESCE(util.total_utilised, 0) AS totalUtilised,
                (COALESCE(gi.grant_sanctioned_amount, 0) - COALESCE(util.total_utilised, 0)) AS balance
            FROM 
                projects p
            LEFT JOIN project_dates_status pds ON p.application_id = pds.application_id
            LEFT JOIN grant_info gi ON p.application_id = gi.application_id
            LEFT JOIN (
                SELECT 
                    application_id, 
                    SUM(amount_utilised) AS total_utilised 
                FROM (
                    SELECT application_id, amount_utilised FROM internal_budget_travel WHERE amount_utilised IS NOT NULL
                    UNION ALL
                    SELECT application_id, amount_utilised FROM internal_budget_accommodation WHERE amount_utilised IS NOT NULL
                    UNION ALL
                    SELECT application_id, amount_utilised FROM internal_budget_fieldwork WHERE amount_utilised IS NOT NULL
                    UNION ALL
                    SELECT application_id, amount_utilised FROM internal_budget_stationery WHERE amount_utilised IS NOT NULL
                    UNION ALL
                    SELECT application_id, amount_utilised FROM internal_budget_dissemination WHERE amount_utilised IS NOT NULL
                    UNION ALL
                    SELECT application_id, amount_utilised FROM internal_budget_misc WHERE amount_utilised IS NOT NULL
                ) AS all_utilisations
                GROUP BY application_id
            ) AS util ON p.application_id = util.application_id
            WHERE 
                p.grant_category = 'INTERNAL'
            ORDER BY 
                p.application_id DESC;
        `;
        const [grants] = await pool.query(query);
        res.status(200).json(grants);

    } catch (error)
    {
        console.error("[INTERNAL] SERVER GET ALL: Error fetching internal grants:", error);
        res.status(500).json({ success: false, message: "Server error while fetching grants." });
    }
});


// In internalGrantRoutes.js

/**
 * ==================================================
 * === GET ONE INTERNAL GRANT (GET /:applicationId) ===
 * ==================================================
 */
router.get('/:applicationId', async (req, res) => {
    // const { applicationId } = req.params;

    const applicationId = req.params.applicationId.trim();

    console.log(`\n--- [INTERNAL] SERVER GET ONE: Request for grant ID: ${applicationId} ---`);

    const connection = await pool.getConnection();
    try {
        // Step 1: Fetch the main project record. If it doesn't exist, stop here.
        const [pRows] = await connection.query("SELECT * FROM projects WHERE application_id = ? AND grant_category = 'INTERNAL'", [applicationId]);
        if (pRows.length === 0) {
            return res.status(404).json({ message: "Internal grant not found." });
        }

        // Initialize the object that will hold all our data.
        const grantData = { projectInfo: pRows[0] };
        
        // Step 2: Fetch all related child data in parallel for efficiency.
        const [
            // One-to-one tables
            [dsRows], [giRows], [pfRows], 
            // One-to-many tables
            [piRows], [coPiRows], [staffRows], [equipRows], [deliverableRows],
            [travelRows], [accomRows], [fieldworkRows], [stationeryRows], [dissemRows], [miscRows],[assignedInventoryRows]
        ] = await Promise.all([
            // One-to-one queries
            connection.query("SELECT * FROM project_dates_status WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM grant_info WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM project_files WHERE application_id = ?", [applicationId]), // <-- ADDED THIS
            // One-to-many queries
            connection.query("SELECT * FROM principal_investigators WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM co_investigators WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM project_staff WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM project_equipments WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM project_deliverables WHERE application_id = ?", [applicationId]), // <-- ADDED THIS
            connection.query("SELECT * FROM internal_budget_travel WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM internal_budget_accommodation WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM internal_budget_fieldwork WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM internal_budget_stationery WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM internal_budget_dissemination WHERE application_id = ?", [applicationId]),
            connection.query("SELECT * FROM internal_budget_misc WHERE application_id = ?", [applicationId]),
            connection.query("SELECT id, asset_category, item, make, tag_no, status FROM inventory WHERE grant_application_id = ? AND grant_type = ?", [applicationId, 'INTERNAL'])


        ]);

        // Step 3: Assemble the final JSON object to send to the frontend.
        // Use `|| {}` or `|| []` as a fallback for cases where a grant has no related records.
        grantData.datesStatus = dsRows[0] || {};
        grantData.grantInfo = giRows[0] || {};
        grantData.projectFiles = pfRows[0] || {}; // <-- ADDED THIS
        grantData.principalInvestigators = piRows || [];
        grantData.coInvestigators = coPiRows || [];
        grantData.projectStaff = staffRows || [];
        grantData.instruments = equipRows || []; // Mapped from project_equipments
        grantData.projectDeliverables = deliverableRows || []; // <-- ADDED THIS
        grantData.travelBudget = travelRows || [];
        grantData.accommodationBudget = accomRows || [];
        grantData.fieldworkBudget = fieldworkRows || [];
        grantData.stationeryBudget = stationeryRows || [];
        grantData.disseminationBudget = dissemRows || [];
        grantData.miscBudget = miscRows || [];
        grantData.assignedInventory = assignedInventoryRows || [];

        // Send the complete data object.
        res.status(200).json(grantData);

    } catch (error) {
        console.error(`[INTERNAL] SERVER GET ONE: Error fetching grant ID ${applicationId}:`, error);
        res.status(500).json({ success: false, message: "Server error while fetching grant details." });
    } finally {
        if (connection) connection.release();
    }
});


router.put('/:applicationId', upload.fields(internalGrantUploadFields), async (req, res) => {
    const applicationId = req.params.applicationId;
    console.log(`\n--- [INTERNAL] SERVER PUT: (NEW LOGIC) Update grant ID: ${applicationId} ---`);

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
    await connection.beginTransaction();

    try {
        // Step 1: Upload all new files
        for (const fieldName in newlyUploadedFiles) {
            for (const fileObj of newlyUploadedFiles[fieldName]) {
                const s3Key = await uploadToS3(fileObj, applicationId, `${fieldName}_updated`);
                fileObj.s3Key = s3Key;
                if (s3Key) newlyUploadedS3KeysForRollback.push(s3Key);
            }
        }

        // Step 2: Update 1-to-1 (parent) tables
        const core = grantDetails.coreInfo;
        await connection.query(`UPDATE projects SET project_title=?, department_name=?, internal_grant_number=?, project_term=? WHERE application_id = ?`,
            [core.project_title, core.department_name, core.internal_grant_number, core.project_term, applicationId]);

        const ds = grantDetails.datesStatus || {};
        await connection.query(`INSERT INTO project_dates_status (application_id, proposal_call_month_year, project_secured_date, project_start_date, project_end_date, project_duration, application_status, project_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE proposal_call_month_year=VALUES(proposal_call_month_year), project_secured_date=VALUES(project_secured_date), project_start_date=VALUES(project_start_date), project_end_date=VALUES(project_end_date), project_duration=VALUES(project_duration), application_status=VALUES(application_status), project_status=VALUES(project_status)`,
            [applicationId, ds.proposal_call_month_year, ds.project_secured_date, ds.project_start_date, ds.project_end_date, ds.project_duration, ds.application_status, ds.project_status]);

        const gi = grantDetails.grantInfo || {};
        await connection.query(`INSERT INTO grant_info (application_id, grant_sanctioned_amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE grant_sanctioned_amount=VALUES(grant_sanctioned_amount)`,
            [applicationId, gi.grant_sanctioned_amount]);

        // Step 3: Process all 1-to-many relationships using our generic helper and config
        for (const config of oneToManyTablesConfig) {
            await processOneToManyRelationship(
                connection,
                applicationId,
                grantDetails[config.dataArrayName],
                newlyUploadedFiles,
                config
            );
        }
        // We will add processing for other sections here later.

        await connection.commit();
        res.status(200).json({ message: "Internal grant updated successfully." });

    } catch (error) {
        await connection.rollback();
        for (const s3key of newlyUploadedS3KeysForRollback) {
            await deleteFromS3(s3key);
        }
        console.error(`[INTERNAL] SERVER PUT: Error updating grant ID ${applicationId}:`, error);
        res.status(500).json({ message: "A server error occurred.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
});


/**
 * === DELETE AN INTERNAL GRANT (DELETE /:applicationId) ===
 */
router.delete('/:applicationId', async (req, res) => {
    // const { applicationId } = req.params;
        const applicationId = req.params.applicationId.trim();

    console.log(`\n--- [INTERNAL] SERVER DELETE: Request to delete grant ID: ${applicationId} ---`);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const s3KeysToDelete = new Set();
        const s3KeyQueries = [
            `SELECT pi_photograph_s3_key AS s3_key FROM principal_investigators WHERE application_id = ?`,
            `SELECT co_pi_photograph_s3_key AS s3_key FROM co_investigators WHERE application_id = ?`,
            `SELECT staff_agreement_s3_key AS s3_key FROM project_staff WHERE application_id = ?`,
            `SELECT document_s3_key FROM internal_budget_travel WHERE application_id = ?`,
        ];
        
        for(const query of s3KeyQueries){
            const [rows] = await connection.query(query, [applicationId]);
            rows.forEach(row => { if(row.s3_key) s3KeysToDelete.add(row.s3_key); });
        }

        const [deleteResult] = await connection.query("DELETE FROM projects WHERE application_id = ? AND grant_category = 'INTERNAL'", [applicationId]);
        if (deleteResult.affectedRows === 0) {
            throw new Error("Grant not found or it is not an internal grant.");
        }

        for (const key of s3KeysToDelete) {
            await deleteFromS3(key);
        }

        await connection.commit();
        res.status(200).json({ success: true, message: "Internal grant and files deleted successfully." });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`[INTERNAL] SERVER DELETE: Error deleting grant ID ${applicationId}:`, error);
        res.status(500).json({ success: false, message: error.message || "Server error while deleting grant." });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
