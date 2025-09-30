// routes/sopsAndTemplatesRoute.js

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { upload } = require('../multerConfig');
const { uploadToS3, deleteFromS3 } = require('../services/s3Service');

// === GET ALL DOCUMENTS === (No changes)
router.get('/', async (req, res) => {
    console.log("--- [SOP] SERVER GET ALL: Request for all documents ---");
    try {
        const query = `
            SELECT id, display_name, file_category, version, uploaded_at, s3_key, original_filename, description 
            FROM sops_and_templates 
            ORDER BY uploaded_at DESC
        `;
        const [documents] = await pool.query(query);
        res.status(200).json(documents);
    } catch (error) {
        console.error("[SOP] SERVER GET ALL: Error fetching documents:", error);
        res.status(500).json({ message: "Server error while fetching documents." });
    }
});

// === UPLOAD A NEW DOCUMENT === (No changes)
router.post('/', upload.single('fileUpload'), async (req, res) => {
    console.log("--- [SOP] SERVER POST: Request to create new document ---");
    const { fileName, category, version, description } = req.body;
    const file = req.file;

    if (!fileName || !category || !file) {
        return res.status(400).json({ message: "File Name, Category, and a file are required." });
    }

    const connection = await pool.getConnection();
    let s3Key = null;
    try {
        await connection.beginTransaction();
        s3Key = await uploadToS3(file, 'sops-and-templates');
        const insertQuery = `
            INSERT INTO sops_and_templates 
            (display_name, file_category, version, description, original_filename, s3_key, mime_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(insertQuery, [fileName, category, version || null, description || null, file.originalname, s3Key, file.mimetype]);
        await connection.commit();
        res.status(201).json({ message: 'Document uploaded successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error("[SOP] SERVER POST: Error saving document:", error);
        if (s3Key) {
            console.log(`[SOP] Rolling back S3 upload for key: ${s3Key}`);
            await deleteFromS3(s3Key);
        }
        res.status(500).json({ message: 'A server error occurred during upload.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// === [NEW] UPDATE A DOCUMENT ===
// Handles updates for a document's metadata and optionally replaces its file.
router.put('/:id', upload.single('fileUpload'), async (req, res) => {
    const { id } = req.params;
    const { fileName, category, version, description } = req.body;
    const newFile = req.file;
    console.log(`--- [SOP] SERVER PUT: Request to update document ID: ${id} ---`);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        let newS3Key = null;
        let oldS3Key = null;

        // If a new file is uploaded, we need to handle S3 operations
        if (newFile) {
            // 1. Find the old S3 key to delete it later
            const [rows] = await connection.query("SELECT s3_key FROM sops_and_templates WHERE id = ?", [id]);
            if (rows.length === 0) throw new Error("Document not found to update.");
            oldS3Key = rows[0].s3_key;

            // 2. Upload the new file to S3
            newS3Key = await uploadToS3(newFile, 'sops-and-templates');
        }

        // 3. Construct the dynamic SQL UPDATE statement
        const updateFields = {
            display_name: fileName,
            file_category: category,
            version: version || null,
            description: description || null,
        };
        if (newFile) {
            updateFields.original_filename = newFile.originalname;
            updateFields.s3_key = newS3Key;
            updateFields.mime_type = newFile.mimetype;
        }

        const queryParts = Object.keys(updateFields).map(key => `${key} = ?`);
        const queryValues = Object.values(updateFields);

        const updateQuery = `UPDATE sops_and_templates SET ${queryParts.join(', ')} WHERE id = ?`;
        await connection.query(updateQuery, [...queryValues, id]);

        // 4. If a new file was uploaded and DB update was successful, delete the old file
        if (newFile && oldS3Key) {
            await deleteFromS3(oldS3Key);
        }

        // 5. Commit the transaction
        await connection.commit();
        res.status(200).json({ message: 'Document updated successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error(`[SOP] SERVER PUT: Error updating document ID ${id}:`, error);
        
        // If a new file was uploaded before an error, clean it up
        if (newS3Key) {
            console.log(`[SOP] Rolling back S3 upload for key: ${newS3Key}`);
            await deleteFromS3(newS3Key);
        }

        res.status(500).json({ message: 'Server error while updating document.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});


// === DELETE A DOCUMENT === (No changes)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`--- [SOP] SERVER DELETE: Request to delete document ID: ${id} ---`);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query("SELECT s3_key FROM sops_and_templates WHERE id = ?", [id]);
        if (rows.length === 0) throw new Error("Document not found.");
        const s3Key = rows[0].s3_key;
        await deleteFromS3(s3Key);
        await connection.query("DELETE FROM sops_and_templates WHERE id = ?", [id]);
        await connection.commit();
        res.status(200).json({ message: "Document deleted successfully." });
    } catch (error) {
        await connection.rollback();
        console.error(`[SOP] SERVER DELETE: Error deleting document ID ${id}:`, error);
        res.status(500).json({ message: error.message || "Server error while deleting document." });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;