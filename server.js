import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"] })); // Configurable CORS
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose
    .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Define Usage Schema
const UsageSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    site: { type: String, required: true },
    timeSpent: { type: Number, required: true },
    startTime: Date,
    endTime: Date,
    timestamp: { type: Date, default: Date.now }
});

const Usage = mongoose.model("Usage", UsageSchema);

// POST: Log Usage
app.post("/log-usage", async (req, res) => {
    try {
        const { username, site, timeSpent, startTime, endTime } = req.body;

        if (!username || !site || !timeSpent) {
            return res.status(400).json({ error: "Missing required fields: username, site, timeSpent" });
        }

        await Usage.create({
            username,
            site,
            timeSpent,
            startTime: startTime ? new Date(startTime) : undefined,
            endTime: endTime ? new Date(endTime) : undefined
        });

        res.status(201).json({ message: "Usage logged successfully" });
    } catch (error) {
        console.error("Error logging usage:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET: Fetch Usage Data with Filtering
app.get("/usage", async (req, res) => {
    try {
        const { username, startDate, endDate, site } = req.query;
        const query = {};

        if (username) query.username = username;
        if (site) query.site = site;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const usageData = await Usage.find(query).sort({ timestamp: -1 });
        res.json(usageData);
    } catch (error) {
        console.error("Error fetching usage data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET: Usage Summary Grouped by Username & Site
app.get("/usage/summary", async (req, res) => {
    try {
        const { username } = req.query;
        const pipeline = [];

        if (username) {
            pipeline.push({ $match: { username } });
        }

        pipeline.push({
            $group: {
                _id: {
                    username: "$username",
                    site: "$site",
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
                },
                totalTime: { $sum: "$timeSpent" },
                visits: { $count: {} }
            }
        });

        pipeline.push({ $sort: { "_id.date": -1, "totalTime": -1 } });

        const summary = await Usage.aggregate(pipeline);
        res.json(summary);
    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET: List of Users
app.get("/users", async (req, res) => {
    try {
        const users = await Usage.distinct("username");
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
