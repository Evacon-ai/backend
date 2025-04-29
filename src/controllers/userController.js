const { db, admin } = require("../config/firebase");
const password = require("secure-random-password");
const axios = require("axios");
const { FIREBASE_WEB_API_KEY } = require("../config/constants");

const getCurrentUser = async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    console.error("Error getting current user:", error);
    res.status(500).json({ error: "Failed to retrieve user profile" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const users = [];
    usersSnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Failed to retrieve users" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await db.collection("users").doc(id).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Failed to retrieve user" });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      created_by,
      first_name,
      last_name,
      email,
      level,
      role,
      organization_id,
    } = req.body;

    if (!first_name || !last_name || !email) {
      return res
        .status(400)
        .json({ error: "Firebase ID, name and email are required" });
    }

    // create Firebase user

    try {
      const generatedPassword = password.randomPassword({
        length: 12,
        characters: [
          password.lower,
          password.upper,
          password.digits,
          password.symbols,
        ],
      });
      const userRecord = await admin.auth().createUser({
        email: email,
        password: generatedPassword,
      });
      console.log("Successfully created new user:", userRecord.uid);

      // create Firestore user

      const newUser = {
        first_name,
        last_name,
        email,
        level: level || "customer",
        role: role || "user",
        organization_id,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: created_by,
      };

      const userRef = db.collection("users").doc(userRecord.uid);
      const doc = await userRef.get();
      if (doc.exists) {
        return res.status(400).json({ error: "User already exists" });
      }
      await userRef.set(newUser);
      const userDoc = await userRef.get();

      // Send password reset email using Firebase API
      const response = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
        {
          requestType: "PASSWORD_RESET",
          email: email,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      res.status(201).json({
        message:
          "User created successfully. Password reset email has been sent.",
        user: { id: userDoc.id, ...userDoc.data() },
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, role, organization_id } = req.body;

    const userDoc = await db.collection("users").doc(id).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {
      ...(first_name && { first_name }),
      ...(last_name && { last_name }),
      ...(email && { email }),
      ...(role && { role }),
      ...(organization_id && { organization_id }),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_by: req.user.uid,
    };

    await db.collection("users").doc(id).update(updates);

    const updatedDoc = await db.collection("users").doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userDoc = await db.collection("users").doc(id).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete from Firebase Authentication first
    await admin.auth().deleteUser(id);

    // Then delete from Firestore
    await db.collection("users").doc(id).delete();

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

module.exports = {
  getCurrentUser,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
