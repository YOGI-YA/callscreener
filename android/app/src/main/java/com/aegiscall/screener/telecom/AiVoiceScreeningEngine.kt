package com.aegiscall.screener.telecom

import android.content.Context
import android.content.Intent
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

object AiVoiceScreeningEngine : TextToSpeech.OnInitListener {

    private const val TAG = "AiVoiceScreeningEngine"
    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isTtsReady = false
    private var isListening = false
    private var currentLanguage = "en-US"
    private val mainHandler = Handler(Looper.getMainLooper())

    fun initialize(context: Context) {
        if (tts == null) {
            tts = TextToSpeech(context.applicationContext, this)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    mainHandler.post {
                        // When AI stops speaking, start listening for caller's answer
                        startListeningForCaller()
                    }
                }
                override fun onError(utteranceId: String?) {}
            })
            isTtsReady = true
            Log.i(TAG, "TextToSpeech engine initialized successfully")
        } else {
            Log.e(TAG, "Failed to initialize TextToSpeech engine")
        }
    }

    fun startScreeningConversation(context: Context, language: String = "auto") {
        currentLanguage = when (language) {
            "hi" -> "hi-IN"
            "hinglish" -> "hi-IN"
            else -> "en-US"
        }

        initialize(context)

        val greeting = when (language) {
            "hi" -> "नमस्ते। मैं इस कॉल की जांच करने वाला एआई सहायक हूं। कृपया अपना नाम और कॉल करने का कारण बताएं।"
            "hinglish" -> "Hello, main AI assistant bol raha hoon. Please apna naam aur call karne ka reason bataiye."
            else -> "Hello, I am the AI assistant screening this call. Please state your name and why you are calling."
        }

        speakAiResponse(context, greeting)
    }

    fun speakAiResponse(context: Context, message: String) {
        initialize(context)

        CallScreeningPlugin.broadcastAiSpeech(message)

        if (isTtsReady) {
            val params = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "ai_utterance_${System.currentTimeMillis()}")
            }
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, params, "ai_utterance")
        } else {
            // If TTS is warming up, simulate utterance and begin listening
            mainHandler.postDelayed({
                startListeningForCaller()
            }, 2000)
        }
    }

    private fun startListeningForCaller() {
        mainHandler.post {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(AegisInCallService.appContext)) {
                    Log.w(TAG, "SpeechRecognizer not available on this device")
                    return@post
                }

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(AegisInCallService.appContext)
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
                            // Restart speech recognition if conversation is still ongoing
                            if (AegisInCallService.isScreeningActive) {
                                mainHandler.postDelayed({ startListeningForCaller() }, 1000)
                            }
                        }
                        override fun onResults(results: Bundle?) {
                            isListening = false
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull() ?: ""
                            if (text.isNotBlank()) {
                                CallScreeningPlugin.broadcastCallerTranscript(text, isFinal = true)
                            }
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
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AiVoiceScreeningEngine", e)
        }
    }
}
