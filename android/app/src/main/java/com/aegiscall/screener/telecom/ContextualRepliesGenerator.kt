package com.aegiscall.screener.telecom

/**
 * ContextualRepliesGenerator
 * ──────────────────────────
 * Dynamically computes contextual smart quick-reply chips for the user interface,
 * mirroring Google Pixel Call Screen interactive assistant chips.
 */
object ContextualRepliesGenerator {

    data class QuickReplyChip(
        val id: String,
        val label: String,
        val speechText: String,
        val actionType: String // "REPLY", "HANGUP", "PICKUP"
    )

    fun generateReplies(callerUtterance: String, language: String = "en-US"): List<QuickReplyChip> {
        val clean = callerUtterance.lowercase()

        return when {
            // Delivery / Courier
            clean.contains("delivery") || clean.contains("package") || clean.contains("courier") || clean.contains("amazon") || clean.contains("fedex") || clean.contains("ups") -> {
                listOf(
                    QuickReplyChip("leave_door", "Leave at door", "Please leave the package at the front door. Thank you.", "REPLY"),
                    QuickReplyChip("signature_check", "Signature required?", "Does this package require an in-person signature?", "REPLY"),
                    QuickReplyChip("call_back_later", "Call back later", "The recipient is currently away and will call you back shortly.", "REPLY"),
                    QuickReplyChip("take_message", "Take a message", "Please leave a message with tracking or delivery details.", "REPLY")
                )
            }

            // Appointment / Medical
            clean.contains("appointment") || clean.contains("doctor") || clean.contains("hospital") || clean.contains("clinic") || clean.contains("dentist") -> {
                listOf(
                    QuickReplyChip("confirm_appt", "Confirm appointment", "The recipient confirms the appointment. Thank you.", "REPLY"),
                    QuickReplyChip("reschedule_appt", "Need to reschedule", "The recipient needs to reschedule. Please provide available dates.", "REPLY"),
                    QuickReplyChip("send_sms", "Send SMS details", "Could you please send the appointment details via text message?", "REPLY"),
                    QuickReplyChip("take_message", "Take a message", "Please leave any preparation notes or instructions.", "REPLY")
                )
            }

            // Financial / Banking
            clean.contains("bank") || clean.contains("card") || clean.contains("fraud") || clean.contains("account") || clean.contains("loan") -> {
                listOf(
                    QuickReplyChip("verify_org", "Which bank?", "Could you state the exact institution and verified department?", "REPLY"),
                    QuickReplyChip("send_mail", "Send written notice", "Please mail official documentation to the address on file.", "REPLY"),
                    QuickReplyChip("call_official", "I will call official #", "The recipient will verify and call back using the official customer service number.", "REPLY"),
                    QuickReplyChip("hang_up", "Hang up", "We are not interested. Goodbye.", "HANGUP")
                )
            }

            // Telemarketing / Solicitation
            clean.contains("offer") || clean.contains("promotion") || clean.contains("warranty") || clean.contains("solar") || clean.contains("survey") -> {
                listOf(
                    QuickReplyChip("not_interested", "Not interested", "The recipient is not interested. Please remove this number from your list.", "REPLY"),
                    QuickReplyChip("do_not_call", "Do not call again", "Please add this number to your Do Not Call registry immediately.", "REPLY"),
                    QuickReplyChip("hang_up", "End call", "Thank you, goodbye.", "HANGUP")
                )
            }

            // Default general chips
            else -> {
                listOf(
                    QuickReplyChip("ask_who", "Who is this?", "Could you please state your full name and company?", "REPLY"),
                    QuickReplyChip("ask_regarding", "What is this regarding?", "Could you please explain what this call is regarding?", "REPLY"),
                    QuickReplyChip("ask_urgent", "Is it urgent?", "Is this an urgent matter?", "REPLY"),
                    QuickReplyChip("take_message", "Take message", "The recipient cannot take the call right now. Please leave a message.", "REPLY")
                )
            }
        }
    }
}
