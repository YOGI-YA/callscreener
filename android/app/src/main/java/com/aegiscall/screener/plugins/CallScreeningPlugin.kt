package com.aegiscall.screener.plugins

import android.app.Activity
import android.app.role.RoleManager
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.provider.ContactsContract
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.activity.result.ActivityResult
import com.aegiscall.screener.models.ScreeningData
import com.aegiscall.screener.telecom.AegisInCallService
import com.aegiscall.screener.telecom.CallHistoryStorage
import com.aegiscall.screener.telecom.CallRecorderManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "CallScreeningBridge")
class CallScreeningPlugin : Plugin() {

    companion object {
        private const val PREFS_NAME = "aegis_call_screener_prefs"
        private const val KEY_API_URL = "backend_api_url"

        @Volatile
        private var instance: CallScreeningPlugin? = null

        fun broadcastScreenedCall(data: ScreeningData) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("id", data.id)
                    put("phoneNumber", data.phoneNumber)
                    put("callerName", data.callerName)
                    put("verdict", data.verdict)
                    put("riskScore", data.riskScore)
                    put("riskLevel", data.riskLevel)
                    put("category", data.category)
                    put("confidence", data.confidence)
                    put("rationale", data.rationale)
                    put("engine", data.engine)
                    put("latencyMs", data.latencyMs)
                    put("timestamp", data.timestamp)

                    val actions = JSObject().apply {
                        put("disallowCall", data.suggestedActions.disallowCall)
                        put("silenceCall", data.suggestedActions.silenceCall)
                        put("rejectCall", data.suggestedActions.rejectCall)
                        put("skipCallLog", data.suggestedActions.skipCallLog)
                        put("skipNotification", data.suggestedActions.skipNotification)
                    }
                    put("suggestedActions", actions)
                }
                plugin.notifyListeners("callScreened", js, true)
            }
        }

        fun broadcastIncomingCall(phoneNumber: String, callerName: String) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("phoneNumber", phoneNumber)
                    put("callerName", callerName)
                    put("timestamp", System.currentTimeMillis())
                }
                plugin.notifyListeners("incomingPhoneCall", js, true)
            }
        }

        fun broadcastCallerTranscript(text: String, isFinal: Boolean) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("speaker", "CALLER")
                    put("text", text)
                    put("isFinal", isFinal)
                    put("timestamp", System.currentTimeMillis())
                }
                plugin.notifyListeners("liveCallTranscript", js, true)
            }
        }

        fun broadcastAudioLevel(rmsDb: Float) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("rmsDb", rmsDb)
                }
                plugin.notifyListeners("audioLevelChanged", js, true)
            }
        }

        fun broadcastAiSpeech(text: String) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("speaker", "AI")
                    put("text", text)
                    put("timestamp", System.currentTimeMillis())
                }
                plugin.notifyListeners("aiSpeechUtterance", js, true)
            }
        }

        fun broadcastCallState(state: String) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("state", state)
                }
                plugin.notifyListeners("callStateChanged", js, true)
            }
        }

        fun broadcastCallEnded() {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("ended", true)
                }
                plugin.notifyListeners("phoneCallEnded", js, true)
            }
        }

        fun broadcastCallPickedUp() {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("pickedUp", true)
                }
                plugin.notifyListeners("callPickedUp", js, true)
            }
        }

        fun broadcastCallAudioState(muted: Boolean, speakerOn: Boolean) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("muted", muted)
                    put("speakerOn", speakerOn)
                }
                plugin.notifyListeners("callAudioStateChanged", js, true)
            }
        }

        fun broadcastRecordingSaved(filePath: String) {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("saved", true)
                    put("filePath", filePath)
                    put("location", "Recordings/Music")
                }
                plugin.notifyListeners("callRecordingSaved", js, true)
            }
        }

        fun broadcastVoicemailGreetingPlaying() {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("state", "GREETING_PLAYING")
                    put("timestamp", System.currentTimeMillis())
                }
                plugin.notifyListeners("voicemailStateChanged", js, true)
            }
        }

        fun broadcastVoicemailRecordingStarted() {
            instance?.let { plugin ->
                val js = JSObject().apply {
                    put("state", "RECORDING_CALLER_MESSAGE")
                    put("timestamp", System.currentTimeMillis())
                }
                plugin.notifyListeners("voicemailStateChanged", js, true)
            }
        }

        fun notifyCallRestored() {
            instance?.let { plugin ->
                val activeCall = AegisInCallService.activeCall
                if (activeCall != null) {
                    val phone = activeCall.details.handle?.schemeSpecificPart ?: "Unknown"
                    val name = activeCall.details.callerDisplayName ?: "Unknown Caller"
                    val stateStr = when (activeCall.state) {
                        android.telecom.Call.STATE_RINGING -> "RINGING"
                        android.telecom.Call.STATE_ACTIVE -> "ACTIVE"
                        android.telecom.Call.STATE_HOLDING -> "HOLDING"
                        else -> "ACTIVE"
                    }
                    val js = JSObject().apply {
                        put("phoneNumber", phone)
                        put("callerName", name)
                        put("timestamp", System.currentTimeMillis())
                        put("isScreeningActive", AegisInCallService.isScreeningActive)
                        put("callState", stateStr)
                    }
                    plugin.notifyListeners("callRestored", js, true)
                }
            }
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    // --- DIALER / PHONE APP ROLE ---

    @PluginMethod
    fun checkDialerRole(call: PluginCall) {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
        val isDefaultDialer = telecomManager?.defaultDialerPackage == context.packageName

        val ret = JSObject().apply {
            put("isDefaultDialer", isDefaultDialer)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun requestDialerRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                    val ret = JSObject().apply {
                        put("success", true)
                        put("message", "AegisCall is already default Phone app")
                    }
                    call.resolve(ret)
                    return
                }
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                startActivityForResult(call, intent, "handleDialerRoleResult")
                return
            }
        }

        // Fallback for Android 9 and below
        val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
            putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
        }
        startActivityForResult(call, intent, "handleDialerRoleResult")
    }

    @ActivityCallback
    fun handleDialerRoleResult(call: PluginCall, result: ActivityResult) {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
        val isDefault = telecomManager?.defaultDialerPackage == context.packageName

        val ret = JSObject().apply {
            put("success", isDefault)
            put("granted", isDefault)
        }
        call.resolve(ret)
    }

    // --- LIVE CALL CONTROLS (IN-CALL PHONE SERVICE) ---

    @PluginMethod
    fun answerCall(call: PluginCall) {
        AegisInCallService.answerCall()
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun rejectCall(call: PluginCall) {
        AegisInCallService.rejectCall()
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun screenCallWithAi(call: PluginCall) {
        val language = call.getString("language") ?: "auto"
        val enableBotVoice = call.getBoolean("enableBotVoice", true) ?: true
        AegisInCallService.startAiScreening(language, enableBotVoice)
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun setAiVoicePersona(call: PluginCall) {
        val persona = call.getString("persona") ?: "female"
        com.aegiscall.screener.telecom.AiVoiceScreeningEngine.setVoicePersona(persona)
        val ret = JSObject().apply { put("success", true); put("persona", persona) }
        call.resolve(ret)
    }

    @PluginMethod
    fun startSilentCallListener(call: PluginCall) {
        val language = call.getString("language") ?: "auto"
        AegisInCallService.startAiScreening(language, false)
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun sendAiReply(call: PluginCall) {
        val replyText = call.getString("replyText")
        if (!replyText.isNullOrBlank()) {
            AegisInCallService.sendQuickReply(replyText)
            val ret = JSObject().apply { put("success", true) }
            call.resolve(ret)
        } else {
            call.reject("replyText is required")
        }
    }

    @PluginMethod
    fun pickupCall(call: PluginCall) {
        AegisInCallService.pickupCall()
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun setMuted(call: PluginCall) {
        val muted = call.getBoolean("muted", false) ?: false
        AegisInCallService.setMuted(muted)
        val ret = JSObject().apply { put("success", true); put("muted", muted) }
        call.resolve(ret)
    }

    @PluginMethod
    fun setSpeakerphone(call: PluginCall) {
        val speakerOn = call.getBoolean("speakerOn", false) ?: false
        AegisInCallService.setSpeakerphone(speakerOn)
        val ret = JSObject().apply { put("success", true); put("speakerOn", speakerOn) }
        call.resolve(ret)
    }

    @PluginMethod
    fun playDtmfTone(call: PluginCall) {
        val toneStr = call.getString("digit") ?: "0"
        val digit = toneStr.firstOrNull() ?: '0'
        AegisInCallService.playDtmfTone(digit)
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun stopDtmfTone(call: PluginCall) {
        AegisInCallService.stopDtmfTone()
        val ret = JSObject().apply { put("success", true) }
        call.resolve(ret)
    }

    @PluginMethod
    fun holdCall(call: PluginCall) {
        val hold = call.getBoolean("hold", false) ?: false
        AegisInCallService.holdCall(hold)
        val ret = JSObject().apply { put("success", true); put("hold", hold) }
        call.resolve(ret)
    }

    @PluginMethod
    fun startCallRecording(call: PluginCall) {
        val phone = call.getString("phoneNumber")
            ?: AegisInCallService.activeCall?.details?.handle?.schemeSpecificPart
            ?: "Unknown"
        val started = CallRecorderManager.startRecording(context, phone)
        val ret = JSObject().apply {
            put("success", started)
            put("isRecording", started)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun stopCallRecording(call: PluginCall) {
        val savedPath = CallRecorderManager.stopRecording(context)
        val ret = JSObject().apply {
            put("success", true)
            put("isRecording", false)
            put("filePath", savedPath ?: "")
            put("savedTo", "Recordings/Music")
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun isCallRecording(call: PluginCall) {
        val ret = JSObject().apply {
            put("isRecording", CallRecorderManager.isRecording)
            put("durationSeconds", CallRecorderManager.getRecordingDurationSeconds())
            put("amplitude", CallRecorderManager.getRecordingAmplitude())
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun getRecordedCalls(call: PluginCall) {
        try {
            val recordings = CallRecorderManager.getSavedRecordings(context)
            val arr = JSArray()
            for (item in recordings) {
                val obj = JSObject().apply {
                    put("id", item.id)
                    put("fileName", item.fileName)
                    put("phoneNumber", item.phoneNumber)
                    put("filePath", item.filePath)
                    put("timestamp", item.timestamp)
                    put("durationSeconds", item.durationSeconds)
                    put("fileSizeBytes", item.fileSizeBytes)
                }
                arr.put(obj)
            }
            val ret = JSObject().apply {
                put("success", true)
                put("recordings", arr)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to list recordings: ${e.message}")
        }
    }

    @PluginMethod
    fun deleteRecordedCall(call: PluginCall) {
        val filePath = call.getString("filePath")
        if (!filePath.isNullOrBlank()) {
            val deleted = CallRecorderManager.deleteRecording(context, filePath)
            val ret = JSObject().apply {
                put("success", deleted)
                put("deleted", deleted)
            }
            call.resolve(ret)
        } else {
            call.reject("filePath is required")
        }
    }

    @PluginMethod
    fun saveCustomGreeting(call: PluginCall) {
        val base64 = call.getString("audioBase64")
        if (!base64.isNullOrBlank()) {
            val saved = com.aegiscall.screener.telecom.CustomGreetingManager.saveGreetingFromBase64(context, base64)
            val ret = JSObject().apply { put("success", saved) }
            call.resolve(ret)
        } else {
            call.reject("audioBase64 is required")
        }
    }

    @PluginMethod
    fun getCustomGreeting(call: PluginCall) {
        val hasGreeting = com.aegiscall.screener.telecom.CustomGreetingManager.hasCustomGreeting(context)
        val duration = com.aegiscall.screener.telecom.CustomGreetingManager.getGreetingDurationSeconds(context)
        val file = com.aegiscall.screener.telecom.CustomGreetingManager.getGreetingFile(context)
        val ret = JSObject().apply {
            put("hasGreeting", hasGreeting)
            put("durationSeconds", duration)
            put("filePath", if (hasGreeting) file.absolutePath else "")
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun deleteCustomGreeting(call: PluginCall) {
        val deleted = com.aegiscall.screener.telecom.CustomGreetingManager.deleteGreeting(context)
        val ret = JSObject().apply { put("success", deleted) }
        call.resolve(ret)
    }

    @PluginMethod
    fun setScreeningMode(call: PluginCall) {
        val mode = call.getString("mode") ?: "AI_ASSISTANT"
        com.aegiscall.screener.telecom.CustomGreetingManager.activeScreeningMode = mode
        val ret = JSObject().apply { put("success", true); put("mode", mode) }
        call.resolve(ret)
    }

    @PluginMethod
    fun getScreeningMode(call: PluginCall) {
        val mode = com.aegiscall.screener.telecom.CustomGreetingManager.activeScreeningMode
        val ret = JSObject().apply { put("mode", mode) }
        call.resolve(ret)
    }

    @PluginMethod
    fun getCurrentCall(call: PluginCall) {
        val activeCall = AegisInCallService.activeCall
        val ret = JSObject()
        if (activeCall != null) {
            val phone = activeCall.details.handle?.schemeSpecificPart ?: "Unknown"
            val name = activeCall.details.callerDisplayName ?: "Unknown Caller"
            val stateStr = when (activeCall.state) {
                android.telecom.Call.STATE_RINGING -> "RINGING"
                android.telecom.Call.STATE_ACTIVE -> "ACTIVE"
                android.telecom.Call.STATE_HOLDING -> "HOLDING"
                android.telecom.Call.STATE_DIALING -> "DIALING"
                android.telecom.Call.STATE_CONNECTING -> "CONNECTING"
                else -> "ACTIVE"
            }
            ret.put("hasActiveCall", true)
            ret.put("phoneNumber", phone)
            ret.put("callerName", name)
            ret.put("callState", stateStr)
            ret.put("isScreeningActive", AegisInCallService.isScreeningActive)
        } else {
            ret.put("hasActiveCall", false)
            ret.put("isScreeningActive", false)
        }
        call.resolve(ret)
    }

    // --- CALL SCREENING ROLE (METADATA FILTER) ---

    @PluginMethod
    fun checkScreeningRole(call: PluginCall) {
        val ret = JSObject()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            val isHeld = roleManager?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) ?: false
            ret.put("roleGranted", isHeld)
            ret.put("isDefaultScreener", isHeld)
        } else {
            ret.put("roleGranted", true)
            ret.put("isDefaultScreener", true)
        }

        call.resolve(ret)
    }

    @PluginMethod
    fun requestScreeningRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                call.reject("RoleManager.ROLE_CALL_SCREENING is not available on this device")
                return
            }

            if (roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                val ret = JSObject()
                ret.put("success", true)
                ret.put("message", "Role is already held")
                call.resolve(ret)
                return
            }

            val intent: Intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
            startActivityForResult(call, intent, "handleRoleResult")
        } else {
            val ret = JSObject()
            ret.put("success", true)
            ret.put("message", "Legacy Android version (Pre-Android 10)")
            call.resolve(ret)
        }
    }

    @ActivityCallback
    fun handleRoleResult(call: PluginCall, result: ActivityResult) {
        val ret = JSObject()
        if (result.resultCode == Activity.RESULT_OK) {
            ret.put("success", true)
            ret.put("granted", true)
        } else {
            ret.put("success", false)
            ret.put("granted", false)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun getScreenedCalls(call: PluginCall) {
        val calls = CallHistoryStorage.getCalls(context)
        val jsArray = JSArray()

        for (item in calls) {
            val js = JSObject().apply {
                put("id", item.id)
                put("phoneNumber", item.phoneNumber)
                put("callerName", item.callerName)
                put("verdict", item.verdict)
                put("riskScore", item.riskScore)
                put("riskLevel", item.riskLevel)
                put("category", item.category)
                put("confidence", item.confidence)
                put("rationale", item.rationale)
                put("engine", item.engine)
                put("latencyMs", item.latencyMs)
                put("timestamp", item.timestamp)

                val actions = JSObject().apply {
                    put("disallowCall", item.suggestedActions.disallowCall)
                    put("silenceCall", item.suggestedActions.silenceCall)
                    put("rejectCall", item.suggestedActions.rejectCall)
                    put("skipCallLog", item.suggestedActions.skipCallLog)
                    put("skipNotification", item.suggestedActions.skipNotification)
                }
                put("suggestedActions", actions)
            }
            jsArray.put(js)
        }

        val ret = JSObject()
        ret.put("calls", jsArray)
        call.resolve(ret)
    }

    @PluginMethod
    fun clearScreenedCalls(call: PluginCall) {
        CallHistoryStorage.clearCalls(context)
        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun openDefaultAppsSettings(call: PluginCall) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
            } else {
                Intent(Settings.ACTION_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                val ret = JSObject()
                ret.put("success", true)
                call.resolve(ret)
            } catch (err: Exception) {
                call.reject("Could not open settings: ${err.message}")
            }
        }
    }

    @PluginMethod
    fun getNativeScreenerConfig(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val url = prefs.getString(KEY_API_URL, "http://10.0.2.2:4000") ?: "http://10.0.2.2:4000"

        val ret = JSObject()
        ret.put("backendUrl", url)
        ret.put("fastRulesActive", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun setNativeScreenerConfig(call: PluginCall) {
        val url = call.getString("backendUrl")
        if (url.isNullOrBlank()) {
            call.reject("backendUrl is required")
            return
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_API_URL, url).apply()

        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    // --- CONTACTS ---

    @PluginMethod
    fun getContacts(call: PluginCall) {
        try {
            val cr: ContentResolver = context.contentResolver
            val cursor = cr.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID
                ),
                null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            )
            val arr = JSArray()
            val seen = mutableSetOf<String>()
            cursor?.use {
                val nameIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numIdx  = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val idIdx   = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                while (it.moveToNext()) {
                    val name   = it.getString(nameIdx) ?: "Unknown"
                    val number = it.getString(numIdx)?.replace("\\s".toRegex(), "") ?: continue
                    val id     = it.getString(idIdx) ?: ""
                    val key    = "${name}::${number}"
                    if (seen.add(key)) {
                        arr.put(JSObject().apply {
                            put("id", id)
                            put("name", name)
                            put("number", number)
                        })
                    }
                }
            }
            call.resolve(JSObject().apply { put("contacts", arr) })
        } catch (e: Exception) {
            call.reject("Failed to read contacts: ${e.message}")
        }
    }

    // --- DEVICE CALL LOG ---

    @PluginMethod
    fun getDeviceCallLog(call: PluginCall) {
        try {
            val limit = call.getInt("limit", 100) ?: 100
            val cr: ContentResolver = context.contentResolver
            val cursor = cr.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION
                ),
                null, null,
                CallLog.Calls.DATE + " DESC LIMIT $limit"
            )
            val arr = JSArray()
            cursor?.use {
                val numIdx  = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
                val durIdx  = it.getColumnIndex(CallLog.Calls.DURATION)
                while (it.moveToNext()) {
                    val callType = when (it.getInt(typeIdx)) {
                        CallLog.Calls.INCOMING_TYPE  -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE  -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE    -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE  -> "REJECTED"
                        else -> "UNKNOWN"
                    }
                    arr.put(JSObject().apply {
                        put("number",   it.getString(numIdx) ?: "")
                        put("name",     it.getString(nameIdx) ?: "")
                        put("type",     callType)
                        put("date",     it.getLong(dateIdx))
                        put("duration", it.getLong(durIdx))
                    })
                }
            }
            call.resolve(JSObject().apply { put("calls", arr) })
        } catch (e: Exception) {
            call.reject("Failed to read call log: ${e.message}")
        }
    }

    // --- MAKE OUTGOING CALL ---

    @PluginMethod
    fun makeCall(call: PluginCall) {
        val number = call.getString("number")
        if (number.isNullOrBlank()) {
            call.reject("number is required")
            return
        }
        try {
            val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            // Fallback: open dialer with number pre-filled
            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(dialIntent)
            call.resolve(JSObject().apply { put("success", true) })
        }
    }
}
