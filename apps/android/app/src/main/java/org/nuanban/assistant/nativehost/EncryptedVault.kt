package org.nuanban.assistant.nativehost

import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class EncryptedVault(private val root: File, private val key: (Boolean) -> SecretKey?) {
    @Synchronized fun write(account: String, slot: String, plaintext: ByteArray) {
        require(plaintext.size in 1..16_384)
        val destination = location(account, slot)
        require(root.isDirectory || root.mkdirs())
        root.setReadable(false, false); root.setReadable(true, true)
        root.setWritable(false, false); root.setWritable(true, true)
        root.setExecutable(false, false); root.setExecutable(true, true)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, requireNotNull(key(true)))
        require(cipher.iv.size == 12)
        cipher.updateAAD(aad(account, slot))
        val encrypted = byteArrayOf(1) + cipher.iv + cipher.doFinal(plaintext)
        val temporary = File.createTempFile("vault-", ".tmp", root)
        try {
            temporary.setReadable(false, false); temporary.setReadable(true, true)
            temporary.setWritable(false, false); temporary.setWritable(true, true)
            FileOutputStream(temporary).use { stream -> stream.write(encrypted); stream.fd.sync() }
            Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { temporary.delete(); encrypted.fill(0) }
    }

    @Synchronized fun read(account: String, slot: String): ByteArray? {
        val source = location(account, slot)
        if (!source.exists()) return null
        require(source.length() in 30..16_413)
        val encrypted = source.readBytes()
        try {
            require(encrypted[0] == 1.toByte())
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, requireNotNull(key(false)), GCMParameterSpec(128, encrypted.copyOfRange(1, 13)))
            cipher.updateAAD(aad(account, slot))
            return cipher.doFinal(encrypted, 13, encrypted.size - 13)
        } finally { encrypted.fill(0) }
    }

    @Synchronized fun remove(account: String, slot: String) {
        val target = location(account, slot)
        check(!target.exists() || target.delete())
    }

    private fun location(account: String, slot: String): File {
        require(account.matches(Regex("[a-z0-9-]{1,64}")) && slot.matches(Regex("[a-z0-9-]{1,32}")))
        val name = MessageDigest.getInstance("SHA-256").digest(aad(account, slot)).joinToString("") { "%02x".format(it.toInt() and 255) }
        return File(root, "$name.bin")
    }
    private fun aad(account: String, slot: String) = "nuanban-v1|$account|$slot".toByteArray(Charsets.UTF_8)
}
