package com.aegiscall.screener.telecom

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class RecordedCallItem(
    val id: String,
    val fileName: String,
    val phoneNumber: String,
    val filePath: String,
    val timestamp: Long,
    val durationSeconds: Long,
    val fileSizeBytes: Long
)

/**
 * CallRecorderManager
 * ───────────────────
 * Manages native in-call audio recording, live amplitude metering,
 * public MediaStore export ("Recordings/AegisCall"), and retrieval of saved recordings.
 */
object CallRecorderManager {

    private const val TAG = "CallRecorderManager"

    @Volatile
    var isRecording: Boolean = false
        private set

    private var mediaRecorder: MediaRecorder? = null
    private var currentTempFile: File? = null
    private var currentPhoneNumber: String = "Unknown"
    private var recordingStartTime: Long = 0L

    fun startRecording(context: Context, phoneNumber: String): Boolean {
        if (isRecording) {
            Log.i(TAG, "Already recording call")
            return true
        }

        try {
            currentPhoneNumber = phoneNumber.ifBlank { "Unknown" }
            recordingStartTime = System.currentTimeMillis()

            val tempFile = File.createTempFile("call_rec_${System.currentTimeMillis()}", ".m4a", context.cacheDir)
            currentTempFile = tempFile

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            // Attempt in-call communication audio source first, fallback to physical mic
            var audioSourceSet = false
            val sourcesToTry = listOf(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                MediaRecorder.AudioSource.MIC,
                MediaRecorder.AudioSource.DEFAULT
            )

            for (src in sourcesToTry) {
                try {
                    recorder.setAudioSource(src)
                    audioSourceSet = true
                    Log.i(TAG, "AudioSource successfully set to: $src")
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "AudioSource $src failed: ${e.message}")
                }
            }

            if (!audioSourceSet) {
                recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            }

            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioEncodingBitRate(128000)
            recorder.setAudioSamplingRate(44100)
            recorder.setOutputFile(tempFile.absolutePath)

            recorder.prepare()
            recorder.start()

            mediaRecorder = recorder
            isRecording = true
            Log.i(TAG, "Call recording started for $currentPhoneNumber -> ${tempFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start call recording", e)
            cleanupTempFile()
            isRecording = false
            return false
        }
    }

    fun getRecordingAmplitude(): Int {
        return try {
            if (isRecording) mediaRecorder?.maxAmplitude ?: 0 else 0
        } catch (e: Exception) {
            0
        }
    }

    fun getRecordingDurationSeconds(): Long {
        return if (isRecording) {
            (System.currentTimeMillis() - recordingStartTime) / 1000
        } else 0L
    }

    fun stopRecording(context: Context): String? {
        if (!isRecording && mediaRecorder == null) {
            return null
        }

        isRecording = false
        val tempFile = currentTempFile
        val phone = currentPhoneNumber
        val durationMs = System.currentTimeMillis() - recordingStartTime

        try {
            mediaRecorder?.apply {
                try {
                    stop()
                } catch (e: Exception) {
                    Log.w(TAG, "Error stopping mediaRecorder: ${e.message}")
                }
                release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing mediaRecorder: ${e.message}")
        } finally {
            mediaRecorder = null
        }

        if (tempFile == null || !tempFile.exists() || tempFile.length() < 512) {
            Log.w(TAG, "Recording file empty or missing, cleanup")
            cleanupTempFile()
            return null
        }

        val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val cleanPhone = phone.replace(Regex("[^0-9+]"), "").ifBlank { "Unknown" }
        val fileName = "Call_${cleanPhone}_$dateFormat.m4a"

        var savedLocation: String? = null

        // Strategy 1: MediaStore API (Android 10+ / API 29+) -> Public "Recordings" or "Music"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val relativeDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Environment.DIRECTORY_RECORDINGS + "/AegisCall"
                } else {
                    Environment.DIRECTORY_MUSIC + "/AegisCall"
                }

                val contentValues = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Audio.Media.MIME_TYPE, "audio/mp4")
                    put(MediaStore.Audio.Media.RELATIVE_PATH, relativeDir)
                    put(MediaStore.Audio.Media.TITLE, "Call with $cleanPhone")
                    put(MediaStore.Audio.Media.ARTIST, "AegisCall Phone Recorder")
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }

                val uri = context.contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        FileInputStream(tempFile).use { input ->
                            input.copyTo(out)
                        }
                    }
                    contentValues.clear()
                    contentValues.put(MediaStore.Audio.Media.IS_PENDING, 0)
                    context.contentResolver.update(uri, contentValues, null, null)
                    savedLocation = "$relativeDir/$fileName"
                    Log.i(TAG, "Saved recording via MediaStore to: $savedLocation (uri: $uri)")
                }
            } catch (e: Exception) {
                Log.w(TAG, "MediaStore insert failed: ${e.message}")
            }
        }

        // Strategy 2: Direct File System Fallback
        if (savedLocation == null) {
            try {
                val baseDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_RECORDINGS)
                } else {
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
                }
                val targetDir = File(baseDir, "AegisCall").apply { if (!exists()) mkdirs() }
                val targetFile = File(targetDir, fileName)
                tempFile.copyTo(targetFile, overwrite = true)
                savedLocation = targetFile.absolutePath

                @Suppress("DEPRECATION")
                val mediaScanIntent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE).apply {
                    data = Uri.fromFile(targetFile)
                }
                context.sendBroadcast(mediaScanIntent)
                Log.i(TAG, "Saved recording to public filesystem: ${targetFile.absolutePath}")
            } catch (e: Exception) {
                Log.e(TAG, "Public filesystem save failed", e)
            }
        }

        cleanupTempFile()
        Log.i(TAG, "Call recording saved to: ${savedLocation ?: "Recordings/Music"} (duration: ${durationMs / 1000}s)")
        return savedLocation ?: fileName
    }

    fun getSavedRecordings(context: Context): List<RecordedCallItem> {
        val list = mutableListOf<RecordedCallItem>()

        // 1. Scan filesystem directory Recordings/AegisCall & Music/AegisCall
        val dirsToScan = listOf(
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_RECORDINGS), "AegisCall"),
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "AegisCall"),
            File(context.filesDir, "recordings")
        )

        for (dir in dirsToScan) {
            if (dir.exists() && dir.isDirectory) {
                val files = dir.listFiles { f -> f.isFile && (f.name.endsWith(".m4a") || f.name.endsWith(".mp3") || f.name.endsWith(".aac")) }
                if (files != null) {
                    for (file in files) {
                        try {
                            val phone = parsePhoneFromFileName(file.name)
                            var durationSec = 0L
                            try {
                                val retriever = MediaMetadataRetriever()
                                retriever.setDataSource(file.absolutePath)
                                val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                                durationSec = (durStr?.toLongOrNull() ?: 0L) / 1000L
                                retriever.release()
                            } catch (e: Exception) {
                                // ignore
                            }

                            list.add(
                                RecordedCallItem(
                                    id = file.name,
                                    fileName = file.name,
                                    phoneNumber = phone,
                                    filePath = file.absolutePath,
                                    timestamp = file.lastModified(),
                                    durationSeconds = durationSec,
                                    fileSizeBytes = file.length()
                                )
                            )
                        } catch (e: Exception) {
                            Log.w(TAG, "Error reading recording file ${file.name}: ${e.message}")
                        }
                    }
                }
            }
        }

        // 2. Query MediaStore if on Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val projection = arrayOf(
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.DATE_MODIFIED,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.SIZE
                )
                val selection = "${MediaStore.Audio.Media.DISPLAY_NAME} LIKE ?"
                val selectionArgs = arrayOf("Call_%")
                val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"

                context.contentResolver.query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                    val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED)
                    val durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)

                    while (cursor.moveToNext()) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol)
                        val date = cursor.getLong(dateCol) * 1000L
                        val durMs = cursor.getLong(durCol)
                        val size = cursor.getLong(sizeCol)
                        val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)

                        // Avoid duplicates if already discovered in filesystem
                        if (list.none { it.fileName == name }) {
                            list.add(
                                RecordedCallItem(
                                    id = id.toString(),
                                    fileName = name,
                                    phoneNumber = parsePhoneFromFileName(name),
                                    filePath = contentUri.toString(),
                                    timestamp = date,
                                    durationSeconds = durMs / 1000L,
                                    fileSizeBytes = size
                                )
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "MediaStore query error: ${e.message}")
            }
        }

        return list.sortedByDescending { it.timestamp }
    }

    fun deleteRecording(context: Context, filePath: String): Boolean {
        try {
            if (filePath.startsWith("content://")) {
                val uri = Uri.parse(filePath)
                val count = context.contentResolver.delete(uri, null, null)
                return count > 0
            } else {
                val file = File(filePath)
                if (file.exists()) {
                    return file.delete()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete recording at $filePath", e)
        }
        return false
    }

    private fun parsePhoneFromFileName(name: String): String {
        // Filename format: Call_+1234567890_20261013_223010.m4a
        val parts = name.split("_")
        return if (parts.size >= 2) parts[1] else "Unknown"
    }

    private fun cleanupTempFile() {
        try {
            currentTempFile?.let {
                if (it.exists()) it.delete()
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            currentTempFile = null
        }
    }
}

