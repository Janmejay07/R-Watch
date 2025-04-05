import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB connection
const mongoURI = process.env.MONGO_URI;
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Utility: Get current IST string
function getISTTimeString(date = new Date()) {
  const istOffset = 330; // IST is UTC+5:30
  const istDate = new Date(date.getTime() + istOffset * 60000);
  return istDate.toISOString().replace("T", " ").slice(0, 23);
}

// Define Schema
const ActivitySchema = new mongoose.Schema({
  site: { type: String, required: true },
  timeSpent: { type: Number, required: true },
  startTime: String,
  endTime: String,
  timestamp: { type: String, default: () => getISTTimeString() }
});

const UserUsageSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  activities: [ActivitySchema]
});

const UserUsage = mongoose.model("UserUsage", UserUsageSchema);

// POST: Log Usage
app.post("/log-usage", async (req, res) => {
  try {
    const { username, site, timeSpent, startTime, endTime } = req.body;

    if (!username || !site || !timeSpent) {
      return res.status(400).json({ error: "Missing required fields: username, site, timeSpent" });
    }

    const activity = {
      site,
      timeSpent,
      startTime,
      endTime,
      timestamp: getISTTimeString()
    };

    const updatedUser = await UserUsage.findOneAndUpdate(
      { username },
      { $push: { activities: activity } },
      { new: true, upsert: true }
    );

    res.status(201).json({ message: "Activity logged", user: updatedUser });
  } catch (error) {
    console.error("Error logging usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: All usage data
app.get("/usage", async (req, res) => {
  try {
    const { username } = req.query;
    const query = username ? { username } : {};
    const users = await UserUsage.find(query);
    res.json(users);
  } catch (error) {
    console.error("Error fetching usage data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Summary
app.get("/usage/summary", async (req, res) => {
  try {
    const { username } = req.query;

    const matchStage = username ? { $match: { username } } : {};
    const pipeline = [
      matchStage,
      { $unwind: "$activities" },
      {
        $group: {
          _id: {
            username: "$username",
            site: "$activities.site"
          },
          totalTime: { $sum: "$activities.timeSpent" },
          visits: { $sum: 1 }
        }
      },
      { $sort: { totalTime: -1 } }
    ];

    const summary = await UserUsage.aggregate(pipeline);
    res.json(summary);
  } catch (error) {
    console.error("Error summarizing usage:", error);
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

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
