package org.nuanban.nativelab

private val completed = mutableListOf<String>()

private fun scenario(name: String, verify: () -> Unit) {
    verify()
    completed += name
}

private fun capturing(): Pair<LabSession, LabTicket> {
    val session = LabSession()
    val ticket = requireNotNull(session.beginConsent())
    check(session.resolveConsent(ticket, true))
    check(session.claimService(ticket))
    check(session.started(ticket))
    return session to ticket
}

fun main() {
    scenario("initial state has no permission or capture") {
        val snapshot = LabSession().snapshot()
        check(snapshot.phase == LabPhase.IDLE && snapshot.frames == 0L && !snapshot.cleanupPending)
    }
    scenario("consent begins once and creates a nonce") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(ticket.generation == 1L && ticket.nonce.length == 36)
        check(session.beginConsent() == null)
    }
    scenario("denial cannot start service") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(!session.resolveConsent(ticket, false))
        check(!session.mayStart(ticket) && !session.claimService(ticket))
        check(session.snapshot().stopReason == LabStopReason.CONSENT_DENIED)
    }
    scenario("wrong nonce cannot authorize") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(!session.resolveConsent(ticket.copy(nonce = "forged"), true))
        check(session.snapshot().phase == LabPhase.AWAITING_CONSENT)
    }
    scenario("wrong generation cannot authorize") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(!session.resolveConsent(ticket.copy(generation = ticket.generation + 1), true))
    }
    scenario("permission result is single use") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(session.resolveConsent(ticket, true))
        check(!session.resolveConsent(ticket, true))
    }
    scenario("capture requires foreground service ownership") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(!session.claimService(ticket) && !session.started(ticket))
        check(session.resolveConsent(ticket, true))
        check(!session.started(ticket))
        check(session.claimService(ticket))
        check(!session.claimService(ticket))
        check(session.started(ticket) && !session.started(ticket))
    }
    scenario("stop invalidates late permission result") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        session.stop(LabStopReason.USER)
        check(!session.resolveConsent(ticket, true))
        check(!session.claimService(ticket))
    }
    scenario("stop fences an already granted service start") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        check(session.resolveConsent(ticket, true))
        session.stop(LabStopReason.USER)
        check(!session.claimService(ticket))
    }
    scenario("frame callback always releases an active image") {
        val (session, ticket) = capturing()
        var releases = 0
        check(session.quarantineFrame(ticket) { releases += 1 })
        check(releases == 1 && session.snapshot().frames == 1L && session.snapshot().released == 1L)
    }
    scenario("late image after stop is released but not accepted") {
        val (session, ticket) = capturing()
        session.stop(LabStopReason.USER)
        var releases = 0
        check(!session.quarantineFrame(ticket) { releases += 1 })
        check(releases == 1 && session.snapshot().lateFrames == 1L && session.snapshot().frames == 0L)
    }
    scenario("release exception stops the active generation") {
        val (session, ticket) = capturing()
        check(!session.quarantineFrame(ticket) { error("synthetic release failure") })
        check(session.snapshot().stopReason == LabStopReason.RELEASE_FAILED)
        check(session.snapshot().releaseFailures == 1L && session.snapshot().released == 0L)
    }
    scenario("pending cleanup blocks a fresh system permission") {
        val (session, ticket) = capturing()
        session.stop(LabStopReason.USER)
        check(session.snapshot().cleanupPending && session.beginConsent() == null)
        session.serviceReleased(ticket, 0)
        check(!session.snapshot().cleanupPending && session.beginConsent() != null)
    }
    scenario("failed cleanup prevents restart until process reset") {
        val (session, ticket) = capturing()
        session.stop(LabStopReason.USER)
        session.serviceReleased(ticket, 1)
        check(session.snapshot().cleanupFailures == 1L && session.beginConsent() == null)
        session.serviceReleased(ticket, 0)
        check(session.beginConsent() == null)
    }
    scenario("stale cleanup cannot release current service") {
        val (session, ticket) = capturing()
        session.serviceReleased(ticket.copy(nonce = "stale"), 0)
        check(session.snapshot().cleanupPending && session.snapshot().phase == LabPhase.CAPTURING)
    }
    scenario("unexpected service release fences capture") {
        val (session, ticket) = capturing()
        session.serviceReleased(ticket, 0)
        check(session.snapshot().phase == LabPhase.STOPPED)
        check(session.snapshot().stopReason == LabStopReason.SERVICE_DESTROYED)
    }
    scenario("repeated stop preserves the first reason and generation") {
        val (session, _) = capturing()
        session.stop(LabStopReason.USER)
        val first = session.snapshot()
        session.stop(LabStopReason.SERVICE_DESTROYED)
        check(session.snapshot() == first)
    }
    scenario("new session requires fresh consent and a different ticket") {
        val (session, old) = capturing()
        session.stop(LabStopReason.USER)
        session.serviceReleased(old, 0)
        val next = requireNotNull(session.beginConsent())
        check(next.generation > old.generation && next.nonce != old.nonce)
        check(!session.resolveConsent(old, true) && !session.stop(old, LabStopReason.PROJECTION_REVOKED))
        check(session.snapshot().phase == LabPhase.AWAITING_CONSENT)
    }
    scenario("late old callback failure cannot stop a fresh generation") {
        val (session, old) = capturing()
        session.stop(LabStopReason.USER)
        session.serviceReleased(old, 0)
        val next = requireNotNull(session.beginConsent())
        check(session.resolveConsent(next, true) && session.claimService(next) && session.started(next))
        check(!session.quarantineFrame(old) { error("synthetic stale failure") })
        check(session.snapshot().phase == LabPhase.CAPTURING)
        check(session.quarantineFrame(next) {})
    }
    scenario("no frame is accepted while waiting for permission") {
        val session = LabSession()
        val ticket = requireNotNull(session.beginConsent())
        var releases = 0
        check(!session.quarantineFrame(ticket) { releases += 1 })
        check(releases == 1 && session.snapshot().phase == LabPhase.AWAITING_CONSENT)
    }
    scenario("one thousand frames remain counts only") {
        val (session, ticket) = capturing()
        repeat(1_000) { check(session.quarantineFrame(ticket) {}) }
        check(session.snapshot().frames == 1_000L && session.snapshot().released == 1_000L)
    }
    LabStopReason.entries.forEach { reason ->
        scenario("every stop reason fences frames: ${reason.name}") {
            val (session, ticket) = capturing()
            session.stop(reason)
            check(!session.quarantineFrame(ticket) {})
            check(session.snapshot().phase == LabPhase.STOPPED && session.snapshot().stopReason == reason)
        }
    }
    println("{\"passed\":true,\"cases\":${completed.size},\"scope\":\"kotlin-jvm-state-machine-only\",\"deviceVerified\":false,\"captureVerified\":false}")
}
