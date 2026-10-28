package com.aegiscall.screener.telecom

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * BatteryOptimizationHelper
 * Provides queries and intents for Android battery optimization whitelist exemption.
 * Necessary for call screening apps to avoid being placed in Android "Restricted" standby
 * buckets after 24-48 hours of background operation.
 */
object BatteryOptimizationHelper {
    private const val TAG = "BatteryOptimizationHelper"

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val packageName = context.packageName
            powerManager?.isIgnoringBatteryOptimizations(packageName) ?: false
        } catch (e: Exception) {
            Log.w(TAG, "Error checking battery optimization status: ${e.message}")
            false
        }
    }

    @SuppressLint("BatteryLife")
    fun createIgnoreBatteryOptimizationIntent(context: Context): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null
        return try {
            val packageName = context.packageName
            if (isIgnoringBatteryOptimizations(context)) {
                // If already ignored, open general battery settings
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            } else {
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error building battery optimization intent: ${e.message}")
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        }
    }
}
