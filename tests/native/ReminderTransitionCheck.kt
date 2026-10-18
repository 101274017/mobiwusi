@file:JvmName("ReminderTransitionCheck")

package org.nuanban.nativelab

import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

private enum class ReminderStatus {
    SCHEDULED,
    SUBMITTED,
    DELIVERED,
    OPENED,
    FAILED,
    MISSED,
    UNKNOWN,
    CANCELLED,
}

private data class ReminderKey(val accountId: String, val instanceId: String)

private data class ReminderRow(
    val accountId: String,
    val reminderId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val dueAtEpochMs: Long,
    val status: ReminderStatus = ReminderStatus.SCHEDULED,
    val submittedAt: Long? = null,
    val deliveredAt: Long? = null,
    val openedAt: Long? = null,
    val failedAt: Long? = null,
    val missedAt: Long? = null,
    val unknownAt: Long? = null,
    val completedAt: Long? = null,
    val clickToken: String? = null,
    val updatedAt: Long = 0,
)

private data class DueSubmission(val entity: ReminderRow, val claimed: Boolean)

private class TransitionRejected(message: String) : IllegalStateException(message)

private class ReminderStoreModel(private val newClickToken: () -> String) {
    private val transactionLock = Any()
    private val rows = linkedMapOf<ReminderKey, ReminderRow>()

    fun insert(row: ReminderRow) {
        synchronized(transactionLock) {
            rows[ReminderKey(row.accountId, row.instanceId)] = row
        }
    }

    fun find(accountId: String, instanceId: String): ReminderRow? = synchronized(transactionLock) {
        rows[ReminderKey(accountId, instanceId)]
    }

    fun claimDue(accountId: String, reminderId: String, nowEpochMs: Long, observedAt: Long, instanceId: String? = null): DueSubmission? = synchronized(transactionLock) {
        val existing = latestByReminderId(accountId, reminderId)
        if (instanceId != null && existing != null && existing.instanceId != instanceId) return@synchronized null
        if (existing != null && existing.status in setOf(ReminderStatus.SUBMITTED, ReminderStatus.DELIVERED, ReminderStatus.OPENED) && existing.submittedAt != null) {
            return@synchronized DueSubmission(existing, false)
        }

        val current = listDue(accountId, nowEpochMs).firstOrNull { it.reminderId == reminderId && (instanceId == null || it.instanceId == instanceId) }
            ?: return@synchronized null
        val next = current.copy(
            status = ReminderStatus.SUBMITTED,
            submittedAt = current.submittedAt ?: observedAt,
            updatedAt = observedAt,
            clickToken = current.clickToken ?: newClickToken(),
        )
        put(next)
        DueSubmission(next, true)
    }

    fun rollbackDueSubmission(accountId: String, reminderId: String, submittedAt: Long, updatedAt: Long): ReminderRow? = synchronized(transactionLock) {
        val current = latestByReminderId(accountId, reminderId)
            ?: return@synchronized null
        if (current.status != ReminderStatus.SUBMITTED || current.submittedAt != submittedAt) return@synchronized null
        val next = current.copy(
            status = ReminderStatus.SCHEDULED,
            submittedAt = null,
            updatedAt = updatedAt,
        )
        put(next)
        next
    }

    fun recordReceipt(accountId: String, todoId: String, instanceId: String, scheduleVersion: Long, state: ReminderStatus, observedAt: Long): ReminderRow = synchronized(transactionLock) {
        val current = rows[ReminderKey(accountId, instanceId)]
            ?: reject("提醒实例不存在。")
        val latest = latestByTodo(accountId, todoId)
        if (current.todoId != todoId || current.scheduleVersion != scheduleVersion || latest?.instanceId != current.instanceId || latest.scheduleVersion != scheduleVersion) {
            reject("提醒回执的排程版本已过期。")
        }
        if (current.completedAt != null || current.status == ReminderStatus.CANCELLED) {
            reject("已取消或完成的提醒不能继续写入回执。")
        }
        val latestReceiptAt = listOfNotNull(
            current.submittedAt,
            current.deliveredAt,
            current.openedAt,
            current.failedAt,
            current.missedAt,
            current.unknownAt,
        ).maxOrNull()
        if (latestReceiptAt != null && observedAt < latestReceiptAt) {
            reject("回执时间不能早于已记录的回执。")
        }
        if (state == current.status) return@synchronized current
        if (current.status in setOf(ReminderStatus.FAILED, ReminderStatus.MISSED, ReminderStatus.UNKNOWN, ReminderStatus.OPENED)) {
            reject("终止回执不能被后续状态覆盖。")
        }
        when (state) {
            ReminderStatus.SUBMITTED -> if (current.status != ReminderStatus.SCHEDULED) reject("submitted 只能从 scheduled 产生。")
            ReminderStatus.DELIVERED -> if (current.status != ReminderStatus.SUBMITTED) reject("delivered 必须先有 submitted。")
            ReminderStatus.OPENED -> if (current.status != ReminderStatus.DELIVERED) reject("opened 必须先有 delivered。")
            ReminderStatus.FAILED,
            ReminderStatus.MISSED,
            ReminderStatus.UNKNOWN -> Unit
            ReminderStatus.SCHEDULED,
            ReminderStatus.CANCELLED,
            -> reject("不支持的提醒回执状态。")
        }
        val next = when (state) {
            ReminderStatus.SUBMITTED -> current.copy(status = state, submittedAt = observedAt, updatedAt = observedAt)
            ReminderStatus.DELIVERED -> current.copy(status = state, deliveredAt = observedAt, updatedAt = observedAt)
            ReminderStatus.OPENED -> current.copy(status = state, openedAt = observedAt, updatedAt = observedAt)
            ReminderStatus.FAILED -> current.copy(status = state, failedAt = observedAt, updatedAt = observedAt)
            ReminderStatus.MISSED -> current.copy(status = state, missedAt = observedAt, updatedAt = observedAt)
            ReminderStatus.UNKNOWN -> current.copy(status = state, unknownAt = observedAt, updatedAt = observedAt)
            ReminderStatus.SCHEDULED,
            ReminderStatus.CANCELLED,
            -> reject("不支持的提醒回执状态。")
        }
        put(next)
        next
    }

    private fun listDue(accountId: String, nowEpochMs: Long): List<ReminderRow> = rows.values
        .filter { current ->
            current.accountId == accountId &&
                current.status == ReminderStatus.SCHEDULED &&
                current.completedAt == null &&
                current.dueAtEpochMs <= nowEpochMs &&
                rows.values.none { newer ->
                    newer.accountId == current.accountId &&
                        newer.todoId == current.todoId &&
                        newer.scheduleVersion > current.scheduleVersion
                }
        }
        .sortedWith(compareBy<ReminderRow> { it.dueAtEpochMs }.thenBy { it.instanceId })

    private fun latestByReminderId(accountId: String, reminderId: String): ReminderRow? = rows.values
        .filter { it.accountId == accountId && it.reminderId == reminderId }
        .maxWithOrNull(compareBy<ReminderRow> { it.scheduleVersion }.thenBy { it.updatedAt }.thenBy { it.instanceId })

    private fun latestByTodo(accountId: String, todoId: String): ReminderRow? = rows.values
        .filter { it.accountId == accountId && it.todoId == todoId }
        .maxWithOrNull(compareBy<ReminderRow> { it.scheduleVersion }.thenBy { it.updatedAt }.thenBy { it.instanceId })

    private fun put(row: ReminderRow) {
        rows[ReminderKey(row.accountId, row.instanceId)] = row
    }

    private fun reject(message: String): Nothing = throw TransitionRejected(message)
}

private class ActivityLifecycleModel {
    private val lifecycleLock = Any()
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val pendingUiReplies = ArrayDeque<() -> Unit>()
    val events = CopyOnWriteArrayList<String>()
    val destroyMarked = CountDownLatch(1)
    @Volatile private var destroyed = false
    @Volatile private var databaseClosed = false

    fun submit(name: String, work: () -> Unit): Future<Boolean>? = try {
        executor.submit(Callable {
            synchronized(lifecycleLock) {
                if (destroyed) {
                    events += "$name:rejected"
                    false
                } else {
                    check(!databaseClosed) { "database closed before operation" }
                    events += "$name:start"
                    work()
                    events += "$name:finish"
                    true
                }
            }
        })
    } catch (_: RejectedExecutionException) {
        null
    }

    fun queueUiReply(reply: () -> Unit) {
        if (destroyed) return
        synchronized(lifecycleLock) {
            if (!destroyed) pendingUiReplies.addLast(reply)
        }
    }

    fun flushUiReplies() {
        val replies = synchronized(lifecycleLock) {
            buildList {
                while (pendingUiReplies.isNotEmpty()) add(pendingUiReplies.removeFirst())
            }
        }
        replies.forEach { reply ->
            if (!destroyed) reply()
        }
    }

    fun destroy() {
        destroyed = true
        events += "destroy:marked"
        destroyMarked.countDown()
        synchronized(lifecycleLock) {
            executor.shutdownNow()
            databaseClosed = true
            events += "database:closed"
        }
    }

    fun isDatabaseClosed(): Boolean = databaseClosed
}

private class TokenSequence {
    var issued = 0
        private set

    fun next(): String {
        issued += 1
        return "generated-token-$issued"
    }
}

private val completed = mutableListOf<String>()

private fun scenario(name: String, verify: () -> Unit) {
    verify()
    completed += name
}

private fun reminder(
    accountId: String = "owner-1",
    reminderId: String = "reminder-1",
    todoId: String = "todo-1",
    instanceId: String = "instance-1",
    scheduleVersion: Long = 1,
    dueAtEpochMs: Long = 100,
    clickToken: String? = "legacy-token",
    updatedAt: Long = 0,
) = ReminderRow(
    accountId = accountId,
    reminderId = reminderId,
    todoId = todoId,
    instanceId = instanceId,
    scheduleVersion = scheduleVersion,
    dueAtEpochMs = dueAtEpochMs,
    clickToken = clickToken,
    updatedAt = updatedAt,
)

private fun expectRejected(name: String, action: () -> Unit) {
    val failure = runCatching(action).exceptionOrNull()
    check(failure is TransitionRejected) { "$name should reject, got ${failure?.javaClass?.simpleName ?: "success"}" }
}

private fun await(latch: CountDownLatch, name: String) {
    check(latch.await(2, TimeUnit.SECONDS)) { "$name did not reach its synchronization point" }
}

private fun await(future: Future<*>, name: String): Any? = try {
    future.get(2, TimeUnit.SECONDS)
} finally {
    if (!future.isDone) future.cancel(true)
}

fun main() {
    scenario("claimDue atomically grants one owner under concurrent alarms") {
        val tokens = TokenSequence()
        val store = ReminderStoreModel(tokens::next)
        store.insert(reminder())
        val barrier = CyclicBarrier(2)
        val executor = Executors.newFixedThreadPool(2)
        val futures = listOf(110L, 111L).map { observedAt ->
            executor.submit<DueSubmission?> {
                barrier.await(2, TimeUnit.SECONDS)
                store.claimDue("owner-1", "reminder-1", 100, observedAt)
            }
        }
        val results = futures.map { await(it, "concurrent claim") as DueSubmission? }
        executor.shutdownNow()
        check(results.count { it?.claimed == true } == 1) { "exactly one claim must own the transition" }
        check(results.all { it != null }) { "a duplicate alarm must observe the existing submission" }
        check(results.mapNotNull { it?.entity?.clickToken }.distinct() == listOf("legacy-token")) { "the existing click token must be reused" }
        check(tokens.issued == 0) { "an existing token must not be replaced" }
    }

    scenario("duplicate claim reuses the old token and preserves its submission timestamp") {
        val store = ReminderStoreModel { "unexpected-token" }
        store.insert(reminder(clickToken = "old-token"))
        val first = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 110))
        val duplicate = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 220))
        check(first.claimed)
        check(!duplicate.claimed)
        check(duplicate.entity.clickToken == "old-token")
        check(duplicate.entity.submittedAt == 110L)
    }

    scenario("missing click token is generated once and survives rollback retry") {
        val tokens = TokenSequence()
        val store = ReminderStoreModel(tokens::next)
        store.insert(reminder(clickToken = null))
        val first = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 110))
        val token = checkNotNull(first.entity.clickToken)
        check(first.claimed)
        check(tokens.issued == 1)
        val rolledBack = checkNotNull(store.rollbackDueSubmission("owner-1", "reminder-1", 110, 120))
        check(rolledBack.status == ReminderStatus.SCHEDULED)
        check(rolledBack.submittedAt == null)
        check(rolledBack.clickToken == token)
        val retry = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 130))
        check(retry.claimed)
        check(retry.entity.clickToken == token)
        check(tokens.issued == 1)
    }

    scenario("rollback is guarded by ownership, timestamp, and current status") {
        val store = ReminderStoreModel { "generated-token-1" }
        store.insert(reminder())
        val owner = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 110))
        val duplicate = checkNotNull(store.claimDue("owner-1", "reminder-1", 100, 111))
        check(!duplicate.claimed)
        if (duplicate.claimed) store.rollbackDueSubmission("owner-1", "reminder-1", 111, 112)
        check(store.find("owner-1", "instance-1")?.status == ReminderStatus.SUBMITTED)
        check(store.rollbackDueSubmission("owner-1", "reminder-1", 999, 120) == null)
        val delivered = store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.DELIVERED, 130)
        check(delivered.status == ReminderStatus.DELIVERED)
        check(store.rollbackDueSubmission("owner-1", "reminder-1", checkNotNull(owner.entity.submittedAt), 140) == null)
        check(store.find("owner-1", "instance-1")?.status == ReminderStatus.DELIVERED)
    }

    scenario("claimDue excludes superseded schedule versions and other accounts") {
        val store = ReminderStoreModel { "generated-token-1" }
        store.insert(reminder(instanceId = "instance-v1", scheduleVersion = 1, clickToken = "v1-token"))
        store.insert(reminder(instanceId = "instance-v2", scheduleVersion = 2, dueAtEpochMs = 200, clickToken = "v2-token", updatedAt = 2))
        check(store.claimDue("owner-1", "reminder-1", 150, 150) == null)
        check(store.claimDue("other-account", "reminder-1", 500, 500) == null)
        val current = checkNotNull(store.claimDue("owner-1", "reminder-1", 200, 210))
        check(current.claimed)
        check(current.entity.instanceId == "instance-v2")
    }

    scenario("a late alarm cannot claim a replacement instance") {
        val store = ReminderStoreModel { "generated-token-1" }
        store.insert(reminder(instanceId = "instance-v1", scheduleVersion = 1, dueAtEpochMs = 100, clickToken = "v1-token"))
        store.insert(reminder(instanceId = "instance-v2", scheduleVersion = 2, dueAtEpochMs = 200, clickToken = "v2-token", updatedAt = 2))
        check(store.claimDue("owner-1", "reminder-1", 500, 500, "instance-v1") == null)
        val current = checkNotNull(store.claimDue("owner-1", "reminder-1", 200, 510, "instance-v2"))
        check(current.claimed && current.entity.instanceId == "instance-v2")
    }

    scenario("receipt order and failure receipt fields remain terminal and monotonic") {
        val store = ReminderStoreModel { "generated-token-1" }
        store.insert(reminder())
        expectRejected("opened before submitted") {
            store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.OPENED, 90)
        }
        val submitted = store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.SUBMITTED, 100)
        check(submitted.status == ReminderStatus.SUBMITTED)
        expectRejected("delivered before the submitted timestamp") {
            store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.DELIVERED, 99)
        }
        val delivered = store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.DELIVERED, 110)
        check(delivered.status == ReminderStatus.DELIVERED)
        expectRejected("opened before the delivered timestamp") {
            store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.OPENED, 109)
        }
        val opened = store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.OPENED, 120)
        check(opened.status == ReminderStatus.OPENED)
        check(store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.OPENED, 121) == opened)
        expectRejected("delivered after opened") {
            store.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.DELIVERED, 130)
        }

        listOf(ReminderStatus.FAILED, ReminderStatus.MISSED, ReminderStatus.UNKNOWN).forEach { failureState ->
            val failureStore = ReminderStoreModel { "generated-token-1" }
            failureStore.insert(reminder())
            val failure = failureStore.recordReceipt("owner-1", "todo-1", "instance-1", 1, failureState, 200)
            check(failure.status == failureState)
            check(
                when (failureState) {
                    ReminderStatus.FAILED -> failure.failedAt == 200L && failure.missedAt == null && failure.unknownAt == null
                    ReminderStatus.MISSED -> failure.missedAt == 200L && failure.failedAt == null && failure.unknownAt == null
                    ReminderStatus.UNKNOWN -> failure.unknownAt == 200L && failure.failedAt == null && failure.missedAt == null
                    else -> false
                },
            )
            expectRejected("failure receipt timestamp moves backwards") {
                failureStore.recordReceipt("owner-1", "todo-1", "instance-1", 1, failureState, 199)
            }
            expectRejected("failure terminal state is not overwritten") {
                failureStore.recordReceipt("owner-1", "todo-1", "instance-1", 1, ReminderStatus.SUBMITTED, 201)
            }
            check(failureStore.recordReceipt("owner-1", "todo-1", "instance-1", 1, failureState, 201) == failure)
        }
    }

    scenario("receipt rejects a stale schedule version") {
        val store = ReminderStoreModel { "generated-token-1" }
        store.insert(reminder(instanceId = "instance-v1", scheduleVersion = 1, clickToken = "v1-token"))
        store.insert(reminder(instanceId = "instance-v2", scheduleVersion = 2, dueAtEpochMs = 200, clickToken = "v2-token", updatedAt = 2))
        expectRejected("receipt for superseded instance") {
            store.recordReceipt("owner-1", "todo-1", "instance-v1", 1, ReminderStatus.SUBMITTED, 210)
        }
        expectRejected("receipt for current instance with stale schedule version") {
            store.recordReceipt("owner-1", "todo-1", "instance-v2", 1, ReminderStatus.SUBMITTED, 210)
        }
        expectRejected("receipt from another account") {
            store.recordReceipt("other-account", "todo-1", "instance-v2", 2, ReminderStatus.SUBMITTED, 210)
        }
    }

    scenario("Activity destroy waits for an in-flight operation and suppresses late replies") {
        val lifecycle = ActivityLifecycleModel()
        val operationStarted = CountDownLatch(1)
        val releaseOperation = CountDownLatch(1)
        var replies = 0
        lifecycle.queueUiReply { replies += 1 }
        val operation = checkNotNull(lifecycle.submit("room") {
            operationStarted.countDown()
            check(releaseOperation.await(2, TimeUnit.SECONDS)) { "room operation was not released" }
        })
        await(operationStarted, "in-flight Room operation")
        val destroyExecutor = Executors.newSingleThreadExecutor()
        val destroy = destroyExecutor.submit { lifecycle.destroy() }
        await(lifecycle.destroyMarked, "Activity destroy marker")
        releaseOperation.countDown()
        check(await(operation, "in-flight Room operation") == true)
        await(destroy, "Activity destroy")
        destroyExecutor.shutdownNow()
        val operationFinished = lifecycle.events.indexOf("room:finish")
        val databaseClosed = lifecycle.events.indexOf("database:closed")
        check(operationFinished >= 0 && databaseClosed > operationFinished) { "database must close after the in-flight operation" }
        check(lifecycle.isDatabaseClosed())
        lifecycle.flushUiReplies()
        check(replies == 0) { "a queued UI reply must be suppressed after destroy" }
        check(lifecycle.submit("late") { error("destroyed Activity executed a late operation") } == null)
    }

    println(
        "{" +
            "\"passed\":true," +
            "\"cases\":${completed.size}," +
            "\"scope\":\"android-room-reminder-transition-pure-jvm\"," +
            "\"roomExecuted\":false," +
            "\"deviceVerified\":false," +
            "\"systemSchedulerVerified\":false" +
            "}",
    )
}
