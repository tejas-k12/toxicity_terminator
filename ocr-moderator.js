// ocr-moderator.js - Complete OCR moderation system
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

class OCRModerator {
  constructor() {
    this.worker = null;
    this.isWorkerReady = false;
  }

 async initialize() {
  try {
    console.log('🔤 Initializing Tesseract.js OCR...');

    this.worker = await createWorker('eng', 1); // Height of concurrency = 1

    this.isWorkerReady = true;
    console.log('✅ Tesseract.js OCR ready!');
  } catch (error) {
    console.error('❌ OCR initialization failed:', error);
    this.isWorkerReady = false;
  }
}


  async moderateImage(imagePathOrBuffer) {
    if (!this.isWorkerReady) {
      return {
        isOffensive: false,
        label: 'OCR not available',
        confidence: 0.1,
        extractedText: ''
      };
    }

    try {
      console.log(`🔍 Extracting text from image`);
      
      // Accept either a path or a buffer
      const processedImage = await this.preprocessImage(imagePathOrBuffer);

      // Recognize text
      const { data } = await this.worker.recognize(processedImage);
      const extractedText = (data && data.text) ? data.text.trim() : '';
      // tesseract confidence can be found in data.confidence in some versions - fallback to 0
      const ocrConfidence = typeof data.confidence === 'number' ? data.confidence : 0;

      console.log(`📝 Extracted text: "${extractedText}" (confidence: ${ocrConfidence})`);
      
      // Only moderate if we have meaningful text (high confidence)
      let textResult = { isOffensive: false, label: 'no meaningful text', confidence: 0 };
      
      if (ocrConfidence > 50 && this.isMeaningfulText(extractedText)) {
        console.log('✅ High confidence text found, moderating...');
        textResult = await this.moderateText(extractedText);
      } else {
        console.log('⚠️ Low confidence or meaningless text, skipping moderation');
      }
      
      // Combine with image metadata analysis if input was a path
      let imageAnalysis = { isOffensive: false, label: 'image metadata ok', confidence: 0.1, details: {} };
      if (typeof imagePathOrBuffer === 'string') {
        imageAnalysis = await this.analyzeImageMetadata(imagePathOrBuffer);
      }

      const isOffensive = (textResult && textResult.isOffensive) || (imageAnalysis && imageAnalysis.isOffensive);
      const overallConfidence = Math.max(textResult.confidence || 0, imageAnalysis.confidence || 0);

      let label = 'clean';
      if ((textResult && textResult.isOffensive) && (imageAnalysis && imageAnalysis.isOffensive)) {
        label = 'offensive text and suspicious image';
      } else if (textResult && textResult.isOffensive) {
        label = textResult.label;
      } else if (imageAnalysis && imageAnalysis.isOffensive) {
        label = imageAnalysis.label;
      }

      return {
        isOffensive,
        label,
        confidence: overallConfidence,
        extractedText,
        ocrConfidence,
        hasMeaningfulText: ocrConfidence > 50,
        details: {
          textModeration: textResult,
          imageAnalysis: imageAnalysis,
          hasText: extractedText.length > 0
        }
      };
      
    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      return this.getFallbackResult();
    }
  }

  async preprocessImage(imagePathOrBuffer) {
    // Accept either path or buffer
    let imageBuffer;
    if (typeof imagePathOrBuffer === 'string') {
      imageBuffer = fs.readFileSync(imagePathOrBuffer);
    } else if (Buffer.isBuffer(imagePathOrBuffer)) {
      imageBuffer = imagePathOrBuffer;
    } else {
      throw new Error('Unsupported image input - expected path or buffer');
    }
    
    // Preprocess image to improve OCR accuracy
    const processedBuffer = await sharp(imageBuffer)
      .grayscale()   // Convert to grayscale
      .normalize()   // Enhance contrast
      .sharpen()     // Sharpen edges
      .threshold(128) // Binarize
      .toFormat('png')
      .toBuffer();
    
    return processedBuffer;
  }

  // Check if text is meaningful (not random characters)
  isMeaningfulText(text) {
    if (!text || text.length < 3) return false;
    
    // Count words vs random characters
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const meaningfulWords = words.filter(word => {
      // A word is meaningful if it has mostly letters and reasonable length
      const lettersOnly = word.replace(/[^a-zA-Z]/g, '');
      const letterRatio = word.length > 0 ? (lettersOnly.length / word.length) : 0;
      return letterRatio > 0.6 && word.length >= 2 && word.length <= 30;
    });
    
    return meaningfulWords.length >= 1;
  }

  async analyzeImageMetadata(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(imageBuffer).metadata();
    const stats = fs.statSync(imagePath);
    const fileName = path.basename(imagePath).toLowerCase();
    
    const suspiciousNames = ['porn', 'adult', 'nsfw', 'explicit', 'nude'];
    const hasSuspiciousName = suspiciousNames.some(word => fileName.includes(word));
    const isVeryLarge = stats.size > 8 * 1024 * 1024;
    
    return {
      isOffensive: hasSuspiciousName,
      label: hasSuspiciousName ? 'suspicious file name' : 'image metadata ok',
      confidence: hasSuspiciousName ? 0.7 : 0.1,
      details: {
        fileName,
        fileSize: stats.size,
        dimensions: `${metadata.width || '?'}x${metadata.height || '?'}`,
        hasSuspiciousName,
        isVeryLarge
      }
    };
  }

  async moderateText(content) {
    if (!content || content.trim().length === 0) {
      return { isOffensive: false, label: 'no text', confidence: 0.0, originalText: content };
    }

    // Offensive patterns (tuned). Note: these are examples — adjust per policy & needs.
    const offensivePatterns = [
      { pattern: /\b(nigger|nigga|fag|faggot|chink|spic|kike)\b/i, weight: 1.0 },
      { pattern: /\b(fuck|shit|asshole|bitch|bastard|cunt|dick|pussy|cock)\b/i, weight: 0.9 },
      { pattern: /\b(retard|moron|idiot|stupid|dumbass|motherfucker)\b/i, weight: 0.8 },
      { pattern: /\b(kill|murder|die|death threat|suicide|kys|end yourself)\b/i, weight: 0.95 },
      { pattern: /\b(hate|despise|loathe)\b.*\b(you|people|gays|jews|blacks|whites|asians)\b/i, weight: 0.85 },
      { pattern: /\b(die|burn in hell|go to hell)\b/i, weight: 0.7 }
    ];

    const lowerContent = content.toLowerCase().trim();
    let maxConfidence = 0;
    let detectedLabel = 'clean';

    for (const { pattern, weight } of offensivePatterns) {
      if (pattern.test(lowerContent)) {
        if (weight > maxConfidence) {
          maxConfidence = weight;
          detectedLabel = `offensive text detected`;
        }
      }
    }

    return {
      isOffensive: maxConfidence > 0.6,
      label: detectedLabel,
      confidence: maxConfidence > 0 ? maxConfidence : 0.1,
      originalText: content
    };
  }

  getFallbackResult() {
    return {
      isOffensive: false,
      label: 'OCR analysis failed',
      confidence: 0.1,
      extractedText: '',
      details: { error: 'OCR unavailable' }
    };
  }

  async cleanup() {
    if (this.worker) {
      try {
        await this.worker.terminate();
        console.log('✅ OCR worker terminated');
      } catch (err) {
        console.warn('Error terminating OCR worker:', err);
      }
    }
  }
}

export const ocrModerator = new OCRModerator();
