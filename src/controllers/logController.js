const { db, admin } = require("../config/firebase");

const getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const startAfter = req.query.startAfter;

    let query = db
      .collection("logs")
      .orderBy("created_at", "desc")
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(new Date(startAfter));
    }

    const snapshot = await query.get();
    const logs = [];

    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    const lastLog = logs[logs.length - 1];

    res.json({
      logs,
      nextStartAfter: lastLog?.created_at?.toDate() || null,
    });
  } catch (error) {
    console.error("Error getting logs:", error);
    res.status(500).json({ error: "Failed to retrieve logs" });
  }
};

const getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const logDoc = await db.collection("logs").doc(id).get();

    if (!logDoc.exists) {
      return res.status(404).json({ error: "Log not found" });
    }

    res.json({ id: logDoc.id, ...logDoc.data() });
  } catch (error) {
    console.error("Error getting log:", error);
    res.status(500).json({ error: "Failed to retrieve log" });
  }
};

const createLog = async (req, res) => {
  try {
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Log action is required" });
    }

    const newLog = {
      action: req.body.action,
      entity_type: req.body.entity_type || null,
      entity_id: req.body.entity_id || null,
      details: req.body.details || {},
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: req.user.uid,
      user: {
        first_name: req.user.first_name || null,
        last_name: req.user.last_name || null,
        email: req.user.email || null,
      },
    };

    const docRef = await db.collection("logs").add(newLog);
    const logDoc = await docRef.get();

    res.status(201).json({ id: logDoc.id, ...logDoc.data() });
  } catch (error) {
    console.error("Error creating log:", error);
    res.status(500).json({ error: "Failed to create log" });
  }
};

module.exports = {
  getLogs,
  getLogById,
  createLog,
};
