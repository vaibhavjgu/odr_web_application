// In routes/inventoryRoutes.js

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { upload, inventoryUploadFields } = require('../multerConfig'); 
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');

// HELPER FUNCTION: Converts empty strings to NULL for database compatibility
const toNullIfEmpty = (value) => {
    return value === '' || value === null || value === undefined ? null : value;
};


// =======================================================
// ===               INVENTORY ROUTES                  ===
// =======================================================
// Note: Route order matters. Specific routes must come before parameterized routes.

// GET ALL INVENTORY ITEMS
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM inventory ORDER BY id DESC");
        res.json(rows);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ message: "Failed to fetch inventory", error: error.message });
    }
});

// GET AVAILABLE INVENTORY ITEMS (FOR DROPDROPS)
// This must be defined BEFORE '/:id'
router.get('/available', async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, asset_category, item, make, tag_no FROM inventory WHERE status = 'In Stock' ORDER BY asset_category, item"
        );
        res.json(rows);
    } catch (error) {
        console.error("Error fetching available inventory:", error);
        res.status(500).json({ message: "Failed to fetch available inventory", error: error.message });
    }
});

// GET ONE INVENTORY ITEM (WITH HISTORY)
router.get('/:id', async (req, res) => {
    const { id: inventoryId } = req.params;
    try {
        const [assetRows] = await pool.query("SELECT * FROM inventory WHERE id = ?", [inventoryId]);
        if (assetRows.length === 0) {
            return res.status(404).json({ message: "Asset not found." });
        }
        const assetDetails = assetRows[0];

        const [historyRows] = await pool.query(
            `SELECT h.*, pi.name_of_pi FROM inventory_assignment_history h
             LEFT JOIN principal_investigators pi ON h.assigned_to_pi_id = pi.id
             WHERE h.inventory_id = ? ORDER BY h.assigned_date DESC`,
            [inventoryId]
        );

        res.json({ ...assetDetails, assignmentHistory: historyRows });
    } catch (error) {
        console.error(`Error fetching details for asset ${inventoryId}:`, error);
        res.status(500).json({ message: "Failed to fetch asset details", error: error.message });
    }
});

// CREATE NEW INVENTORY ITEM
router.post('/', upload.fields(inventoryUploadFields), async (req, res) => {
    const connection = await pool.getConnection();
    let s3Key = null;
    try {
        await connection.beginTransaction();
        const data = req.body;
        const file = (req.files && req.files['document_uploads']) ? req.files['document_uploads'][0] : null;
        
        if (file) {
            s3Key = await uploadToS3(file, `inventory-${data.tag_no || Date.now()}`);
        }
        
        const postData = {
            ...data,
            po_date: toNullIfEmpty(data.po_date), assigned_date: toNullIfEmpty(data.assigned_date),
            warranty_expiry_date: toNullIfEmpty(data.warranty_expiry_date), maintenance_due_date: toNullIfEmpty(data.maintenance_due_date),
            license_expiry_date: toNullIfEmpty(data.license_expiry_date), date_of_return: toNullIfEmpty(data.date_of_return),
            scrap_date: toNullIfEmpty(data.scrap_date), document_uploads: s3Key
        };

        const [result] = await connection.query(`INSERT INTO inventory SET ?`, postData);
        await connection.commit();
        res.status(201).json({ message: 'Asset created successfully', id: result.insertId });

    } catch (error) {
        await connection.rollback();
        if (s3Key) await deleteFromS3(s3Key); // Clean up S3 if DB insert fails
        console.error("Error creating asset:", error);
        res.status(500).json({ message: 'Failed to create asset', error: error.message });
    } finally {
        connection.release();
    }
});

// ASSIGN INVENTORY ITEM TO A GRANT & PI
// This must be defined BEFORE '/:id'
router.put('/assign/:id', async (req, res) => {
    const { id: inventoryId } = req.params;
    const { grant_application_id, grant_type, pi_id, assigned_to, project_name, assigned_date } = req.body;

    if (!grant_application_id || !grant_type || !pi_id) {
        return res.status(400).json({ message: "Grant ID, Grant Type, and a specific PI ID are required." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [updateResult] = await connection.query(
            `UPDATE inventory SET status = 'Assigned', grant_application_id = ?, grant_type = ?, current_pi_id = ?, assigned_to = ?, project_name = ?, assigned_date = ?
             WHERE id = ? AND status = 'In Stock'`, 
            [grant_application_id, grant_type, pi_id, assigned_to, project_name, assigned_date, inventoryId]
        );

        if (updateResult.affectedRows === 0) throw new Error("Asset not found or is not available for assignment.");

        await connection.query(
            `INSERT INTO inventory_assignment_history (inventory_id, grant_application_id, grant_type, assigned_to_pi_id, assigned_date) 
             VALUES (?, ?, ?, ?, ?)`,
            [inventoryId, grant_application_id, grant_type, pi_id, assigned_date]
        );

        await connection.commit();
        res.json({ message: `Asset ${inventoryId} successfully assigned to grant ${grant_application_id}.` });

    } catch (error) {
        await connection.rollback();
        console.error(`Error assigning asset ${inventoryId}:`, error);
        const statusCode = error.message.includes("not found") ? 404 : 500;
        res.status(statusCode).json({ message: `Failed to assign asset ${inventoryId}`, error: error.message });
    } finally {
        connection.release();
    }
});

// UNASSIGN INVENTORY ITEM (RETURN TO STOCK)
// This must be defined BEFORE '/:id'
router.put('/unassign/:id', async (req, res) => {
    const { id: inventoryId } = req.params;
    const { remarks } = req.body; // Optional remarks for the return
    const returnDate = new Date();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [updateResult] = await connection.query(
            `UPDATE inventory SET status = 'In Stock', grant_application_id = NULL, grant_type = NULL, current_pi_id = NULL,
             assigned_to = NULL, project_name = NULL, assigned_date = NULL, date_of_return = ? WHERE id = ? AND status = 'Assigned'`,
            [returnDate, inventoryId]
        );
        
        if (updateResult.affectedRows === 0) throw new Error("Asset not found or was not in an 'Assigned' state.");

        // Update the history record with the return date and any remarks
        await connection.query(
            `UPDATE inventory_assignment_history SET returned_date = ?, remarks = ? WHERE inventory_id = ? AND returned_date IS NULL 
             ORDER BY assigned_date DESC LIMIT 1`,
            [returnDate, toNullIfEmpty(remarks), inventoryId]
        );

        await connection.commit();
        res.json({ message: `Asset ${inventoryId} successfully unassigned and returned to stock.` });
    } catch (error) {
        await connection.rollback();
        console.error(`Error unassigning asset ${inventoryId}:`, error);
        const statusCode = error.message.includes("not found") ? 404 : 500;
        res.status(statusCode).json({ message: `Failed to unassign asset ${inventoryId}`, error: error.message });
    } finally {
        connection.release();
    }
});

// UPDATE A GENERAL INVENTORY ITEM's DETAILS
router.put('/:id', upload.fields(inventoryUploadFields), async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    let newS3Key = null;

    try {
        await connection.beginTransaction();
        const data = req.body;
        const file = (req.files && req.files['document_uploads']) ? req.files['document_uploads'][0] : null;

        const [rows] = await connection.query("SELECT document_uploads FROM inventory WHERE id = ?", [id]);
        if (rows.length === 0) throw new Error("Asset not found.");
        const oldS3Key = rows[0].document_uploads;

        // If a new file is uploaded, replace the old one
        if (file) {
            newS3Key = await uploadToS3(file, `inventory-${data.tag_no || id}`);
            data.document_uploads = newS3Key;
            if (oldS3Key) await deleteFromS3(oldS3Key);
        }

        const updateData = {
            ...data,
            po_date: toNullIfEmpty(data.po_date), assigned_date: toNullIfEmpty(data.assigned_date),
            warranty_expiry_date: toNullIfEmpty(data.warranty_expiry_date), maintenance_due_date: toNullIfEmpty(data.maintenance_due_date),
            license_expiry_date: toNullIfEmpty(data.license_expiry_date), date_of_return: toNullIfEmpty(data.date_of_return),
            scrap_date: toNullIfEmpty(data.scrap_date)
        };
        
        await connection.query("UPDATE inventory SET ? WHERE id = ?", [updateData, id]);
        await connection.commit();
        res.json({ message: `Asset ${id} updated successfully.` });

    } catch (error) {
        await connection.rollback();
        if (newS3Key) await deleteFromS3(newS3Key); // Clean up new S3 file if DB update fails
        console.error(`Error updating asset ${id}:`, error);
        res.status(500).json({ message: `Failed to update asset ${id}`, error: error.message });
    } finally {
        connection.release();
    }
});

// DELETE INVENTORY ITEM
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query("SELECT document_uploads FROM inventory WHERE id = ?", [id]);
        if (rows.length === 0) throw new Error("Asset not found.");
        const s3Key = rows[0].document_uploads;

        await connection.query("DELETE FROM inventory WHERE id = ?", [id]);
        
        // After DB delete is successful, remove the file from S3
        if (s3Key) await deleteFromS3(s3Key);
        
        await connection.commit();
        res.json({ message: `Asset ${id} and associated files deleted successfully.` });
    } catch (error) {
        await connection.rollback();
        console.error(`Error deleting asset ${id}:`, error);
        res.status(500).json({ message: `Failed to delete asset ${id}`, error: error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;