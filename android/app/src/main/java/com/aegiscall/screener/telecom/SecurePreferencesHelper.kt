package com.aegiscall.screener.telecom

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * SecurePreferencesHelper
 * Cryptographically secures sensitive configuration (API keys, emergency safe-words,
 * webhook URLs) using hardware-backed Android KeyStore and AES-256-GCM.
 */
class SecurePreferencesHelper(private val context: Context) {
    private val tag = "SecurePrefs"
    private val keyAlias = "AegisCallMasterKey"
    private val prefName = "aegis_secure_prefs"
    private val prefs: SharedPreferences = context.getSharedPreferences(prefName, Context.MODE_PRIVATE)

    init {
        ensureMasterKey()
    }

    private fun ensureMasterKey() {
        try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            if (!keyStore.containsAlias(keyAlias)) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    "AndroidKeyStore"
                )
                val spec = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()

                keyGenerator.init(spec)
                keyGenerator.generateKey()
                Log.i(tag, "Generated hardware-backed master key in AndroidKeyStore")
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to ensure master key in KeyStore", e)
        }
    }

    private fun getSecretKey(): SecretKey? {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return keyStore.getKey(keyAlias, null) as? SecretKey
    }

    /**
     * Encrypts plaintext string using AES-256-GCM and stores base64 payload
     */
    fun putSecureString(key: String, value: String): Boolean {
        return try {
            val secretKey = getSecretKey() ?: return false
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)

            val iv = cipher.iv
            val cipherBytes = cipher.doFinal(value.toByteArray(Charsets.UTF_8))

            // Pack IV (12 bytes) + CipherText
            val combined = ByteArray(iv.size + cipherBytes.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(cipherBytes, 0, combined, iv.size, cipherBytes.size)

            val encoded = Base64.encodeToString(combined, Base64.NO_WRAP)
            prefs.edit().putString(key, encoded).apply()
            true
        } catch (e: Exception) {
            Log.e(tag, "Failed to encrypt key: $key", e)
            false
        }
    }

    /**
     * Decrypts AES-256-GCM stored payload from SharedPreferences
     */
    fun getSecureString(key: String, defaultValue: String? = null): String? {
        val encoded = prefs.getString(key, null) ?: return defaultValue
        return try {
            val secretKey = getSecretKey() ?: return defaultValue
            val combined = Base64.decode(encoded, Base64.NO_WRAP)
            if (combined.size < 12) return defaultValue

            val iv = ByteArray(12)
            val cipherBytes = ByteArray(combined.size - 12)
            System.arraycopy(combined, 0, iv, 0, 12)
            System.arraycopy(combined, 12, cipherBytes, 0, cipherBytes.size)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

            val decrypted = cipher.doFinal(cipherBytes)
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(tag, "Failed to decrypt key: $key", e)
            defaultValue
        }
    }
}
