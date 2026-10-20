(() => {
  const host = window.captureHost;
  const configuration = host.configuration;
  const video = document.getElementById('capture-video');
  const canvas = document.getElementById('capture-canvas');
  let stream = null;
  let starting = false;
  let stopped = false;
  let capturing = false;
  let frameSize = null;
  let callbackId = null;
  let rejectFrame = null;

  function stopTracks() {
    if (callbackId !== null) video.cancelVideoFrameCallback(callbackId);
    callbackId = null;
    rejectFrame?.(new Error('capture_stopped'));
    rejectFrame = null;
    if (stream) for (const track of stream.getTracks()) { track.removeEventListener('ended', ended); track.stop(); }
    stream = null;
    video.pause();
    video.srcObject = null;
    canvas.width = 0;
    canvas.height = 0;
  }

  function fail(reason) {
    if (stopped) return;
    stopped = true;
    stopTracks();
    host.post('error', { reason });
  }

  function ended() {
    if (stopped) return;
    stopped = true;
    stopTracks();
    host.post('ended');
  }

  function stop() {
    stopped = true;
    stopTracks();
    host.post('stopped');
    return true;
  }

  function nextFrame() {
    return new Promise((resolve, reject) => {
      rejectFrame = reject;
      callbackId = video.requestVideoFrameCallback(() => {
        callbackId = null;
        rejectFrame = null;
        if (stopped || !stream || stream.getVideoTracks()[0]?.readyState !== 'live') reject(new Error('capture_stopped'));
        else resolve(Date.now());
      });
    });
  }

  async function start() {
    if (starting || stream || stopped) return false;
    starting = true;
    try {
      if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function' || typeof video.requestVideoFrameCallback !== 'function') { fail('capture_media_unavailable'); return false; }
      const acquired = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: { width: { ideal: configuration.width }, height: { ideal: configuration.height }, frameRate: { ideal: 2, max: 5 }, resizeMode: 'none' } });
      if (stopped) { for (const track of acquired.getTracks()) track.stop(); return false; }
      stream = acquired;
      if (stream.getAudioTracks().length !== 0 || stream.getVideoTracks().length !== 1 || stream.getTracks().length !== 1) { fail('capture_audio_forbidden'); return false; }
      const track = stream.getVideoTracks()[0];
      if (track.readyState !== 'live') { fail('capture_track_ended'); return false; }
      track.addEventListener('ended', ended, { once: true });
      try { await track.applyConstraints({ width: { ideal: configuration.width }, height: { ideal: configuration.height }, frameRate: { min: 2, ideal: 2, max: 5 }, resizeMode: 'none' }); }
      catch { fail('capture_refresh_unavailable'); return false; }
      if (stopped) return false;
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await nextFrame();
      if (stopped) return false;
      if (!Number.isSafeInteger(video.videoWidth) || !Number.isSafeInteger(video.videoHeight) || video.videoWidth < configuration.minWidth || video.videoWidth > configuration.maxWidth || video.videoHeight < configuration.minHeight || video.videoHeight > configuration.maxHeight || video.videoWidth > configuration.maxDimension || video.videoHeight > configuration.maxDimension || video.videoWidth * video.videoHeight > configuration.maxPixels) { fail('capture_dimensions_unproven'); return false; }
      frameSize = Object.freeze({ width: video.videoWidth, height: video.videoHeight });
      host.post('ready', { width: video.videoWidth, height: video.videoHeight });
      return true;
    } catch (error) {
      fail(error?.name === 'NotAllowedError' ? 'capture_permission_denied' : 'capture_media_failed');
      return false;
    } finally { starting = false; }
  }

  async function capture(requestId) {
    if (stopped || !stream) return;
    if (capturing) { fail('capture_busy'); return; }
    capturing = true;
    let bytes;
    try {
      const capturedAt = await nextFrame();
      if (stopped) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!frameSize || width !== frameSize.width || height !== frameSize.height || width * height > configuration.maxPixels) { fail('capture_dimensions_unproven'); return; }
      canvas.width = width;
      canvas.height = height;
      const drawing = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!drawing) { fail('capture_canvas_unavailable'); return; }
      drawing.drawImage(video, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (stopped) return;
      if (!blob || blob.size < 33 || blob.size > configuration.maxPngBytes) { fail('capture_png_limit'); return; }
      bytes = await blob.arrayBuffer();
      if (!stopped) host.post('frame', { requestId, capturedAt, width, height, png: bytes });
    } catch {
      fail('capture_frame_failed');
    } finally {
      if (bytes) new Uint8Array(bytes).fill(0);
      canvas.width = 0;
      canvas.height = 0;
      capturing = false;
    }
  }

  host.onCommand(command => { if (command.kind === 'stop') stop(); else capture(command.requestId); });
  window.addEventListener('pagehide', stop, { once: true });
  window.addEventListener('unhandledrejection', event => { event.preventDefault(); fail('capture_worker_failed'); });
  window.nuanbanCapture = Object.freeze({ start, stop });
})();
