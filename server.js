import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI;
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// New activity schema
const activitySchema = new mongoose.Schema({
  site: { type: String, required: true },
  timeSpent: { type: Number, required: true },
  startTime: Date,
  endTime: Date,
  timestamp: { type: Date, default: Date.now }
});

// New user schema
const userUsageSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  activities: [activitySchema]
});

const UserUsage = mongoose.model("UserUsage", userUsageSchema);

// POST: Log usage (store in activities array)
app.post("/log-usage", async (req, res) => {
  try {
    const { username, site, timeSpent, startTime, endTime } = req.body;

    if (!username || !site || !timeSpent) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const activity = {
      site,
      timeSpent,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      timestamp: new Date()
    };

    // Add or update user with new activity
    const updated = await UserUsage.findOneAndUpdate(
      { username },
      { $push: { activities: activity } },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: "Usage logged", data: updated });
  } catch (error) {
    console.error("Error logging usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Fetch all usage per user
app.get("/usage", async (req, res) => {
  try {
    const { username } = req.query;
    const query = username ? { username } : {};

    const usageData = await UserUsage.find(query).sort({ username: 1 });
    res.json(usageData);
  } catch (error) {
    console.error("Error fetching usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Usage summary (total time per site per user per day)
app.get("/usage/summary", async (req, res) => {
  try {
    const { username } = req.query;

    const matchStage = username ? { username } : {};
    const pipeline = [
      { $match: matchStage },
      { $unwind: "$activities" },
      {
        $group: {
          _id: {
            username: "$username",
            site: "$activities.site",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$activities.timestamp" } }
          },
          totalTime: { $sum: "$activities.timeSpent" },
          visits: { $count: {} }
        }
      },
      { $sort: { "_id.date": -1, totalTime: -1 } }
    ];

    const summary = await UserUsage.aggregate(pipeline);
    res.json(summary);
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: List of users
app.get("/users", async (req, res) => {
  try {
    const users = await UserUsage.distinct("username");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
