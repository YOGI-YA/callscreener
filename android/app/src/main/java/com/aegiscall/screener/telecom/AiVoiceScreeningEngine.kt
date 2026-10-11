package com.aegiscall.screener.telecom

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.aegiscall.screener.plugins.CallScreeningPlugin
import java.util.Locale

/**
 * AiVoiceScreeningEngine
 * ──────────────────────
 * Handles TTS (AI speaking) and STT (caller listening) during an active
 * phone call when AegisCall is the Default Phone App.
 *
 * AUDIO ROUTING:
 * When a call is active, Android routes audio to the call stream.
 * We set AudioManager to MODE_IN_CALL and route to earpiece so TTS plays
 * into the phone's earpiece path (which is the same stream the caller hears).
 *
 * IMPORTANT: SpeechRecognizer captures from the device microphone.
 * During a live call, both our STT mic and the call audio share the mic.
 * This is an Android platform constraint — the workaround for a proper
 * production app would be to use AudioRecord directly and an acoustic
 * echo-canceller (AEC), but Android's built-in AEC handles this reasonably
 * for VOICE_COMMUNICATION audio sessions.
 */
object AiVoiceScreeningEngine : TextToSpeech.OnInitListener {

    private const val TAG = "AiVoiceScreeningEngine"
    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var audioManager: AudioManager? = null
    private var isTtsReady = false
    private var isListening = false
    private var currentLanguage = "en-US"
    private val mainHandler = Handler(Looper.getMainLooper())

    fun initialize(context: Context) {
        if (tts == null) {
            tts = TextToSpeech(context.applicationContext, this)
        }
        if (audioManager == null) {
            audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    mainHandler.post {
                        try {
                            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                            @Suppress("DEPRECATION")
                            audioManager?.isSpeakerphoneOn = true
                        } catch (e: Exception) {
                            Log.w(TAG, "Audio routing onStart error: ${e.message}")
                        }
                    }
                }
                override fun onDone(utteranceId: String?) {
                    mainHandler.post {
                        try {
                            audioManager?.mode = AudioManager.MODE_IN_CALL
                        } catch (e: Exception) {
                            Log.w(TAG, "Audio routing onDone error: ${e.message}")
                        }
                        // After AI finishes speaking, start listening for caller's response
                        startListeningForCaller()
                    }
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    mainHandler.post {
                        startListeningForCaller()
                    }
                }
            })
            isTtsReady = true
            Log.i(TAG, "TextToSpeech engine initialized successfully")
            applyHighFidelityVoice(Locale.US)
        } else {
            Log.e(TAG, "Failed to initialize TextToSpeech engine")
        }
    }

    private fun applyHighFidelityVoice(targetLocale: Locale) {
        try {
            tts?.language = targetLocale
            // Conversational rhythm: 1.03x speed, natural pitch
            tts?.setSpeechRate(1.03f)
            tts?.setPitch(1.0f)

            val availableVoices = tts?.voices
            if (!availableVoices.isNullOrEmpty()) {
                val bestVoice = availableVoices
                    .filter { it.locale.language == targetLocale.language }
                    .maxByOrNull { v ->
                        var score = 0
                        val name = v.name.lowercase()
                        if (name.contains("network")) score += 60
                        if (name.contains("neural")) score += 50
                        if (name.contains("natural")) score += 40
                        if (name.contains("wavenet")) score += 35
                        if (v.quality >= android.speech.tts.Voice.QUALITY_VERY_HIGH) score += 30
                        if (v.quality == android.speech.tts.Voice.QUALITY_HIGH) score += 20
                        score
                    }
                if (bestVoice != null) {
                    tts?.voice = bestVoice
                    Log.i(TAG, "Activated Free Neural Voice: ${bestVoice.name} (quality=${bestVoice.quality})")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not apply neural voice: ${e.message}")
        }
    }

    fun startScreeningConversation(context: Context, language: String = "auto") {
        currentLanguage = when (language.lowercase()) {
            "hi" -> "hi-IN"
            "hinglish" -> "hi-IN"
            else -> "en-US"
        }

        initialize(context)

        val targetLocale = try {
            Locale.forLanguageTag(currentLanguage)
        } catch (e: Exception) {
            Locale.US
        }
        applyHighFidelityVoice(targetLocale)

        val greeting = when (language.lowercase()) {
            "hi" -> "नमस्ते। मैं इस कॉल की जांच करने वाला एआई सहायक हूं। कृपया अपना नाम और कॉल करने का कारण बताएं।"
            "hinglish" -> "Hello, main AI assistant bol raha hoon. Please apna naam aur call karne ka reason bataiye."
            else -> "Hello, I am the AI assistant screening this call on the recipient's behalf. Please state your name and the reason you are calling."
        }

        speakAiResponse(context, greeting)
    }

    fun speakAiResponse(context: Context, message: String) {
        initialize(context)

        // Broadcast text to UI
        CallScreeningPlugin.broadcastAiSpeech(message)

        if (isTtsReady) {
            val utteranceId = "ai_${System.currentTimeMillis()}"
            val params = Bundle().apply {
                // KEY_PARAM_STREAM: STREAM_VOICE_CALL routes into the telephony audio path
                putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL)
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        } else {
            // TTS warming up, start listening after brief pause
            mainHandler.postDelayed({
                CallScreeningPlugin.broadcastAiSpeech(message)
                startListeningForCaller()
            }, 2000)
        }
    }

    private fun startListeningForCaller() {
        mainHandler.post {
            try {
                val ctx = AegisInCallService.appContext
                if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
                    Log.w(TAG, "SpeechRecognizer not available on this device")
                    return@post
                }

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(ctx)
                    speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {
                            isListening = true
                        }
                        override fun onBeginningOfSpeech() {}
                        override fun onRmsChanged(rmsdB: Float) {}
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {
                            isListening = false
                        }
                        override fun onError(error: Int) {
                            isListening = false
                            Log.w(TAG, "STT error code: $error")
                            // Restart STT if still actively screening
                            if (AegisInCallService.isScreeningActive) {
                                mainHandler.postDelayed({ startListeningForCaller() }, 1200)
                            }
                        }
                        override fun onResults(results: Bundle?) {
                            isListening = false
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull() ?: ""
                            if (text.isNotBlank()) {
                                Log.i(TAG, "Caller said: $text")
                                CallScreeningPlugin.broadcastCallerTranscript(text, isFinal = true)
                            }
                            // Keep listening during active screening
                            if (AegisInCallService.isScreeningActive) {
                                mainHandler.postDelayed({ startListeningForCaller() }, 800)
                            }
                        }
                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull() ?: ""
                            if (text.isNotBlank()) {
                                CallScreeningPlugin.broadcastCallerTranscript(text, isFinal = false)
                            }
                        }
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentLanguage)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    // EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: shorter turns
                    putExtra("android.speech.extra.SPEECH_INPUT_MINIMUM_LENGTH_MILLIS", 500)
                }

                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Error starting speech listener", e)
            }
        }
    }

    fun stop() {
        try {
            tts?.stop()
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
            speechRecognizer = null
            isListening = false
            // Restore audio mode
            mainHandler.post {
                audioManager?.mode = AudioManager.MODE_NORMAL
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AiVoiceScreeningEngine", e)
        }
    }
}
