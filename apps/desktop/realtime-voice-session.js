(function expose(root) {
  'use strict';

  function createRealtimeVoiceSession(options) {
    let generation = 0;
    let peer = null;
    let channel = null;
    let microphone = null;
    let remote = null;
    let timer = null;
    let durationTimer = null;
    let muted = false;
    let speaking = false;
    let active = false;
    const transcripts = new Map();
    const setTimer = options.setTimeout ?? setTimeout;
    const clearTimer = options.clearTimeout ?? clearTimeout;
    const report = state => { if (active) options.onState(muted ? 'muted' : state); };
    const stopTracks = stream => { for (const track of stream?.getTracks() ?? []) track.stop(); };

    function stop() {
      active = false;
      generation += 1;
      clearTimer(timer);
      clearTimer(durationTimer);
      timer = null;
      durationTimer = null;
      if (microphone) for (const track of microphone.getTracks()) track.onended = null;
      stopTracks(microphone);
      stopTracks(remote);
      microphone = null;
      remote = null;
      if (channel) {
        channel.onopen = null;
        channel.onmessage = null;
        channel.onclose = null;
        channel.onerror = null;
        channel.close();
        channel = null;
      }
      if (peer) {
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        peer.close();
        peer = null;
      }
      options.audio.pause();
      options.audio.srcObject = null;
      transcripts.clear();
    }

    function fail() {
      if (!active) return;
      stop();
      options.onError();
    }

    function transcript(role, identifier, value, append) {
      if (typeof identifier !== 'string' || identifier.length > 200 || typeof value !== 'string' || value.length > 6000) return;
      const key = role + ':' + identifier;
      const text = (append ? transcripts.get(key) ?? '' : '') + value;
      transcripts.set(key, text.slice(-6000));
      while (transcripts.size > 40) transcripts.delete(transcripts.keys().next().value);
      options.onTranscript({ id: key, role, text: text.slice(-6000) });
    }

    function receive(data) {
      if (!active || typeof data !== 'string' || data.length > 128_000) { fail(); return; }
      let event;
      try { event = JSON.parse(data); } catch { fail(); return; }
      if (!event || typeof event.type !== 'string') { fail(); return; }
      switch (event.type) {
        case 'input_audio_buffer.speech_started': speaking = false; report('listening'); break;
        case 'input_audio_buffer.speech_stopped': report('thinking'); break;
        case 'response.created': report('thinking'); break;
        case 'output_audio_buffer.started': speaking = true; report('speaking'); break;
        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared': speaking = false; report('listening'); break;
        case 'conversation.item.input_audio_transcription.completed': transcript('user', event.item_id, event.transcript, false); break;
        case 'response.output_audio_transcript.delta': transcript('assistant', event.item_id, event.delta, true); break;
        case 'response.output_audio_transcript.done': transcript('assistant', event.item_id, event.transcript, false); break;
        case 'response.done': if (event.response?.status === 'failed') fail(); break;
        case 'error': if (event.error?.code !== 'response_cancel_not_active') fail(); break;
      }
    }

    async function start() {
      if (active) return;
      active = true;
      muted = false;
      speaking = false;
      const current = ++generation;
      const valid = () => active && current === generation;
      report('connecting');
      timer = setTimer(fail, 30_000);
      durationTimer = setTimer(() => { if (valid()) { stop(); options.onEnd(); } }, 15 * 60_000);
      try {
        const acquired = await options.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (!valid()) { stopTracks(acquired); return; }
        microphone = acquired;
        const tracks = microphone.getAudioTracks();
        if (tracks.length !== 1 || microphone.getVideoTracks().length !== 0) throw new Error('audio_only_required');
        tracks[0].onended = fail;
        peer = options.createPeerConnection();
        const connection = peer;
        connection.ontrack = event => {
          if (!valid() || event.track.kind !== 'audio') { event.track.stop(); if (valid()) fail(); return; }
          remote = event.streams[0] ?? options.createMediaStream([event.track]);
          options.audio.srcObject = remote;
          void options.audio.play().catch(() => { if (valid()) fail(); });
        };
        connection.onconnectionstatechange = () => {
          if (valid() && ['failed', 'closed', 'disconnected'].includes(connection.connectionState)) fail();
        };
        for (const track of tracks) connection.addTrack(track, microphone);
        channel = connection.createDataChannel('oai-events');
        channel.onopen = () => { if (valid()) { clearTimer(timer); timer = null; report('listening'); } };
        channel.onmessage = event => { if (valid()) receive(event.data); };
        channel.onclose = fail;
        channel.onerror = fail;
        const offer = await connection.createOffer();
        if (!valid()) return;
        await connection.setLocalDescription(offer);
        if (!valid()) return;
        const result = await options.connect(connection.localDescription.sdp);
        if (!valid()) return;
        await connection.setRemoteDescription({ type: 'answer', sdp: result.answer });
      } catch { if (valid()) fail(); }
    }

    function interrupt() {
      if (!active || !speaking || channel?.readyState !== 'open') return false;
      try {
        channel.send(JSON.stringify({ type: 'response.cancel' }));
        channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
        speaking = false;
        report('listening');
        return true;
      } catch { fail(); return false; }
    }

    function setMuted(value) {
      if (!active || typeof value !== 'boolean') return false;
      muted = value;
      for (const track of microphone?.getAudioTracks() ?? []) track.enabled = !muted;
      if (muted && channel?.readyState === 'open') {
        try { channel.send(JSON.stringify({ type: 'input_audio_buffer.clear' })); } catch { fail(); return false; }
      }
      report(speaking ? 'speaking' : 'listening');
      return muted;
    }

    return { start, stop, interrupt, setMuted };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createRealtimeVoiceSession };
  else root.NuanbanRealtimeVoice = Object.freeze({ createRealtimeVoiceSession });
})(globalThis);
