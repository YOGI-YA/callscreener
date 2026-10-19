package com.aegiscall.screener.telecom

import android.util.Log

/**
 * DialogStateMachine
 * ──────────────────
 * Multi-turn conversational screening dialog engine replicating Google Pixel Call Screen
 * and Truecaller Assistant.
 *
 * Manages conversation turns, context-aware follow-up queries, and intelligent closure.
 */
class DialogStateMachine {

    companion object {
        private const val TAG = "DialogStateMachine"
    }

    enum class ScreeningPhase {
        INITIAL_GREETING,
        INTENT_CLARIFICATION,
        VERIFICATION_DETAIL,
        FINAL_RESOLUTION
    }

    var currentPhase: ScreeningPhase = ScreeningPhase.INITIAL_GREETING
        private set
    var turnCount: Int = 0
        private set

    fun reset() {
        currentPhase = ScreeningPhase.INITIAL_GREETING
        turnCount = 0
    }

    /**
     * Determines whether to generate an automated follow-up turn and produces
     * the natural conversational response.
     */
    fun processCallerTurn(callerUtterance: String, language: String = "en-US"): String? {
        turnCount++
        val clean = callerUtterance.lowercase()

        // Turn 1 complete -> Transition to Clarification
        if (currentPhase == ScreeningPhase.INITIAL_GREETING) {
            currentPhase = ScreeningPhase.INTENT_CLARIFICATION

            // Contextual branch based on what caller said
            return when {
                clean.contains("delivery") || clean.contains("package") || clean.contains("courier") || clean.contains("amazon") || clean.contains("fedex") || clean.contains("ups") -> {
                    if (language.startsWith("hi")) {
                        "क्या यह कोई पार्सल डिलीवरी है? क्या इसके लिए हस्ताक्षर या ओटीपी की आवश्यकता है?"
                    } else {
                        "Understood, you're with delivery. Can you please state the carrier and if a recipient signature is required?"
                    }
                }
                clean.contains("doctor") || clean.contains("hospital") || clean.contains("clinic") || clean.contains("appointment") -> {
                    if (language.startsWith("hi")) {
                        "अपॉइंटमेंट की पुष्टि के लिए धन्यवाद। कृपया तारीख और समय बताएं।"
                    } else {
                        "Thank you for calling regarding the appointment. Could you please confirm the scheduled date and time?"
                    }
                }
                clean.contains("bank") || clean.contains("card") || clean.contains("account") || clean.contains("loan") -> {
                    if (language.startsWith("hi")) {
                        "कृपया अपनी संस्था का नाम और इस कॉल का विशिष्ट उद्देश्य बताएं।"
                    } else {
                        "Please state the specific financial institution and whether this is an urgent matter regarding the account."
                    }
                }
                clean.length < 10 -> {
                    if (language.startsWith("hi")) {
                        "आवाज स्पष्ट नहीं थी। कृपया अपना नाम और कॉल करने का कारण दोबारा बताएं।"
                    } else {
                        "I couldn't quite hear you. Could you please clearly state your name and why you're calling?"
                    }
                }
                else -> {
                    if (language.startsWith("hi")) {
                        "धन्यवाद। क्या यह कॉल बहुत जरूरी है या आप कोई संदेश छोड़ना चाहेंगे?"
                    } else {
                        "Thank you. Could you please let me know if this is urgent or if you would like to leave a brief message?"
                    }
                }
            }
        }

        // Turn 2 complete -> Transition to Resolution / Voicemail
        if (currentPhase == ScreeningPhase.INTENT_CLARIFICATION) {
            currentPhase = ScreeningPhase.FINAL_RESOLUTION
            return if (language.startsWith("hi")) {
                "आपका संदेश प्राप्त हो गया है और प्राप्तकर्ता को लाइव ट्रांसक्रिप्ट भेज दी गई है। धन्यवाद।"
            } else {
                "I have relayed your message and live transcript to the recipient. Thank you for calling."
            }
        }

        // If already past resolution, do not speak further
        return null
    }
}
