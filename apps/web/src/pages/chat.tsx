import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ImagePlus, Mic, Monitor, RotateCcw, Send, Square } from 'lucide-react';
import { ServiceFailure, readConversation } from '@nuanban/application';
import { detectTextRisk } from '@nuanban/domain';
import { services } from '../composition';
import { announce, useApp } from '../store';
import { Badge, Modal, PageTitle, Pet, useSpeech } from '../components';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  state: 'streaming' | 'completed' | 'stopped' | 'failed';
}

export function ChatPage() {
  const [search] = useSearchParams();
  const [input, setInput] = useState(search.get('q') ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const [failure, setFailure] = useState<ServiceFailure | null>(null);
  const [media, setMedia] = useState<{ url: string; name: string } | null>(null);
  const [inputModal, setInputModal] = useState<'voice' | 'screen' | null>(null);
  const [microphoneState, setMicrophoneState] = useState<'idle' | 'requesting' | 'active'>('idle');
  const microphone = useRef<MediaStream | null>(null);
  const mediaGeneration = useRef(0);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const speech = useSpeech();
  const preferences = useApp(state => state.snapshot!.preferences);

  function stopMedia() {
    mediaGeneration.current++;
    microphone.current?.getTracks().forEach(track => track.stop());
    microphone.current = null;
    setMicrophoneState('idle');
    setInputModal(null);
  }

  function stop() {
    stopMedia();
    generation.current++;
    controller.current?.abort();
    inFlight.current = false;
    speech.stop();
    setBusy(false);
    setCaption('已停止，本次讲解不会自动恢复。');
    setMessages(previous => previous.map(message => message.state === 'streaming'
      ? { ...message, text: message.text || '讲解已停止。', state: 'stopped' } : message));
  }

  useEffect(() => {
    window.addEventListener('nuanban:stop', stop);
    return () => {
      window.removeEventListener('nuanban:stop', stop);
      generation.current++;
      controller.current?.abort();
      mediaGeneration.current++;
      microphone.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: preferences.reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
  }, [messages, preferences.reducedMotion]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || inFlight.current) return;
    stop();
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setFailure(null);
    setInput('');
    const answerId = crypto.randomUUID();
    const risk = detectTextRisk(question);
    if (risk === 'private' || risk === 'transaction') {
      const warning = risk === 'transaction'
        ? '这涉及支付、转账或验证码，先停下来。暖伴不会指导这类操作，请用熟悉的电话号码与家人确认。'
        : '这里可能涉及密码或私人信息，先不要发送。请离开敏感页面后重新提问。';
      setMessages(previous => [...previous,
        { id: crypto.randomUUID(), role: 'user', text: '涉及敏感内容的问题（已在本机拦截，未发送）', state: 'completed' },
        { id: answerId, role: 'assistant', text: warning, state: 'completed' },
      ]);
      setCaption(warning);
      speech.speak(warning);
      return;
    }
    setBusy(true);
    inFlight.current = true;
    setCaption('暖伴正在整理讲解…');
    setMessages(previous => [...previous,
      { id: crypto.randomUUID(), role: 'user', text: question, state: 'completed' },
      { id: answerId, role: 'assistant', text: '', state: 'streaming' },
    ]);
    try {
      const answer = await readConversation(services.conversation, question, abort.signal, (segment, fullAnswer) => {
        if (current !== generation.current || abort.signal.aborted) return;
        setCaption(segment);
        setMessages(previous => previous.map(message => message.id === answerId ? { ...message, text: fullAnswer } : message));
      });
      if (current !== generation.current || abort.signal.aborted) return;
      setMessages(previous => previous.map(message => message.id === answerId ? { ...message, state: 'completed' } : message));
      setCaption(answer);
      speech.speak(answer);
      if (risk === 'safe' && /不会|怎么|忘|教|字太小/.test(question)) {
        try { await useApp.getState().addNote(question, answer, 'conversation'); }
        catch { announce('讲解已完成，但学习笔记未保存，请查看保存错误提示。'); }
      }
    } catch (error) {
      if (current !== generation.current || abort.signal.aborted) return;
      speech.stop();
      const problem = error instanceof ServiceFailure ? error : new ServiceFailure('PROVIDER_UNAVAILABLE', '讲解暂时不可用。问题已保留，请稍后重试或做本机练习。', true);
      setFailure(problem);
      setCaption(problem.message);
      setInput(previous => previous || question);
      setMessages(previous => previous.map(message => message.id === answerId
        ? { ...message, text: message.text || problem.message, state: 'failed' } : message));
    } finally {
      if (current === generation.current) { inFlight.current = false; setBusy(false); }
    }
  }

  async function checkMicrophone() {
    if (microphoneState !== 'idle') return;
    const current = ++mediaGeneration.current;
    setMicrophoneState('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('不支持');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== mediaGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
      microphone.current = stream;
      setMicrophoneState('active');
      announce('麦克风权限可用，不录音、不上传。关闭窗口立即停止。');
    } catch {
      if (current !== mediaGeneration.current) return;
      setMicrophoneState('idle');
      announce('麦克风暂不可用或未获许可，可以继续使用文字输入。');
    }
  }

  const lastAnswer = [...messages].reverse().find(message => message.role === 'assistant' && message.state === 'completed');
  function selectImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { announce('请选择小于 10MB 的图片。'); return; }
    setMedia({ url: URL.createObjectURL(file), name: file.name });
    announce('图片仅本机预览，不上传；真实图片识别未接入。');
  }

  return <>
    <PageTitle eyebrow="有什么想学的，慢慢说" title="和暖伴说说" subtitle="语音、文字、图片都可以作为入口。当前只演示文字讲解和本机图片预览。" />
    <div className="chat-layout">
      <section className="chat-panel" aria-label="讲解对话">
        <div className="chat-panel-head"><div><span className="online-dot" /><strong>暖暖在这里</strong></div><Badge>固定场景演示 · 不是实时 AI</Badge></div>
        <div className="messages" aria-live="off">
          {!messages.length && <div className="chat-welcome"><Pet kind={preferences.pet} color={preferences.petColor} /><h2>不用想好怎么问，<br />说说你遇到的难处就好。</h2><div className="suggestions">{['手机上的字太小，怎么调大？', '怎么给家人拍一张照片？', '我忘了上次学过的步骤'].map(text => <button key={text} onClick={() => setInput(text)}>{text}<ArrowUpRight size={17} /></button>)}</div></div>}
          {messages.map(message => <div className={'message ' + message.role} key={message.id} data-state={message.state}><span className="message-avatar">{message.role === 'user' ? '我' : '暖'}</span><div><small>{message.role === 'user' ? '你' : '暖伴 · 演示讲解'}</small><p>{message.text || '我在想，一会儿就好…'}</p>{message.state === 'failed' && <small className="message-state">讲解未完成 · 不生成学习笔记</small>}{message.state === 'stopped' && <small className="message-state">已停止 · 不会自动恢复</small>}</div></div>)}
          <div ref={bottom} />
        </div>
        {failure && <section className="conversation-failure" role="alert" aria-label="讲解未完成"><strong>这次讲解还没完成</strong><p>{failure.message}</p><div className="button-row">{failure.retryable && <button className="button secondary" onClick={() => void submit()} disabled={busy || !input.trim()}>重试这个问题</button>}<Link className="button plain" to="/overlay/guide">先做本机练习</Link><Link className="button plain" to="/family">找家人帮忙</Link></div></section>}
        {media && <div className="media-preview"><img src={media.url} alt="本机选择的图片预览" /><div><strong>{media.name}</strong><p>仅在本机预览，不能识别内容</p><button className="text-button" onClick={() => setMedia(null)}>移除图片</button></div></div>}
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="question">想问暖伴的问题</label>
          <textarea id="question" rows={2} value={input} onChange={event => setInput(event.target.value)} placeholder="比如：手机上的字太小，怎么调大？" maxLength={1500} />
          <div className="composer-bottom"><div><button type="button" className="tool-button" onClick={() => setInputModal('voice')}><Mic size={19} />语音</button><button type="button" className="tool-button" onClick={() => fileInput.current?.click()}><ImagePlus size={19} />选图片</button><button type="button" className="tool-button" onClick={() => setInputModal('screen')}><Monitor size={19} />屏幕</button></div><button className="button primary send-button" disabled={busy || !input.trim()}><Send size={19} />{busy ? '讲解中' : '发送'}</button></div>
        </form>
        <input ref={fileInput} type="file" accept="image/*" capture={search.get('input') === 'image' ? 'environment' : undefined} hidden onChange={event => { selectImage(event.target.files?.[0]); event.target.value = ''; }} />
      </section>
      <aside className="chat-side"><section className="panel caption-panel"><span className="eyebrow">大字字幕</span><p className="caption" aria-live="polite" aria-atomic="true" style={{ fontSize: preferences.captionSize }}>{caption || '暖伴的讲解，会在这里清楚地显示。'}</p>{speech.status === 'unavailable' && <p className="small-note" role="status">系统没有可用的语音播放，已保留大字字幕。</p>}{speech.status === 'error' && <p className="small-note" role="status">语音播放失败，字幕仍然可读。</p>}<div className="stack"><button className="button secondary" disabled={busy || !lastAnswer || !!failure} onClick={() => { if (lastAnswer) { setCaption(lastAnswer.text); speech.speak(lastAnswer.text); } }}><RotateCcw size={19} />再讲一遍</button><button className="button plain" onClick={stop}><Square size={16} />停止讲解</button></div></section><Link className="guide-invitation" to="/overlay/guide">想亲手试一试？<br /><strong>打开手把手练习 <ArrowRight size={18} /></strong></Link><div className="small-note">画面、音频和图片不会上传；真实多模态服务尚未接入。</div></aside>
    </div>
    <Modal open={inputModal !== null} onOpenChange={open => { if (!open) stopMedia(); }} title={inputModal === 'voice' ? '语音输入能力说明' : '屏幕输入能力说明'} description="权限由系统弹窗决定，演示不伪造授权。">
      {inputModal === 'voice' ? <><p>可以检查浏览器麦克风权限；音频不录制、不上传。语音识别供应尚未接入，请改用文字输入。</p><button className="button secondary" onClick={() => void checkMicrophone()} disabled={microphoneState !== 'idle'}><Mic size={20} />{microphoneState === 'requesting' ? '等待系统权限' : microphoneState === 'active' ? '麦克风检查中' : '检查麦克风权限'}</button></> : <><p>浏览器不能提供跨应用教学浮层。原生隐私检测尚未验证，因此不会开启真实屏幕采集。</p><Link className="button primary" to="/overlay/guide" onClick={stopMedia}>进入应用内练习 <ArrowRight size={20} /></Link></>}
    </Modal>
  </>;
}
