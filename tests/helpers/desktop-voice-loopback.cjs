const electron = require('electron');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { createRealtimeVoiceHost } = require('../../apps/desktop/realtime-voice-host.cjs');

const { app, BrowserWindow } = electron;
const root = path.resolve(__dirname, '..', '..', '.cache');
const userData = process.env.NUANBAN_VOICE_SMOKE_USER_DATA;
const presentation = process.env.NUANBAN_VOICE_SMOKE_PRESENTATION === 'pet' ? 'pet' : 'window';
if (!userData || !path.isAbsolute(userData) || !path.resolve(userData).startsWith(root + path.sep)) throw new Error('Dedicated voice smoke cache path is required');
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('mute-audio');
process.env.NUANBAN_DESKTOP_API_BASE_URL = '';
process.env.NUANBAN_DESKTOP_API_TOKEN = '';
process.env.NUANBAN_REALTIME_API_KEY = '';
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const audit = { checks: 0, calls: 0, errors: [], states: [], transcripts: [], dialogs: [], receivedTrack: false, channelOpened: false, fakeDevice: true, realMicrophone: false, realProvider: false };
  const receiver = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' } });
  await receiver.loadURL('about:blank');
  const host = createRealtimeVoiceHost({ electron: { ...electron, BrowserWindow: presentation === 'pet' ? BrowserWindow : class HiddenVoiceWindow extends BrowserWindow { show() {} focus() {} } }, presentation,
    showDialog: async configuration => { audit.dialogs.push(configuration.title); return { response: 0 }; }, beforeStart: async () => {},
    onState: value => { audit.states.push(value.state); },
    onTranscript: value => { audit.transcripts.push(value); },
    client: { status: () => ({ configured: true }), check: async () => { audit.checks++; return { configured: true }; },
      connect: async (offer, { signal }) => {
        audit.calls++;
        if (signal.aborted) throw new Error('cancelled');
        const answer = await receiver.webContents.executeJavaScript(`(async () => {
          window.syntheticVoicePeer = new RTCPeerConnection();
          const peer = window.syntheticVoicePeer;
          peer.ontrack = event => { window.syntheticReceivedTrack = event.track.kind === 'audio'; };
          peer.ondatachannel = event => {
            window.syntheticVoiceChannel = event.channel;
            const send = () => {
              window.syntheticChannelOpened = true;
              event.channel.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'loopback-user', transcript: '本机合成音频回环' }));
              event.channel.send(JSON.stringify({ type: 'response.output_audio_transcript.done', item_id: 'loopback-assistant', transcript: '虚拟音轨连通，不代表真实供应验收。' }));
            };
            event.channel.onopen = send;
            if (event.channel.readyState === 'open') send();
          };
          await peer.setRemoteDescription({ type: 'offer', sdp: ${JSON.stringify(offer)} });
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          if (peer.iceGatheringState !== 'complete') await new Promise(resolve => {
            peer.onicegatheringstatechange = () => { if (peer.iceGatheringState === 'complete') resolve(); };
          });
          return peer.localDescription.sdp;
        })()`);
        if (signal.aborted) throw new Error('cancelled');
        return { answer };
      },
    } });
  global.__nuanbanVoiceLoopback = { host, receiver, audit };
  await host.open();
  app.on('before-quit', () => { host.dispose(); if (!receiver.isDestroyed()) receiver.destroy(); });
}).catch(error => { console.error(error.message); app.exit(1); });
