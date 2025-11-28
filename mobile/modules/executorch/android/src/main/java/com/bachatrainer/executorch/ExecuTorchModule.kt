package com.bachatrainer.executorch

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File
import java.nio.FloatBuffer
import kotlin.math.roundToInt

/**
 * ExecuTorch Native Module for Android
 * Provides React Native bridge for PyTorch ExecuTorch pose detection
 */
class ExecuTorchModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ExecuTorchModule"
        private const val MODEL_INPUT_SIZE = 192
        private const val NUM_KEYPOINTS = 17
    }

    // Module state
    // private var module: Module? = null  // Will be initialized when ExecuTorch is added
    private var modelLoaded = false
    private var currentDelegate = "none"
    private val inferenceTimes = mutableListOf<Double>()
    private var totalInferences = 0

    override fun getName() = "ExecuTorchModule"

    /**
     * Load ExecuTorch model from file path
     */
    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        try {
            // Validate model file exists
            val modelFile = File(modelPath)
            if (!modelFile.exists()) {
                promise.reject("MODEL_NOT_FOUND", "Model file not found at path: $modelPath")
                return
            }

            Log.i(TAG, "Loading ExecuTorch model from: $modelPath")

            // TODO: Load ExecuTorch model
            // This will be implemented once ExecuTorch library is added
            // module = Module.load(modelPath)

            // For now, simulate successful load
            modelLoaded = true

            Log.i(TAG, "Model loaded successfully")
            promise.resolve(true)

        } catch (e: Exception) {
            modelLoaded = false
            Log.e(TAG, "Failed to load model", e)
            promise.reject("LOAD_ERROR", "Failed to load model: ${e.message}", e)
        }
    }

    /**
     * Set hardware acceleration delegate
     */
    @ReactMethod
    fun setDelegate(delegate: String, promise: Promise) {
        if (!modelLoaded) {
            promise.reject("MODEL_NOT_LOADED", "Model must be loaded before setting delegate")
            return
        }

        try {
            Log.i(TAG, "Setting delegate: $delegate")

            // Validate delegate
            if (delegate != "xnnpack" && delegate != "none") {
                promise.reject(
                    "INVALID_DELEGATE",
                    "Invalid delegate for Android. Use 'xnnpack' or 'none'"
                )
                return
            }

            // TODO: Configure ExecuTorch delegate
            // This will be implemented once ExecuTorch library is added

            currentDelegate = delegate

            Log.i(TAG, "Delegate set to: $delegate")
            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to set delegate", e)
            promise.reject("DELEGATE_ERROR", "Failed to set delegate: ${e.message}", e)
        }
    }

    /**
     * Run pose detection inference
     */
    @ReactMethod
    fun runInference(imageData: ReadableMap, promise: Promise) {
        if (!modelLoaded) {
            promise.reject("MODEL_NOT_LOADED", "Model must be loaded before running inference")
            return
        }

        try {
            val startTime = System.currentTimeMillis()

            // Extract image data
            val width = imageData.getInt("width")
            val height = imageData.getInt("height")
            val data = imageData.getString("data")

            if (data == null) {
                promise.reject("INVALID_INPUT", "Missing image data")
                return
            }

            // Decode image
            val bitmap = decodeImage(data)
            if (bitmap == null) {
                promise.reject("IMAGE_DECODE_ERROR", "Failed to decode image")
                return
            }

            // Resize to model input size
            val resizedBitmap = Bitmap.createScaledBitmap(
                bitmap,
                MODEL_INPUT_SIZE,
                MODEL_INPUT_SIZE,
                true
            )

            // Convert to tensor
            val tensorData = bitmapToTensor(resizedBitmap)

            // TODO: Run ExecuTorch inference
            // This will be implemented once ExecuTorch library is added
            // val outputs = module?.forward(tensorData)

            // For now, return mock keypoints
            val keypoints = generateMockKeypoints()

            val endTime = System.currentTimeMillis()
            val inferenceTime = (endTime - startTime).toDouble()

            // Track metrics
            inferenceTimes.add(inferenceTime)
            totalInferences++

            // Keep only last 100 inference times
            if (inferenceTimes.size > 100) {
                inferenceTimes.removeAt(0)
            }

            // Build result
            val result = Arguments.createMap().apply {
                putArray("keypoints", keypoints)
                putDouble("inferenceTime", inferenceTime)
            }

            promise.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "Inference failed", e)
            promise.reject("INFERENCE_ERROR", "Inference failed: ${e.message}", e)
        }
    }

    /**
     * Get performance metrics
     */
    @ReactMethod
    fun getPerformanceMetrics(promise: Promise) {
        try {
            if (inferenceTimes.isEmpty()) {
                val emptyMetrics = Arguments.createMap().apply {
                    putDouble("averageFPS", 0.0)
                    putDouble("averageLatency", 0.0)
                    putDouble("p50Latency", 0.0)
                    putDouble("p95Latency", 0.0)
                    putDouble("p99Latency", 0.0)
                    putInt("totalInferences", 0)
                }
                promise.resolve(emptyMetrics)
                return
            }

            // Calculate average latency
            val avgLatency = inferenceTimes.average()
            val avgFPS = 1000.0 / avgLatency

            // Calculate percentiles
            val sortedTimes = inferenceTimes.sorted()
            val p50Index = (sortedTimes.size * 0.5).roundToInt()
            val p95Index = (sortedTimes.size * 0.95).roundToInt()
            val p99Index = (sortedTimes.size * 0.99).roundToInt()

            val metrics = Arguments.createMap().apply {
                putDouble("averageFPS", avgFPS)
                putDouble("averageLatency", avgLatency)
                putDouble("p50Latency", sortedTimes[p50Index])
                putDouble("p95Latency", sortedTimes[p95Index])
                putDouble("p99Latency", sortedTimes[p99Index])
                putInt("totalInferences", totalInferences)
            }

            promise.resolve(metrics)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to get metrics", e)
            promise.reject("METRICS_ERROR", "Failed to get metrics: ${e.message}", e)
        }
    }

    /**
     * Reset performance metrics
     */
    @ReactMethod
    fun resetMetrics(promise: Promise) {
        inferenceTimes.clear()
        totalInferences = 0
        promise.resolve(true)
    }

    /**
     * Unload model and free resources
     */
    @ReactMethod
    fun unloadModel(promise: Promise) {
        try {
            // TODO: Unload ExecuTorch model
            // module = null

            modelLoaded = false
            currentDelegate = "none"
            inferenceTimes.clear()
            totalInferences = 0

            Log.i(TAG, "Model unloaded")
            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to unload model", e)
            promise.reject("UNLOAD_ERROR", "Failed to unload model: ${e.message}", e)
        }
    }

    // Helper methods

    private fun decodeImage(data: String): Bitmap? {
        return try {
            when {
                // Handle base64 encoded image
                data.startsWith("data:image") -> {
                    val base64Data = data.substringAfter("base64,")
                    val imageBytes = Base64.decode(base64Data, Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                }
                // Handle file URI
                data.startsWith("file://") -> {
                    val path = data.substring(7)
                    BitmapFactory.decodeFile(path)
                }
                // Handle content URI
                data.startsWith("content://") -> {
                    val inputStream = reactApplicationContext.contentResolver.openInputStream(
                        android.net.Uri.parse(data)
                    )
                    BitmapFactory.decodeStream(inputStream)
                }
                else -> null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decode image", e)
            null
        }
    }

    private fun bitmapToTensor(bitmap: Bitmap): FloatArray {
        // Convert bitmap to normalized float array [0, 1]
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val tensorData = FloatArray(width * height * 3)
        var index = 0

        for (pixel in pixels) {
            // Extract RGB values and normalize to [0, 1]
            tensorData[index++] = ((pixel shr 16) and 0xFF) / 255.0f  // R
            tensorData[index++] = ((pixel shr 8) and 0xFF) / 255.0f   // G
            tensorData[index++] = (pixel and 0xFF) / 255.0f           // B
        }

        return tensorData
    }

    private fun generateMockKeypoints(): WritableArray {
        // Generate 17 mock keypoints for testing
        val keypoints = Arguments.createArray()

        repeat(NUM_KEYPOINTS) {
            val keypoint = Arguments.createMap().apply {
                putDouble("x", 0.5 + (Math.random() - 0.5) * 0.2)
                putDouble("y", 0.5 + (Math.random() - 0.5) * 0.2)
                putDouble("confidence", 0.8 + Math.random() * 0.2)
            }
            keypoints.pushMap(keypoint)
        }

        return keypoints
    }
}
