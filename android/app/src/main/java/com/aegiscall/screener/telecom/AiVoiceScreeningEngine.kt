package com.aegiscall.screener.telecom

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import com.aegiscall.screener.plugins.CallScreeningPlugin
import java.util.Locale

/**
 * AiVoiceScreeningEngine
 * ──────────────────────
 * Handles bidirectional AI call screening during an active phone call:
 * 1. AI Assistant speaks directly to the caller over the voice call audio stream.
 * 2. Real-time Speech-To-Text listens to the caller's spoken replies word-by-word.
 * 3. Audio routing ensures the caller on the other end hears the AI speech loud & clear.
 */
object AiVoiceScreeningEngine : TextToSpeech.OnInitListener {

    private const val TAG = "AiVoiceScreeningEngine"
    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var audioManager: AudioManager? = null
    private var isTtsReady = false
    private var isListening = false
    private var currentLanguage = "en-US"
    private var voicePersona = "female" // "female", "male", "natural"
    private val mainHandler = Handler(Looper.getMainLooper())

    var isBotVoiceEnabled: Boolean = true

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

            // Direct TTS audio strictly into voice communication stream
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                tts?.setAudioAttributes(audioAttributes)
            }

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    mainHandler.post {
                        try {
                            if (!AegisInCallService.isScreeningActive) {
                                tts?.stop()
                                return@post
                            }
                            // 1. Unmute uplink so audio transmits clearly to the remote party on the phone call
                            AegisInCallService.serviceInstance?.setMuted(false)
                            audioManager?.isMicrophoneMute = false
                            @Suppress("DEPRECATION")
                            audioManager?.isSpeakerphoneOn = false
                            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION

                            // 2. Ensure remote caller gets loud and clear signal without blasting our side
                            if (!TelecomAudioRouter.isListenIn()) {
                                AegisInCallService.appContext.let { ctx ->
                                    TelecomAudioRouter.configureScreeningAudioRoute(ctx, AegisInCallService.serviceInstance)
                                }
                            }

                            CallScreeningPlugin.broadcastAudioRouteState(
                                transmittingToCaller = true,
                                localMuted = !TelecomAudioRouter.isListenIn()
                            )
                        } catch (e: Exception) {
                            Log.w(TAG, "Audio routing onStart error: ${e.message}")
                        }
                    }
                }
                override fun onDone(utteranceId: String?) {
                    mainHandler.post {
                        if (!AegisInCallService.isScreeningActive) return@post
                        try {
                            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                            CallScreeningPlugin.broadcastAudioRouteState(transmittingToCaller = false, localMuted = !TelecomAudioRouter.isListenIn())
                        } catch (e: Exception) {
                            Log.w(TAG, "Audio routing onDone error: ${e.message}")
                        }
                        // After AI finishes speaking to the caller, listen for the caller's response
                        startListeningForCaller()
                    }
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    mainHandler.post {
                        CallScreeningPlugin.broadcastAudioRouteState(transmittingToCaller = false, localMuted = !TelecomAudioRouter.isListenIn())
                        if (AegisInCallService.isScreeningActive) {
                            startListeningForCaller()
                        }
                    }
                }
            })
            isTtsReady = true
            Log.i(TAG, "TextToSpeech engine initialized successfully for caller uplink transmission")
            applyHighFidelityVoice(Locale.US)
        } else {
            Log.e(TAG, "Failed to initialize TextToSpeech engine")
        }
    }

    fun setVoicePersona(persona: String) {
        voicePersona = persona.lowercase()
        val locale = try {
            Locale.forLanguageTag(currentLanguage)
        } catch (e: Exception) {
            Locale.US
        }
        applyHighFidelityVoice(locale)
    }

    private fun applyHighFidelityVoice(targetLocale: Locale) {
        try {
            tts?.language = targetLocale
            tts?.setSpeechRate(1.02f)
            tts?.setPitch(if (voicePersona == "male") 0.92f else 1.05f)

            val availableVoices = tts?.voices
            if (!availableVoices.isNullOrEmpty()) {
                val matchingVoices = availableVoices.filter { it.locale.language == targetLocale.language }
                val bestVoice = matchingVoices.maxByOrNull { v ->
                    var score = 0
                    val name = v.name.lowercase()
                    if (voicePersona == "female" && (name.contains("female") || name.contains("fem") || name.contains("girl"))) score += 40
                    if (voicePersona == "male" && (name.contains("male") || name.contains("man") || name.contains("boy"))) score += 40
                    if (name.contains("network")) score += 60
                    if (name.contains("neural")) score += 50
                    if (name.contains("natural")) score += 45
                    if (name.contains("wavenet")) score += 35
                    if (v.quality >= Voice.QUALITY_VERY_HIGH) score += 30
                    if (v.quality == Voice.QUALITY_HIGH) score += 20
                    score
                }
                if (bestVoice != null) {
                    tts?.voice = bestVoice
                    Log.i(TAG, "Activated voice: ${bestVoice.name} (quality=${bestVoice.quality}) for $voicePersona")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not apply voice: ${e.message}")
        }
    }

    fun startScreeningConversation(context: Context, language: String = "auto", enableBotVoice: Boolean = true) {
        isBotVoiceEnabled = enableBotVoice
        currentLanguage = when (language.lowercase()) {
            "hi" -> "hi-IN"
            "hinglish" -> "hi-IN"
            else -> "en-US"
        }

        initialize(context)

        try {
            tts?.stop()
        } catch (e: Exception) {
            // ignore
        }

        val targetLocale = try {
            Locale.forLanguageTag(currentLanguage)
        } catch (e: Exception) {
            Locale.US
        }
        applyHighFidelityVoice(targetLocale)

        if (enableBotVoice) {
            val greeting = when (language.lowercase()) {
                "hi" -> "नमस्ते। मैं इस कॉल की जांच करने वाला एआई सहायक हूं। कृपया अपना नाम और कॉल करने का कारण बताएं।"
                "hinglish" -> "Namaste, main recipient ke liye call screen kar raha hoon. Kripya apna naam aur call karne ka reason batayein."
                else -> "Hello, I am screening calls on behalf of the recipient with Aegis AI. Please state your name and why you are calling."
            }
            speakAiResponse(context, greeting)
        } else {
            Log.i(TAG, "Silent listener mode activated. Starting STT listener.")
            startListeningForCaller()
        }
    }

    fun speakAiResponse(context: Context, message: String) {
        if (!AegisInCallService.isScreeningActive) {
            Log.i(TAG, "Screening not active, skipping speakAiResponse")
            return
        }
        isBotVoiceEnabled = true
        initialize(context)

        // Broadcast utterance to frontend UI for live bubble
        CallScreeningPlugin.broadcastAiSpeech(message)

        // Stop STT while AI speaks so AI doesn't transcribe its own voice
        speechRecognizer?.stopListening()
        isListening = false

        if (isTtsReady) {
            val utteranceId = "ai_${System.currentTimeMillis()}"
            val params = Bundle().apply {
                putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL)
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        } else {
            mainHandler.postDelayed({
                if (AegisInCallService.isScreeningActive) {
                    val utteranceId = "ai_${System.currentTimeMillis()}"
                    val params = Bundle().apply {
                        putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL)
                        putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
                        putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
                    }
                    tts?.speak(message, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
                }
            }, 800)
        }
    }

    fun startListeningForCaller() {
        mainHandler.post {
            if (!AegisInCallService.isScreeningActive) return@post
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
                        override fun onRmsChanged(rmsdB: Float) {
                            // Broadcast audio volume / dB levels to the UI for live equalizer
                            CallScreeningPlugin.broadcastAudioLevel(rmsdB)
                        }
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {
                            isListening = false
                        }
                        override fun onError(error: Int) {
                            isListening = false
                            Log.w(TAG, "STT error code: $error")
                            // Restart STT if still actively screening
                            if (AegisInCallService.isScreeningActive) {
                                mainHandler.postDelayed({ startListeningForCaller() }, 800)
                            }
                        }
                        override fun onResults(results: Bundle?) {
                            isListening = false
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull() ?: ""
                            if (text.isNotBlank()) {
                                val defense = PromptInjectionDefense.inspectCallerUtterance(text)
                                Log.i(TAG, "Caller said: ${defense.sanitizedText} (Injection detected: ${defense.isInjectionAttempt})")
                                CallScreeningPlugin.broadcastCallerTranscript(defense.sanitizedText, isFinal = true)
                            }
                            // Keep listening continuously during active screening
                            if (AegisInCallService.isScreeningActive) {
                                mainHandler.postDelayed({ startListeningForCaller() }, 200)
                            }
                        }
                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull() ?: ""
                            if (text.isNotBlank()) {
                                val defense = PromptInjectionDefense.inspectCallerUtterance(text)
                                CallScreeningPlugin.broadcastCallerTranscript(defense.sanitizedText, isFinal = false)
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
            mainHandler.removeCallbacksAndMessages(null)
            tts?.stop()
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
            speechRecognizer = null
            isListening = false
            // Restore audio mode
            mainHandler.post {
                try {
                    audioManager?.mode = AudioManager.MODE_NORMAL
                    @Suppress("DEPRECATION")
                    audioManager?.isSpeakerphoneOn = false
                } catch (e: Exception) {
                    // ignore
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AiVoiceScreeningEngine", e)
        }
    }
}
