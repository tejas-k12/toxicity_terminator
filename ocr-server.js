// ocr-server.js - Complete server with OCR
import express from "express";
import cors from "cors";
import { ocrModerator } from "./ocr-moderator.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { spawn } from "child_process";
import AWS from "aws-sdk";
import { sendNotification } from "./notificationService.js";

// ✅ FIX — define __dirname at the top BEFORE use
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// CloudWatch setup
AWS.config.update({ region: "us-east-1" });
const cloudwatch = new AWS.CloudWatch();


function pushMetric(name, value) {
    console.log("📊 Pushing metric to CloudWatch:", name, value);
    cloudwatch.putMetricData({
        Namespace: "BadContentApp",
        MetricData: [
            {
                MetricName: name,
                Value: value,
                Unit: "Count"
            }
        ]
    }, (err) => {
        if (err) console.log("❌ CloudWatch Metric Error:", err);
        else console.log("✅ Metric sent:", name);
    });
}


// ✅ logDir now works because __dirname is defined ABOVE
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logFile = fs.createWriteStream(path.join(logDir, "ocr.log"), { flags: "a" });

function log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    process.stdout.write(entry);
    logFile.write(entry);
}

const app = express();

// CORS configuration - MORE PERMISSIVE FOR DEBUGGING
app.use(cors({
  origin: [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3000",   // ✅ added
    "http://127.0.0.1:3000"    // ✅ added
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));


// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
app.post("/like", async (req, res) => {
try {
const { sender, receiver, postId, type } = req.body || {};


// allow client-provided payload or fallback to defaults for testing
const data = {
type: type || "like",
sender: sender || "userA",
receiver: receiver || "userB",
postId: postId || 123
};


log(`📨 /like trigger received: ${JSON.stringify(data)}`);


try {
const lambdaResp = await sendNotification(data);
log(`✅ sendNotification returned`);
// If sendNotification returns a payload, try to log it
if (lambdaResp && lambdaResp.Payload) {
try {
const payloadStr = Buffer.from(lambdaResp.Payload).toString();
log(`📤 Lambda payload: ${payloadStr}`);
} catch (e) {
log(`⚠️ Failed to parse lambda payload: ${e.message}`);
}
}
} catch (lambdaErr) {
log(`❌ Error invoking sendNotification: ${lambdaErr.message || lambdaErr}`);
// Continue — we don't want notification failure to block like action
}


res.json({ ok: true, message: "Like processed; notification triggered (best-effort)" });
} catch (err) {
console.error("❌ /like handler error:", err);
res.status(500).json({ error: err.message });
}
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize OCR
console.log('🚀 Starting OCR Content Moderation Server...');

let ocrInitialized = false;

(async () => {
  try {
    await ocrModerator.initialize();
    ocrInitialized = true;
    console.log("✅ OCR Content Moderation System Ready!");
  } catch (error) {
    console.error("❌ OCR initialization failed:", error);
    ocrInitialized = false;
  }
})();

// Add error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Health check endpoint - SIMPLIFIED FOR TESTING
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "OCR Content Moderation Server is running",
    ocrReady: ocrInitialized,
    timestamp: new Date().toISOString()
  });
});

// Simple test endpoint - NO OCR DEPENDENCY
app.get("/api/test", (req, res) => {
  res.json({
    message: "OCR Content Moderation API is responding!",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to OCR Content Moderation API",
    description: "Extracts text from images and moderates content",
    status: "running",
    endpoints: {
      health: "/api/health",
      test: "/api/test",
      moderate: "/api/moderate/post"
    }
  });
});

// Main moderation endpoint - WITH BETTER ERROR HANDLING
app.post("/api/moderate/post", upload.single('image'), async (req, res) => {
  try {
    const ocrStart = Date.now();

    if (!ocrInitialized) {
      return res.status(503).json({ 
        error: "OCR system is still initializing. Please try again in a few seconds." 
      });
    }

    const { text } = req.body;
    const imageFile = req.file;
    
    console.log("📨 Received moderation request:");
    console.log("   Text:", text || "No text");
    console.log("   Image:", imageFile ? imageFile.originalname : "No image");
    
    let textResult = { isOffensive: false, label: 'no text', confidence: 0 };
    let imageResult = { isOffensive: false, label: 'no image', confidence: 0, extractedText: '' };

    // Moderate text if provided
    if (text && text.trim() !== "") {
      try {
        textResult = await ocrModerator.moderateText(text);
        console.log("📝 Text moderation result:", textResult);
      } catch (textError) {
        console.error("Text moderation error:", textError);
        textResult = { 
          isOffensive: false, 
          label: 'error', 
          confidence: 0,
          error: textError.message 
        };
      }
    }

    // Moderate image with OCR if provided
    if (imageFile) {
      try {
        imageResult = await ocrModerator.moderateImage(imageFile.path);
        console.log(`📝 Image text extraction: "${imageResult.extractedText}"`);
        console.log(`📊 Image moderation result:`, {
          isOffensive: imageResult.isOffensive,
          label: imageResult.label,
          hasMeaningfulText: imageResult.hasMeaningfulText
        });
      } catch (imageError) {
        console.error("Image moderation error:", imageError);
        imageResult = { 
          isOffensive: false, 
          label: 'error', 
          confidence: 0,
          extractedText: '',
          error: imageError.message 
        };
      }
    }

    // Combined result
    const isOffensive = textResult.isOffensive || imageResult.isOffensive;
    console.log("➡️ Reached BEFORE safe/unsafe metric push");

    if (isOffensive) {
    console.log("🚫 Post is OFFENSIVE → pushing UnsafePosts");
    pushMetric("UnsafePosts", 1);
} else {
    console.log("✅ Post is SAFE → pushing SafePosts");
    pushMetric("SafePosts", 1);
}
console.log("📌 Pushing TotalPosts");
pushMetric("TotalPosts", 1);

console.log("✅ Finished PUSHING metrics");


    if (imageFile) {
      const safeOrUnsafe = isOffensive ? "unsafe" : "safe";

      console.log("📤 Uploading image to S3:", safeOrUnsafe);

      const python = spawn("python", [
          "s3_uploader.py",
          imageFile.path,
          safeOrUnsafe
      ]);

      python.stdout.on("data", (data) => {
          console.log("✅ S3 Upload Result:", data.toString());
      });

      python.stderr.on("data", (data) => {
          console.error("❌ Python Error:", data.toString());
      });

      python.on("close", (code) => {
          console.log(`📁 Python script exited with code ${code} (ignored)`);

          // ✅ Optional: Delete uploaded file from local storage
          try {
              fs.unlinkSync(imageFile.path);
              console.log("🧹 Local file removed.");
          } catch (err) {
              console.error("⚠️ Failed to delete local file:", err);
          }
      });
    }

    const overallConfidence = Math.max(textResult.confidence, imageResult.confidence);
    
    let label = 'clean';
    if (textResult.isOffensive && imageResult.isOffensive) {
      label = 'offensive text in both post and image';
    } else if (textResult.isOffensive) {
      label = textResult.label;
    } else if (imageResult.isOffensive) {
      label = imageResult.label;
    }

    console.log("✅ Final moderation result:", { 
      isOffensive, 
      label, 
      confidence: overallConfidence,
      hasImageText: imageResult.extractedText ? imageResult.extractedText.length > 0 : false
    });

    // ✅ Push OCR processing time metric
    const ocrTime = Date.now() - ocrStart;
    pushMetric("OCRProcessingTimeMs", ocrTime);

    res.json({
      isOffensive,
      label,
      confidence: overallConfidence,
      type: 'ocr_combined',
      details: {
        text: textResult,
        image: imageResult
      }
    });
    
  } catch (error) {
    console.error("❌ OCR moderation error:", error);
    res.status(500).json({ 
      error: "OCR moderation failed: " + error.message,
      details: "Check server logs for more information"
    });
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down OCR server gracefully...');
  if (typeof ocrModerator.cleanup === 'function') {
    await ocrModerator.cleanup();
  }
  console.log('✅ Server shutdown complete');
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log("=".repeat(60));
  console.log(`🚀 OCR Server running on http://localhost:${PORT}`);
  console.log(`🌐 Also accessible via http://127.0.0.1:${PORT}`);
  console.log(`🔤 OCR Status: ${ocrInitialized ? 'READY' : 'INITIALIZING...'}`);
  console.log("=".repeat(60));
  console.log("📚 Available endpoints:");
  console.log("   GET  /              - Welcome page");
  console.log("   GET  /api/health    - Health check");
  console.log("   GET  /api/test      - Simple test");
  console.log("   POST /api/moderate/post - Moderate content");
  console.log("=".repeat(60));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});
