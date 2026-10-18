package org.nuanban.assistant.nativehost

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class NativeChallenge(val id: String, val nonce: String, val expiresAtMs: Long)
data class NativeSession(val accountId: String, val deviceId: String, val accessToken: String, val refreshToken: String, val accessExpiresAtMs: Long, val refreshExpiresAtMs: Long)
interface NativeAuthTransport { fun exchange(challengeId: String, signature: String): NativeSession }

class NativeDeviceAuth(private val vault: EncryptedVault, private val transport: NativeAuthTransport? = null, private val now: () -> Long = System::currentTimeMillis) {
    private var generation = 0L
    private val consumed = linkedSetOf<String>()
    private var accountId: String? = null
    private var deviceId: String? = null

    @Synchronized fun provision(account: String, device: String, secret: ByteArray, userConfirmed: Boolean) {
        require(userConfirmed && account.matches(Regex("[a-z0-9-]{1,64}")) && device.matches(Regex("[A-Za-z0-9-]{1,80}")) && secret.size in 32..256)
        forget()
        vault.write(account, "device-secret", secret)
        accountId = account
        deviceId = device
    }

    fun authenticate(challenge: NativeChallenge, userConfirmed: Boolean): Boolean {
        val request: Triple<Long, String, String>
        val signature: String
        synchronized(this) {
            val remote = transport ?: return false
            require(userConfirmed && challenge.id.matches(Regex("[A-Za-z0-9-]{1,80}")) && challenge.nonce.matches(Regex("[A-Za-z0-9_-]{16,256}")))
            require(challenge.expiresAtMs > now() && challenge.expiresAtMs - now() <= 120_000 && challenge.id !in consumed && consumed.size < 1024)
            val account = accountId ?: return false
            val device = deviceId ?: return false
            consumed.add(challenge.id)
            request = Triple(generation, account, device)
            val secret = vault.read(account, "device-secret") ?: return false
            try {
                val mac = Mac.getInstance("HmacSHA256")
                mac.init(SecretKeySpec(secret, "HmacSHA256"))
                signature = mac.doFinal(challenge.nonce.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
            } finally { secret.fill(0) }
            check(remote === transport)
        }
        val session = transport!!.exchange(challenge.id, signature)
        synchronized(this) {
            if (generation != request.first || accountId != request.second || deviceId != request.third || challenge.expiresAtMs <= now()) return false
            require(session.accountId == accountId && session.deviceId == deviceId && session.accessExpiresAtMs > now() && session.refreshExpiresAtMs >= session.accessExpiresAtMs)
            require(session.accessToken.length in 16..4096 && session.refreshToken.length in 16..4096 && !session.accessToken.contains('\n') && !session.refreshToken.contains('\n'))
            val encoded = listOf(session.accessExpiresAtMs, session.refreshExpiresAtMs, session.accessToken, session.refreshToken).joinToString("\n").toByteArray(Charsets.UTF_8)
            try { vault.write(request.second, "session", encoded) } finally { encoded.fill(0) }
            return true
        }
    }

    @Synchronized fun status(): String = if (transport == null) "transport_unavailable" else if (accountId == null) "binding_required" else "native_auth_available_requires_consent"
    @Synchronized fun cancel() { generation += 1 }
    @Synchronized fun forget() {
        cancel()
        accountId?.let { vault.remove(it, "session"); vault.remove(it, "device-secret") }
        accountId = null
        deviceId = null
    }
}
