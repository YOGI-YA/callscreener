package com.aegiscall.screener.plugins

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.activity.result.ActivityResult
import com.aegiscall.screener.models.ScreeningData
import com.aegiscall.screener.telecom.AegisInCallService
import com.aegiscall.screener.telecom.CallHistoryStorage
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
        AegisInCallService.startAiScreening(language)
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
}
